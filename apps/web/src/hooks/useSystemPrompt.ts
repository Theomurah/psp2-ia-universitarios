/**
 * Hooks do system prompt personalizado do aluno (H7).
 *
 * - useActiveSystemPrompt(): versão ativa (RLS limita ao próprio usuário).
 * - useRegenerateSystemPrompt(): invoca a Edge Function generate-system-prompt,
 *   que regera a partir do profile + últimos docs e versiona. Sem mudança de
 *   semestre, ela reusa a versão ativa (regenerated:false).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { UserSystemPrompt } from '@psp2/shared';

export function useActiveSystemPrompt() {
  return useQuery({
    queryKey: ['user-system-prompt', 'active'],
    queryFn: async (): Promise<UserSystemPrompt | null> => {
      const { data, error } = await supabase
        .from('user_system_prompts')
        .select('*')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as UserSystemPrompt) ?? null;
    },
  });
}

interface RegenerateResponse {
  ok: boolean;
  regenerated: boolean;
  prompt: UserSystemPrompt;
}

export function useRegenerateSystemPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<RegenerateResponse> => {
      const { data, error } = await supabase.functions.invoke<RegenerateResponse>(
        'generate-system-prompt',
        { body: {} },
      );
      if (error) throw error;
      if (!data) throw new Error('Resposta vazia da função.');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-system-prompt'] });
    },
  });
}
