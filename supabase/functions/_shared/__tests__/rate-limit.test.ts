/**
 * Testes do rate limiter in-memory (_shared/rate-limit.ts).
 *
 * Origem: auditoria 2026-06-10 (TESTS-02, item 3 do plano priorizado —
 * rate-limit.ts estava com 0% de cobertura apesar de ser controle de
 * segurança auditável do CLAUDE.md).
 *
 * Cobre:
 *   - Janela: primeira chamada abre bucket com resetAt = now + windowSec*1000.
 *   - Estouro: além de `max` → ok:false, remaining:0, resetAt preservado.
 *   - Reset: após a janela expirar, o bucket reabre zerado.
 *   - Isolamento: chaves de usuários distintos têm contadores independentes.
 *   - clientFingerprint: preferência user.id > cf-connecting-ip > x-forwarded-for > unknown.
 *
 * O estado (BUCKETS) é module-level e compartilhado entre os testes do
 * arquivo — cada teste usa chaves próprias pra não interferir nos demais.
 * O relógio é controlado via fake Date (vi.setSystemTime), sem timers reais.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, clientFingerprint, type RateLimitOptions } from '../rate-limit.ts';

const T0 = new Date('2026-06-10T12:00:00Z').getTime();
const OPTS: RateLimitOptions = { max: 3, windowSec: 60 };
const WINDOW_MS = OPTS.windowSec * 1000;

beforeEach(() => {
  // Só Date — checkRateLimit usa apenas Date.now(), nenhum timer agendado.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkRateLimit — janela', () => {
  it('primeira chamada abre o bucket: ok, remaining = max-1, resetAt = now + janela', () => {
    const r = checkRateLimit('u:window-first', OPTS);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(OPTS.max - 1);
    expect(r.resetAt).toBe(T0 + WINDOW_MS);
  });

  it('chamadas seguintes na mesma janela decrementam remaining e mantêm resetAt', () => {
    const key = 'u:window-decrement';
    checkRateLimit(key, OPTS); // 1ª (remaining 2)

    const r2 = checkRateLimit(key, OPTS);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(1);
    expect(r2.resetAt).toBe(T0 + WINDOW_MS);

    const r3 = checkRateLimit(key, OPTS);
    expect(r3.ok).toBe(true);
    expect(r3.remaining).toBe(0);
    expect(r3.resetAt).toBe(T0 + WINDOW_MS);
  });
});

describe('checkRateLimit — estouro', () => {
  it('além de max → ok:false, remaining:0, resetAt da janela original', () => {
    const key = 'u:burst-overflow';
    for (let i = 0; i < OPTS.max; i++) {
      expect(checkRateLimit(key, OPTS).ok).toBe(true);
    }

    const blocked = checkRateLimit(key, OPTS);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBe(T0 + WINDOW_MS);
  });

  it('continua bloqueado até o fim da janela (inclusive no instante exato do resetAt)', () => {
    const key = 'u:blocked-until-reset';
    for (let i = 0; i <= OPTS.max; i++) checkRateLimit(key, OPTS);

    // 1ms antes do reset: ainda bloqueado
    vi.setSystemTime(T0 + WINDOW_MS - 1);
    expect(checkRateLimit(key, OPTS).ok).toBe(false);

    // Exatamente em resetAt: a comparação é estrita (resetAt < now) → ainda bloqueado
    vi.setSystemTime(T0 + WINDOW_MS);
    expect(checkRateLimit(key, OPTS).ok).toBe(false);
  });

  it('chamadas bloqueadas não estendem a janela (sem sliding window punitivo)', () => {
    const key = 'u:no-window-extension';
    for (let i = 0; i < OPTS.max; i++) checkRateLimit(key, OPTS);

    vi.setSystemTime(T0 + WINDOW_MS / 2);
    const blocked = checkRateLimit(key, OPTS);
    expect(blocked.ok).toBe(false);
    // resetAt segue ancorado na abertura do bucket
    expect(blocked.resetAt).toBe(T0 + WINDOW_MS);
  });
});

describe('checkRateLimit — reset da janela', () => {
  it('após a janela expirar, o bucket reabre zerado com novo resetAt', () => {
    const key = 'u:window-reset';
    for (let i = 0; i <= OPTS.max; i++) checkRateLimit(key, OPTS);
    expect(checkRateLimit(key, OPTS).ok).toBe(false);

    const t1 = T0 + WINDOW_MS + 1;
    vi.setSystemTime(t1);

    const r = checkRateLimit(key, OPTS);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(OPTS.max - 1);
    expect(r.resetAt).toBe(t1 + WINDOW_MS);
  });

  it('depois do reset o limite volta a valer integralmente', () => {
    const key = 'u:full-quota-after-reset';
    for (let i = 0; i <= OPTS.max; i++) checkRateLimit(key, OPTS);

    vi.setSystemTime(T0 + WINDOW_MS + 1);
    for (let i = 0; i < OPTS.max; i++) {
      expect(checkRateLimit(key, OPTS).ok).toBe(true);
    }
    expect(checkRateLimit(key, OPTS).ok).toBe(false);
  });
});

describe('checkRateLimit — chaves por usuário', () => {
  it('usuários distintos têm contadores independentes', () => {
    const userA = 'u:user-aaaa';
    const userB = 'u:user-bbbb';

    // A estoura o limite
    for (let i = 0; i <= OPTS.max; i++) checkRateLimit(userA, OPTS);
    expect(checkRateLimit(userA, OPTS).ok).toBe(false);

    // B não é afetado
    const rB = checkRateLimit(userB, OPTS);
    expect(rB.ok).toBe(true);
    expect(rB.remaining).toBe(OPTS.max - 1);
  });

  it('o mesmo usuário em endpoints diferentes (prefixo na chave) não compartilha bucket', () => {
    const upload = 'upload:u:same-user';
    const ingest = 'ingest:u:same-user';

    for (let i = 0; i <= OPTS.max; i++) checkRateLimit(upload, OPTS);
    expect(checkRateLimit(upload, OPTS).ok).toBe(false);
    expect(checkRateLimit(ingest, OPTS).ok).toBe(true);
  });
});

describe('clientFingerprint — identificador estável', () => {
  const makeReq = (headers: Record<string, string> = {}) =>
    new Request('http://localhost/fn', { headers });

  it('prefere user.id quando presente (ignora headers de IP)', () => {
    const req = makeReq({ 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '5.6.7.8' });
    expect(clientFingerprint(req, 'abc-123')).toBe('u:abc-123');
  });

  it('sem user: prefere cf-connecting-ip sobre x-forwarded-for', () => {
    const req = makeReq({ 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '5.6.7.8' });
    expect(clientFingerprint(req, null)).toBe('ip:5.6.7.8');
  });

  it('sem cf-connecting-ip: usa o PRIMEIRO IP do x-forwarded-for (client real, não proxies)', () => {
    const req = makeReq({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1, 10.0.0.2' });
    expect(clientFingerprint(req, undefined)).toBe('ip:9.9.9.9');
  });

  it('sem nenhum header → fallback "unknown"', () => {
    expect(clientFingerprint(makeReq(), null)).toBe('ip:unknown');
  });

  it('fingerprints distintos geram buckets distintos de fato', () => {
    const reqA = makeReq({ 'cf-connecting-ip': '11.11.11.11' });
    const reqB = makeReq({ 'cf-connecting-ip': '22.22.22.22' });
    const keyA = clientFingerprint(reqA, null);
    const keyB = clientFingerprint(reqB, null);
    expect(keyA).not.toBe(keyB);

    for (let i = 0; i <= OPTS.max; i++) checkRateLimit(keyA, OPTS);
    expect(checkRateLimit(keyA, OPTS).ok).toBe(false);
    expect(checkRateLimit(keyB, OPTS).ok).toBe(true);
  });
});

describe('checkRateLimit — GC de buckets expirados (proteção de memória)', () => {
  it('com o map cheio de entries expiradas, novas chaves seguem funcionando', () => {
    // Enche o map até MAX_BUCKETS (10_000) com janelas curtas
    const shortOpts: RateLimitOptions = { max: 1, windowSec: 1 };
    for (let i = 0; i < 10_000; i++) {
      checkRateLimit(`gc:fill-${i}`, shortOpts);
    }

    // Avança além da expiração de todas — a próxima chamada dispara o GC
    vi.setSystemTime(T0 + 5_000);
    const r = checkRateLimit('gc:after-sweep', OPTS);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(OPTS.max - 1);

    // E uma das chaves antigas reabre janela nova (não herda o count antigo)
    const reopened = checkRateLimit('gc:fill-0', shortOpts);
    expect(reopened.ok).toBe(true);
    expect(reopened.resetAt).toBe(T0 + 5_000 + 1_000);
  });
});
