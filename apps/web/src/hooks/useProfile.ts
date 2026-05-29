import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { createLogger } from '../lib/log';
import type { Profile, MateriaPerfil } from '@psp2/shared';

const log = createLogger('profile');

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<Profile | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export interface ProfileUpdateInput {
  full_name: string;
  curso?: string;
  semestre_atual: string;
  materias: MateriaPerfil[];
}

/**
 * Erro lançado quando a coluna `curso` ainda não existe no banco
 * (migration 0003 não aplicada). O caller pode tratar e dar mensagem acionável.
 */
export class MissingCursoColumnError extends Error {
  constructor() {
    super('A coluna "curso" não existe — aplique a migration 0003.');
    this.name = 'MissingCursoColumnError';
  }
}

function isMissingCursoColumn(err: unknown): boolean {
  const e = err as PostgrestError;
  // Postgres: 42703 = undefined_column
  if (e?.code === '42703' && e.message?.toLowerCase().includes('curso')) return true;
  // PostgREST: PGRST204 = schema cache miss (column desconhecida)
  if (e?.code === 'PGRST204' && e.message?.toLowerCase().includes('curso')) return true;
  // Fallback por substring
  const msg = (e?.message ?? '').toLowerCase();
  return msg.includes("'curso'") && (msg.includes('does not exist') || msg.includes('not found') || msg.includes('schema'));
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileUpdateInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const fullPayload = {
        full_name: input.full_name,
        curso: input.curso ?? null,
        semestre_atual: input.semestre_atual,
        materias: input.materias,
      };

      const { error } = await supabase
        .from('profiles')
        .update(fullPayload)
        .eq('id', user.id);

      if (!error) return;

      // Fallback: se a coluna `curso` não existe (migration 0003 não aplicada),
      // salva o resto e sobe erro tipado pro caller decidir como avisar o usuário.
      if (isMissingCursoColumn(error)) {
        // Sanitizado: nunca o PostgrestError cru (details/hint podem vazar PII).
        log.warn('curso_column_missing_fallback', { migration: '0003', ...log.fromError(error) });
        const { full_name, semestre_atual, materias } = fullPayload;
        const { error: retryError } = await supabase
          .from('profiles')
          .update({ full_name, semestre_atual, materias })
          .eq('id', user.id);
        if (retryError) throw retryError;
        throw new MissingCursoColumnError();
      }

      throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
    // Mesmo quando lançamos MissingCursoColumnError, o resto foi salvo —
    // invalida o cache pra UI refletir o que salvou.
    onError: (err) => {
      if (err instanceof MissingCursoColumnError) {
        qc.invalidateQueries({ queryKey: ['profile'] });
      }
    },
  });
}
