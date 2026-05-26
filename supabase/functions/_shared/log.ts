/**
 * Helper de logging estruturado pra Edge Functions.
 *
 * Formato: JSON 1-evento-por-linha, schema único.
 *   { ts, level, fn, evt, ...campos }
 *
 * Auditoria 2026-05-26 (Agente 4 — Observabilidade):
 *   - A3: logs em texto livre → JSON estruturado filtrável no Supabase Studio
 *   - A6 (base): `redactError` evita vazamento de PII / detalhes do Postgres
 *
 * Uso típico em uma Edge Function:
 *
 *   import { createLogger } from '../_shared/log.ts';
 *   const log = createLogger('ingest-document');
 *
 *   log.info('received', { user_id: user.id, format });
 *   log.error('insert_failed', log.fromError(err));
 *   log.warn('rate_limited', { user_id: user.id });
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

/** Campos canônicos sensíveis — nunca passam por log direto. */
const REDACT_KEYS = new Set([
  'password',
  'access_token',
  'refresh_token',
  'google_access_token',
  'google_refresh_token',
  'provider_token',
  'provider_refresh_token',
  'authorization',
  'cookie',
  'email',
  'markdown',
  'texto',
  'texto_bruto',
  'messages',
]);

/** Trunca strings longas pra não inflar log. */
function truncate(value: string, max = 200): string {
  return value.length > max ? `${value.slice(0, max)}…[+${value.length - max}]` : value;
}

/**
 * Sanitiza um objeto de fields: remove chaves sensíveis e trunca strings longas.
 */
function sanitizeFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
      continue;
    }
    if (typeof value === 'string') {
      out[key] = truncate(value, 500);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Extrai campos seguros de um Error / PostgrestError / OpenRouterError.
 * Nunca expõe `details`/`hint` brutos (podem conter dados do aluno).
 */
export function fromError(err: unknown): LogFields {
  if (!err) return { error: 'unknown' };

  if (err instanceof Error) {
    // deno-lint-ignore no-explicit-any
    const anyErr = err as any;
    return {
      error_name: err.name,
      error_message: truncate(err.message, 200),
      // PostgrestError / OpenRouterError costumam ter `code`/`status`
      error_code: anyErr.code,
      error_status: anyErr.status,
    };
  }

  if (typeof err === 'object') {
    // deno-lint-ignore no-explicit-any
    const anyErr = err as any;
    return {
      error_code: anyErr.code,
      error_status: anyErr.status,
      error_message: typeof anyErr.message === 'string' ? truncate(anyErr.message, 200) : undefined,
    };
  }

  return { error: truncate(String(err), 200) };
}

interface Logger {
  info(evt: string, fields?: LogFields): void;
  warn(evt: string, fields?: LogFields): void;
  error(evt: string, fields?: LogFields): void;
  fromError(err: unknown): LogFields;
}

function emit(level: LogLevel, fn: string, evt: string, fields: LogFields = {}): void {
  const record = {
    ts: new Date().toISOString(),
    level,
    fn,
    evt,
    ...sanitizeFields(fields),
  };
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Cria um logger nomeado pra uma Edge Function.
 *
 * @example
 *   const log = createLogger('process-document');
 *   log.info('pipeline_started', { job_id, user_id });
 */
export function createLogger(fn: string): Logger {
  return {
    info: (evt, fields) => emit('info', fn, evt, fields),
    warn: (evt, fields) => emit('warn', fn, evt, fields),
    error: (evt, fields) => emit('error', fn, evt, fields),
    fromError,
  };
}
