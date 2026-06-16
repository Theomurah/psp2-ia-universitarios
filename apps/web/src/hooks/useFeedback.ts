/**
 * Hooks de feedback (H10).
 *
 * - useJobFeedback(jobId): feedback já enviado pelo usuário para aquele job
 *   (RLS limita ao próprio). Usado pra mostrar estado "já avaliado".
 * - useSubmitFeedback(): insere uma avaliação. RLS (feedback_insert_own) exige
 *   user_id = auth.uid(), então setamos user_id explicitamente.
 * - useAdminFeedbackOverview(): agregado pro painel /admin (RPC SECURITY DEFINER).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Feedback, FeedbackTopic } from '@psp2/shared';

export function useJobFeedback(jobId: string | null) {
  return useQuery({
    queryKey: ['job-feedback', jobId],
    enabled: !!jobId,
    queryFn: async (): Promise<Feedback | null> => {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Feedback) ?? null;
    },
    staleTime: 60_000,
  });
}

interface SubmitFeedbackArgs {
  jobId: string | null;
  rating: number;
  topic: FeedbackTopic;
  comments?: string;
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, rating, topic, comments }: SubmitFeedbackArgs): Promise<Feedback> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Faça login de novo.');

      const trimmed = comments?.trim();
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          job_id: jobId,
          rating,
          topic,
          comments: trimmed ? trimmed : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Feedback;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['job-feedback', vars.jobId] });
      qc.invalidateQueries({ queryKey: ['admin', 'feedback'] });
    },
  });
}

export interface AdminFeedbackOverview {
  total: number;
  avg_rating: number;
  by_rating: Record<string, number>;          // chaves "1".."5"
  by_topic: { topic: FeedbackTopic; count: number }[];
  recent: {
    id: string;
    rating: number;
    topic: FeedbackTopic;
    comments: string | null;
    created_at: string;
    document_title: string | null;
  }[];
}

export function useAdminFeedbackOverview(includeTest = false) {
  return useQuery({
    queryKey: ['admin', 'feedback', includeTest],
    queryFn: async (): Promise<AdminFeedbackOverview> => {
      const { data, error } = await supabase.rpc('admin_feedback_overview', { p_include_test: includeTest });
      if (error) throw new Error(error.message);
      return data as AdminFeedbackOverview;
    },
    refetchInterval: 60_000,
  });
}
