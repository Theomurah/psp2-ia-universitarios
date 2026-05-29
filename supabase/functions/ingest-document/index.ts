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
import { handleCorsPrefligh } from '../_shared/cors.ts';
import { createAuthClient, createServiceClient } from '../_shared/supabase-client.ts';
import {
  jsonResponse,
  errorResponse,
  requireContentType,
  requireMaxPayload,
  parseJsonBody,
} from '../_shared/http.ts';
import { checkRateLimit, clientFingerprint } from '../_shared/rate-limit.ts';
import { UploadRequestSchema } from '../../../packages/shared/src/schemas.ts';

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const MAX_BODY_BYTES = 4 * 1024; // metadata only

serve(async (req) => {
  const cors = handleCorsPrefligh(req);
  if (cors) return cors;

  try {
    // Guards rápidos antes de qualquer trabalho
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
      return errorResponse(req, 'rate_limited', 429);
    }

    // 3) Body parsing + validação Zod
    const [body, parseErr] = await parseJsonBody(req);
    if (parseErr) return parseErr;
    const parsed = UploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(req, 'invalid_body', 400);
    }
    const { filename_original, format, size_bytes, storage_path } = parsed.data;

    // 4) Verifica que o storage_path pertence ao próprio usuário
    if (!storage_path.startsWith(`${user.id}/`)) {
      return errorResponse(req, 'forbidden_path', 403);
    }

    // 5) Cria documento + job em transação (service role para escrever)
    const service = createServiceClient();

    const { data: doc, error: docError } = await service
      .from('documents')
      .insert({
        user_id: user.id,
        filename_original,
        format,
        size_bytes,
        storage_path,
      })
      .select()
      .single();
    if (docError || !doc) {
      console.error('ingest-document insert documents:', docError);
      return errorResponse(req, 'internal_error', 500);
    }

    const { data: job, error: jobError } = await service
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
      console.error('ingest-document insert jobs:', jobError);
      return errorResponse(req, 'internal_error', 500);
    }

    // 6) Dispara processamento em background — frontend recebe 202 já
    const processUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-document`;
    EdgeRuntime.waitUntil(
      fetch(processUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job_id: job.id }),
      }).catch((err) => console.error('Falha ao disparar process-document:', err)),
    );

    return jsonResponse(req, {
      job_id: job.id,
      document_id: doc.id,
      status: 'pending',
    }, 202);
  } catch (err) {
    console.error('ingest-document erro:', err);
    return errorResponse(req, 'internal_error', 500);
  }
});
