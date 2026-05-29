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
 * - Sem essa validação, qualquer um com UUID podia disparar processamento.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://esm.sh/zod@3.23.8';
import { handleCorsPrefligh } from '../_shared/cors.ts';
import { createAuthClient, createServiceClient } from '../_shared/supabase-client.ts';
import {
  jsonResponse,
  errorResponse,
  requireContentType,
  requireMaxPayload,
  parseJsonBody,
} from '../_shared/http.ts';
import { parseDocument } from '../_shared/parsers.ts';
import { classify, synthesize, synthesizeChunked, compress } from '../_shared/pipeline.ts';
import { CHUNK_THRESHOLD } from '../_shared/chunking.ts';
import {
  ensureFolderPath,
  uploadMarkdown,
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
  const cors = handleCorsPrefligh(req);
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
    // OU JWT de usuário dono do job. Sem isso, qualquer um com job_id podia
    // disparar processamento.
    const auth = await authorizeProcessDocument(req, job_id);
    if (!auth.ok) {
      return errorResponse(req, auth.code, auth.status);
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
// Autorização: service_role bearer OU JWT do dono do job
// =============================================================
async function authorizeProcessDocument(
  req: Request,
  jobId: string,
): Promise<{ ok: true } | { ok: false; code: string; status: number }> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, code: 'unauthorized', status: 401 };
  }
  const token = authHeader.slice(7).trim();

  // Caso 1: chamada interna com service_role (ingest-document → process-document)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) {
    return { ok: true };
  }

  // Caso 2: JWT do usuário — precisa ser dono do job
  const client = createAuthClient(req);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    return { ok: false, code: 'unauthorized', status: 401 };
  }

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
    // Sinal de segurança: usuário autenticado tentou disparar job de outro.
    log.warn('authorize_owner_mismatch', { job_id: jobId, requester_id: user.id });
    return { ok: false, code: 'forbidden', status: 403 };
  }
  return { ok: true };
}

// =============================================================
// Pipeline principal — roda em background via waitUntil
// =============================================================
async function runPipeline(jobId: string): Promise<void> {
  const service = createServiceClient();

  // Claim atômico: tenta transicionar pending → processing.
  // Se afetar 0 linhas, é porque outro worker já está rodando (ou o job
  // já terminou) — retornamos early, evitando dupla cobrança de LLM.
  // Origem: auditoria 2026-05-26 (Agente 6 — Banco, achado D1; cobre
  // também Agente 1 — A1 sobre `started_at` ser sobrescrito).
  const startedAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await service
    .from('jobs')
    .update({
      status: 'processing',
      started_at: startedAt,
      current_step: 'parse',
      progress_percent: 0,
    })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id');

  if (claimErr) {
    log.error('claim_failed', { job_id: jobId, ...log.fromError(claimErr) });
    return;
  }
  if (!claimed || claimed.length === 0) {
    // Outro worker já claim'ou ou o job não está em pending — sai sem custo.
    log.warn('job_claim_skipped', { job_id: jobId, reason: 'already_claimed_or_not_pending' });
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
    // Origem: auditoria 2026-05-26 (Agente 1 A5 + Agente 6 A1).
    const { data: prev } = await service
      .from('jobs')
      .select('attempt_count')
      .eq('id', jobId)
      .single();
    const nextAttempt = (prev?.attempt_count ?? 0) + 1;
    await service.from('jobs').update({
      status: 'failed',
      error_reason: reason,
      completed_at: new Date().toISOString(),
      attempt_count: nextAttempt,
    }).eq('id', jobId);
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
    const parseResult = await parseDocument(buffer, doc.format, mimeType);
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

    // Camada 4 — LLM-as-judge (T25). Roda quando 2-3 anteriores deram warning
    // OU em 5% dos jobs como amostragem de qualidade. Não bloqueia em caso de
    // falha (validateJudge devolve passed:true se LLM indisponível).
    // Origem: auditoria 2026-05-26 (Agente 1, achado A3).
    const judgeShouldRun = synthVerdict === 'warning' || Math.random() < 0.05;
    let judgeScore: number | null = semantic.score;
    if (judgeShouldRun) {
      const judge = await validateJudge(parseResult.texto, synth.result.markdown);
      judgeScore = judge.score > 0 ? judge.score : semantic.score;
      await logEvent('judge', judge.passed ? 'success' : 'warning', {
        message: judge.comment || judge.warnings.join('; ') || judge.errors.join('; ') || null,
      });
    }

    // Salva o markdown sintetizado
    await service.from('generated_content').insert({
      document_id: doc.id,
      type: 'synthesized',
      markdown: synth.result.markdown,
      metadata: synth.result.metadata,
      validation_score: judgeScore,
    });

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

    await service.from('generated_content').insert({
      document_id: doc.id,
      type: 'compressed_compact',
      markdown: comp.result.markdown,
      metadata: comp.result.metadata,
    });

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
    const finalStatus = synthVerdict === 'warning' ? 'completed_with_warning' : 'completed';
    await service.from('jobs').update({
      status: finalStatus,
      current_step: null,
      progress_percent: 100,
      chars_input: parseResult.texto.length,
      chars_synthesis: synth.result.markdown.length,
      chars_compression: comp.result.markdown.length,
      cost_usd_total: totalCost,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
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
  // deno-lint-ignore no-explicit-any
  service: any;
}): Promise<DriveAttemptResult> {
  const { profile, filename, markdown, pathSegments, service } = args;

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

  // Persiste eventuais novos tokens (Google às vezes rotaciona)
  if (token.access_token !== profile.google_access_token) {
    await service.from('profiles').update({
      google_access_token: token.access_token,
      google_token_expires_at: new Date(token.expires_at).toISOString(),
    }).eq('id', profile.id).catch((err: unknown) => {
      // Não bloqueia o upload — migration 0004 pode não estar aplicada.
      log.warn('token_persist_failed', { user_id: profile.id, ...log.fromError(err) });
    });
  }

  const t0 = Date.now();
  try {
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
