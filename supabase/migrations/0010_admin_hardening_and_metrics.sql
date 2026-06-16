-- =============================================================================
-- Migration 0010 — Hardening dos advisors + RPCs adicionais pro dashboard
-- =============================================================================
-- Endereça achados do Supabase advisor (security + performance):
--   A) handle_new_user é trigger interno — não deve estar exposto via /rest/v1/rpc
--   B) is_admin deve ser callable só por authenticated (não anon)
--   C) FK app_settings.updated_by sem índice (advisor performance)
--
-- E adiciona RPCs pra dashboard rico:
--   D) admin_metrics_timeseries(days) — série diária pra sparklines
--   E) admin_top_users(limit)        — ranking de uso
--   F) admin_pipeline_breakdown()    — funil status dos jobs
--   G) admin_materia_distribution()  — distribuição global por matéria
-- =============================================================================

-- A) handle_new_user — revoga RPC público
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- B) is_admin — só authenticated
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- C) Índice no FK não-coberto
create index if not exists idx_app_settings_updated_by
  on public.app_settings(updated_by)
  where updated_by is not null;

-- D) admin_metrics_timeseries(p_days)
-- Retorna array JSON [{ day: 'YYYY-MM-DD', docs: N, jobs_success: N, jobs_failed: N, cost_usd: N }]
create or replace function public.admin_metrics_timeseries(p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $fn$
declare
  v_days integer := greatest(1, least(p_days, 90));
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with days as (
    select generate_series(
      (current_date - (v_days - 1))::date,
      current_date::date,
      interval '1 day'
    )::date as day
  ),
  docs as (
    select date_trunc('day', created_at)::date as day, count(*) as n
      from public.documents
     where created_at >= current_date - (v_days - 1)
     group by 1
  ),
  jobs_s as (
    select date_trunc('day', completed_at)::date as day, count(*) as n,
           coalesce(sum(cost_usd_total), 0) as cost
      from public.jobs
     where completed_at is not null
       and status = 'success'
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
  select jsonb_agg(
    jsonb_build_object(
      'day',          to_char(d.day, 'YYYY-MM-DD'),
      'docs',         coalesce(docs.n, 0),
      'jobs_success', coalesce(jobs_s.n, 0),
      'jobs_failed',  coalesce(jobs_f.n, 0),
      'cost_usd',     coalesce(jobs_s.cost, 0)
    ) order by d.day
  )
  into v_result
  from days d
  left join docs   on docs.day   = d.day
  left join jobs_s on jobs_s.day = d.day
  left join jobs_f on jobs_f.day = d.day;

  return coalesce(v_result, '[]'::jsonb);
end $fn$;

revoke all on function public.admin_metrics_timeseries(integer) from public, anon;
grant execute on function public.admin_metrics_timeseries(integer) to authenticated;

-- E) admin_top_users(p_limit) — ranking por docs + custo
create or replace function public.admin_top_users(p_limit integer default 10)
returns table (
  id            uuid,
  email         text,
  full_name     text,
  curso         text,
  doc_count     bigint,
  job_count     bigint,
  cost_usd      numeric,
  last_activity timestamptz
)
language plpgsql
security definer
set search_path = ''
stable
as $fn$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select p.id, p.email, p.full_name, p.curso,
           coalesce(d.cnt, 0)::bigint            as doc_count,
           coalesce(j.cnt, 0)::bigint            as job_count,
           coalesce(j.cost, 0)::numeric          as cost_usd,
           greatest(coalesce(d.last_at, p.created_at), coalesce(j.last_at, p.created_at)) as last_activity
      from public.profiles p
      left join (
        select user_id, count(*) as cnt, max(created_at) as last_at
          from public.documents group by user_id
      ) d on d.user_id = p.id
      left join (
        select user_id, count(*) as cnt, sum(cost_usd_total) as cost, max(created_at) as last_at
          from public.jobs group by user_id
      ) j on j.user_id = p.id
     order by (coalesce(j.cost, 0) + coalesce(d.cnt, 0) * 0.001) desc nulls last,
              p.created_at desc
     limit greatest(1, least(p_limit, 50));
end $fn$;

revoke all on function public.admin_top_users(integer) from public, anon;
grant execute on function public.admin_top_users(integer) to authenticated;

-- F) admin_pipeline_breakdown() — funil de status (jobs)
create or replace function public.admin_pipeline_breakdown()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $fn$
declare v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'docs_uploaded',  (select count(*) from public.documents),
    'docs_processed', (select count(*) from public.documents where processed_at is not null),
    'jobs_pending',   (select count(*) from public.jobs where status = 'pending'),
    'jobs_processing',(select count(*) from public.jobs where status = 'processing'),
    'jobs_success',   (select count(*) from public.jobs where status = 'success'),
    'jobs_failed',    (select count(*) from public.jobs where status = 'failed'),
    'jobs_retried',   (select count(*) from public.jobs where attempt_count > 0 and status = 'success'),
    'avg_duration_seconds', coalesce((
      select avg(extract(epoch from (completed_at - started_at)))
        from public.jobs
       where status = 'success' and started_at is not null and completed_at is not null
    ), 0)
  ) into v_result;

  return v_result;
end $fn$;

revoke all on function public.admin_pipeline_breakdown() from public, anon;
grant execute on function public.admin_pipeline_breakdown() to authenticated;

-- G) admin_materia_distribution() — distribuição global por matéria
create or replace function public.admin_materia_distribution()
returns table (
  materia_code text,
  doc_count    bigint,
  user_count   bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $fn$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select d.materia_code,
           count(*)::bigint                  as doc_count,
           count(distinct d.user_id)::bigint as user_count
      from public.documents d
     where d.materia_code is not null
     group by d.materia_code
     order by count(*) desc
     limit 20;
end $fn$;

revoke all on function public.admin_materia_distribution() from public, anon;
grant execute on function public.admin_materia_distribution() to authenticated;
