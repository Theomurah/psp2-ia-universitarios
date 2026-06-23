/**
 * Edge Function: ingest-document (T12)
 *
 * Recebe metadados de um upload já feito no Storage via signed URL,
 * cria um documento e um job (status: pending), e dispara o processamento
 * em background via EdgeRuntime.waitUntil() — sem pg_cron.
 *
 * O frontend recebe 202 imediatamente e escuta o job via Realtime.
 *
 * Hardening:
 * - JWT obrigatório do usuário (RLS aplicada na auth client)
 * - Validação Zod estrita do body
 * - Path do storage obrigatoriamente igual ao user.id
 * - Rate limit por usuário (20 uploads/minuto)
 * - Erros nunca vazam stack/SQL — só códigos canônicos
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCorsPreflight } from '../_shared/cors.ts';
import { createAuthClient } from '../_shared/supabase-client.ts';
import {
  jsonResponse,
  errorResponse,
  requireContentType,
  requireMaxPayload,
  parseJsonBody,
} from '../_shared/http.ts';
import { checkRateLimit, clientFingerprint } from '../_shared/rate-limit.ts';
import { createLogger } from '../_shared/log.ts';
import { UploadRequestSchema } from '../../../packages/shared/src/schemas.ts';

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const MAX_BODY_BYTES = 4 * 1024; // metadata only
const log = createLogger('ingest-document');

serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;

  try {
    // Guards rápidos antes de qualquer trabalho.
    // Content-Length obrigatório: requireMaxPayload deixa passar requests sem
    // o header (ex.: Transfer-Encoding: chunked) e req.json() bufferizaria um
    // corpo ilimitado em memória antes de qualquer checagem (DoS).
    // Origem: auditoria 2026-06-10 (EDGE-HANDLERS-01).
    if (!req.headers.get('content-length')) {
      return errorResponse(req, 'length_required', 411, 'Header Content-Length é obrigatório.');
    }
    const ctErr = requireContentType(req, 'application/json');
    if (ctErr) return ctErr;
    const sizeErr = requireMaxPayload(req, MAX_BODY_BYTES);
    if (sizeErr) return sizeErr;

    // 1) Autenticação via JWT do usuário
    const authClient = createAuthClient(req);
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return errorResponse(req, 'unauthorized', 401);
    }

    // 2) Rate limit por usuário (20 uploads/minuto)
    const fp = clientFingerprint(req, user.id);
    const rl = checkRateLimit(`ingest:${fp}`, { max: 20, windowSec: 60 });
    if (!rl.ok) {
      log.warn('rate_limited', { user_id: user.id, endpoint: 'ingest', window_sec: 60 });
      return errorResponse(req, 'rate_limited', 429);
    }

    // 3) Body parsing + validação Zod
    const [body, parseErr] = await parseJsonBody(req);
    if (parseErr) return parseErr;
    const parsed = UploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      log.warn('invalid_body', { user_id: user.id });
      return errorResponse(req, 'invalid_body', 400);
    }
    const { filename_original, format, size_bytes, storage_path, drive_upload_mode, drive_raw_name_mode } = parsed.data;

    // 4) Verifica que o storage_path pertence ao próprio usuário e tem o
    //    formato estrito `<user.id>/<arquivo>` — um único segmento de arquivo,
    //    sem `..` nem barras extras. O startsWith sozinho aceitava
    //    `<uid>/../<outro-uid>/x` (sem traversal real no Storage atual, mas a
    //    validação não pode depender desse detalhe do backend).
    //    Origem: auditoria 2026-06-10 (EDGE-HANDLERS-03).
    const expectedPrefix = `${user.id}/`;
    const objectName = storage_path.startsWith(expectedPrefix)
      ? storage_path.slice(expectedPrefix.length)
      : '';
    if (
      objectName.length === 0 ||
      objectName.includes('/') ||
      objectName === '.' ||
      objectName === '..'
    ) {
      // Não logamos o path (pode conter nome de arquivo = PII) — só o sinal.
      log.warn('forbidden_path', { user_id: user.id, format });
      return errorResponse(req, 'forbidden_path', 403);
    }

    // 5) Confere que o objeto realmente existe no Storage e usa o tamanho
    //    real do bucket — size_bytes declarado pelo cliente poluía métricas e
    //    qualquer quota futura, e paths nunca enviados criavam jobs fadados a
    //    falhar só no download. List via authClient: a RLS do bucket
    //    (0002, documents_select_own) re-valida a posse da pasta.
    //    Origem: auditoria 2026-06-10 (EDGE-HANDLERS-11).
    const { data: objects, error: listErr } = await authClient.storage
      .from('documents')
      .list(user.id, { search: objectName, limit: 100 });
    if (listErr) {
      log.error('storage_list_failed', { user_id: user.id, ...log.fromError(listErr) });
      return errorResponse(req, 'internal_error', 500);
    }
    const storageObject = objects?.find((o) => o.name === objectName);
    if (!storageObject) {
      log.warn('storage_object_missing', { user_id: user.id, format });
      return errorResponse(req, 'invalid_body', 400, 'Arquivo não encontrado no Storage — refaça o upload.');
    }
    const realSizeBytes = typeof storageObject.metadata?.size === 'number'
      ? storageObject.metadata.size
      : size_bytes;

    log.info('request_received', { user_id: user.id, format, size_bytes: realSizeBytes });

    // 6) Cria documento + job com o client AUTENTICADO (RLS como rede de
    //    segurança): documents_insert_own/jobs_insert_own (0006) cobrem os
    //    inserts e as policies de select cobrem o `.select()` de retorno.
    //    service_role aqui era over-privilege — um filtro esquecido passaria
    //    a escrever em dados de qualquer usuário em vez de falhar fechado.
    //    Origem: auditoria 2026-06-10 (EDGE-HANDLERS-02).
    const { data: doc, error: docError } = await authClient
      .from('documents')
      .insert({
        user_id: user.id,
        filename_original,
        format,
        size_bytes: realSizeBytes,
        storage_path,
        drive_upload_mode,
        drive_raw_name_mode,
      })
      .select()
      .single();
    if (docError || !doc) {
      log.error('insert_documents_failed', { user_id: user.id, ...log.fromError(docError) });
      return errorResponse(req, 'internal_error', 500);
    }

    const { data: job, error: jobError } = await authClient
      .from('jobs')
      .insert({
        user_id: user.id,
        document_id: doc.id,
        status: 'pending',
        current_step: 'parse',
      })
      .select()
      .single();
    if (jobError || !job) {
      log.error('insert_jobs_failed', { user_id: user.id, document_id: doc.id, ...log.fromError(jobError) });
      return errorResponse(req, 'internal_error', 500);
    }

    log.info('job_enqueued', { job_id: job.id, document_id: doc.id, user_id: user.id, format, size_bytes: realSizeBytes });

    // 7) Dispara processamento em background — frontend recebe 202 já.
    //    A SERVICE_ROLE_KEY aqui é necessária: process-document precisa
    //    autorizar a chamada interna sem JWT de usuário (via === 'service').
    const processUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-document`;
    EdgeRuntime.waitUntil(
      fetch(processUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job_id: job.id }),
      })
        .then((res) => {
          if (!res.ok) {
            log.error('process_dispatch_non_2xx', { job_id: job.id, http_status: res.status });
          } else {
            log.debug('process_dispatched', { job_id: job.id });
          }
        })
        .catch((err) => log.error('process_dispatch_failed', { job_id: job.id, ...log.fromError(err) })),
    );

    return jsonResponse(req, {
      job_id: job.id,
      document_id: doc.id,
      status: 'pending',
    }, 202);
  } catch (err) {
    log.error('unhandled', log.fromError(err));
    return errorResponse(req, 'internal_error', 500);
  }
});
