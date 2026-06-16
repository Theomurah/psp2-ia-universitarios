/**
 * Helpers HTTP para Edge Functions: respostas JSON com CORS e sanitização de erros.
 *
 * Nunca devolver `(err as Error).message` direto no body — pode vazar
 * stack/SQL/secrets. Use `errorResponse(req, code, status, extra?)`.
 */

import { corsHeadersFor } from './cors.ts';

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersFor(req),
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

/**
 * Resposta de erro padronizada — usa código curto + mensagem amigável.
 * O log interno (console.error) é onde os detalhes ficam, nunca no body.
 */
export function errorResponse(
  req: Request,
  code: string,
  status: number,
  publicMessage?: string,
): Response {
  return jsonResponse(req, {
    error: code,
    message: publicMessage ?? defaultMessageForCode(code),
  }, status);
}

function defaultMessageForCode(code: string): string {
  switch (code) {
    case 'unauthorized': return 'Faça login novamente para continuar.';
    case 'forbidden': return 'Você não tem permissão para essa operação.';
    case 'forbidden_path': return 'Caminho de arquivo não pertence a você.';
    case 'invalid_body': return 'Dados enviados estão em formato inválido.';
    case 'missing_required': return 'Campos obrigatórios não foram enviados.';
    case 'payload_too_large': return 'Arquivo ou requisição maior que o permitido.';
    case 'unsupported_media_type': return 'Tipo de mídia não suportado.';
    case 'rate_limited': return 'Muitas requisições — tente novamente em alguns segundos.';
    case 'not_found': return 'Recurso não encontrado.';
    case 'profile_not_found': return 'Perfil não encontrado.';
    case 'drive_auth_expired': return 'Token do Google expirou — reconecte sua conta.';
    case 'drive_api_error': return 'Erro temporário na API do Google Drive.';
    case 'internal_error': return 'Ocorreu um erro interno. Tente novamente.';
    default: return 'Ocorreu um erro.';
  }
}

/**
 * Valida content-type esperado. Retorna Response 415 se não bater.
 */
export function requireContentType(req: Request, expected: string): Response | null {
  const ct = (req.headers.get('content-type') ?? '').toLowerCase();
  if (!ct.startsWith(expected.toLowerCase())) {
    return errorResponse(req, 'unsupported_media_type', 415);
  }
  return null;
}

/**
 * Valida content-length. Retorna Response 413 se exceder maxBytes.
 * Aceita request sem header (assume ok), mas Deno geralmente preenche.
 */
export function requireMaxPayload(req: Request, maxBytes: number): Response | null {
  const lenStr = req.headers.get('content-length');
  if (!lenStr) return null;
  const len = Number(lenStr);
  if (Number.isFinite(len) && len > maxBytes) {
    return errorResponse(req, 'payload_too_large', 413);
  }
  return null;
}

/**
 * Faz JSON.parse defensivo. Retorna [data, null] ou [null, errorResponse].
 */
export async function parseJsonBody<T = unknown>(
  req: Request,
): Promise<[T | null, Response | null]> {
  try {
    const data = await req.json() as T;
    return [data, null];
  } catch {
    return [null, errorResponse(req, 'invalid_body', 400, 'JSON inválido.')];
  }
}
