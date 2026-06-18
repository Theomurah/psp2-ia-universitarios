/**
 * Edge Function: process-document
 *
 * Recebe um job_id, baixa o arquivo do Storage, e roda o pipeline completo
 * em background via EdgeRuntime.waitUntil(). Atualiza job.status + job_events
 * a cada passo. Frontend escuta via Realtime.
 *
 * Cobre:
 *   T12 — endpoint que dispara processamento
 *   T14 — fila assíncrona via waitUntil (sem pg_cron)
 *   T16 — tratamento de erros com retry e status: failed
 *
 * Hardening:
 * - Autorização obrigatória: Bearer = SERVICE_ROLE_KEY (chamada interna)
 *   OU JWT do user cujo id == job.user_id
 *   OU JWT de admin (is_admin via profiles) — usado pelo requeue do /admin
 *   (RPC admin_requeue_job → invoke process-document), que fecha o ciclo de
 *   reprocessamento de jobs presos. Origem: auditoria 2026-06-10.
 * - Sem essa validação, qualquer um com UUID podia disparar processamento.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://esm.sh/zod@3.23.8';
import { handleCorsPreflight } from '../_shared/cors.ts';
import { createAuthClient, createServiceClient } from '../_shared/supabase-client.ts';
import {
  jsonResponse,
  errorResponse,
  requireContentType,
  requireMaxPayload,
  parseJsonBody,
} from '../_shared/http.ts';
import { parseDocument } from '../_shared/parsers.ts';
import { getModelConfig, getModelParams } from '../_shared/models.ts';
import { classify, synthesize, synthesizeChunked, compress } from '../_shared/pipeline.ts';
import { CHUNK_THRESHOLD } from '../_shared/chunking.ts';
import {
  ensureFolderPath,
  uploadMarkdown,
  updateMarkdown,
  ensureFreshToken,
  DriveAuthExpiredError,
  DriveError,
  type DriveTokenPair,
} from '../_shared/drive/index.ts';
import {
  validateStructural,
  validateClassification,
  validateQuantitative,
  validateSemantic,
  validateJudge,
  decideVerdict,
} from '../_shared/validation.ts';
import { buildFilenameFinal, buildDriveFolderPath } from '../../../packages/shared/src/schemas.ts';
import { createLogger } from '../_shared/log.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import type { PipelineStep } from '../../../packages/shared/src/constants.ts';

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const MAX_BODY_BYTES = 4 * 1024;
const log = createLogger('process-document');

// Schema do body — UUID estrito evita que UUIDs malformados quebrem em .eq('id')
// com erro Postgres 22P02 vazando pelo console.error como 'internal_error'.
// Origem: auditoria 2026-05-26 (Agente 1, achado B1).
const ProcessDocumentBodySchema = z.object({
  job_id: z.string().uuid(),
});

serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;

  try {
    const ctErr = requireContentType(req, 'application/json');
    if (ctErr) return ctErr;
    const sizeErr = requireMaxPayload(req, MAX_BODY_BYTES);
    if (sizeErr) return sizeErr;

    const [body, parseErr] = await parseJsonBody<unknown>(req);
    if (parseErr) return parseErr;
    const parsed = ProcessDocumentBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(req, 'invalid_body', 400, 'job_id deve ser um UUID válido.');
    }
    const { job_id } = parsed.data;

    // Autorização: precisa ser service_role (chamada interna do ingest-document)
    // OU JWT de usuário dono do job OU JWT de admin (requeue via /admin).
    // Sem isso, qualquer um com job_id podia disparar processamento.
    const auth = await authorizeProcessDocument(req, job_id);
    if (!auth.ok) {
      return errorResponse(req, auth.code, auth.status);
    }

    // Rate limit só para chamadas de usuário/admin (re-disparo manual). As
    // chamadas internas service_role (ingest → process) são parte do fluxo
    // normal e não passam por aqui. Reprocessar é caro (pipeline LLM completo):
    // 10/min por usuário corta loop que queimaria quota OpenRouter.
    // Origem: auditoria 2026-05-28 (Segurança, achado A1).
    if (auth.via !== 'service') {
      const rl = checkRateLimit(`process:${auth.userId}`, { max: 10, windowSec: 60 });
      if (!rl.ok) {
        log.warn('rate_limited', { user_id: auth.userId, endpoint: 'process-document', window_sec: 60 });
        return errorResponse(req, 'rate_limited', 429);
      }
    }

    // Responde 202 já e segue processando em background
    EdgeRuntime.waitUntil(runPipeline(job_id));

    return jsonResponse(req, { status: 'processing' }, 202);
  } catch (err) {
    log.error('init_unhandled', log.fromError(err));
    return errorResponse(req, 'internal_error', 500);
  }
});

// =============================================================
// Autorização: service_role bearer OU JWT do dono do job OU JWT de admin
// =============================================================
async function authorizeProcessDocument(
  req: Request,
  jobId: string,
): Promise<
  | { ok: true; via: 'service' }
  | { ok: true; via: 'user' | 'admin'; userId: string }
  | { ok: false; code: string; status: number }
> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, code: 'unauthorized', status: 401 };
  }
  const token = authHeader.slice(7).trim();

  // Caso 1: chamada interna com service_role (ingest-document → process-document)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) {
    return { ok: true, via: 'service' };
  }

  // Caso 2: JWT do usuário — precisa ser dono do job
  const client = createAuthClient(req);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    return { ok: false, code: 'unauthorized', status: 401 };
  }

  // service_role necessário aqui: o requester ainda não foi confirmado como
  // dono do job — a leitura de jobs.user_id precisa bypassar RLS pra conseguir
  // distinguir 404 (job não existe) de 403 (job de outro usuário).
  const service = createServiceClient();
  const { data: job, error: jobErr } = await service
    .from('jobs')
    .select('user_id')
    .eq('id', jobId)
    .maybeSingle();
  if (jobErr) {
    log.error('authorize_read_job_failed', { job_id: jobId, ...log.fromError(jobErr) });
    return { ok: false, code: 'internal_error', status: 500 };
  }
  if (!job) {
    return { ok: false, code: 'not_found', status: 404 };
  }
  if (job.user_id !== user.id) {
    // Caso 3: JWT de admin — fecha o ciclo do requeue (/admin → RPC
    // admin_requeue_job → invoke process-document). Leitura via service
    // client direto em profiles.is_admin: a RPC public.is_admin() depende
    // de auth.uid(), que não existe no contexto do service client.
    // Origem: auditoria 2026-06-10 (requeue deixava job morto em pending).
    const { data: profile, error: profErr } = await service
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (profErr) {
      log.error('authorize_read_profile_failed', { job_id: jobId, ...log.fromError(profErr) });
      return { ok: false, code: 'internal_error', status: 500 };
    }
    if (profile?.is_admin === true) {
      log.info('authorize_admin_dispatch', { job_id: jobId, admin_id: user.id });
      return { ok: true, via: 'admin', userId: user.id };
    }
    // Sinal de segurança: usuário autenticado tentou disparar job de outro.
    log.warn('authorize_owner_mismatch', { job_id: jobId, requester_id: user.id });
    return { ok: false, code: 'forbidden', status: 403 };
  }
  return { ok: true, via: 'user', userId: user.id };
}

// =============================================================
// Pipeline principal — roda em background via waitUntil
// =============================================================
// Máximo de tentativas por job — alinhado ao watchdog planejado no roadmap
// (CLAUDE.md: `attempt_count < 2`). A tabela jobs não tem coluna max_retries.
const MAX_ATTEMPTS = 2;

async function runPipeline(jobId: string): Promise<void> {
  // service_role necessário em todo o runPipeline: roda em background via
  // EdgeRuntime.waitUntil SEM JWT de usuário no contexto (inclusive quando o
  // gatilho é a chamada interna ingest → process). RLS via authClient não
  // funcionaria aqui. Não trocar por createAuthClient.
  const service = createServiceClient();

  // Claim atômico: tenta transicionar pending → processing.
  // Também aceita jobs `failed` com tentativas restantes — re-disparo manual
  // do dono (via === 'user') era no-op antes: nada devolvia o job pra pending
  // e o failed ficava irrecuperável sem SQL manual. error_reason/completed_at
  // são resetados no MESMO update pra não vazar estado da execução anterior.
  // Se afetar 0 linhas, outro worker já está rodando, o job já terminou ou
  // esgotou as tentativas — retornamos early, evitando dupla cobrança de LLM.
  // Origem: auditoria 2026-05-26 (Agente 6 — Banco, achado D1; cobre
  // também Agente 1 — A1 sobre `started_at` ser sobrescrito) e
  // auditoria 2026-06-10 (EDGE-HANDLERS-05).
  const startedAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await service
    .from('jobs')
    .update({
      status: 'processing',
      started_at: startedAt,
      current_step: 'parse',
      progress_percent: 0,
      error_reason: null,
      completed_at: null,
    })
    .eq('id', jobId)
    .or(`status.eq.pending,and(status.eq.failed,attempt_count.lt.${MAX_ATTEMPTS})`)
    .select('id');

  if (claimErr) {
    log.error('claim_failed', { job_id: jobId, ...log.fromError(claimErr) });
    return;
  }
  if (!claimed || claimed.length === 0) {
    // Outro worker já claim'ou, o job está em estado terminal não-retryável
    // ou esgotou as tentativas — sai sem custo.
    log.warn('job_claim_skipped', { job_id: jobId, reason: 'already_claimed_or_not_claimable' });
    return;
  }

  log.info('pipeline_started', { job_id: jobId });

  // Helpers de telemetria/erro
  // Importante: setStep NUNCA mais sobrescreve started_at (gravado uma vez no claim).
  const setStep = async (step: PipelineStep, progress: number) => {
    await service.from('jobs').update({
      status: 'processing',
      current_step: step,
      progress_percent: progress,
    }).eq('id', jobId);
  };

  const logEvent = async (
    step: string,
    event_type: 'start' | 'success' | 'retry' | 'warning' | 'error',
    extra: Partial<{
      message: string; duration_ms: number; llm_model: string;
      tokens_input: number; tokens_output: number; cost_usd: number;
    }> = {},
  ) => {
    await service.from('job_events').insert({ job_id: jobId, step, event_type, ...extra });
  };

  // Callback de retry pra propagar pra callLLMWithRetry — registra cada
  // backoff transitório em job_events (antes ficavam invisíveis, com a
  // duração da chamada inflada e sem rastro).
  // Origem: auditoria 2026-05-26 (Agente 4 — Observabilidade, A11).
  const makeRetryHook = (step: string) => async (info: {
    attempt: number; maxAttempts: number; status: number; delayMs: number; message: string; model: string;
  }) => {
    await logEvent(step, 'retry', {
      message: `retry ${info.attempt}/${info.maxAttempts} (HTTP ${info.status}, espera ${info.delayMs}ms): ${info.message}`,
      llm_model: info.model,
      duration_ms: info.delayMs,
    });
  };

  const fail = async (reason: string, step: string) => {
    await logEvent(step, 'error', { message: reason });
    // Incrementa attempt_count para que dashboards e o futuro watchdog
    // pg_cron consigam diferenciar "falha na 1ª tentativa" de "falha
    // crônica após N retentativas". O retry automático em si fica pro
    // batch B-A7 (watchdog pg_cron — ver CLAUDE.md / Roadmap operacional).
    // Nota: o incremento é select-then-update (não-atômico); a corrida é
    // teórica graças ao claim atômico. Tornar atômico exige RPC SQL
    // (`attempt_count = attempt_count + 1`) — fora do escopo desta função.
    // Origem: auditoria 2026-05-26 (Agente 1 A5 + Agente 6 A1).
    const { data: prev } = await service
      .from('jobs')
      .select('attempt_count')
      .eq('id', jobId)
      .single();
    const nextAttempt = (prev?.attempt_count ?? 0) + 1;
    await updateJobChecked(service, jobId, {
      status: 'failed',
      error_reason: reason,
      completed_at: new Date().toISOString(),
      attempt_count: nextAttempt,
    });
  };

  try {
    // 0) Carrega job + documento + perfil
    const { data: job, error: jobErr } = await service
      .from('jobs').select('*, documents(*)').eq('id', jobId).single();
    if (jobErr || !job) throw new Error(`Job ${jobId} não encontrado`);

    const doc = job.documents;
    const { data: profile, error: profErr } = await service
      .from('profiles').select('*').eq('id', job.user_id).single();
    if (profErr || !profile) throw new Error('Profile não encontrado');

    // 1) PARSE
    await setStep('parse', 10);
    const t0 = Date.now();
    const { data: fileBlob, error: dlErr } = await service.storage
      .from('documents').download(doc.storage_path);
    if (dlErr || !fileBlob) throw new Error(`Falha ao baixar do Storage: ${dlErr?.message}`);
    const buffer = new Uint8Array(await fileBlob.arrayBuffer());
    const mimeType = fileBlob.type || undefined;
    // Modelo de OCR resolvido em runtime via getModelConfig() — cascata
    // app_settings (`model_vision`, editável no /admin) → env VISION_MODEL/
    // VISION_PROVIDER → default. Antes getVisionProvider() lia só env e a
    // config do painel era ignorada.
    // Origem: auditoria 2026-06-10 (EDGE-HANDLERS-07).
    const modelConfig = await getModelConfig();
    const parseResult = await parseDocument(buffer, doc.format, mimeType, {
      visionModel: modelConfig.vision,
      visionParams: (await getModelParams()).vision,
    });
    await logEvent('parse', 'success', {
      duration_ms: Date.now() - t0,
      llm_model: parseResult.metadata.vision_provider,
      cost_usd: parseResult.metadata.vision_cost_usd,
      message: `${parseResult.metadata.chars} chars extraídos${parseResult.metadata.vision_provider ? ` via OCR (${parseResult.metadata.vision_provider})` : ''}`,
    });

    if (parseResult.texto.length < 50) {
      return await fail('Documento muito curto após parse (< 50 chars)', 'parse');
    }

    // 2) CLASSIFY
    await setStep('classify', 25);
    const cls = await classify({
      texto_bruto: parseResult.texto,
      semestre: profile.semestre_atual ?? '2026.1',
      materias: profile.materias ?? [],
    }, makeRetryHook('classify'));
    await logEvent('classify', 'success', {
      duration_ms: cls.usage.duration_ms,
      llm_model: cls.usage.model,
      tokens_input: cls.usage.tokens_input,
      tokens_output: cls.usage.tokens_output,
      cost_usd: cls.usage.cost_usd,
      message: `${cls.result.materia_code} · ${cls.result.tipo} · conf=${cls.result.confianca.toFixed(2)}`,
    });

    const clsValidation = validateClassification(cls.result);
    if (!clsValidation.passed) {
      // Confiança muito baixa → falha
      return await fail(clsValidation.errors.join('; '), 'classify');
    }

    // Faixa intermediária [review, auto): a classificação passa, mas o job
    // termina como `needs_review`. Antes esse warning era descartado e o doc
    // ia como `completed` pro Drive sem nenhum sinal de revisão (achado B1).
    // Decisão de produto: NÃO pausa o pipeline — completa o trabalho e sobe
    // pro Drive normalmente, só marca o status final pra revisão humana.
    // Origem: auditoria 2026-05-28 (Bugs, achado B1).
    const classificationNeedsReview = clsValidation.warnings.length > 0;
    if (classificationNeedsReview) {
      await logEvent('classify', 'warning', { message: clsValidation.warnings.join('; ') });
    }

    // Atualiza doc com a classificação
    await service.from('documents').update({
      materia_code: cls.result.materia_code,
      tipo: cls.result.tipo,
      data_doc: cls.result.data,
      identificador: cls.result.identificador,
      titulo: cls.result.titulo,
      classificacao_confianca: cls.result.confianca,
    }).eq('id', doc.id);

    // 3) SYNTHESIZE — automaticamente em chunks pra docs grandes (T24)
    await setStep('synthesize', 45);
    const materiaNome = profile.materias?.find((m: { code: string }) => m.code === cls.result.materia_code)?.nome ?? cls.result.materia_code;

    // System prompt personalizado do aluno (H7) — opt-in: só existe se o aluno
    // gerou em /configuracoes (generate-system-prompt). Ausente → síntese padrão.
    const { data: activePrompt } = await service
      .from('user_system_prompts')
      .select('prompt_text')
      .eq('user_id', job.user_id)
      .eq('is_active', true)
      .maybeSingle();

    const synthInput = {
      texto_bruto: parseResult.texto,
      contexto: {
        materia_code: cls.result.materia_code,
        materia_nome: materiaNome,
        tipo: cls.result.tipo,
        data: cls.result.data,
        identificador: cls.result.identificador,
        titulo: cls.result.titulo,
        semestre: profile.semestre_atual ?? '2026.1',
        fonte: null,
        user_system_prompt: activePrompt?.prompt_text ?? null,
      },
    };

    const synth = await synthesizeChunked(synthInput, {
      // Propaga retries transitórios do LLM pra job_events, igual classify e
      // compress — fecha o SHARED-FUNCTIONS-07 ponta-a-ponta.
      onRetry: makeRetryHook('synthesize'),
      onChunkEvent: async (e) => {
        const eventType = e.kind.endsWith('_success') ? 'success' : 'start';
        const stepName = e.kind.startsWith('chunk')
          ? `synthesize.chunk_${(e.chunk_index ?? 0) + 1}_of_${e.chunk_total ?? '?'}`
          : 'synthesize.reduce';
        await logEvent(stepName, eventType, {
          duration_ms: e.duration_ms,
          llm_model: e.model,
          tokens_input: e.tokens_input,
          tokens_output: e.tokens_output,
          cost_usd: e.cost_usd,
          message: e.source_section ? `seção: ${e.source_section}` : undefined,
        });
      },
    });

    await logEvent('synthesize', 'success', {
      duration_ms: synth.usage.duration_ms,
      llm_model: synth.usage.model,
      tokens_input: synth.usage.tokens_input,
      tokens_output: synth.usage.tokens_output,
      cost_usd: synth.usage.cost_usd,
      message: synth.chunked
        ? `chunked: ${synth.chunk_count} chunks (input ${parseResult.texto.length} chars > ${CHUNK_THRESHOLD})`
        : `single pass (${parseResult.texto.length} chars)`,
    });

    // Validações da síntese
    const structural = validateStructural(synth.result.markdown);
    const quantitative = validateQuantitative({
      chars_input: parseResult.texto.length,
      chars_output: synth.result.markdown.length,
      modo: 'synthesis',
    });
    const semantic = validateSemantic(parseResult.texto, synth.result.markdown);
    const synthVerdict = decideVerdict([structural, quantitative, semantic]);
    if (synthVerdict === 'rejected') {
      return await fail(`Síntese rejeitada: ${[...structural.errors, ...quantitative.errors, ...semantic.errors].join('; ')}`, 'synthesize');
    }

    // Saída cortada por max_tokens mesmo após o retry automático com orçamento
    // dobrado (pipeline.ts) — a síntese existe mas pode estar incompleta no
    // final. Registra warning e rebaixa o status final (nunca silencioso).
    // Origem: auditoria 2026-06-10 (SHARED-FUNCTIONS, contrato `truncated`).
    if (synth.truncated) {
      await logEvent('synthesize', 'warning', {
        message: 'Saída truncada por max_tokens (mesmo após retry com orçamento dobrado) — síntese pode estar incompleta no final',
      });
    }

    // Camada 4 — LLM-as-judge (T25). Roda quando 2-3 anteriores deram warning
    // OU em 5% dos jobs como amostragem de qualidade. Não bloqueia em caso de
    // falha (validateJudge devolve passed:true se LLM indisponível).
    // Origem: auditoria 2026-05-26 (Agente 1, achado A3).
    const judgeShouldRun = synthVerdict === 'warning' || Math.random() < 0.05;
    // validation_score é gravado SEMPRE na escala 0–1: validateSemantic já
    // devolve 0–1 e a média do judge (0–10, validation.ts) é normalizada
    // dividindo por 10 antes do insert. A camada de origem fica em
    // metadata.validation_layer ('semantic' | 'judge') — antes a coluna
    // misturava as duas escalas sem nenhum sinal de qual era qual.
    // Origem: auditoria 2026-06-10 (EDGE-HANDLERS-10).
    let validationScore: number | null = semantic.score;
    let validationLayer: 'semantic' | 'judge' = 'semantic';
    if (judgeShouldRun) {
      const judge = await validateJudge(parseResult.texto, synth.result.markdown);
      if (judge.score > 0) {
        validationScore = judge.score / 10;
        validationLayer = 'judge';
      }
      await logEvent('judge', judge.passed ? 'success' : 'warning', {
        // undefined (não null): logEvent tipa message como string opcional e
        // o JSON do insert omite chaves undefined — efeito igual ao null.
        message: judge.comment || judge.warnings.join('; ') || judge.errors.join('; ') || undefined,
      });
    }

    // Salva o markdown sintetizado. UPSERT consciente: generated_content tem
    // unique (document_id, type) — em reprocessamento (retry de job failed,
    // reset manual) o insert plain violava a unique e o `{ error }` ignorado
    // fazia a síntese nova ser descartada em silêncio, com o job concluindo
    // como completed apontando pro conteúdo antigo.
    // Origem: auditoria 2026-06-10 (EDGE-HANDLERS-06).
    const { error: synthPersistErr } = await service.from('generated_content').upsert({
      document_id: doc.id,
      type: 'synthesized',
      markdown: synth.result.markdown,
      metadata: { ...synth.result.metadata, validation_layer: validationLayer },
      validation_score: validationScore,
    }, { onConflict: 'document_id,type' });
    if (synthPersistErr) {
      log.error('generated_content_persist_failed', {
        job_id: jobId,
        content_type: 'synthesized',
        ...log.fromError(synthPersistErr),
      });
      // Sem conteúdo persistido, concluir como completed seria mentira.
      return await fail('Falha ao salvar a síntese gerada', 'synthesize');
    }

    // 4) COMPRESS (modo compacta)
    await setStep('compress', 70);
    const comp = await compress({
      markdown_sintetizado: synth.result.markdown,
      modo: 'compacta',
    }, makeRetryHook('compress'));
    await logEvent('compress', 'success', {
      duration_ms: comp.usage.duration_ms,
      llm_model: comp.usage.model,
      tokens_input: comp.usage.tokens_input,
      tokens_output: comp.usage.tokens_output,
      cost_usd: comp.usage.cost_usd,
    });

    // Validação quantitativa da compressão — antes só a síntese era validada
    // e uma compressão que perdesse todas as fórmulas passava como sucesso.
    // Perda de fórmula é ERRO (validateQuantitative); ratio fora da faixa e
    // avisos "⚠️ COBRADO NA PROVA" perdidos são warnings. Em rejected NÃO
    // falhamos o job (a síntese íntegra já está salva): registramos job_event
    // de erro e rebaixamos o status final pra completed_with_warning.
    // Origem: auditoria 2026-06-10 (EDGE-HANDLERS-08).
    const compQuant = validateQuantitative({
      chars_input: synth.result.markdown.length,
      chars_output: comp.result.markdown.length,
      formulas_input: synth.result.metadata.formulas_count,
      formulas_output: comp.result.metadata.formulas_preservadas,
      modo: 'compact',
    });
    if (!comp.result.metadata.avisos_preservados) {
      compQuant.warnings.push('Avisos "⚠️ COBRADO NA PROVA" não preservados na compressão');
    }
    // Mesmo contrato `truncated` da síntese — compressão cortada por max_tokens
    // vira warning (artefato principal, a síntese, já está íntegro e salvo).
    if (comp.truncated) {
      compQuant.warnings.push('Saída truncada por max_tokens — compressão pode estar incompleta no final');
    }
    const compVerdict = decideVerdict([compQuant]);
    if (compVerdict === 'rejected') {
      await logEvent('compress', 'error', { message: compQuant.errors.join('; ') });
    } else if (compVerdict === 'warning') {
      await logEvent('compress', 'warning', { message: compQuant.warnings.join('; ') });
    }

    // UPSERT consciente + erro checado — mesmo racional do insert da síntese
    // (unique document_id,type). Origem: EDGE-HANDLERS-06.
    const { error: compressPersistErr } = await service.from('generated_content').upsert({
      document_id: doc.id,
      type: 'compressed_compact',
      markdown: comp.result.markdown,
      metadata: comp.result.metadata,
    }, { onConflict: 'document_id,type' });
    if (compressPersistErr) {
      log.error('generated_content_persist_failed', {
        job_id: jobId,
        content_type: 'compressed_compact',
        ...log.fromError(compressPersistErr),
      });
      return await fail('Falha ao salvar a compressão gerada', 'compress');
    }

    // 5) NOMENCLATURE
    await setStep('nomenclature', 85);
    const filenameFinal = buildFilenameFinal({
      materia_code: cls.result.materia_code,
      tipo: cls.result.tipo,
      identificador: cls.result.identificador,
      data: cls.result.data,
      titulo: cls.result.titulo,
      extension: 'md',
    });
    const driveFolderPath = buildDriveFolderPath(
      profile.semestre_atual ?? '2026.1',
      materiaNome,
    );
    await service.from('documents').update({
      filename_final: filenameFinal,
      drive_folder_path: driveFolderPath,
    }).eq('id', doc.id);

    // 6) UPLOAD_DRIVE (T28 + T29)
    await setStep('upload_drive', 95);
    const driveResult = await tryUploadToDrive({
      profile,
      filename: filenameFinal,
      markdown: synth.result.markdown,
      pathSegments: [profile.semestre_atual ?? '2026.1', materiaNome],
      existingFileId: doc.drive_file_id ?? null,
      service,
    });

    if (driveResult.skipped) {
      await logEvent('upload_drive', 'warning', { message: driveResult.reason });
    } else if (driveResult.error) {
      await logEvent('upload_drive', 'error', { message: driveResult.error });
    } else {
      await logEvent('upload_drive', 'success', {
        duration_ms: driveResult.duration_ms,
        message: `arquivo no Drive: ${driveResult.file_id}`,
      });
      await service.from('documents').update({
        drive_file_id: driveResult.file_id,
      }).eq('id', doc.id);
    }

    // 7) Conclui
    const totalCost = cls.usage.cost_usd + synth.usage.cost_usd + comp.usage.cost_usd;
    // needs_review tem prioridade sobre completed_with_warning: classificação
    // incerta pede olhar humano (qual matéria?), sinal mais forte que um warning
    // cosmético da síntese. Compressão rejeitada (fórmulas perdidas) rebaixa
    // pra completed_with_warning — EDGE-HANDLERS-08.
    const finalStatus = classificationNeedsReview
      ? 'needs_review'
      : synthVerdict === 'warning' || synth.truncated || compVerdict === 'rejected'
        ? 'completed_with_warning'
        : 'completed';
    // Escrita terminal verificada (com 1 retentativa): se falhasse em silêncio
    // o job ficaria preso em 'processing' pra sempre, sem rastro do motivo.
    // Origem: auditoria 2026-06-10 (EDGE-HANDLERS-09).
    await updateJobChecked(service, jobId, {
      status: finalStatus,
      current_step: null,
      progress_percent: 100,
      chars_input: parseResult.texto.length,
      chars_synthesis: synth.result.markdown.length,
      chars_compression: comp.result.markdown.length,
      cost_usd_total: totalCost,
      completed_at: new Date().toISOString(),
    });
    await service.from('documents').update({
      processed_at: new Date().toISOString(),
    }).eq('id', doc.id);

    log.info('pipeline_completed', {
      job_id: jobId,
      status: finalStatus,
      cost_usd_total: totalCost,
      chars_input: parseResult.texto.length,
      chars_synthesis: synth.result.markdown.length,
      drive_uploaded: !driveResult.skipped && !driveResult.error,
    });

  } catch (err) {
    log.error('pipeline_failed', { job_id: jobId, ...log.fromError(err) });
    await fail((err as Error).message, 'unknown');
  }
}

/**
 * Update terminal de jobs com checagem de erro + 1 retentativa.
 *
 * supabase-js NÃO lança em erro PostgREST (retorna `{ error }`) — sem essa
 * checagem, uma falha transitória (rede, restart do PostgREST) deixava o job
 * preso em 'processing' pra sempre sem nenhum log do motivo.
 * Origem: auditoria 2026-06-10 (EDGE-HANDLERS-09).
 */
