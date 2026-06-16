-- =============================================================================
-- Migration 0015 — Dashboard admin v2 (alertas, deltas, eventos de job)
-- =============================================================================
-- A) admin_alerts()              — incidentes que exigem ação (falhas + stuck)
-- B) admin_metrics_overview(days)— agora aceita período e devolve deltas
-- C) admin_top_users(limit)      — filtra usuários sem nenhuma atividade
-- D) admin_job_events(job_id)    — eventos de um job (pro "ver eventos" inline)
-- =============================================================================

-- =============================================================================
-- A) admin_alerts() — agrupa falhas recentes por motivo + detecta jobs presos
-- =============================================================================
create or replace function public.admin_alerts()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $fn$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  -- Janela de 30 dias: erros de config (ex: API key ausente) persistem até
  -- serem corrigidos. 7 dias deixava falhas recentes-mas-não-resolvidas fora
  -- do radar, contradizendo a tabela de jobs logo abaixo.
  select jsonb_build_object(
    'failed_30d', (
      select count(*) from public.jobs
       where status = 'failed' and created_at > now() - interval '30 days'
    ),
    -- jobs presos: em processing há mais de 10 min (cobre watchdog ainda não implementado)
    'stuck', (
      select count(*) from public.jobs
       where status = 'processing' and coalesce(started_at, created_at) < now() - interval '10 minutes'
    ),
    -- top motivos de falha agrupados (últimos 30d)
    'top_errors', coalesce((
      select jsonb_agg(e order by e->>'last_seen' desc)
      from (
        select jsonb_build_object(
          'reason',    coalesce(error_reason, 'Motivo não informado'),
          'count',     count(*),
          'last_seen', max(created_at)
        ) as e
        from public.jobs
        where status = 'failed' and created_at > now() - interval '30 days'
        group by coalesce(error_reason, 'Motivo não informado')
        order by count(*) desc
        limit 5
      ) sub
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $fn$;

revoke all on function public.admin_alerts() from public, anon;
grant execute on function public.admin_alerts() to authenticated;

-- =============================================================================
-- B) admin_metrics_overview(p_days) — KPIs totais + deltas do período
-- =============================================================================
-- Mudou de assinatura (sem args -> p_days). Precisa DROP antes do CREATE.
drop function if exists public.admin_metrics_overview();

create or replace function public.admin_metrics_overview(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $fn$
declare
  v_days integer := greatest(1, least(p_days, 365));
  v_cur_start timestamptz := now() - make_interval(days => v_days);
  v_prev_start timestamptz := now() - make_interval(days => v_days * 2);
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select jsonb_build_object(
    'period_days', v_days,
    'users', jsonb_build_object(
      'total',       (select count(*) from public.profiles),
      'admins',      (select count(*) from public.profiles where is_admin = true),
      'with_drive',  (select count(*) from public.profiles where drive_connected_at is not null),
      'period',      (select count(*) from public.profiles where created_at >= v_cur_start),
      'period_prev', (select count(*) from public.profiles where created_at >= v_prev_start and created_at < v_cur_start)
    ),
    'documents', jsonb_build_object(
      'total',       (select count(*) from public.documents),
      'processed',   (select count(*) from public.documents where processed_at is not null),
      'period',      (select count(*) from public.documents where created_at >= v_cur_start),
      'period_prev', (select count(*) from public.documents where created_at >= v_prev_start and created_at < v_cur_start)
    ),
    'jobs', jsonb_build_object(
      'total',       (select count(*) from public.jobs),
      'pending',     (select count(*) from public.jobs where status = 'pending'),
      'processing',  (select count(*) from public.jobs where status = 'processing'),
      'success',     (select count(*) from public.jobs where status in ('completed', 'completed_with_warning')),
      'failed',      (select count(*) from public.jobs where status = 'failed'),
      'period',      (select count(*) from public.jobs where created_at >= v_cur_start),
      'period_prev', (select count(*) from public.jobs where created_at >= v_prev_start and created_at < v_cur_start)
    ),
    'cost_usd', jsonb_build_object(
      'total',       coalesce((select sum(cost_usd_total) from public.jobs), 0),
      'period',      coalesce((select sum(cost_usd_total) from public.jobs where created_at >= v_cur_start), 0),
      'period_prev', coalesce((select sum(cost_usd_total) from public.jobs where created_at >= v_prev_start and created_at < v_cur_start), 0)
    )
  ) into v_result;

  return v_result;
end $fn$;

revoke all on function public.admin_metrics_overview(integer) from public, anon;
grant execute on function public.admin_metrics_overview(integer) to authenticated;

-- =============================================================================
-- C) admin_top_users(p_limit) — exclui usuários sem nenhuma atividade
-- =============================================================================
create or replace function public.admin_top_users(p_limit integer default 10)
returns table (
  id uuid, email text, full_name text, curso text,
  doc_count bigint, job_count bigint, cost_usd numeric, last_activity timestamptz
)
language plpgsql security definer set search_path = '' stable
as $fn$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id, p.email, p.full_name, p.curso,
           coalesce(d.cnt, 0)::bigint, coalesce(j.cnt, 0)::bigint, coalesce(j.cost, 0)::numeric,
           greatest(coalesce(d.last_at, p.created_at), coalesce(j.last_at, p.created_at))
      from public.profiles p
      left join (select user_id, count(*) as cnt, max(created_at) as last_at from public.documents group by user_id) d on d.user_id = p.id
      left join (select user_id, count(*) as cnt, sum(cost_usd_total) as cost, max(created_at) as last_at from public.jobs group by user_id) j on j.user_id = p.id
     where coalesce(d.cnt, 0) > 0 or coalesce(j.cnt, 0) > 0
     order by (coalesce(j.cost, 0) + coalesce(d.cnt, 0) * 0.001) desc nulls last, p.created_at desc
     limit greatest(1, least(p_limit, 50));
end $fn$;

revoke all on function public.admin_top_users(integer) from public, anon;
grant execute on function public.admin_top_users(integer) to authenticated;

-- =============================================================================
-- D) admin_job_events(p_job_id) — eventos de um job (pro "ver eventos" inline)
-- =============================================================================
create or replace function public.admin_job_events(p_job_id uuid)
returns table (
  id bigint, step text, event_type text, message text,
  duration_ms integer, llm_model text, cost_usd numeric, created_at timestamptz
)
language plpgsql security definer set search_path = '' stable
as $fn$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select je.id, je.step, je.event_type::text, je.message,
           je.duration_ms, je.llm_model, je.cost_usd, je.created_at
      from public.job_events je
     where je.job_id = p_job_id
     order by je.created_at asc, je.id asc
     limit 200;
end $fn$;

revoke all on function public.admin_job_events(uuid) from public, anon;
grant execute on function public.admin_job_events(uuid) to authenticated;
