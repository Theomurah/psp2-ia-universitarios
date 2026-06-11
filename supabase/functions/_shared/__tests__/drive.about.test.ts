/**
 * Testes do helper getAbout — parsing da resposta e tratamento de auth.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAbout, DriveAuthExpiredError, DriveError } from '../drive/index.ts';

const accessToken = 'ya29.test';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockReset();
});

describe('getAbout', () => {
  it('retorna email, nome e quota parseados', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            emailAddress: 'theo@aluno.unb.br',
            displayName: 'Theo Murahovschi',
            photoLink: 'https://lh3.googleusercontent.com/x',
          },
          storageQuota: {
            usage: '5368709120',          // 5 GB
            limit: '16106127360',         // 15 GB (tier free do Google One)
            usageInDrive: '4294967296',   // 4 GB
          },
        }),
        { status: 200 },
      ),
    );

    const info = await getAbout(accessToken);
    expect(info.email).toBe('theo@aluno.unb.br');
    expect(info.display_name).toBe('Theo Murahovschi');
    expect(info.storage_used).toBe(5368709120);
    expect(info.storage_limit).toBe(16106127360);
    expect(info.storage_used_drive).toBe(4294967296);
  });

  it('trata storage_limit = null pra contas com armazenamento ilimitado', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: { emailAddress: 'workspace@unb.br' },
          storageQuota: { usage: '1024', usageInDrive: '1024' }, // sem limit
        }),
        { status: 200 },
      ),
    );

    const info = await getAbout(accessToken);
    expect(info.storage_limit).toBeNull();
  });

  it('lança DriveAuthExpiredError em 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{"error":"invalid_token"}', { status: 401 }),
    );
    await expect(getAbout(accessToken)).rejects.toBeInstanceOf(DriveAuthExpiredError);
  });

  it('lança DriveError em outro erro', async () => {
    // Para forçar não-retentável, usamos 400
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('bad request', { status: 400 }),
    );
    await expect(getAbout(accessToken)).rejects.toBeInstanceOf(DriveError);
  });

  it('chama o endpoint correto com fields parametrizados', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ user: {}, storageQuota: {} }), { status: 200 }),
    );
    await getAbout(accessToken);

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/www\.googleapis\.com\/drive\/v3\/about/);
    expect(url).toContain('fields=');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer ya29.test');
  });
});
