/**
 * CORS — whitelist explícita por origin, com echo seguro.
 *
 * Configurável via env var ALLOWED_ORIGINS (CSV). Sem env, libera apenas
 * localhost (dev). Em produção, defina:
 *   supabase secrets set ALLOWED_ORIGINS="https://app.seu-dominio.com,https://staging.seu-dominio.com"
 *
 * NUNCA voltar para Access-Control-Allow-Origin: * — ver auditoria.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
];

function getAllowedOrigins(): string[] {
  const env = Deno.env.get('ALLOWED_ORIGINS');
  if (!env) return DEFAULT_ALLOWED_ORIGINS;
  return env.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Retorna headers CORS específicos pra esta request:
 * - ecoa o Origin se estiver na whitelist
 * - caso contrário, retorna o primeiro permitido (browser bloqueia, mas tem fallback)
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = getAllowedOrigins();
  const allowedOrigin = allowed.includes(origin) ? origin : (allowed[0] ?? '');
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

/**
 * Backwards-compat: retorna headers default (primeiro origin permitido).
 * Usar `corsHeadersFor(req)` quando possível — esse echoes o Origin correto.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': DEFAULT_ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Vary': 'Origin',
};

export function handleCorsPrefligh(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }
  return null;
}
