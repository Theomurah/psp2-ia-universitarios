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
  // Cap em LAST_STATUS_CAP entries pra evitar leak em sessão longa.
  // Origem: auditoria 2026-05-26 (Agente 1, achado C5).
  const lastStatusRef = useRef(new Map<string, JobStatus>());
  // Flag pra suprimir aviso "perdeu conexão" no primeiro render.
  const hadConnectionRef = useRef(false);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Defesa em profundidade: filtra eventos do Realtime por user_id no servidor,
    // não dependendo só de RLS estar habilitada na config do projeto Supabase.
    // Origem: auditoria 2026-05-26 (Agente 1, achado C2).
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      channel = supabase
        .channel(`jobs-changes:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: RealtimePostgresChangesPayload<JobRecord>) => {
            qc.invalidateQueries({ queryKey: ['jobs'] });

            // Toast em transições significativas
            if (payload.eventType === 'UPDATE') {
              const oldRow = payload.old as Partial<JobRecord>;
              const newRow = payload.new as JobRecord;
              const prev = lastStatusRef.current.get(newRow.id) ?? oldRow.status;
              const next = newRow.status;
              if (prev !== next) {
                cacheStatus(lastStatusRef.current, newRow.id, next);
                notifyStatusChange(toast, newRow, next);
              }
            } else if (payload.eventType === 'INSERT') {
              const newRow = payload.new as JobRecord;
              cacheStatus(lastStatusRef.current, newRow.id, newRow.status);
            }
          },
        )
        .subscribe((status) => {
          const isConnected = status === 'SUBSCRIBED';
          setConnected(isConnected);
          if (isConnected) {
            if (hadConnectionRef.current) {
              toast.success('Conexão restabelecida', 'Atualizações em tempo real reativadas.');
            }
            hadConnectionRef.current = true;
          } else if (hadConnectionRef.current && status === 'CHANNEL_ERROR') {
            toast.warning('Sem atualização em tempo real', 'Tentando reconectar…');
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
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

// Cap pra Map de status — evita leak em sessão longa com muitos jobs.
// Origem: auditoria 2026-05-26 (Agente 1, achado C5).
const LAST_STATUS_CAP = 200;

function cacheStatus(map: Map<string, JobStatus>, jobId: string, status: JobStatus): void {
  // Status terminais não precisam ficar no cache — não há mais transição.
  if (status === 'completed' || status === 'completed_with_warning' || status === 'failed') {
    map.delete(jobId);
    return;
  }
  // Se atingiu o cap, descarta a entrada mais antiga (FIFO via insertion order).
  if (map.size >= LAST_STATUS_CAP && !map.has(jobId)) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(jobId, status);
}
