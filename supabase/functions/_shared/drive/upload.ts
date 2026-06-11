/**
 * Upload de arquivos pro Google Drive (T29).
 *
 * Duas estratégias:
 *   - Multipart Upload (uma chamada HTTP, metadata + bytes) → ideal pra arquivos pequenos.
 *   - Resumable Upload (POST inicial pra obter Location, depois PUT com bytes) →
 *     necessário pra arquivos grandes ou redes instáveis.
 *
 * A função `uploadFile` decide automaticamente qual usar:
 *   < RESUMABLE_THRESHOLD bytes → multipart
 *   ≥ RESUMABLE_THRESHOLD bytes → resumable
 *
 * Ref oficial: https://developers.google.com/workspace/drive/api/guides/manage-uploads
 */

import {
  DriveAuthExpiredError,
  DriveError,
  type DriveFileUploadResult,
} from './types.ts';
import { withRetry } from './retry.ts';

const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Limite acima do qual usar Resumable Upload em vez de Multipart.
 * Recomendação Google: ≥ 5 MB. Usamos 5 MiB pra simplicidade.
 */
export const RESUMABLE_THRESHOLD = 5 * 1024 * 1024;

export interface UploadOptions {
  accessToken: string;
  /** Pasta destino (id). Se null, vai pra "My Drive" raiz. */
  parentId: string | null;
  /** Nome do arquivo final no Drive (com extensão). */
  filename: string;
  /** Bytes do arquivo. */
  content: Uint8Array | string;
  /** MIME type. Default text/markdown. */
  mimeType?: string;
}

function normalizeContent(content: Uint8Array | string): Uint8Array {
  if (typeof content === 'string') return new TextEncoder().encode(content);
  return content;
}

function buildMetadata(opts: UploadOptions, mimeType: string): Record<string, unknown> {
  const meta: Record<string, unknown> = { name: opts.filename, mimeType };
  if (opts.parentId) meta.parents = [opts.parentId];
  return meta;
}

/**
 * Faz upload e retorna o id + link de visualização. Escolhe multipart ou
 * resumable conforme o tamanho do conteúdo. Aplica retry com backoff.
 */
export async function uploadFile(opts: UploadOptions): Promise<DriveFileUploadResult> {
  const bytes = normalizeContent(opts.content);
  if (bytes.length >= RESUMABLE_THRESHOLD) {
    return uploadFileResumable(opts, bytes);
  }
  return uploadFileMultipart(opts, bytes);
}

/**
 * Multipart Upload — uma única chamada HTTP com metadata + bytes.
 * Indicado pra arquivos ≤ 5 MB segundo a recomendação oficial.
 */
async function uploadFileMultipart(
  opts: UploadOptions,
  bodyContent: Uint8Array,
): Promise<DriveFileUploadResult> {
  const mimeType = opts.mimeType ?? 'text/markdown';
  const metadata = buildMetadata(opts, mimeType);

  // Constrói multipart manualmente — fetch não tem helper nativo pra isso
  const boundary = `psp2-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();

  const head =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    '\r\n' +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;

  const headBytes = encoder.encode(head);
  const tailBytes = encoder.encode(tail);
  const body = new Uint8Array(headBytes.length + bodyContent.length + tailBytes.length);
  body.set(headBytes, 0);
  body.set(bodyContent, headBytes.length);
  body.set(tailBytes, headBytes.length + bodyContent.length);

  const url = `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name,webViewLink,parents`;

  return withRetry(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (res.status === 401) throw new DriveAuthExpiredError();
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new DriveError(`uploadFile multipart ${res.status}: ${errBody}`, res.status, errBody);
    }

    // deno-lint-ignore no-explicit-any
    const data: any = await res.json();
    return {
      id: data.id,
      name: data.name,
      webViewLink: data.webViewLink,
      parents: data.parents,
    };
  });
}

/**
 * Resumable Upload — passo 1: inicia sessão (POST) → recebe Location header;
 * passo 2: envia bytes (PUT) na Location URI.
 *
 * Não fazemos chunking real ainda — a complexidade só vale a pena se o pipeline
 * passar a aceitar > 50 MiB. Por ora, upload do arquivo inteiro num único PUT,
 * mas com retry no PUT em caso de 5xx/429.
 *
 * Ref: https://developers.google.com/workspace/drive/api/guides/manage-uploads#resumable
 */
async function uploadFileResumable(
  opts: UploadOptions,
  bodyContent: Uint8Array,
): Promise<DriveFileUploadResult> {
  const mimeType = opts.mimeType ?? 'application/octet-stream';
  const metadata = buildMetadata(opts, mimeType);
  const totalBytes = bodyContent.length;

  // Passo 1 — inicia sessão e obtém upload URL
  const sessionUrl = await withRetry(async () => {
    const res = await fetch(
      `${DRIVE_UPLOAD}?uploadType=resumable&fields=id,name,webViewLink,parents`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(totalBytes),
        },
        body: JSON.stringify(metadata),
      },
    );

    if (res.status === 401) throw new DriveAuthExpiredError();
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new DriveError(`uploadFile resumable init ${res.status}: ${body}`, res.status, body);
    }

    const location = res.headers.get('Location') ?? res.headers.get('location');
    if (!location) {
      throw new DriveError('uploadFile resumable init: sem Location header', 500);
    }
    return location;
  });

  // Passo 2 — envia bytes
  return withRetry(async () => {
    const res = await fetch(sessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(totalBytes),
      },
      // Uint8Array aqui sempre tem backing ArrayBuffer (vem de normalizeContent),
      // mas o tipo genérico Uint8Array<ArrayBufferLike> não satisfaz BodyInit no TS 5.9.
      body: bodyContent as BodyInit,
    });

    if (res.status === 401) throw new DriveAuthExpiredError();
    if (res.status === 404) {
      // Sessão expirou — caller precisa reiniciar do passo 1
      throw new DriveError(
        'Sessão de upload expirou (404). Reinicie o upload do zero.',
        404,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new DriveError(`uploadFile resumable put ${res.status}: ${body}`, res.status, body);
    }

    // deno-lint-ignore no-explicit-any
    const data: any = await res.json();
    return {
      id: data.id,
      name: data.name,
      webViewLink: data.webViewLink,
      parents: data.parents,
    };
  });
}

/**
 * Upload de string Markdown como text/markdown.
 * Wrapper conveniente — 80% dos uploads do pipeline são MD.
 */
export async function uploadMarkdown(
  opts: Omit<UploadOptions, 'mimeType' | 'content'> & { markdown: string },
): Promise<DriveFileUploadResult> {
  return uploadFile({
    accessToken: opts.accessToken,
    parentId: opts.parentId,
    filename: opts.filename,
    content: opts.markdown,
    mimeType: 'text/markdown',
  });
}
