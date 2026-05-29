import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { createLogger } from '../lib/log';
import { useAuth } from './useAuth';

const log = createLogger('is-admin');

/**
 * Consulta `public.is_admin()` no banco e responde em 3 estados:
 *   - `undefined` enquanto a query está pendente (auth carregando OU fetch em vôo)
 *   - `true`  / `false` quando resolvido
 *
 * O caller (RequireAdmin) DEVE distinguir undefined de false. Tratar undefined
 * como false causa redirect prematuro — daí o bug do "só entra no double click".
 */
export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ['is_admin', user?.id],
    enabled: !authLoading && !!user,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) {
        log.warn('rpc_failed', { rpc_name: 'is_admin', ...log.fromError(error) });
        return false;
      }
      return data === true;
    },
    staleTime: 5 * 60_000,
  });
}
