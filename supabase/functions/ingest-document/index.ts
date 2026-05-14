/**
 * Edge Function: ingest-document (T12)
 *
 * Recebe metadados de um upload já feito no Storage via signed URL,
 * cria um documento e um job (status: pending), e dispara o processamento
 * em background via EdgeRuntime.waitUntil() — sem pg_cron.
 *
 * O frontend recebe 202 imediatamente e escuta o job via Realtime.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, handleCorsPrefligh } from '../_shared/cors.ts';
import { createAuthClient, createServiceClient } from '../_shared/supabase-client.ts';
import { UploadRequestSchema } from '../../../packages/shared/src/schemas.ts';

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

serve(async (req) => {
  const cors = handleCorsPrefligh(req);
  if (cors) return cors;

  try {
    // 1) Autenticação via JWT do usuário
    const authClient = createAuthClient(req);
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Validação do body
    const body = await req.json();
    const parsed = UploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'invalid_body', details: parsed.error.format() }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { filename_original, format, size_bytes, storage_path } = parsed.data;

    // 3) Verifica que o storage_path pertence ao próprio usuário
    if (!storage_path.startsWith(`${user.id}/`)) {
      return new Response(JSON.stringify({ error: 'forbidden_path' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4) Cria documento + job em transação (service role para escrever)
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
    if (docError) throw docError;

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
    if (jobError) throw jobError;

    // 5) Dispara processamento em background — frontend recebe 202 já
    // Aqui chamamos a outra Edge Function via HTTP (fire-and-forget).
    // process-document vai usar EdgeRuntime.waitUntil internamente.
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

    return new Response(
      JSON.stringify({
        job_id: job.id,
        document_id: doc.id,
        status: 'pending',
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('ingest-document erro:', err);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
