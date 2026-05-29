/**
 * T27 — testes do refresh de access_token Google.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshAccessToken, ensureFreshToken, DriveAuthExpiredError, DriveError } from '../drive/index.ts';

beforeEach(() => {
  Deno.env.set('GOOGLE_CLIENT_ID', 'test-client');
  Deno.env.set('GOOGLE_CLIENT_SECRET', 'test-secret');
  vi.spyOn(globalThis, 'fetch').mockReset();
});

afterEach(() => {
  Deno.env.delete('GOOGLE_CLIENT_ID');
  Deno.env.delete('GOOGLE_CLIENT_SECRET');
});

describe('refreshAccessToken', () => {
  it('troca refresh por access novo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        access_token: 'NEW_ACCESS',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/drive.file',
      }), { status: 200 }),
    );
    const pair = await refreshAccessToken('OLD_REFRESH');
    expect(pair.access_token).toBe('NEW_ACCESS');
    expect(pair.refresh_token).toBe('OLD_REFRESH'); // Google reusa
    expect(pair.expires_at).toBeGreaterThan(Date.now());
  });

  it('lança DriveAuthExpiredError em 400/401 (refresh revogado)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('invalid_grant', { status: 400 }));
    await expect(refreshAccessToken('BAD')).rejects.toThrowError(DriveAuthExpiredError);
  });

  it('lança DriveError em 500 após esgotar retries', async () => {
    // 500 é retentável — mocka pra todas as tentativas devolverem 500.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(refreshAccessToken('X')).rejects.toThrowError(DriveError);
  });

  it('lança DriveError quando faltam CLIENT_ID/SECRET', async () => {
    Deno.env.delete('GOOGLE_CLIENT_ID');
    await expect(refreshAccessToken('X')).rejects.toThrowError(DriveError);
  });
});

describe('ensureFreshToken', () => {
  it('retorna o mesmo token quando ainda válido', async () => {
    const token = {
      access_token: 'OK',
      refresh_token: 'R',
      expires_at: Date.now() + 5 * 60 * 1000, // 5 min
      token_type: 'Bearer' as const,
      scope: 'drive.file',
    };
    const out = await ensureFreshToken(token);
    expect(out).toBe(token);
  });

  it('faz refresh quando dentro da margem de expiração', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'NEW', expires_in: 3600 }), { status: 200 }),
    );
    const token = {
      access_token: 'OLD',
      refresh_token: 'R',
      expires_at: Date.now() + 30_000, // 30s — margem é 60s
      token_type: 'Bearer' as const,
      scope: 'drive.file',
    };
    const out = await ensureFreshToken(token);
    expect(out.access_token).toBe('NEW');
  });

  it('lança quando expirado e sem refresh_token', async () => {
    const token = {
      access_token: 'OLD',
      expires_at: Date.now() - 60_000,
      token_type: 'Bearer' as const,
      scope: 'drive.file',
    };
    await expect(ensureFreshToken(token)).rejects.toThrowError(DriveAuthExpiredError);
  });
});
