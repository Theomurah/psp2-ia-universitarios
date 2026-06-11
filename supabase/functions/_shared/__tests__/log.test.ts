/**
 * Testes do logger estruturado das Edge Functions (_shared/log.ts).
 *
 * Cobre:
 *   - Redação de chaves sensíveis (REDACT_KEYS) e truncamento.
 *   - fromError: extrai campos seguros, nunca details/hint.
 *   - Threshold via LOG_LEVEL (separação dev/prod).
 *   - Roteamento por nível pro console correto.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger, fromError } from '../log.ts';

function parseLast(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const calls = spy.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return JSON.parse(calls[calls.length - 1][0] as string);
}

describe('createLogger — formato e redação', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Deno.env.set('LOG_LEVEL', 'debug'); // emite tudo nos testes
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emite JSON com schema { ts, level, fn, evt, ...campos }', () => {
    const log = createLogger('test-fn');
    log.info('hello', { user_id: 'abc' });
    const rec = parseLast(logSpy);
    expect(rec.level).toBe('info');
    expect(rec.fn).toBe('test-fn');
    expect(rec.evt).toBe('hello');
    expect(rec.user_id).toBe('abc');
    expect(typeof rec.ts).toBe('string');
  });

  it('redige chaves sensíveis', () => {
    const log = createLogger('test-fn');
    log.info('evt', {
      access_token: 'secret',
      email: 'a@b.com',
      markdown: 'conteúdo do aluno',
      authorization: 'Bearer xyz',
      safe: 'ok',
    });
    const rec = parseLast(logSpy);
    expect(rec.access_token).toBe('[redacted]');
    expect(rec.email).toBe('[redacted]');
    expect(rec.markdown).toBe('[redacted]');
    expect(rec.authorization).toBe('[redacted]');
    expect(rec.safe).toBe('ok');
  });

  it('redige chaves sensíveis em objetos aninhados e arrays (redação profunda)', () => {
    const log = createLogger('test-fn');
    log.info('evt', {
      ctx: {
        user: { email: 'a@b.com', id: 'u1' },
        tokens: [{ access_token: 'secret' }],
      },
      safe: 'ok',
    });
    const rec = parseLast(logSpy);
    const ctx = rec.ctx as {
      user: { email: string; id: string };
      tokens: Array<{ access_token: string }>;
    };
    expect(ctx.user.email).toBe('[redacted]');
    expect(ctx.user.id).toBe('u1');
    expect(ctx.tokens[0].access_token).toBe('[redacted]');
    expect(rec.safe).toBe('ok');
  });

  it('corta objetos além do limite de profundidade com [depth-limit]', () => {
    const log = createLogger('test-fn');
    log.info('evt', { a: { b: { c: { d: { e: 'fundo demais' } } } } });
    const rec = parseLast(logSpy);
    const a = rec.a as { b: { c: { d: unknown } } };
    expect(a.b.c.d).toBe('[depth-limit]');
  });

  it('trunca strings longas também em níveis aninhados', () => {
    const log = createLogger('test-fn');
    log.info('evt', { nested: { big: 'x'.repeat(600) } });
    const rec = parseLast(logSpy);
    const nested = rec.nested as { big: string };
    expect(nested.big.length).toBeLessThan(600);
    expect(nested.big).toContain('…[+100]');
  });

  it('roteia cada nível para o console correto', () => {
    const log = createLogger('test-fn');
    log.warn('w');
    log.error('e');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warnSpy.mock.calls[0][0] as string).level).toBe('warn');
    expect(JSON.parse(errorSpy.mock.calls[0][0] as string).level).toBe('error');
  });
});

describe('fromError — campos seguros', () => {
  it('extrai name/message/code/status de um Error', () => {
    const err = Object.assign(new Error('boom'), { code: '23505', status: 409 });
    const f = fromError(err);
    expect(f.error_name).toBe('Error');
    expect(f.error_message).toBe('boom');
    expect(f.error_code).toBe('23505');
    expect(f.error_status).toBe(409);
  });

  it('nunca expõe details/hint do PostgrestError', () => {
    const pgErr = { code: '42501', message: 'permission denied', details: 'row: {valor secreto}', hint: 'use RLS' };
    const f = fromError(pgErr);
    expect(f.error_code).toBe('42501');
    expect(Object.keys(f)).not.toContain('details');
    expect(Object.keys(f)).not.toContain('hint');
  });
});

describe('threshold via LOG_LEVEL (separação dev/prod)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('default (sem env) é info: debug é suprimido, info passa', () => {
    Deno.env.delete('LOG_LEVEL');
    const log = createLogger('fn');
    log.debug('hidden');
    log.info('shown');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0] as string).evt).toBe('shown');
  });

  it('LOG_LEVEL=debug emite debug', () => {
    Deno.env.set('LOG_LEVEL', 'debug');
    createLogger('fn').debug('now-visible');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0] as string).evt).toBe('now-visible');
  });

  it('LOG_LEVEL=error suprime info mas mantém error', () => {
    Deno.env.set('LOG_LEVEL', 'error');
    const log = createLogger('fn');
    log.info('quiet');
    log.error('loud');
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('LOG_LEVEL inválido cai pro default info', () => {
    Deno.env.set('LOG_LEVEL', 'banana');
    const log = createLogger('fn');
    log.debug('hidden');
    log.info('shown');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
