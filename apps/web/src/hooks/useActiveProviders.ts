import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { createLogger } from '../lib/log';
import type { ProviderId } from '../config/models';

const log = createLogger('admin');

export interface ActiveProvidersResult {
  /** true = chave configurada no Supabase; ausente = desconhecido */
  providers: Record<ProviderId, boolean>;
  /** Há um endpoint custom (LLM_BASE_URL) configurado? */
  customBaseUrl: boolean;
}

interface ProvidersResponse {
  providers: Record<string, boolean>;
  customBaseUrl?: boolean;
}

/**
 * Consulta a Edge Function admin-providers pra saber quais providers de LLM
 * têm chave configurada. Degrada graciosamente: se a função não existir/der
 * erro (ex: ainda não deployada), retorna `null` e a UI assume "desconhecido"
 * (mostra todos os grupos sem travar nada).
 */
export function useActiveProviders() {
  return useQuery<ActiveProvidersResult | null>({
    queryKey: ['admin-providers'],
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<ProvidersResponse>('admin-providers');
      if (error || !data?.providers) {
        log.warn('providers_fetch_failed', { reason: error?.message ?? 'empty' });
        return null;
      }
      return {
        providers: data.providers as Record<ProviderId, boolean>,
        customBaseUrl: !!data.customBaseUrl,
      };
    },
  });
}
