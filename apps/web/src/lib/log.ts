/**
 * Logger estruturado do frontend — espelho de `supabase/functions/_shared/log.ts`.
 *
 * Por que existe: padroniza o logging do app (mesmo schema JSON 1-evento-por-linha)
 * e força a sanitização exigida pelo CLAUDE.md — nunca logar o objeto de erro cru
 * (pode vazar `details`/`hint` de PostgrestError), token, email ou conteúdo do aluno.
 *
 * Separação dev/prod (decidida em BUILD-TIME via Vite):
 *   - `vite dev`   → import.meta.env.DEV  → nível `debug` (loga tudo)
 *   - `vite build` → import.meta.env.PROD → nível `warn`  (só warn + error)
 *
 * Como `import.meta.env.PROD` é constante de build, o threshold é estático e o
 * bundler consegue podar os ramos. Em produção, `log.info(...)` vira no-op.
 *
 * Override em runtime (debug pontual em prod sem redeploy):
 *   localStorage.setItem('psp2:log_level', 'debug')  // depois recarregue
 *
 * Uso:
 *   import { createLogger } from '../lib/log';
 *   const log = createLogger('upload');
 *   log.info('upload_started', { format, size_bytes });
 *   log.error('upload_failed', log.fromError(err));
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

/**
 * Chaves sensíveis — nunca passam por log direto. Espelha REDACT_KEYS do helper
 * canônico das Edge Functions, com adições relevantes pro frontend (full_name).
 */
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
  'openrouter_api_key',
  'authorization',
  'cookie',
  'email',
  'full_name',
  'markdown',
  'texto',
  'texto_bruto',
  'messages',
  // PostgrestError — details/hint podem conter valor de linha (PII).
  'details',
  'hint',
]);

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Threshold base resolvido em build-time. DEV = debug, PROD = warn.
 * Mantido como constante pra permitir tree-shaking dos ramos pelo Vite.
 */
const BUILD_THRESHOLD: number = import.meta.env.PROD ? LEVEL_ORDER.warn : LEVEL_ORDER.debug;

/** Lê override opcional de localStorage (não quebra em modo privado/SSR). */
function runtimeOverride(): number | null {
  try {
    const raw = localStorage.getItem('psp2:log_level')?.toLowerCase();
    if (raw && raw in LEVEL_ORDER) return LEVEL_ORDER[raw as LogLevel];
  } catch {
    // localStorage indisponível — ignora.
  }
  return null;
}

function thresholdLevel(): number {
  return runtimeOverride() ?? BUILD_THRESHOLD;
}

/** Trunca strings longas pra não inflar o log. */
function truncate(value: string, max = 500): string {
  return value.length > max ? `${value.slice(0, max)}…[+${value.length - max}]` : value;
}

function sanitizeFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = typeof value === 'string' ? truncate(value) : value;
  }
  return out;
}

/**
 * Extrai campos seguros de um erro (Error / PostgrestError / AuthError).
 * Nunca expõe `details`/`hint` brutos.
 */
export function fromError(err: unknown): LogFields {
  if (!err) return { error: 'unknown' };
  if (err instanceof Error) {
    const anyErr = err as Error & { code?: unknown; status?: unknown };
    return {
      error_name: err.name,
      error_message: truncate(err.message, 200),
      error_code: anyErr.code,
      error_status: anyErr.status,
    };
  }
  if (typeof err === 'object') {
    const anyErr = err as { code?: unknown; status?: unknown; message?: unknown };
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

function emit(level: LogLevel, scope: string, evt: string, fields: LogFields = {}): void {
  if (LEVEL_ORDER[level] < thresholdLevel()) return;
  const record = {
    ts: new Date().toISOString(),
    level,
    scope,
    evt,
    ...sanitizeFields(fields),
  };
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Cria um logger nomeado pra um módulo/feature do frontend.
 *
 * @example
 *   const log = createLogger('auth');
 *   log.info('signin_succeeded', { email_domain });
 */
export function createLogger(scope: string): Logger {
  return {
    debug: (evt, fields) => emit('debug', scope, evt, fields),
    info: (evt, fields) => emit('info', scope, evt, fields),
    warn: (evt, fields) => emit('warn', scope, evt, fields),
    error: (evt, fields) => emit('error', scope, evt, fields),
    fromError,
  };
}

/**
 * Helper: extrai só o domínio de um email pra log (nunca o endereço completo).
 *   "theo@aluno.unb.br" → "aluno.unb.br"
 */
export function emailDomain(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return 'unknown';
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}
