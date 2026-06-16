/**
 * T29 — testes do upload multipart pro Drive.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadFile,
  uploadMarkdown,
  updateFile,
  updateMarkdown,
  DriveAuthExpiredError,
  DriveError,
} from '../drive/index.ts';

const accessToken = 'ya29.test';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockReset();
});

describe('uploadFile', () => {
  it('faz POST multipart e retorna id+name+webViewLink', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'FILE_ID',
          name: 'aula.md',
          webViewLink: 'https://drive.google.com/file/d/FILE_ID',
          parents: ['FOLDER_ID'],
        }),
        { status: 200 },
      ),
    );

    const r = await uploadFile({
      accessToken,
      parentId: 'FOLDER_ID',
      filename: 'aula.md',
      content: '# conteúdo',
      mimeType: 'text/markdown',
    });

    expect(r.id).toBe('FILE_ID');
    expect(r.webViewLink).toMatch(/drive\.google\.com/);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('uploadType=multipart');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer ya29.test');
    expect(headers['Content-Type']).toMatch(/multipart\/related; boundary=psp2-/);
  });

  it('aceita Uint8Array como content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'X', name: 'a.pdf', parents: [] }), { status: 200 }),
    );
    const r = await uploadFile({
      accessToken,
      parentId: null,
      filename: 'a.pdf',
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      mimeType: 'application/pdf',
    });
    expect(r.id).toBe('X');
  });

  it('lança DriveAuthExpiredError em 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(
      uploadFile({ accessToken, parentId: null, filename: 'x.md', content: 'x' }),
    ).rejects.toThrowError(DriveAuthExpiredError);
  });

  it('lança DriveError pra outros status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('quota exceeded', { status: 403 }),
    );
    await expect(
      uploadFile({ accessToken, parentId: null, filename: 'x.md', content: 'x' }),
    ).rejects.toThrowError(DriveError);
  });
});

describe('uploadMarkdown', () => {
  it('força mimeType text/markdown e passa markdown como content', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'MD_ID', name: 'aula.md', parents: [] }), { status: 200 }),
    );

    await uploadMarkdown({
      accessToken,
      parentId: null,
      filename: 'aula.md',
      markdown: '# Título\n\nConteúdo.',
    });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const bodyAsBytes = init.body as Uint8Array;
    const text = new TextDecoder().decode(bodyAsBytes);
    expect(text).toContain('Content-Type: text/markdown');
    expect(text).toContain('# Título');
  });
});

describe('updateFile (reprocessamento)', () => {
  it('faz PATCH multipart no fileId com name + trashed:false no metadata', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'FILE_ID',
          name: 'aula-v2.md',
          webViewLink: 'https://drive.google.com/file/d/FILE_ID',
          parents: ['FOLDER_ID'],
        }),
        { status: 200 },
      ),
    );

    const r = await updateFile({
      accessToken,
      fileId: 'FILE_ID',
      filename: 'aula-v2.md',
      content: '# conteúdo novo',
      mimeType: 'text/markdown',
    });

    expect(r.id).toBe('FILE_ID');

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/files/FILE_ID?uploadType=multipart');
    expect(init.method).toBe('PATCH');

    const text = new TextDecoder().decode(init.body as Uint8Array);
    expect(text).toContain('"name":"aula-v2.md"');
    expect(text).toContain('"trashed":false');
    expect(text).not.toContain('parents'); // update não aceita parents no metadata
    expect(text).toContain('# conteúdo novo');
  });

  it('lança DriveError 404 se o arquivo foi apagado em definitivo (sem retry)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('File not found', { status: 404 }));

    await expect(
      updateMarkdown({ accessToken, fileId: 'GONE', filename: 'x.md', markdown: 'x' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 404 não é retentável
  });

  it('lança DriveAuthExpiredError em 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(
      updateMarkdown({ accessToken, fileId: 'F', filename: 'x.md', markdown: 'x' }),
    ).rejects.toThrowError(DriveAuthExpiredError);
  });
});

describe('uploadFile (resumable, ≥ 5 MiB)', () => {
  it('usa Resumable Upload em 2 chamadas (init + PUT)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      // Passo 1 — init, retorna Location
      .mockResolvedValueOnce(
        new Response('', {
          status: 200,
          headers: {
            Location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=SESSION_ID',
          },
        }),
      )
      // Passo 2 — PUT com bytes, retorna metadata final
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'BIG_FILE_ID',
            name: 'apostila.pdf',
            webViewLink: 'https://drive.google.com/file/d/BIG_FILE_ID',
            parents: ['FOLDER'],
          }),
          { status: 200 },
        ),
      );

    // 6 MiB > RESUMABLE_THRESHOLD (5 MiB)
    const bigContent = new Uint8Array(6 * 1024 * 1024);
    const r = await uploadFile({
      accessToken,
      parentId: 'FOLDER',
      filename: 'apostila.pdf',
      content: bigContent,
      mimeType: 'application/pdf',
    });

    expect(r.id).toBe('BIG_FILE_ID');
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Passo 1: POST + headers X-Upload-*
    const [initUrl, initOpts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(initUrl).toContain('uploadType=resumable');
    const initHeaders = initOpts.headers as Record<string, string>;
    expect(initHeaders['X-Upload-Content-Type']).toBe('application/pdf');
    expect(initHeaders['X-Upload-Content-Length']).toBe(String(6 * 1024 * 1024));
    expect(initOpts.method).toBe('POST');

    // Passo 2: PUT no Location URI com os bytes
    const [putUrl, putOpts] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(putUrl).toContain('upload_id=SESSION_ID');
    expect(putOpts.method).toBe('PUT');
    const putHeaders = putOpts.headers as Record<string, string>;
    expect(putHeaders['Content-Type']).toBe('application/pdf');
    expect(putHeaders['Content-Length']).toBe(String(6 * 1024 * 1024));
  });

  it('lança DriveError se o init não devolver Location (retentável → esgota retries)', async () => {
    // "Sem Location" gera DriveError com status 500 (retentável) — mocka todas as tentativas.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }), // 200 mas sem header Location
    );

    const bigContent = new Uint8Array(6 * 1024 * 1024);
    await expect(
      uploadFile({
        accessToken,
        parentId: null,
        filename: 'big.pdf',
        content: bigContent,
        mimeType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(DriveError);
  });

  it('propaga 404 do PUT (sessão expirada) sem retentar', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('', {
          status: 200,
          headers: { Location: 'https://upload.example/x' },
        }),
      )
      .mockResolvedValueOnce(new Response('expired', { status: 404 }));

    const bigContent = new Uint8Array(6 * 1024 * 1024);
    await expect(
      uploadFile({
        accessToken,
        parentId: null,
        filename: 'big.pdf',
        content: bigContent,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
