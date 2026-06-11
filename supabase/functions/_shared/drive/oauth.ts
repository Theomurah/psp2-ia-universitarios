/**
 * Helpers de OAuth2 com Google (T27).
 *
 * O fluxo de OAuth do USUÁRIO é gerenciado pelo Supabase Auth (Provider:
 * Google), que devolve `provider_token` (access) e `provider_refresh_token`
 * direto no JWT. Este módulo cuida só do refresh quando o access expira.
 *
 * Pré-requisitos no Supabase Console:
 *   - Auth → Providers → Google: enabled
 *   - Scopes: `https://www.googleapis.com/auth/drive.file` (mínimo
 *     privilégio — só vê arquivos criados pelo app)
 *
 * Pré-requisitos em Google Cloud Console:
 *   - OAuth client (Web): redirect URI = `<projeto-supabase>.supabase.co/auth/v1/callback`
 *   - Drive API habilitada
 *
 * Secrets esperados no Edge Function runtime:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *
 * NOTA: nenhuma chamada real foi feita em produção ainda — exige
 * configuração do GCP por humano (ver PENDENCIAS.md).
 */

import { DriveAuthExpiredError, DriveError, type DriveTokenPair } from './types.ts';
import { withRetry } from './retry.ts';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Faz refresh do access_token a partir do refresh_token armazenado.
 * Lança DriveAuthExpiredError se o refresh token foi revogado (400/401).
 *
 * Aplica retry com backoff em 5xx (servidor Google indisponível) — 4xx não
 * retenta porque são erros de credencial/parâmetros que não se resolvem
 * sozinhos.
 */
export async function refreshAccessToken(refreshToken: string): Promise<DriveTokenPair> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new DriveError(
      'GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados nas secrets.',
      500,
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  return withRetry(async () => {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (res.status === 400 || res.status === 401) {
      const errText = await res.text().catch(() => '');
      throw new DriveAuthExpiredError(`refresh falhou: ${errText.slice(0, 200)}`);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new DriveError(`refresh status ${res.status}: ${errText}`, res.status, errText);
    }

    // deno-lint-ignore no-explicit-any
    const data: any = await res.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? refreshToken, // Google reusa o mesmo refresh
      expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
      token_type: 'Bearer',
      scope: data.scope ?? 'https://www.googleapis.com/auth/drive.file',
    };
  });
}

/**
 * Garante que um token está válido. Se passou da validade (com margem de 60s),
 * faz refresh automaticamente. Retorna sempre um access_token utilizável.
 */
export async function ensureFreshToken(
  current: DriveTokenPair,
  marginSeconds = 60,
): Promise<DriveTokenPair> {
  const margin = marginSeconds * 1000;
  if (current.expires_at - margin > Date.now()) return current;
  if (!current.refresh_token) {
    throw new DriveAuthExpiredError('Token vencido e sem refresh_token disponível');
  }
  return refreshAccessToken(current.refresh_token);
}
