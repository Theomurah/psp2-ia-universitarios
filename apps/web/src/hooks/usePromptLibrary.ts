/**
 * Hook pra ler a biblioteca de prompts (T34).
 *
 * Mostra prompts oficiais (is_official=true) + prompts próprios do usuário.
 * Hook a query depende da RLS — Supabase filtra via policy "prompts_select_official_or_own".
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { PromptLibraryItem } from '@psp2/shared';

export function usePromptLibrary() {
  return useQuery({
    queryKey: ['prompt_library'],
    queryFn: async (): Promise<PromptLibraryItem[]> => {
      const { data, error } = await supabase
        .from('prompt_library')
        .select('*')
        .order('is_official', { ascending: false })
        .order('category', { ascending: true })
        .order('title', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PromptLibraryItem[];
    },
  });
}

export function useIncrementPromptUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (promptId: string) => {
      // Aumenta o contador de uso. Lê → +1 → write (RPC seria melhor, mas isso já basta pra MVP).
      const { data: row, error: readErr } = await supabase
        .from('prompt_library')
        .select('usage_count')
        .eq('id', promptId)
        .single();
      if (readErr) {
        // Pode ser oficial (não tem permissão de update) — ignoramos silencioso
        return;
      }
      await supabase
        .from('prompt_library')
        .update({ usage_count: (row?.usage_count ?? 0) + 1 })
        .eq('id', promptId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prompt_library'] }),
  });
}
