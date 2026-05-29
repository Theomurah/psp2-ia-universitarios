/**
 * Testes do helper de retry — comportamento de backoff, classificação de
 * erros retentáveis e respeito ao limite de tentativas.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  withRetry,
  isRetryable,
  DriveError,
  DriveAuthExpiredError,
} from '../drive/index.ts';

// Sleep instantâneo nos testes — evita timeout
const sleep = () => Promise.resolve();

describe('isRetryable', () => {
  it('retorna true para 5xx', () => {
    expect(isRetryable(new DriveError('boom', 500))).toBe(true);
    expect(isRetryable(new DriveError('boom', 503))).toBe(true);
  });

  it('retorna true para 429', () => {
    expect(isRetryable(new DriveError('rate', 429))).toBe(true);
  });

  it('retorna true para 403 com rateLimit no body', () => {
    expect(
      isRetryable(new DriveError('forbidden', 403, 'rateLimitExceeded')),
    ).toBe(true);
  });

  it('retorna false para 403 comum', () => {
    expect(isRetryable(new DriveError('forbidden', 403, 'permission'))).toBe(false);
  });

  it('retorna false para 400/404', () => {
    expect(isRetryable(new DriveError('bad', 400))).toBe(false);
    expect(isRetryable(new DriveError('not found', 404))).toBe(false);
  });

  it('retorna false para DriveAuthExpiredError (401)', () => {
    expect(isRetryable(new DriveAuthExpiredError())).toBe(false);
  });

  it('retorna true para TypeError de fetch (network)', () => {
    expect(isRetryable(new TypeError('failed to fetch'))).toBe(true);
  });

  it('retorna false para Error genérico', () => {
    expect(isRetryable(new Error('something'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('retorna na primeira tentativa quando fn passa', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { sleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retenta em 5xx até sucesso', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new DriveError('boom', 503))
      .mockRejectedValueOnce(new DriveError('boom', 502))
      .mockResolvedValue('done');

    const result = await withRetry(fn, { attempts: 4, sleep });
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('aborta imediatamente em erro non-retryable (401)', async () => {
    const fn = vi.fn().mockRejectedValue(new DriveAuthExpiredError());
    await expect(withRetry(fn, { attempts: 4, sleep })).rejects.toBeInstanceOf(
      DriveAuthExpiredError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aborta em 400 sem retentar', async () => {
    const fn = vi.fn().mockRejectedValue(new DriveError('bad request', 400));
    await expect(withRetry(fn, { attempts: 4, sleep })).rejects.toBeInstanceOf(DriveError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respeita o limite de tentativas e lança o último erro', async () => {
    const fn = vi.fn().mockRejectedValue(new DriveError('boom', 503));
    await expect(withRetry(fn, { attempts: 3, sleep })).rejects.toMatchObject({
      status: 503,
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('aplica backoff exponencial via sleep', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new DriveError('boom', 503))
      .mockRejectedValueOnce(new DriveError('boom', 503))
      .mockResolvedValue('done');

    const delays: number[] = [];
    const fakeSleep = (ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    };

    await withRetry(fn, { attempts: 4, baseDelayMs: 100, jitterMs: 0, sleep: fakeSleep });

    expect(delays).toHaveLength(2);
    expect(delays[0]).toBe(100); // 100 * 2^0
    expect(delays[1]).toBe(200); // 100 * 2^1
  });

  it('respeita o cap superior do delay', async () => {
    const fn = vi.fn().mockRejectedValue(new DriveError('boom', 503));

    const delays: number[] = [];
    const fakeSleep = (ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    };

    await expect(
      withRetry(fn, {
        attempts: 5,
        baseDelayMs: 1000,
        jitterMs: 0,
        capMs: 1500,
        sleep: fakeSleep,
      }),
    ).rejects.toThrow();

    expect(delays).toEqual([1000, 1500, 1500, 1500]); // capa em 1500
  });
});
