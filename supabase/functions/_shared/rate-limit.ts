/**
 * Rate limiter in-memory para Edge Functions.
 *
 * Bom o suficiente pra defesa contra abuso casual e burst attacks.
 * NÃO é distribuído — instâncias diferentes do edge worker têm contadores
 * separados (Supabase escala horizontal). Pra produção heavy-load, trocar
 * por Upstash Redis. Por enquanto cobre 90% dos casos.
 *
 * Uso:
 *   const limit = await checkRateLimit(`upload:${user.id}`, { max: 10, windowSec: 60 });
 *   if (!limit.ok) return errorResponse(req, 'rate_limited', 429);
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const BUCKETS = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000; // proteção contra memory leak

export interface RateLimitOptions {
  max: number;
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;

  // GC barato: se o map encheu, dropa entries expiradas
  if (BUCKETS.size >= MAX_BUCKETS) {
    for (const [k, b] of BUCKETS.entries()) {
      if (b.resetAt < now) BUCKETS.delete(k);
    }
  }

  const existing = BUCKETS.get(key);
  if (!existing || existing.resetAt < now) {
    const resetAt = now + windowMs;
    BUCKETS.set(key, { count: 1, resetAt });
    return { ok: true, remaining: opts.max - 1, resetAt };
  }

  if (existing.count >= opts.max) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { ok: true, remaining: opts.max - existing.count, resetAt: existing.resetAt };
}

/**
 * Extrai um identificador estável para rate limiting:
 * preferência por user.id, fallback pra IP (via x-forwarded-for ou cf-connecting-ip).
 */
export function clientFingerprint(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const cf = req.headers.get('cf-connecting-ip') ?? '';
  const ip = (cf || xff.split(',')[0] || 'unknown').trim();
  return `ip:${ip}`;
}
