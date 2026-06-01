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
 * Persistência durável (espelha o modelo do app Kawi): além do console, eventos
 * `info+` são gravados de forma NÃO-BLOQUEANTE na tabela `activity_logs`
 * (migration 0018), com um `request_id` de correlação por sessão. O threshold de
 * persistência é INDEPENDENTE do de console — em prod o console mostra só `warn+`,
 * mas `info` (ex: auditoria de admin) continua sendo persistido pro registro.
 *
 * Uso:
 *   import { createLogger } from '../lib/log';
 *   const log = createLogger('upload');
 *   log.info('upload_started', { format, size_bytes });
 *   log.error('upload_failed', log.fromError(err));
 */

import { supabase } from './supabase';

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

// ============================================================
// Persistência durável — transport pra tabela activity_logs
// ============================================================

/**
 * Nível mínimo PERSISTIDO no banco. Independente do threshold de console:
 * em prod o console mostra só `warn+`, mas persistimos `info+` pra não perder
 * a trilha de auditoria (ex: ações de admin são `info`). Se o volume incomodar,
 * suba pra `LEVEL_ORDER.warn`.
 */
const PERSIST_MIN_LEVEL = LEVEL_ORDER.info;

/**
 * ID de correlação da sessão (aba). Anexado a todo log persistido pra rastrear
 * um fluxo ponta-a-ponta. Gerado uma vez no load do módulo.
 */
const SESSION_REQUEST_ID: string | null = (() => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // crypto indisponível (contexto não-seguro) — segue sem correlação.
  }
  return null;
})();

/** Retorna o request_id de correlação da sessão atual. */
export function getRequestId(): string | null {
  return SESSION_REQUEST_ID;
}

/**
 * Persiste um evento em `activity_logs` de forma NÃO-BLOQUEANTE (fire-and-forget).
 * Decisões (espelham o transport do Kawi):
 *  - `supabase.ts` não importa o logger, então a dependência é unidirecional
 *    (log.ts → supabase.ts) — sem ciclo, sem dynamic import.
 *  - Guard de sessão: sem user, o INSERT violaria a RLS `activity_logs_insert_own`
 *    — pula em silêncio (log sem dono é inútil e só poluiria o console).
 *  - Erros usam `console.*` direto (nunca o logger) pra não criar loop infinito.
 */
async function persist(rec: { ts: string; level: LogLevel; scope: string; evt: string; fields: LogFields }): Promise<void> {
  try {
    // getSession() lê do storage local (sem round-trip) — barato pra logging.
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    void Promise.resolve(
      supabase.from('activity_logs').insert({
        user_id: userId,
        level: rec.level,
        scope: rec.scope,
        evt: rec.evt,
        request_id: SESSION_REQUEST_ID,
        fields: rec.fields,
        created_at: rec.ts,
      }),
    )
      .then(({ error }) => {
        if (error) console.warn('[log] activity_logs insert falhou:', error.message);
      })
      .catch((err: unknown) => {
        console.warn('[log] activity_logs insert rejeitado:', err instanceof Error ? err.message : String(err));
      });
  } catch {
    // Persistência nunca pode travar a app — falha silenciosa.
  }
}

function emit(level: LogLevel, scope: string, evt: string, fields: LogFields = {}): void {
  const severity = LEVEL_ORDER[level];
  const toConsole = severity >= thresholdLevel();
  const toPersist = severity >= PERSIST_MIN_LEVEL;
  if (!toConsole && !toPersist) return;

  const ts = new Date().toISOString();
  const safeFields = sanitizeFields(fields);

  if (toConsole) {
    const line = JSON.stringify({ ts, level, scope, evt, ...safeFields });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  // Não-bloqueante: nunca aguardamos o insert (UI não pode esperar logging).
  if (toPersist) {
    void persist({ ts, level, scope, evt, fields: safeFields });
  }
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
