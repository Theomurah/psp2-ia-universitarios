/**
 * Mutation que faz upload do PDF do atestado SIGAA → Edge Function
 * `parse-sigaa-atestado` → retorna estrutura parseada.
 *
 * O resultado vai pra um preview no frontend; usuário confirma antes de
 * gravar em `profiles.materias` via useUpdateProfile.
 */

import { useMutation } from '@tanstack/react-query';
import type { SigaaAtestado } from '@psp2/shared';
import { supabase } from '../lib/supabase';

const FUNCTIONS_URL = (() => {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/functions/v1/parse-sigaa-atestado`;
})();

/**
 * Erro tipado pra distinguir falhas de "função não deployada" de outros erros.
 * O caller mostra mensagem acionável (ex: "rode `supabase functions deploy ...`").
 */
export class EdgeFunctionMissingError extends Error {
  constructor() {
    super('A Edge Function `parse-sigaa-atestado` não está deployada no Supabase. ' +
      'Rode `supabase functions deploy parse-sigaa-atestado --project-ref <seu-ref>` e tente de novo.');
    this.name = 'EdgeFunctionMissingError';
  }
}

export function useImportSigaa() {
  return useMutation({
    mutationFn: async (file: File): Promise<SigaaAtestado> => {
      if (!FUNCTIONS_URL) {
        throw new Error('VITE_SUPABASE_URL não configurada.');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Arquivo maior que 5 MiB.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Faça login novamente.');

      const formData = new FormData();
      formData.append('file', file, file.name);

      let res: Response;
      try {
        res = await fetch(FUNCTIONS_URL, {
          method: 'POST',
          headers: {
            // Não definir Content-Type — browser preenche com boundary do multipart
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });
      } catch (err) {
        // TypeError "Failed to fetch" tipicamente significa:
        //  - função 404 (preflight retorna sem CORS, browser bloqueia)
        //  - rede caída
        //  - CORS bloqueado por origin não permitida
        // Reportamos como EdgeFunctionMissing pra dar ação ao usuário.
        if ((err as Error).message?.toLowerCase().includes('fetch')) {
          throw new EdgeFunctionMissingError();
        }
        throw err;
      }

      // 404 explícito também = função não existe
      if (res.status === 404) {
        throw new EdgeFunctionMissingError();
      }

      const json = await res.json().catch(() => ({} as { ok?: boolean; message?: string }));
      if (!res.ok || !json.ok) {
        const msg = (json as { message?: string }).message ?? `Erro ${res.status}.`;
        throw new Error(msg);
      }
      return (json as { parsed: SigaaAtestado }).parsed;
    },
  });
}
