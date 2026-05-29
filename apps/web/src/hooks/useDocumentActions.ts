/**
 * Mutations de arquivamento e exclusão de documentos.
 *
 * - Arquivar: soft delete reversível (atualiza `documents.archived_at`).
 * - Desarquivar: zera `archived_at` (volta pra view ativa).
 * - Excluir: hard delete — apaga storage + linha em `documents` (CASCADE limpa
 *   jobs, job_events, generated_content). Irreversível.
 *
 * RLS já garante que só o dono executa.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { createLogger } from '../lib/log';

const log = createLogger('document-actions');

interface SetArchivedArgs {
  documentId: string;
  archived: boolean;
}

/** Marca/desmarca o documento como arquivado. Reversível. */
export function useSetArchived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, archived }: SetArchivedArgs) => {
      const { error } = await supabase
        .from('documents')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['user-metrics'] });
    },
  });
}

interface DeleteDocumentArgs {
  documentId: string;
  storagePath: string;
}

/**
 * Exclui permanentemente o documento e tudo linkado.
 * O CASCADE no schema cobre: jobs → job_events, documents → generated_content.
 * Storage é apagado em paralelo (best-effort — se falhar, o arquivo fica
 * órfão no bucket mas o doc some da UI).
 */
export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, storagePath }: DeleteDocumentArgs) => {
      // Tenta apagar o arquivo do storage primeiro (best-effort).
      // Se falhar, logamos mas seguimos — RLS garante que se chegou aqui o
      // user é dono, então o doc deve ir embora mesmo com storage órfão.
      const storageRes = await supabase.storage.from('documents').remove([storagePath]);
      if (storageRes.error) {
        // Best-effort: arquivo pode ficar órfão no bucket, mas o doc some da UI.
        log.warn('storage_remove_failed', { document_id: documentId, ...log.fromError(storageRes.error) });
      }

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['user-metrics'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