async function updateJobChecked(
  service: ReturnType<typeof createServiceClient>,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  let { error } = await service.from('jobs').update(patch).eq('id', jobId);
  if (error) {
    log.error('terminal_update_failed', { job_id: jobId, will_retry: true, ...log.fromError(error) });
    ({ error } = await service.from('jobs').update(patch).eq('id', jobId));
    if (error) {
      log.error('terminal_update_failed', { job_id: jobId, will_retry: false, ...log.fromError(error) });
    }
  }
}

// =============================================================
// Upload pro Google Drive (T28 + T29) — não interrompe pipeline em erro
// =============================================================
type DriveAttemptResult =
  | { skipped: true; reason: string; error?: undefined; file_id?: undefined; duration_ms?: undefined }
  | { skipped: false; error: string; file_id?: undefined; duration_ms?: undefined; reason?: undefined }
  | { skipped: false; error?: undefined; file_id: string; duration_ms: number; reason?: undefined };

async function tryUploadToDrive(args: {
  // deno-lint-ignore no-explicit-any
  profile: any;
  filename: string;
  markdown: string;
  pathSegments: string[];
  /** drive_file_id de upload anterior — reprocessamento atualiza in-place. */
  existingFileId: string | null;
  // deno-lint-ignore no-explicit-any
  service: any;
}): Promise<DriveAttemptResult> {
  const { profile, filename, markdown, pathSegments, existingFileId, service } = args;

  // Defesa em profundidade: aborta upload se markdown for absurdamente grande.
  // Síntese normal raramente passa de 50-100 KB; > 1 MB é alucinação do LLM
  // ou expansão indevida — não vale gastar storage do Drive nem quota Google.
  // Origem: auditoria 2026-05-26 (Agente 3 — Segurança, achado S-08).
  const MAX_MARKDOWN_BYTES = 1_000_000;
  if (markdown.length > MAX_MARKDOWN_BYTES) {
    return {
      skipped: false,
      error: `Markdown gerado (${markdown.length} bytes) excedeu limite de ${MAX_MARKDOWN_BYTES} bytes — upload pro Drive abortado`,
    };
  }

  if (!profile.google_refresh_token) {
    return { skipped: true, reason: 'Drive não conectado (sem refresh_token salvo)' };
  }

  // Monta token pair a partir do profile; faz refresh se já passou da validade
  let token: DriveTokenPair = {
    access_token: profile.google_access_token ?? '',
    refresh_token: profile.google_refresh_token,
    expires_at: profile.google_token_expires_at
      ? new Date(profile.google_token_expires_at).getTime()
      : 0,
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/drive.file',
  };

  try {
    token = await ensureFreshToken(token);
  } catch (err) {
    if (err instanceof DriveAuthExpiredError) {
      return { skipped: true, reason: 'Token Google expirado — reconectar Drive na tela de Configurações' };
    }
    return { skipped: false, error: `refresh falhou: ${(err as Error).message}` };
  }

  // Persiste eventuais novos tokens (Google às vezes rotaciona — inclusive o
  // refresh_token; descartá-lo quebraria todo refresh futuro até reconectar).
  // ATENÇÃO: PostgrestBuilder só implementa `then` — chamar `.catch()` nele
  // lançava TypeError sempre que o refresh acontecia (qualquer upload >1h
  // após conectar o Drive), derrubando o pipeline inteiro DEPOIS do custo
  // LLM já gasto. Além disso, builders supabase nunca rejeitam em erro de
  // DB — o erro vem em `{ error }` e precisa ser checado explicitamente.
  // Origem: auditoria 2026-06-10 (EDGE-HANDLERS-04).
  if (token.access_token !== profile.google_access_token) {
    const { error: tokenPersistErr } = await service.from('profiles').update({
      google_access_token: token.access_token,
      google_refresh_token: token.refresh_token,
      google_token_expires_at: new Date(token.expires_at).toISOString(),
    }).eq('id', profile.id);
    if (tokenPersistErr) {
      // Não bloqueia o upload — migration 0004 pode não estar aplicada.
      log.warn('token_persist_failed', { user_id: profile.id, ...log.fromError(tokenPersistErr) });
    }
  }

  const t0 = Date.now();
  try {
    // Reprocessamento: se o doc já subiu antes, atualiza o arquivo in-place
    // (PATCH) em vez de criar duplicata — o Drive aceita nomes repetidos na
    // mesma pasta e o drive_file_id antigo ficaria órfão.
    if (existingFileId) {
      try {
        const updated = await updateMarkdown({
          accessToken: token.access_token,
          fileId: existingFileId,
          filename,
          markdown,
        });
        return { skipped: false, file_id: updated.id, duration_ms: Date.now() - t0 };
      } catch (err) {
        // 404 = arquivo apagado em definitivo no Drive — cai pro fluxo de criação
        if (!(err instanceof DriveError) || err.status !== 404) throw err;
      }
    }

    const folderId = await ensureFolderPath(
      profile.drive_root_folder_id,
      pathSegments,
      { accessToken: token.access_token },
    );
    const file = await uploadMarkdown({
      accessToken: token.access_token,
      parentId: folderId,
      filename,
      markdown,
    });
    return { skipped: false, file_id: file.id, duration_ms: Date.now() - t0 };
  } catch (err) {
    if (err instanceof DriveAuthExpiredError) {
      return { skipped: true, reason: 'Token Google rejeitado pelo Drive — reconectar' };
    }
    if (err instanceof DriveError) {
      return { skipped: false, error: `Drive ${err.status}: ${err.message}` };
    }
    return { skipped: false, error: (err as Error).message };
  }
}
