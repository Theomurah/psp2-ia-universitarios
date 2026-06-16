/**
 * Cria/encontra pastas no Google Drive (T28).
 *
 * Estratégia "find or create": antes de criar uma pasta, lista as existentes
 * com o mesmo nome no parent — se encontrar, reusa. Evita duplicar pastas
 * quando o aluno roda o pipeline várias vezes.
 *
 * Estrutura padrão:
 *   {root_folder} → {semestre} → {materia}
 *
 * O root_folder é criado on-demand e o id fica salvo em `profiles.drive_root_folder_id`.
 */

import { DriveAuthExpiredError, DriveError, type DriveFolder } from './types.ts';
import { withRetry } from './retry.ts';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

interface DriveApiOpts {
  accessToken: string;
}

/**
 * Escapa caracteres especiais da search query do Drive.
 * Drive aceita '\\' e '\'' como escapes; outros caracteres não precisam ser tratados.
 * Ref: https://developers.google.com/workspace/drive/api/guides/ref-search-terms
 */
function escapeDriveQueryString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Procura uma pasta no Drive pelo nome dentro de um parent.
 * Retorna a primeira encontrada (Drive permite múltiplas pastas mesmo nome).
 * Aplica retry com backoff exponencial em 5xx/429.
 */
export async function findFolder(
  name: string,
  parentId: string | null,
  opts: DriveApiOpts,
): Promise<DriveFolder | null> {
  const escapedName = escapeDriveQueryString(name);
  const parentQuery = parentId ? `'${parentId}' in parents` : "'root' in parents";
  const q = [
    `mimeType = '${FOLDER_MIME}'`,
    `name = '${escapedName}'`,
    parentQuery,
    'trashed = false',
  ].join(' and ');

  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,parents)&pageSize=10`;

  return withRetry(async () => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${opts.accessToken}` },
    });

    if (res.status === 401) throw new DriveAuthExpiredError();
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new DriveError(`findFolder ${res.status}: ${body}`, res.status, body);
    }

    // deno-lint-ignore no-explicit-any
    const data: any = await res.json();
    const first = data.files?.[0];
    if (!first) return null;
    return {
      id: first.id,
      name: first.name,
      parent_id: first.parents?.[0] ?? null,
    };
  });
}

/**
 * Cria uma pasta nova no Drive. Use só quando findFolder já retornou null.
 * Aplica retry com backoff exponencial em 5xx/429.
 */
export async function createFolder(
  name: string,
  parentId: string | null,
  opts: DriveApiOpts,
): Promise<DriveFolder> {
  const body = {
    name,
    mimeType: FOLDER_MIME,
    parents: parentId ? [parentId] : undefined,
  };

  return withRetry(async () => {
    const res = await fetch(`${DRIVE_API}/files?fields=id,name,parents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) throw new DriveAuthExpiredError();
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new DriveError(`createFolder ${res.status}: ${errBody}`, res.status, errBody);
    }

    // deno-lint-ignore no-explicit-any
    const data: any = await res.json();
    return {
      id: data.id,
      name: data.name,
      parent_id: data.parents?.[0] ?? null,
    };
  });
}

/**
 * Helper idempotente — usa cache (find) antes de criar.
 */
export async function findOrCreateFolder(
  name: string,
  parentId: string | null,
  opts: DriveApiOpts,
): Promise<DriveFolder> {
  const existing = await findFolder(name, parentId, opts);
  if (existing) return existing;
  return createFolder(name, parentId, opts);
}

/**
 * Garante toda a cadeia `path = ['Semestre', 'Materia']` partindo do root.
 * Retorna o id da pasta mais profunda.
 *
 * Ex: ensureFolderPath(rootId, ['2026.1', 'Física 3']) →
 *   - find/cria '2026.1' dentro de rootId
 *   - find/cria 'Física 3' dentro do '2026.1'
 *   - retorna id de 'Física 3'
 */
export async function ensureFolderPath(
  rootId: string | null,
  segments: string[],
  opts: DriveApiOpts,
): Promise<string | null> {
  let parentId = rootId;
  for (const segment of segments) {
    const folder = await findOrCreateFolder(segment, parentId, opts);
    parentId = folder.id;
  }
  return parentId;
}

/**
 * Garante a pasta-raiz do app no Drive do aluno.
 * Cria "PSP2 - Estudos" se não existir; retorna o id.
 */
export async function ensureRootFolder(
  opts: DriveApiOpts,
  rootName = 'PSP2 - Estudos',
): Promise<DriveFolder> {
  return findOrCreateFolder(rootName, null, opts);
}
