/**
 * Hook para o feed "Últimas operações" — lista os job_events do usuário,
 * com filtros. Usado pelo componente <ActivityFeed /> embutido no Dashboard.
 *
 * RLS já garante isolamento por usuário (policy job_events_select_via_job
 * checa via FK pro próprio job).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { JobEvent } from '@psp2/shared';

export interface ActivityRow extends JobEvent {
  /** Dados do job (denormalizado pra UI) */
  jobs: {
    id: string;
    status: string;
    document_id: string;
    documents: {
      filename_original: string;
      filename_final: string | null;
      materia_code: string | null;
    } | null;
  } | null;
}

export interface ActivityFilters {
  /** Tipos de evento a incluir (vazio = todos) */
  eventTypes?: ('start' | 'success' | 'retry' | 'warning' | 'error')[];
  /** Step do pipeline (vazio = todos) */
  step?: string;
  /** Limite de linhas */
  limit?: number;
}

export function useActivity(filters: ActivityFilters = {}) {
  const limit = filters.limit ?? 200;
  return useQuery({
    queryKey: ['activity', filters],
    queryFn: async (): Promise<ActivityRow[]> => {
      let q = supabase
        .from('job_events')
        .select(
          'id, job_id, step, event_type, message, duration_ms, llm_model, tokens_input, tokens_output, cost_usd, created_at, ' +
            'jobs!inner(id, status, document_id, documents(filename_original, filename_final, materia_code))',
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filters.eventTypes && filters.eventTypes.length > 0) {
        q = q.in('event_type', filters.eventTypes);
      }
      if (filters.step) {
        q = q.eq('step', filters.step);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ActivityRow[];
    },
    staleTime: 15_000,
  });
}

/**
 * Métricas agregadas do usuário (cards do Dashboard).
 * Calcula no client a partir de jobs já carregados — barato.
 */
export interface UserMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalCostUsd: number;
  totalCharsInput: number;
  byMateria: { materia: string; count: number }[];
}

export function useUserMetrics() {
  return useQuery({
    queryKey: ['user-metrics'],
    queryFn: async (): Promise<UserMetrics> => {
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('status, cost_usd_total, chars_input, documents(materia_code)')
        .limit(500);
      if (error) throw error;
      const rows = (jobs ?? []) as unknown as Array<{
        status: string;
        cost_usd_total: number | null;
        chars_input: number | null;
        // Supabase pode retornar como array (relação) ou objeto. Tratamos ambos.
        documents: { materia_code: string | null } | { materia_code: string | null }[] | null;
      }>;

      const totalJobs = rows.length;
      const completedJobs = rows.filter((r) => r.status === 'completed' || r.status === 'completed_with_warning').length;
      const failedJobs = rows.filter((r) => r.status === 'failed').length;
      const totalCostUsd = rows.reduce((s, r) => s + Number(r.cost_usd_total ?? 0), 0);
      const totalCharsInput = rows.reduce((s, r) => s + Number(r.chars_input ?? 0), 0);

      const counter = new Map<string, number>();
      for (const r of rows) {
        const docs = Array.isArray(r.documents) ? r.documents[0] : r.documents;
        const mat = docs?.materia_code ?? 'Sem matéria';
        counter.set(mat, (counter.get(mat) ?? 0) + 1);
      }
      const byMateria = Array.from(counter.entries())
        .map(([materia, count]) => ({ materia, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      return { totalJobs, completedJobs, failedJobs, totalCostUsd, totalCharsInput, byMateria };
    },
    staleTime: 30_000,
  });
}
