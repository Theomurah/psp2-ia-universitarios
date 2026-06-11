/**
 * T28 — testes de find/create de pastas no Drive (rede mockada).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findFolder,
  createFolder,
  findOrCreateFolder,
  ensureFolderPath,
  ensureRootFolder,
  DriveAuthExpiredError,
  DriveError,
} from '../drive/index.ts';

const accessToken = 'ya29.test';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockReset();
});

describe('findFolder', () => {
  it('retorna a 1ª pasta quando achou', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ files: [{ id: 'F1', name: 'A', parents: ['ROOT'] }] }), { status: 200 }),
    );
    const r = await findFolder('A', 'ROOT', { accessToken });
    expect(r).toEqual({ id: 'F1', name: 'A', parent_id: 'ROOT' });
  });

  it('retorna null quando nada encontrado', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ files: [] }), { status: 200 }),
    );
    const r = await findFolder('Nada', null, { accessToken });
    expect(r).toBeNull();
  });

  it('escapa aspas simples no nome (evita query injection)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ files: [] }), { status: 200 }),
    );
    await findFolder("O'Brien", null, { accessToken });
    const calledUrl = spy.mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent("O\\'Brien"));
  });

  it('lança DriveAuthExpiredError em 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(findFolder('A', null, { accessToken })).rejects.toThrowError(DriveAuthExpiredError);
  });

  it('lança DriveError com status pra erros transitórios após esgotar retries', async () => {
    // 503 é retentável — mocka pra todas as tentativas devolverem 503.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 503 }));
    await expect(findFolder('A', null, { accessToken })).rejects.toMatchObject({ status: 503 });
  });
});

describe('createFolder', () => {
  it('cria com parent e retorna id+name+parent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'F2', name: 'B', parents: ['ROOT'] }), { status: 200 }),
    );
    const r = await createFolder('B', 'ROOT', { accessToken });
    expect(r).toEqual({ id: 'F2', name: 'B', parent_id: 'ROOT' });
  });

  it('cria sem parent (raiz do My Drive) e retorna parent_id null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'ROOT_APP', name: 'Root', parents: [] }), { status: 200 }),
    );
    const r = await createFolder('Root', null, { accessToken });
    expect(r.parent_id).toBeNull();
  });

  it('lança DriveAuthExpiredError em 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(createFolder('X', null, { accessToken })).rejects.toThrowError(DriveAuthExpiredError);
  });

  it('lança DriveError pra outros status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('quota', { status: 403 }));
    await expect(createFolder('X', null, { accessToken })).rejects.toThrowError(DriveError);
  });
});

describe('findOrCreateFolder', () => {
  it('quando encontra, não chama create', async () => {
    const f = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ files: [{ id: 'F1', name: 'A', parents: [null] }] }), { status: 200 }),
      );
    const r = await findOrCreateFolder('A', null, { accessToken });
    expect(r.id).toBe('F1');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('quando não encontra, chama create', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'F_NEW', name: 'A', parents: [] }), { status: 200 }));
    const r = await findOrCreateFolder('A', null, { accessToken });
    expect(r.id).toBe('F_NEW');
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe('ensureFolderPath', () => {
  it('cria cadeia inteira em ordem (find primeiro, create se faltar)', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
      // find '2026.1' — não acha
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      // create '2026.1'
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'SEM_ID', name: '2026.1', parents: ['ROOT'] }), { status: 200 }))
      // find 'Física 3' dentro de SEM_ID — não acha
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      // create 'Física 3'
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'MAT_ID', name: 'Física 3', parents: ['SEM_ID'] }), { status: 200 }));

    const r = await ensureFolderPath('ROOT', ['2026.1', 'Física 3'], { accessToken });
    expect(r).toBe('MAT_ID');
    expect(f).toHaveBeenCalledTimes(4);
  });

  it('retorna rootId se segments vazio', async () => {
    const r = await ensureFolderPath('ROOT', [], { accessToken });
    expect(r).toBe('ROOT');
  });
});

describe('ensureRootFolder', () => {
  it('cria "PSP2 - Estudos" no root se não existir', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ROOT_APP', name: 'PSP2 - Estudos', parents: [] }), { status: 200 }));
    const r = await ensureRootFolder({ accessToken });
    expect(r.name).toBe('PSP2 - Estudos');
    expect(r.id).toBe('ROOT_APP');
  });
});
