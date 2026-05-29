import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AdminMetrics {
  period_days: number;
  users:     { total: number; admins: number; with_drive: number; period: number; period_prev: number };
  documents: { total: number; processed: number; period: number; period_prev: number };
  jobs:      { total: number; pending: number; processing: number; success: number; failed: number; period: number; period_prev: number };
  cost_usd:  { total: number; period: number; period_prev: number };
}

export interface AdminAlerts {
  failed_30d: number;
  stuck: number;
  top_errors: { reason: string; count: number; last_seen: string }[];
}

export interface AdminJobEvent {
  id: number;
  step: string;
  event_type: string;
  message: string | null;
  duration_ms: number | null;
  llm_model: string | null;
  cost_usd: number | null;
  created_at: string;
}

export interface AdminRecentJob {
  id: string;
  user_email: string;
  document_title: string;
  document_format: string;
  status: string;
  current_step: string | null;
  progress_percent: number;
  cost_usd_total: number | null;
  attempt_count: number;
  error_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AdminRecentUser {
  id: string;
  email: string;
  full_name: string | null;
  curso: string | null;
  semestre_atual: string | null;
  is_admin: boolean;
  drive_connected: boolean;
  doc_count: number;
  created_at: string;
}

export function useAdminMetricsOverview(days = 30) {
  return useQuery({
    queryKey: ['admin', 'metrics_overview', days],
    queryFn: async (): Promise<AdminMetrics> => {
      const { data, error } = await supabase.rpc('admin_metrics_overview', { p_days: days });
      if (error) throw new Error(error.message);
      return data as AdminMetrics;
    },
    refetchInterval: 60_000,
  });
}

export function useAdminAlerts() {
  return useQuery({
    queryKey: ['admin', 'alerts'],
    queryFn: async (): Promise<AdminAlerts> => {
      const { data, error } = await supabase.rpc('admin_alerts');
      if (error) throw new Error(error.message);
      return data as AdminAlerts;
    },
    refetchInterval: 30_000,
  });
}

export function useAdminJobEvents(jobId: string | null) {
  return useQuery({
    queryKey: ['admin', 'job_events', jobId],
    enabled: !!jobId,
    queryFn: async (): Promise<AdminJobEvent[]> => {
      const { data, error } = await supabase.rpc('admin_job_events', { p_job_id: jobId });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminJobEvent[];
    },
  });
}

export function useAdminRecentJobs(limit = 20) {
  return useQuery({
    queryKey: ['admin', 'recent_jobs', limit],
    queryFn: async (): Promise<AdminRecentJob[]> => {
      const { data, error } = await supabase.rpc('admin_recent_jobs', { p_limit: limit });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminRecentJob[];
    },
    refetchInterval: 30_000,
  });
}

export function useAdminRecentUsers(limit = 20) {
  return useQuery({
    queryKey: ['admin', 'recent_users', limit],
    queryFn: async (): Promise<AdminRecentUser[]> => {
      const { data, error } = await supabase.rpc('admin_recent_users', { p_limit: limit });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminRecentUser[];
    },
  });
}

export interface TimeseriesPoint {
  day: string;
  docs: number;
  jobs_success: number;
  jobs_failed: number;
  cost_usd: number;
}

export function useAdminTimeseries(days = 14) {
  return useQuery({
    queryKey: ['admin', 'timeseries', days],
    queryFn: async (): Promise<TimeseriesPoint[]> => {
      const { data, error } = await supabase.rpc('admin_metrics_timeseries', { p_days: days });
      if (error) throw new Error(error.message);
      return (data ?? []) as TimeseriesPoint[];
    },
    refetchInterval: 60_000,
  });
}

export interface AdminTopUser {
  id: string;
  email: string;
  full_name: string | null;
  curso: string | null;
  doc_count: number;
  job_count: number;
  cost_usd: number;
  last_activity: string;
}

export function useAdminTopUsers(limit = 10) {
  return useQuery({
    queryKey: ['admin', 'top_users', limit],
    queryFn: async (): Promise<AdminTopUser[]> => {
      const { data, error } = await supabase.rpc('admin_top_users', { p_limit: limit });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminTopUser[];
    },
  });
}

export interface PipelineBreakdown {
  docs_uploaded: number;
  docs_processed: number;
  jobs_pending: number;
  jobs_processing: number;
  jobs_success: number;
  jobs_failed: number;
  jobs_retried: number;
  avg_duration_seconds: number;
}

export function useAdminPipelineBreakdown() {
  return useQuery({
    queryKey: ['admin', 'pipeline'],
    queryFn: async (): Promise<PipelineBreakdown> => {
      const { data, error } = await supabase.rpc('admin_pipeline_breakdown');
      if (error) throw new Error(error.message);
      return data as PipelineBreakdown;
    },
    refetchInterval: 30_000,
  });
}

export interface MateriaDistribution {
  materia_code: string;
  doc_count: number;
  user_count: number;
}

export function useAdminMateriaDistribution() {
  return useQuery({
    queryKey: ['admin', 'materia_dist'],
    queryFn: async (): Promise<MateriaDistribution[]> => {
      const { data, error } = await supabase.rpc('admin_materia_distribution');
      if (error) throw new Error(error.message);
      return (data ?? []) as MateriaDistribution[];
    },
  });
}
