-- =============================================================================
-- Migration 0019 — Filtro de dados de teste nas RPCs admin
-- =============================================================================
-- Problema: o seed 0016 criou 50 perfis is_test=true (+1075 docs/jobs, 182
-- feedback). Nenhuma RPC admin filtrava is_test, então o dashboard mostrava
-- 52 usuários / 1075 docs / 182 feedback quando o real é 2 / ~0 / ~0.
--
-- Solução: cada RPC que agrega dados de usuário ganha um parâmetro
-- `p_include_test boolean default false`. Por padrão (false) o dashboard
-- mostra só dados reais; o admin pode ligar um toggle pra inspecionar o seed.
--
-- Implementação: `v_uids` = array de ids de profiles válidos (todos se
-- include_test, só não-test caso contrário). Tabelas com user_id filtram por
-- `user_id = any(v_uids)`; profiles filtram direto por `(is_test=false OR incl)`.
--
-- Todas mudam de assinatura (ganham parâmetro), então DROP + CREATE.
-- =============================================================================

-- A) admin_metrics_overview(p_days, p_include_test) --------------------------
drop function if exists public.admin_metrics_overview(integer);
create or replace function public.admin_metrics_overview(
  p_days integer default 30,
  p_include_test boolean default false
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_days integer := greatest(1, least(p_days, 365));
  v_cur_start timestamptz := now() - make_interval(days => v_days);
  v_prev_start timestamptz := now() - make_interval(days => v_days * 2);
  v_uids uuid[];
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(array_agg(id), '{}') into v_uids
    from public.profiles where (is_test = false or p_include_test);

  select jsonb_build_object(
    'period_days', v_days,
    'users', jsonb_build_object(
      'total',       (select count(*) from public.profiles where (is_test = false or p_include_test)),
      'admins',      (select count(*) from public.profiles where is_admin = true and (is_test = false or p_include_test)),
      'with_drive',  (select count(*) from public.profiles where drive_connected_at is not null and (is_test = false or p_include_test)),
      'period',      (select count(*) from public.profiles where created_at >= v_cur_start and (is_test = false or p_include_test)),
      'period_prev', (select count(*) from public.profiles where created_at >= v_prev_start and created_at < v_cur_start and (is_test = false or p_include_test))
    ),
    'documents', jsonb_build_object(
      'total',       (select count(*) from public.documents where user_id = any(v_uids)),
      'processed',   (select count(*) from public.documents where user_id = any(v_uids) and processed_at is not null),
      'period',      (select count(*) from public.documents where user_id = any(v_uids) and created_at >= v_cur_start),
      'period_prev', (select count(*) from public.documents where user_id = any(v_uids) and created_at >= v_prev_start and created_at < v_cur_start)
    ),
    'jobs', jsonb_build_object(
      'total',       (select count(*) from public.jobs where user_id = any(v_uids)),
      'pending',     (select count(*) from public.jobs where user_id = any(v_uids) and status = 'pending'),
      'processing',  (select count(*) from public.jobs where user_id = any(v_uids) and status = 'processing'),
      'success',     (select count(*) from public.jobs where user_id = any(v_uids) and status in ('completed', 'completed_with_warning')),
      'failed',      (select count(*) from public.jobs where user_id = any(v_uids) and status = 'failed'),
      'period',      (select count(*) from public.jobs where user_id = any(v_uids) and created_at >= v_cur_start),
      'period_prev', (select count(*) from public.jobs where user_id = any(v_uids) and created_at >= v_prev_start and created_at < v_cur_start)
    ),
    'cost_usd', jsonb_build_object(
      'total',       coalesce((select sum(cost_usd_total) from public.jobs where user_id = any(v_uids)), 0),
      'period',      coalesce((select sum(cost_usd_total) from public.jobs where user_id = any(v_uids) and created_at >= v_cur_start), 0),
      'period_prev', coalesce((select sum(cost_usd_total) from public.jobs where user_id = any(v_uids) and created_at >= v_prev_start and created_at < v_cur_start), 0)
    )
  ) into v_result;
  return v_result;
end $fn$;
revoke all on function public.admin_metrics_overview(integer, boolean) from public, anon;
grant execute on function public.admin_metrics_overview(integer, boolean) to authenticated;

-- B) admin_metrics_timeseries(p_days, p_include_test) ------------------------
drop function if exists public.admin_metrics_timeseries(integer);
create or replace function public.admin_metrics_timeseries(
  p_days integer default 14,
  p_include_test boolean default false
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_days integer := greatest(1, least(p_days, 90)); v_uids uuid[]; v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(array_agg(id), '{}') into v_uids
    from public.profiles where (is_test = false or p_include_test);

  with days as (
    select generate_series((current_date - (v_days - 1))::date, current_date::date, interval '1 day')::date as day
  ),
  docs as (
    select date_trunc('day', created_at)::date as day, count(*) as n
      from public.documents where user_id = any(v_uids) and created_at >= current_date - (v_days - 1) group by 1
  ),
  jobs_s as (
    select date_trunc('day', completed_at)::date as day, count(*) as n, coalesce(sum(cost_usd_total), 0) as cost
      from public.jobs
     where user_id = any(v_uids) and completed_at is not null
       and status in ('completed', 'completed_with_warning')
       and completed_at >= current_date - (v_days - 1)
     group by 1
  ),
  jobs_f as (
    select date_trunc('day', completed_at)::date as day, count(*) as n
      from public.jobs
     where user_id = any(v_uids) and completed_at is not null
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
revoke all on function public.admin_metrics_timeseries(integer, boolean) from public, anon;
grant execute on function public.admin_metrics_timeseries(integer, boolean) to authenticated;

-- C) admin_pipeline_breakdown(p_include_test) -------------------------------
drop function if exists public.admin_pipeline_breakdown();
create or replace function public.admin_pipeline_breakdown(
  p_include_test boolean default false
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_uids uuid[]; v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(array_agg(id), '{}') into v_uids
    from public.profiles where (is_test = false or p_include_test);

  select jsonb_build_object(
    'docs_uploaded',  (select count(*) from public.documents where user_id = any(v_uids)),
    'docs_processed', (select count(*) from public.documents where user_id = any(v_uids) and processed_at is not null),
    'jobs_pending',   (select count(*) from public.jobs where user_id = any(v_uids) and status = 'pending'),
    'jobs_processing',(select count(*) from public.jobs where user_id = any(v_uids) and status = 'processing'),
    'jobs_success',   (select count(*) from public.jobs where user_id = any(v_uids) and status in ('completed', 'completed_with_warning')),
    'jobs_failed',    (select count(*) from public.jobs where user_id = any(v_uids) and status = 'failed'),
    'jobs_retried',   (select count(*) from public.jobs where user_id = any(v_uids) and attempt_count > 0 and status in ('completed', 'completed_with_warning')),
    'avg_duration_seconds', coalesce((
      select avg(extract(epoch from (completed_at - started_at)))
        from public.jobs
       where user_id = any(v_uids) and status in ('completed', 'completed_with_warning')
         and started_at is not null and completed_at is not null
    ), 0)
  ) into v_result;
  return v_result;
end $fn$;
revoke all on function public.admin_pipeline_breakdown(boolean) from public, anon;
grant execute on function public.admin_pipeline_breakdown(boolean) to authenticated;

-- D) admin_materia_distribution(p_include_test) -----------------------------
drop function if exists public.admin_materia_distribution();
create or replace function public.admin_materia_distribution(
  p_include_test boolean default false
)
returns table (materia_code text, doc_count bigint, user_count bigint)
language plpgsql stable security definer set search_path = ''
as $fn$
declare v_uids uuid[];
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(array_agg(id), '{}') into v_uids
    from public.profiles where (is_test = false or p_include_test);

  return query
    select d.materia_code, count(*)::bigint, count(distinct d.user_id)::bigint
      from public.documents d
     where d.user_id = any(v_uids) and d.materia_code is not null
     group by d.materia_code
     order by count(*) desc
     limit 20;
end $fn$;
revoke all on function public.admin_materia_distribution(boolean) from public, anon;
grant execute on function public.admin_materia_distribution(boolean) to authenticated;

-- E) admin_recent_jobs(p_limit, p_include_test) -----------------------------
drop function if exists public.admin_recent_jobs(integer);
create or replace function public.admin_recent_jobs(
  p_limit integer default 20,
  p_include_test boolean default false
)
returns table (
  id uuid, user_email text, document_title text, document_format text,
  status text, current_step text, progress_percent smallint,
  cost_usd_total numeric, attempt_count smallint, error_reason text,
  created_at timestamptz, completed_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select j.id, p.email, coalesce(d.titulo, d.filename_original), d.format::text,
           j.status::text, j.current_step, j.progress_percent,
           j.cost_usd_total, j.attempt_count, j.error_reason,
           j.created_at, j.completed_at
      from public.jobs j
      join public.profiles p on p.id = j.user_id
      join public.documents d on d.id = j.document_id
     where (p.is_test = false or p_include_test)
     order by j.created_at desc
     limit greatest(1, least(p_limit, 100));
end $fn$;
revoke all on function public.admin_recent_jobs(integer, boolean) from public, anon;
grant execute on function public.admin_recent_jobs(integer, boolean) to authenticated;

-- F) admin_recent_users(p_limit, p_include_test) ----------------------------
drop function if exists public.admin_recent_users(integer);
create or replace function public.admin_recent_users(
  p_limit integer default 20,
  p_include_test boolean default false
)
returns table (
  id uuid, email text, full_name text, curso text, semestre_atual text,
  is_admin boolean, drive_connected boolean, doc_count bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id, p.email, p.full_name, p.curso, p.semestre_atual,
           p.is_admin, (p.drive_connected_at is not null),
           (select count(*) from public.documents d where d.user_id = p.id),
           p.created_at
      from public.profiles p
     where (p.is_test = false or p_include_test)
     order by p.created_at desc
     limit greatest(1, least(p_limit, 100));
end $fn$;
revoke all on function public.admin_recent_users(integer, boolean) from public, anon;
grant execute on function public.admin_recent_users(integer, boolean) to authenticated;

-- G) admin_top_users(p_limit, p_include_test) -------------------------------
drop function if exists public.admin_top_users(integer);
create or replace function public.admin_top_users(
  p_limit integer default 10,
  p_include_test boolean default false
)
returns table (
  id uuid, email text, full_name text, curso text,
  doc_count bigint, job_count bigint, cost_usd numeric, last_activity timestamptz
)
language plpgsql stable security definer set search_path = ''
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
     where (p.is_test = false or p_include_test)
       and (coalesce(d.cnt, 0) > 0 or coalesce(j.cnt, 0) > 0)
     order by (coalesce(j.cost, 0) + coalesce(d.cnt, 0) * 0.001) desc nulls last, p.created_at desc
     limit greatest(1, least(p_limit, 50));
