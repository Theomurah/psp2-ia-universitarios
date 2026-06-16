/**
 * Edge Function: generate-system-prompt (T32).
 *
 * Lê profile + últimos N documentos do aluno e gera (via merge determinístico,
 * sem LLM) o system prompt personalizado. Persiste como nova versão em
 * `user_system_prompts` e desativa a anterior. Se nada relevante mudou
 * (mesmo semester_snapshot), reusa o ativo.
 *
 * Sem chamada a LLM — função puramente de orquestração + DB.
 *
 * Hardening:
 * - JWT obrigatório
 * - Rate limit (10/min — operação eventual, pode regenerar)
 * - Erros não vazam mensagem interna
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCorsPreflight } from '../_shared/cors.ts';
import { createAuthClient } from '../_shared/supabase-client.ts';
import { jsonResponse, errorResponse } from '../_shared/http.ts';
import { checkRateLimit, clientFingerprint } from '../_shared/rate-limit.ts';
import { createLogger } from '../_shared/log.ts';
import {
  renderSystemPrompt,
  buildSemesterSnapshot,
  type RenderSystemPromptInput,
} from '../_shared/system-prompt.ts';

const RECENT_DOCS_LIMIT = 30;
const log = createLogger('generate-system-prompt');

serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;

  try {
    // 1) Autentica usuário
    const auth = createAuthClient(req);
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) {
      return errorResponse(req, 'unauthorized', 401);
    }

    // 2) Rate limit
    const fp = clientFingerprint(req, user.id);
    const rl = checkRateLimit(`gen-prompt:${fp}`, { max: 10, windowSec: 60 });
    if (!rl.ok) {
      log.warn('rate_limited', { user_id: user.id, endpoint: 'gen-prompt', window_sec: 60 });
      return errorResponse(req, 'rate_limited', 429);
    }

    // Parâmetro opcional: force=true → regenera mesmo se snapshot bater
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === 'true';

    // Todas as operações abaixo são em dados do próprio usuário e estão
    // cobertas pelas policies de 0006 (profiles_select_own, documents_select_own,
    // user_prompts_*_own, generated_select_via_doc) — usamos o client
    // AUTENTICADO pra manter a RLS como rede de segurança: um `.eq('user_id')`
    // esquecido falha fechado em vez de vazar dados de outro usuário.
    // Origem: auditoria 2026-06-10 (EDGE-HANDLERS-02).
    // 3) Carrega profile
    const { data: profile, error: profErr } = await auth
      .from('profiles')
      .select('full_name, curso, semestre_atual, materias')
      .eq('id', user.id)
      .single();
    if (profErr || !profile) {
      return errorResponse(req, 'profile_not_found', 404);
    }

    // 4) Carrega últimos N documentos processados
    const { data: docs, error: docsErr } = await auth
      .from('documents')
      .select('materia_code, tipo, titulo, identificador, data_doc')
      .eq('user_id', user.id)
      .not('processed_at', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(RECENT_DOCS_LIMIT);
    if (docsErr) {
      log.error('list_docs_failed', { user_id: user.id, ...log.fromError(docsErr) });
      return errorResponse(req, 'internal_error', 500);
    }

    // 5) Tópicos por matéria — agregados dos generated_content do tipo 'synthesized'
    const topicosPorMateria = await aggregateTopicos(auth, user.id);

    // 6) Monta input + renderiza
    const input: RenderSystemPromptInput = {
      full_name: profile.full_name ?? 'Aluno(a)',
      curso: profile.curso ?? '',
      semestre: profile.semestre_atual ?? '',
      materias: profile.materias ?? [],
      recent_documents: docs ?? [],
      topicos_por_materia: topicosPorMateria,
    };
    const promptText = renderSystemPrompt(input);
    const snapshot = buildSemesterSnapshot(input);

    // 7) Se já existe ativo com o mesmo snapshot, reusa (sem nova versão)
    const { data: existing } = await auth
      .from('user_system_prompts')
      .select('id, prompt_text, version, semester_snapshot, source_documents, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!force && existing && existing.semester_snapshot === snapshot) {
      log.info('prompt_reused', { user_id: user.id, version: existing.version, doc_count: docs?.length ?? 0 });
      return jsonResponse(req, {
        ok: true,
        regenerated: false,
        prompt: existing,
      });
    }

    // 8) Desativa o ativo atual e cria novo
    if (existing) {
      await auth
        .from('user_system_prompts')
        .update({ is_active: false })
        .eq('id', existing.id);
    }

    const sourceDocIds: string[] = [];
    if (docs && docs.length > 0) {
      const { data: idRows } = await auth
        .from('documents')
        .select('id')
        .eq('user_id', user.id)
        .not('processed_at', 'is', null)
        .order('processed_at', { ascending: false })
        .limit(RECENT_DOCS_LIMIT);
      if (idRows) sourceDocIds.push(...idRows.map((r) => r.id));
    }

    const nextVersion = (existing?.version ?? 0) + 1;
    const { data: inserted, error: insertErr } = await auth
      .from('user_system_prompts')
      .insert({
        user_id: user.id,
        prompt_text: promptText,
        semester_snapshot: snapshot,
        source_documents: sourceDocIds,
        version: nextVersion,
        is_active: true,
      })
      .select()
      .single();
    if (insertErr || !inserted) {
      log.error('insert_failed', { user_id: user.id, version: nextVersion, ...log.fromError(insertErr) });
      return errorResponse(req, 'internal_error', 500);
    }

    log.info('prompt_regenerated', {
      user_id: user.id,
      version: nextVersion,
      forced: force,
      source_doc_count: sourceDocIds.length,
    });

    return jsonResponse(req, {
      ok: true,
      regenerated: true,
      prompt: inserted,
    });
  } catch (err) {
    log.error('unhandled', log.fromError(err));
    return errorResponse(req, 'internal_error', 500);
  }
});

// =============================================================
async function aggregateTopicos(
  // Client autenticado (RLS) — generated_select_via_doc + documents_select_own
  // garantem que só linhas do próprio usuário são lidas.
  // deno-lint-ignore no-explicit-any
  client: any,
  userId: string,
): Promise<Record<string, string[]>> {
  const { data, error } = await client
    .from('generated_content')
    .select('metadata, documents!inner(materia_code, user_id)')
    .eq('type', 'synthesized')
    .eq('documents.user_id', userId);

  if (error || !data) return {};

  const acc: Record<string, Set<string>> = {};
  for (const row of data as Array<{ metadata: { topicos_extraidos?: string[] }; documents: { materia_code: string } }>) {
    const materia = row.documents?.materia_code ?? 'OUTRO';
    const topicos = row.metadata?.topicos_extraidos ?? [];
    if (!acc[materia]) acc[materia] = new Set();
    for (const t of topicos) acc[materia].add(t);
  }

  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(acc)) {
    out[k] = Array.from(v).slice(0, 10);
  }
  return out;
}
