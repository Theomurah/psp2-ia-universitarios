-- =============================================================================
-- Migration 0029 — started_at no admin_recent_jobs + pending estagnado em alerta
-- =============================================================================
-- Origem: auditoria 2026-06-10 (revisão dos must-fix do requeue).
--
-- A) admin_recent_jobs: expõe `started_at`. O front (AlertBanner.isStuck) usava
--    `created_at` como base do limiar de 10 min, enquanto o admin_alerts() usa
--    `coalesce(started_at, created_at)` — um job que esperou na fila e foi
--    claimado há pouco aparecia como "preso" com botão de requeue ativo
--    enquanto ainda rodava (risco de reprocesso duplo + custo LLM dobrado).
--    Com started_at exposto, o front usa a MESMA base do admin_alerts().
--
-- B) admin_alerts: jobs em `pending` há >10 min também contam como presos.
--    O fluxo normal (ingest-document → waitUntil → process-document) tira o
--    job de pending em segundos; pending antigo significa disparo perdido
--    (ex: requeue cujo dispatch falhou). Antes, o requeue REMOVIA o job do
--    alerta (que só olhava processing) sem resolvê-lo — zumbi invisível.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) admin_recent_jobs(p_limit) — agora devolve started_at
-- ---------------------------------------------------------------------------
-- Mudança no shape do RETURNS TABLE exige DROP antes do CREATE.
drop function if exists public.admin_recent_jobs(integer);

create or replace function public.admin_recent_jobs(p_limit integer default 20)
returns table (
  id uuid,
  user_email text,
  document_title text,
  document_format text,
  status text,
  current_step text,
  progress_percent smallint,
  cost_usd_total numeric,
  attempt_count smallint,
  error_reason text,
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
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
    select j.id,
           p.email,
           coalesce(d.titulo, d.filename_original),
           d.format::text,
           j.status::text,
           j.current_step,
           j.progress_percent,
           j.cost_usd_total,
           j.attempt_count,
           j.error_reason,
           j.created_at,
           j.started_at,
           j.completed_at
      from public.jobs j
      join public.profiles p on p.id = j.user_id
      join public.documents d on d.id = j.document_id
     order by j.created_at desc
     limit greatest(1, least(p_limit, 100));
end $fn$;

revoke all on function public.admin_recent_jobs(integer) from public, anon;
grant execute on function public.admin_recent_jobs(integer) to authenticated;

comment on function public.admin_recent_jobs(integer) is
  'Jobs recentes pro painel /admin (inclui started_at pra detecção de preso com a mesma base do admin_alerts). Raises 42501 se não-admin.';

-- ---------------------------------------------------------------------------
-- B) admin_alerts() — stuck inclui pending estagnado (>10 min)
-- ---------------------------------------------------------------------------
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
    -- Jobs presos:
    --   processing há >10 min  → worker morreu/travou (watchdog ainda não existe);
    --   pending há >10 min     → disparo perdido (ingest falhou em invocar o
    --                            process-document, ou requeue sem dispatch).
    'stuck', (
      select count(*) from public.jobs
       where (status = 'processing' and coalesce(started_at, created_at) < now() - interval '10 minutes')
          or (status = 'pending' and created_at < now() - interval '10 minutes')
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

comment on function public.admin_alerts() is
  'Incidentes pro banner do /admin: falhas 30d agrupadas + jobs presos (processing >10min via coalesce(started_at, created_at), ou pending >10min). Raises 42501 se não-admin.';
