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
 * Separação dev/prod: o nível mínimo emitido é controlado pela env var
 * `LOG_LEVEL` (debug | info | warn | error). Default `info`. Em produção
 * deixe `info`; em branch/dev rode com `debug` pra ver o detalhe fino.
 *   supabase secrets set LOG_LEVEL=info    # produção
 *   supabase secrets set LOG_LEVEL=debug   # branch de desenvolvimento
 *
 * Uso típico em uma Edge Function:
 *
 *   import { createLogger } from '../_shared/log.ts';
 *   const log = createLogger('ingest-document');
 *
 *   log.debug('detail', { step });          // só sai com LOG_LEVEL=debug
 *   log.info('received', { user_id: user.id, format });
 *   log.error('insert_failed', log.fromError(err));
 *   log.warn('rate_limited', { user_id: user.id });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

/** Campos canônicos sensíveis — nunca passam por log direto. */
const REDACT_KEYS = new Set([
  'password',
  'access_token',
  'refresh_token',
  'id_token',
  'google_access_token',
  'google_refresh_token',
  'provider_token',
  'provider_refresh_token',
  'api_key',
  'openai_key',
  'anthropic_key',
  'gpt_key',
  'openrouter_api_key',
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
 * Profundidade máxima de sanitização recursiva. Objetos aninhados além
 * desse nível são substituídos por '[depth-limit]' — evita custo/ciclos
 * em estruturas profundas e garante que nada escape da redação.
 */
const SANITIZE_MAX_DEPTH = 4;

/**
 * Sanitiza um valor recursivamente:
 *   - chaves em REDACT_KEYS viram '[redacted]' em QUALQUER nível de aninhamento
 *     (antes só o nível raiz era redigido — auditoria 2026-06-10);
 *   - strings são truncadas (500 chars);
 *   - arrays/objetos são percorridos até SANITIZE_MAX_DEPTH.
 * Mesma semântica espelhada no front (apps/web/src/lib/log.ts).
 */
function sanitizeValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return truncate(value, 500);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= SANITIZE_MAX_DEPTH) return '[depth-limit]';
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACT_KEYS.has(key.toLowerCase())
      ? '[redacted]'
      : sanitizeValue(v, depth + 1);
  }
  return out;
}

/**
 * Sanitiza um objeto de fields: remove chaves sensíveis (inclusive em objetos
 * aninhados) e trunca strings longas.
 */
function sanitizeFields(fields: LogFields): LogFields {
  return sanitizeValue(fields, 0) as LogFields;
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
  debug(evt: string, fields?: LogFields): void;
  info(evt: string, fields?: LogFields): void;
  warn(evt: string, fields?: LogFields): void;
  error(evt: string, fields?: LogFields): void;
  fromError(err: unknown): LogFields;
}

/** Ordem de severidade — usada pra filtrar pelo threshold de LOG_LEVEL. */
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Lê o nível mínimo a emitir de `LOG_LEVEL` (default `info`).
 * Lido a cada emit (custo desprezível) pra permitir override em runtime/teste.
 */
function thresholdLevel(): number {
  // deno-lint-ignore no-explicit-any
  const denoEnv = (globalThis as any).Deno?.env;
  const raw = (denoEnv?.get?.('LOG_LEVEL') ?? 'info').toLowerCase();
  return LEVEL_ORDER[raw as LogLevel] ?? LEVEL_ORDER.info;
}

function emit(level: LogLevel, fn: string, evt: string, fields: LogFields = {}): void {
  if (LEVEL_ORDER[level] < thresholdLevel()) return;
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
    debug: (evt, fields) => emit('debug', fn, evt, fields),
    info: (evt, fields) => emit('info', fn, evt, fields),
    warn: (evt, fields) => emit('warn', fn, evt, fields),
    error: (evt, fields) => emit('error', fn, evt, fields),
    fromError,
  };
}