end $fn$;
revoke all on function public.admin_top_users(integer, boolean) from public, anon;
grant execute on function public.admin_top_users(integer, boolean) to authenticated;

-- H) admin_feedback_overview(p_include_test) --------------------------------
drop function if exists public.admin_feedback_overview();
create or replace function public.admin_feedback_overview(
  p_include_test boolean default false
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_uids uuid[]; v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(array_agg(id), '{}') into v_uids
    from public.profiles where (is_test = false or p_include_test);

  select jsonb_build_object(
    'total', (select count(*) from public.feedback where user_id = any(v_uids)),
    'avg_rating', coalesce((select round(avg(rating)::numeric, 2) from public.feedback where user_id = any(v_uids)), 0),
    'by_rating', (
      select jsonb_object_agg(g.r::text, coalesce(c.cnt, 0))
      from generate_series(1, 5) g(r)
      left join (
        select rating, count(*) as cnt from public.feedback where user_id = any(v_uids) group by rating
      ) c on c.rating = g.r
    ),
    'by_topic', coalesce((
      select jsonb_agg(jsonb_build_object('topic', t.topic, 'count', t.cnt) order by t.cnt desc)
      from (
        select topic, count(*) as cnt from public.feedback where user_id = any(v_uids) group by topic
      ) t
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(e order by (e->>'created_at') desc)
      from (
        select jsonb_build_object(
          'id',             f.id,
          'rating',         f.rating,
          'topic',          f.topic,
          'comments',       f.comments,
          'created_at',     f.created_at,
          'document_title', coalesce(d.titulo, d.filename_final, d.filename_original)
        ) as e
        from public.feedback f
        left join public.jobs j      on j.id = f.job_id
        left join public.documents d on d.id = j.document_id
        where f.user_id = any(v_uids)
        order by f.created_at desc
        limit 20
      ) sub
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $fn$;
revoke all on function public.admin_feedback_overview(boolean) from public, anon;
grant execute on function public.admin_feedback_overview(boolean) to authenticated;

-- I) admin_alerts(p_include_test) -------------------------------------------
drop function if exists public.admin_alerts();
create or replace function public.admin_alerts(
  p_include_test boolean default false
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_uids uuid[]; v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(array_agg(id), '{}') into v_uids
    from public.profiles where (is_test = false or p_include_test);

  select jsonb_build_object(
    'failed_30d', (select count(*) from public.jobs where user_id = any(v_uids) and status = 'failed' and created_at > now() - interval '30 days'),
    'stuck', (select count(*) from public.jobs where user_id = any(v_uids) and status = 'processing' and coalesce(started_at, created_at) < now() - interval '10 minutes'),
    'top_errors', coalesce((
      select jsonb_agg(e order by e->>'last_seen' desc)
      from (
        select jsonb_build_object('reason', coalesce(error_reason, 'Motivo não informado'), 'count', count(*), 'last_seen', max(created_at)) as e
        from public.jobs
        where user_id = any(v_uids) and status = 'failed' and created_at > now() - interval '30 days'
        group by coalesce(error_reason, 'Motivo não informado')
        order by count(*) desc limit 5
      ) sub
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $fn$;
revoke all on function public.admin_alerts(boolean) from public, anon;
grant execute on function public.admin_alerts(boolean) to authenticated;
