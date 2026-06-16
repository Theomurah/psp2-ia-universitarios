/**
 * Conexão do Google Drive (T27 — fix do achado B5).
 *
 * Fluxo em duas pernas:
 * 1. `startDriveOAuth()` — redireciona pro consent do Google via Supabase Auth
 *    com scope `drive.file`. `access_type=offline` + `prompt=consent` são
 *    obrigatórios: sem eles o Google não devolve o refresh_token.
 * 2. `useFinishDriveConnection()` — de volta em /settings?drive=callback, lê os
 *    provider tokens da sessão (só existem logo após o redirect OAuth) e invoca
 *    a Edge Function connect-drive, que persiste os tokens e cria a pasta-raiz.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { createLogger } from '../lib/log';

const log = createLogger('drive');

/** Mínimo privilégio: acesso apenas a arquivos criados pelo próprio app. */
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export async function startDriveOAuth() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: DRIVE_SCOPE,
      redirectTo: `${window.location.origin}/settings?drive=callback`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
}

interface ConnectDriveResponse {
  ok: boolean;
  drive_root_folder_id: string | null;
  warning?: 'migration_pending';
}

export function useFinishDriveConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ConnectDriveResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      const provider_token = session?.provider_token;
      const provider_refresh_token = session?.provider_refresh_token;
      if (!provider_token || !provider_refresh_token) {
        throw new Error(
          'Tokens do Google não encontrados na sessão. Clique em "Conectar" novamente.',
        );
      }

      const { data, error } = await supabase.functions.invoke<ConnectDriveResponse>(
        'connect-drive',
        { body: { provider_token, provider_refresh_token } },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error('Resposta inesperada da função connect-drive.');
      return data;
    },
    onSuccess: (data) => {
      log.info('drive_connected', {
        has_root_folder: !!data.drive_root_folder_id,
        migration_pending: data.warning === 'migration_pending',
      });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => {
      log.error('drive_connect_failed', log.fromError(err));
    },
  });
}
