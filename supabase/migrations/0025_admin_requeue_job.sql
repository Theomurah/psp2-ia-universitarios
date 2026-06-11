-- =============================================================================
-- Migration 0025 — RPC admin_requeue_job: reenfileira job travado/falho
-- =============================================================================
-- Origem: auditoria 2026-06-10. Contrato com o front:
--   supabase.rpc('admin_requeue_job', { p_job_id })
--
-- Dá ao admin um caminho seguro (SECURITY DEFINER + is_admin) pra voltar um
-- job 'failed', 'processing' (preso) ou 'pending' (disparo perdido) para
-- 'pending', sem precisar de acesso direto ao banco. A volta pra fila zera o
-- estado de execução anterior (step/erro/progresso/tentativas/timestamps) pra
-- o worker tratar como job novo. Toda chamada é auditada server-side em
-- activity_logs (scope='admin').
--
-- IMPORTANTE — esta RPC NÃO dispara o pipeline. Não existe consumidor
-- automático de jobs 'pending' (process-document só é invocado pelo
-- ingest-document; o watchdog pg_cron é Sprint 2). Quem chama a RPC é
-- responsável por invocar POST /functions/v1/process-document com o job_id
-- na sequência — o AlertBanner do /admin faz exatamente isso, usando o JWT
-- do admin (aceito pelo authorizeProcessDocument desde a auditoria
-- 2026-06-10). Sem o dispatch, o job fica em 'pending' até alguém disparar.
-- =============================================================================

create or replace function public.admin_requeue_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_prev_status text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- FOR UPDATE: tranca a row pra não competir com o worker no meio do requeue.
  select j.status::text into v_prev_status
    from public.jobs j
   where j.id = p_job_id
   for update;

  if v_prev_status is null then
    raise exception 'job not found' using errcode = 'P0002';
  end if;

  -- 'pending' também é requeueable: cobre o zumbi de disparo perdido (requeue
  -- anterior sem dispatch, ou ingest que não conseguiu invocar o pipeline) —
  -- o reset abaixo é quase no-op, mas a auditoria registra a retentativa.
  if v_prev_status not in ('failed', 'processing', 'pending') then
    raise exception 'job is not requeueable (status=%)', v_prev_status;
  end if;

  update public.jobs
     set status           = 'pending',
         current_step     = null,
         error_reason     = null,
         progress_percent = 0,
         attempt_count    = 0,
         started_at       = null,
         completed_at     = null
   where id = p_job_id;

  -- Auditoria server-side (0018/0024) — não depende do browser do admin.
  insert into public.activity_logs (user_id, level, scope, evt, fields)
  values (
    v_uid, 'info', 'admin', 'job_requeued',
    jsonb_build_object('job_id', p_job_id, 'previous_status', v_prev_status, 'via', 'rpc')
  );

  -- Compat: se uma tabela dedicada admin_audit_log existir (criada por outra
  -- frente), registra lá também. Best-effort: divergência de schema/colunas
  -- não pode derrubar o requeue.
  if to_regclass('public.admin_audit_log') is not null then
    begin
      execute 'insert into public.admin_audit_log (admin_id, action, target_id, details)
               values ($1, $2, $3, $4)'
        using v_uid, 'job_requeued', p_job_id,
              jsonb_build_object('previous_status', v_prev_status);
    exception when others then
      raise warning 'admin_requeue_job: admin_audit_log insert skipped (%)', sqlerrm;
    end;
  end if;
end $fn$;

revoke all on function public.admin_requeue_job(uuid) from public, anon;
grant execute on function public.admin_requeue_job(uuid) to authenticated;

comment on function public.admin_requeue_job(uuid) is
  'Reenfileira job failed/processing/pending → pending (zera step/erro/progresso/tentativas). NÃO dispara o pipeline: o caller deve invocar process-document na sequência (o AlertBanner do /admin faz isso). SECURITY DEFINER guardado por is_admin(); raise 42501 se não-admin, P0002 se job não existe. Audita em activity_logs scope=admin. Origem: auditoria 2026-06-10.';
