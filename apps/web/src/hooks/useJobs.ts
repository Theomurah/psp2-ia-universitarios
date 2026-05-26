import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import type { JobRecord, DocumentRecord, JobStatus } from '@psp2/shared';

export type JobWithDoc = JobRecord & { documents: DocumentRecord };

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async (): Promise<JobWithDoc[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, documents(*)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as JobWithDoc[];
    },
  });
}

/**
 * Escuta mudanças em jobs via Realtime, invalida a query e dispara toast
 * em transições relevantes (completed, completed_with_warning, failed, needs_review).
 *
 * [extra] Toast em mudança de status + aviso visual de queda de conexão.
 */
export function useJobsRealtime() {
  const qc = useQueryClient();
  const toast = useToast();
  const [connected, setConnected] = useState(false);
  // Cache local: job_id -> último status visto. Evita disparar toast em refresh.
  const lastStatusRef = useRef(new Map<string, JobStatus>());
  // Flag pra suprimir aviso "perdeu conexão" no primeiro render.
  const hadConnectionRef = useRef(false);

  useEffect(() => {
    const channel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        (payload: RealtimePostgresChangesPayload<JobRecord>) => {
          qc.invalidateQueries({ queryKey: ['jobs'] });

          // Toast em transições significativas
          if (payload.eventType === 'UPDATE') {
            const oldRow = payload.old as Partial<JobRecord>;
            const newRow = payload.new as JobRecord;
            const prev = lastStatusRef.current.get(newRow.id) ?? oldRow.status;
            const next = newRow.status;
            if (prev !== next) {
              lastStatusRef.current.set(newRow.id, next);
              notifyStatusChange(toast, newRow, next);
            }
          } else if (payload.eventType === 'INSERT') {
            const newRow = payload.new as JobRecord;
            lastStatusRef.current.set(newRow.id, newRow.status);
          }
        },
      )
      .subscribe((status) => {
        const isConnected = status === 'SUBSCRIBED';
        setConnected(isConnected);
        if (isConnected) {
          if (hadConnectionRef.current) {
            // Reconectou
            toast.success('Conexão restabelecida', 'Atualizações em tempo real reativadas.');
          }
          hadConnectionRef.current = true;
        } else if (hadConnectionRef.current && status === 'CHANNEL_ERROR') {
          toast.warning('Sem atualização em tempo real', 'Tentando reconectar…');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, toast]);

  return connected;
}

function notifyStatusChange(
  toast: ReturnType<typeof useToast>,
  job: JobRecord,
  next: JobStatus,
) {
  switch (next) {
    case 'processing':
      // Silencioso — já existe progresso na UI; evita ruído.
      break;
    case 'completed':
      toast.success('Documento pronto', 'Processamento concluído.');
      break;
    case 'completed_with_warning':
      toast.warning('Concluído com avisos', 'O documento foi processado, mas vale revisar.');
      break;
    case 'needs_review':
      toast.warning('Precisa de revisão', 'A classificação ficou abaixo do limite de confiança.');
      break;
    case 'failed':
      toast.error('Falhou no processamento', job.error_reason ?? 'Veja detalhes no card.');
      break;
  }
}
