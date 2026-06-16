/**
 * Endpoint About — informações da conta Google conectada.
 *
 * Útil pra:
 *   - mostrar "Conectado como theo@gmail.com" na tela de Configurações
 *   - validar que o token ainda funciona antes de iniciar um upload caro
 *   - exibir quota de storage (útil pra usuário com Drive cheio)
 *
 * Ref: https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get
 */

import { DriveAuthExpiredError, DriveError } from './types.ts';
import { withRetry } from './retry.ts';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export interface DriveAboutInfo {
  email: string;
  display_name?: string;
  photo_url?: string;
  /** Bytes usados pelo usuário (todos os arquivos do Drive). */
  storage_used: number;
  /** Bytes totais disponíveis (`null` se for ilimitado). */
  storage_limit: number | null;
  /** Bytes usados pelo Drive especificamente (sem Gmail/Photos). */
  storage_used_drive: number;
}

/**
 * Retorna informações da conta Google conectada.
 * Lança DriveAuthExpiredError se o token estiver inválido.
 */
export async function getAbout(accessToken: string): Promise<DriveAboutInfo> {
  return withRetry(async () => {
    const fields = 'user(emailAddress,displayName,photoLink),storageQuota(usage,limit,usageInDrive)';
    const url = `${DRIVE_API}/about?fields=${encodeURIComponent(fields)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) throw new DriveAuthExpiredError();
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new DriveError(`getAbout ${res.status}: ${body}`, res.status, body);
    }

    // deno-lint-ignore no-explicit-any
    const data: any = await res.json();
    const limit = data.storageQuota?.limit;
    return {
      email: data.user?.emailAddress ?? '',
      display_name: data.user?.displayName,
      photo_url: data.user?.photoLink,
      storage_used: Number(data.storageQuota?.usage ?? 0),
      storage_limit: limit ? Number(limit) : null, // null = unlimited
      storage_used_drive: Number(data.storageQuota?.usageInDrive ?? 0),
    };
  });
}
