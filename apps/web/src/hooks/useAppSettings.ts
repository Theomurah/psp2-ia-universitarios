import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_settings'] }),
  });
}
