/**
 * Edge Function: connect-drive (T27).
 *
 * Recebe os tokens OAuth do Google que o frontend obteve via Supabase Auth
 * (Provider Google) e persiste em `profiles`. Cria/garante a pasta-raiz
 * "PSP2 - Estudos" no Drive do aluno e salva o id.
 *
 * Não chama nenhum LLM. Pode ser invocada com token recém-obtido ou pra
 * forçar reconexão.
 *
 * Body esperado:
 *   {
 *     "provider_token":         string,  // access token do Google
 *     "provider_refresh_token": string,  // refresh token
 *     "expires_in":             number   // segundos até expirar (default 3600)
 *   }
 *
 * Hardening:
 * - JWT obrigatório
 * - Rate limit por usuário (5/min — operação rara)
 * - Validação estrita de tokens (formato + tamanho)
 * - Erros não vazam mensagem interna
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'npm:zod@3.23.8';
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
import { ensureRootFolder, DriveAuthExpiredError, DriveError } from '../_shared/drive/index.ts';

const MAX_BODY_BYTES = 16 * 1024;

const ConnectDriveSchema = z.object({
  provider_token: z.string().min(20).max(4096),
  provider_refresh_token: z.string().min(20).max(4096),
  expires_in: z.number().int().positive().max(86_400 * 30).optional(),
});

serve(async (req) => {
  const cors = handleCorsPrefligh(req);
  if (cors) return cors;

  try {
    const ctErr = requireContentType(req, 'application/json');
    if (ctErr) return ctErr;
    const sizeErr = requireMaxPayload(req, MAX_BODY_BYTES);
    if (sizeErr) return sizeErr;

    // 1) Autentica o usuário via JWT
    const auth = createAuthClient(req);
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) {
      return errorResponse(req, 'unauthorized', 401);
    }

    // 2) Rate limit por usuário (5/min, operação cara que faz round-trip ao Google)
    const fp = clientFingerprint(req, user.id);
    const rl = checkRateLimit(`connect-drive:${fp}`, { max: 5, windowSec: 60 });
    if (!rl.ok) return errorResponse(req, 'rate_limited', 429);

    // 3) Lê + valida body
    const [body, parseErr] = await parseJsonBody(req);
    if (parseErr) return parseErr;
    const parsed = ConnectDriveSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(req, 'invalid_body', 400);
    }
    const { provider_token, provider_refresh_token } = parsed.data;
    const expires_in = parsed.data.expires_in ?? 3600;

    // 4) Cria/encontra a pasta-raiz "PSP2 - Estudos" no Drive do aluno
    let rootFolderId: string | null = null;
    try {
      const root = await ensureRootFolder({ accessToken: provider_token });
      rootFolderId = root.id;
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        return errorResponse(req, 'drive_auth_expired', 401);
      }
      if (err instanceof DriveError) {
        console.error('connect-drive Drive API error:', err);
        return errorResponse(req, 'drive_api_error', 502);
      }
      throw err;
    }

    // 5) Salva tokens + root_folder_id no profile (service role pra contornar RLS)
    const service = createServiceClient();
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error: updateError } = await service
      .from('profiles')
      .update({
        google_access_token: provider_token,
        google_refresh_token: provider_refresh_token,
        google_token_expires_at: expiresAt,
        drive_root_folder_id: rootFolderId,
        drive_connected_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      // Schema pode estar sem 0004 aplicada — tenta update parcial
      const msg = updateError.message?.toLowerCase() ?? '';
      if (msg.includes('google_access_token') || msg.includes('drive_connected_at') || msg.includes('google_token_expires_at')) {
        const { error: fallbackError } = await service
          .from('profiles')
          .update({
            google_refresh_token: provider_refresh_token,
            drive_root_folder_id: rootFolderId,
          })
          .eq('id', user.id);
        if (fallbackError) {
          console.error('connect-drive fallback update:', fallbackError);
          return errorResponse(req, 'internal_error', 500);
        }
        return jsonResponse(req, {
          ok: true,
          drive_root_folder_id: rootFolderId,
          warning: 'migration_pending',
        });
      }
      console.error('connect-drive update profile:', updateError);
      return errorResponse(req, 'internal_error', 500);
    }

    return jsonResponse(req, {
      ok: true,
      drive_root_folder_id: rootFolderId,
    });
  } catch (err) {
    console.error('connect-drive erro:', err);
    return errorResponse(req, 'internal_error', 500);
  }
});
