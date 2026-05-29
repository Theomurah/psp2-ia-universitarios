-- =============================================================================
-- Migration 0014 — Fix do enum job_status nas RPCs admin
-- =============================================================================
-- Bug introduzido em 0009/0010: as RPCs admin_metrics_overview,
-- admin_metrics_timeseries e admin_pipeline_breakdown filtravam por
-- `status = 'success'`, mas esse valor NÃO existe no enum job_status.
--
-- Valores reais (de 0001_initial_schema.sql):
--   pending | processing | needs_review | completed | completed_with_warning | failed
--
-- Sintoma: chamadas pras RPCs retornavam 400 Bad Request com
--   "invalid input value for enum public.job_status: 'success'".
--
-- Sucesso operacional = completed OR completed_with_warning (ambos contam como
-- "deu certo no pipeline"; warning apenas significa que o judge marcou um
-- problema cosmético).
-- =============================================================================

create or replace function public.admin_metrics_overview()
returns jsonb language plpgsql security definer set search_path = '' stable
as $fn$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total',        (select count(*) from public.profiles),
      'new_30d',      (select count(*) from public.profiles where created_at > now() - interval '30 days'),
      'admins',       (select count(*) from public.profiles where is_admin = true),
      'with_drive',   (select count(*) from public.profiles where drive_connected_at is not null)
    ),
    'documents', jsonb_build_object(
      'total',        (select count(*) from public.documents),
      'last_7d',      (select count(*) from public.documents where created_at > now() - interval '7 days'),
      'processed',    (select count(*) from public.documents where processed_at is not null)
    ),
    'jobs', jsonb_build_object(
      'total',        (select count(*) from public.jobs),
      'pending',      (select count(*) from public.jobs where status = 'pending'),
      'processing',   (select count(*) from public.jobs where status = 'processing'),
      'success',      (select count(*) from public.jobs where status in ('completed', 'completed_with_warning')),
      'failed',       (select count(*) from public.jobs where status = 'failed'),
      'last_7d',      (select count(*) from public.jobs where created_at > now() - interval '7 days')
    ),
    'cost_usd', jsonb_build_object(
      'total',        coalesce((select sum(cost_usd_total) from public.jobs), 0),
      'last_30d',     coalesce((select sum(cost_usd_total) from public.jobs where created_at > now() - interval '30 days'), 0)
    )
  ) into v_result;
  return v_result;
end $fn$;

create or replace function public.admin_metrics_timeseries(p_days integer default 14)
returns jsonb language plpgsql security definer set search_path = '' stable
as $fn$
declare v_days integer := greatest(1, least(p_days, 90)); v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with days as (
    select generate_series((current_date - (v_days - 1))::date, current_date::date, interval '1 day')::date as day
  ),
  docs as (
    select date_trunc('day', created_at)::date as day, count(*) as n
      from public.documents where created_at >= current_date - (v_days - 1) group by 1
  ),
  jobs_s as (
    select date_trunc('day', completed_at)::date as day, count(*) as n, coalesce(sum(cost_usd_total), 0) as cost
      from public.jobs
     where completed_at is not null
       and status in ('completed', 'completed_with_warning')
       and completed_at >= current_date - (v_days - 1)
     group by 1
  ),
  jobs_f as (
    select date_trunc('day', completed_at)::date as day, count(*) as n
      from public.jobs
     where completed_at is not null
       and status = 'failed'
       and completed_at >= current_date - (v_days - 1)
     group by 1
  )
  select jsonb_agg(jsonb_build_object(
    'day', to_char(d.day, 'YYYY-MM-DD'),
    'docs', coalesce(docs.n, 0),
    'jobs_success', coalesce(jobs_s.n, 0),
    'jobs_failed', coalesce(jobs_f.n, 0),
    'cost_usd', coalesce(jobs_s.cost, 0)
  ) order by d.day) into v_result
  from days d
  left join docs on docs.day = d.day
  left join jobs_s on jobs_s.day = d.day
  left join jobs_f on jobs_f.day = d.day;
  return coalesce(v_result, '[]'::jsonb);
end $fn$;

create or replace function public.admin_pipeline_breakdown()
returns jsonb language plpgsql security definer set search_path = '' stable
as $fn$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'docs_uploaded',  (select count(*) from public.documents),
    'docs_processed', (select count(*) from public.documents where processed_at is not null),
    'jobs_pending',   (select count(*) from public.jobs where status = 'pending'),
    'jobs_processing',(select count(*) from public.jobs where status = 'processing'),
    'jobs_success',   (select count(*) from public.jobs where status in ('completed', 'completed_with_warning')),
    'jobs_failed',    (select count(*) from public.jobs where status = 'failed'),
    'jobs_retried',   (select count(*) from public.jobs where attempt_count > 0 and status in ('completed', 'completed_with_warning')),
    'avg_duration_seconds', coalesce((
      select avg(extract(epoch from (completed_at - started_at)))
        from public.jobs
       where status in ('completed', 'completed_with_warning')
         and started_at is not null and completed_at is not null
    ), 0)
  ) into v_result;
  return v_result;
end $fn$;
