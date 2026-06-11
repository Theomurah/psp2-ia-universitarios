/**
 * Helper de retry com backoff exponencial pra Google Drive API v3.
 *
 * Conforme a documentação oficial, devem ser retentados:
 *   - 5xx (Server Error)
 *   - 429 (Too Many Requests)
 *   - 403 com motivo `rateLimitExceeded` / `userRateLimitExceeded`
 *
 * 4xx restante = restart da operação, NÃO retry no mesmo request.
 *
 * Backoff: base 500ms, dobra a cada tentativa, com jitter aleatório de até 250ms.
 *
 * Ref: https://developers.google.com/workspace/drive/api/guides/handle-errors
 */

import { DriveAuthExpiredError, DriveError } from './types.ts';

export interface RetryOptions {
  /** Tentativas totais (1 = sem retry). Default 4. */
  attempts?: number;
  /** Base em ms (multiplicado por 2^n). Default 500. */
  baseDelayMs?: number;
  /** Jitter máximo em ms somado ao delay. Default 250. */
  jitterMs?: number;
  /** Cap superior em ms (não cresce além disso). Default 8000. */
  capMs?: number;
  /** Sleep customizado (pra testes determinísticos). */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Decide se um erro é retentável segundo as regras Drive API.
 * Caller pode reusar pra outros cenários.
 */
export function isRetryable(err: unknown): boolean {
  if (err instanceof DriveAuthExpiredError) return false; // 401 não retenta
  if (err instanceof DriveError) {
    const s = err.status;
    if (s >= 500 && s < 600) return true;       // 5xx
    if (s === 429) return true;                  // rate limit
    // 403 rate limit (raro, distinto de "forbidden" comum)
    if (s === 403 && typeof err.body === 'string' && /rateLimit/i.test(err.body)) return true;
    return false;
  }
  // Erros de rede (TypeError em fetch) — retenta
  if (err instanceof TypeError && /fetch/i.test(err.message)) return true;
  return false;
}

/**
 * Executa `fn` retentando em erros transitórios com backoff exponencial.
 * Re-lança o último erro se todas as tentativas falharem (ou se for non-retryable).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const baseDelay = opts.baseDelayMs ?? 500;
  const jitter = opts.jitterMs ?? 250;
  const cap = opts.capMs ?? 8000;
  const sleep = opts.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      if (!isRetryable(err)) break;
      const exp = Math.min(baseDelay * 2 ** i, cap);
      const delay = exp + Math.floor(Math.random() * jitter);
      await sleep(delay);
    }
  }
  throw lastErr;
}
