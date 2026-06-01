import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { createLogger } from '../lib/log';

// Scope 'admin' unificado: filtra toda ação administrativa via
// jq 'select(.scope=="admin")' nos logs.
const log = createLogger('admin');

export interface AppSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export function useAppSettings(keyPrefix?: string) {
  return useQuery({
    queryKey: ['app_settings', keyPrefix ?? 'all'],
    queryFn: async (): Promise<AppSetting[]> => {
      let q = supabase.from('app_settings').select('*').order('key');
      if (keyPrefix) q = q.like('key', `${keyPrefix}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as AppSetting[];
    },
  });
}

export function useSetAppSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { data, error } = await supabase.rpc('admin_set_setting', {
        p_key: key,
        p_value: value,
      });
      if (error) throw new Error(error.message);
      return data as AppSetting;
    },
    onSuccess: (_data, { key }) => {
      // Auditoria: quem mudou a config (o updated_by/at fica na própria tabela).
      // Logamos só a chave — não o valor (evita logar config potencialmente sensível).
      log.info('setting_changed', { setting_key: key });
      qc.invalidateQueries({ queryKey: ['app_settings'] });
    },
    onError: (err, { key }) => {
      log.error('setting_change_failed', { setting_key: key, ...log.fromError(err) });
    },
  });
}
