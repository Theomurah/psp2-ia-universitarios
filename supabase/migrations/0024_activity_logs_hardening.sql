-- =============================================================================
-- Migration 0024 — activity_logs: auditoria admin server-side + anti-forja
-- =============================================================================
-- Origem: auditoria 2026-06-10 (MIGRATIONS-05).
--
-- A trilha de auditoria admin (scope='admin') era gravada PELO BROWSER via
-- persist() fire-and-forget (lib/log.ts), com policy de INSERT que só validava
-- user_id. Três problemas:
--   1) Forja: qualquer authenticated inseria eventos falsos com scope='admin'.
--   2) Supressão: admin malicioso bloqueava o insert (devtools/offline) e a
--      falha era engolida em silêncio.
--   3) Flood: fields jsonb sem limite de tamanho (truncagem era só client-side).
--
-- Correção em duas partes:
--   A) Policy de INSERT passa a REJEITAR scope='admin' vindo do client e a
--      limitar tamanho de scope/evt/request_id/fields. Telemetria client-side
--      vira best-effort declarado; auditoria deixa de depender do browser.
--   B) Os eventos de auditoria admin passam a ser gravados SERVER-SIDE por
--      triggers nas tabelas mutadas (app_settings, prompt_library oficiais)
--      — impossíveis de suprimir pelo client. As funções são SECURITY DEFINER
--      (owner = role da migration, dono de activity_logs), então o INSERT
--      bypassa a RLS restritiva do item A. auth.uid() continua retornando o
--      usuário do JWT mesmo dentro de SECURITY DEFINER.
--
-- Efeito no front existente: os log.info(scope 'admin') client-side passam a
-- ser rejeitados pela RLS — persist() já engole a falha (console.warn em dev).
-- Os mesmos eventos seguem aparecendo na trilha, agora via trigger.
-- =============================================================================

-- =============================================================================
-- A) Policy de INSERT — whitelist negativa + limites de tamanho
-- =============================================================================

drop policy if exists activity_logs_insert_own on public.activity_logs;

create policy activity_logs_insert_own on public.activity_logs
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    -- scope='admin' é reservado pra escrita server-side (triggers/RPCs abaixo)
    and coalesce(scope, '') <> 'admin'
    -- anti-flood: limites generosos pro uso legítimo, hostis pra abuso
    and (scope is null or length(scope) <= 64)
    and length(evt) <= 120
    and (request_id is null or length(request_id) <= 64)
    and (fields is null or pg_column_size(fields) <= 8192)
  );

-- =============================================================================
-- B1) Trigger de auditoria — app_settings
-- =============================================================================
-- Escrita em app_settings só acontece via admin_set_setting() (SECURITY
-- DEFINER que valida is_admin) ou service_role. auth.uid() não-nulo aqui
-- significa "admin autenticado mudou config" — exatamente o que auditamos.
-- Sem handler de exceção de propósito: se a auditoria falhar, a mutação
-- falha junto (fail-closed).

create or replace function public.tg_audit_app_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Contexto sem JWT (service_role/migration/seed): não é ação de admin logado.
  if v_uid is not null then
    insert into public.activity_logs (user_id, level, scope, evt, fields)
    values (
      v_uid, 'info', 'admin', 'setting_changed',
      jsonb_build_object('setting_key', new.key, 'op', lower(tg_op), 'via', 'db_trigger')
    );
  end if;
  return null;  -- AFTER trigger: retorno ignorado
end $$;

comment on function public.tg_audit_app_settings() is
  'Auditoria server-side de mudanças em app_settings → activity_logs (scope=admin). Substitui o log client-side forjável/suprimível (auditoria 2026-06-10, MIGRATIONS-05).';

drop trigger if exists app_settings_admin_audit on public.app_settings;

create trigger app_settings_admin_audit
  after insert or update on public.app_settings
  for each row execute function public.tg_audit_app_settings();

-- =============================================================================
-- B2) Trigger de auditoria — prompt_library (apenas prompts oficiais)
-- =============================================================================
-- Usuário comum não alcança rows oficiais (RLS 0006/0009/0011), então quando
-- uma row com is_official=true muda sob um JWT, foi um admin. Prompts privados
-- de aluno ficam de fora (conteúdo do aluno não entra em log — CLAUDE.md);
-- logamos só o id do prompt oficial, nunca template/título.

-- Gotcha plpgsql: OLD não existe em INSERT e NEW não existe em DELETE —
-- referenciá-los (mesmo em branch não tomado de um CASE) pode falhar com
-- "record is not assigned yet". Por isso os branches explícitos por TG_OP.

create or replace function public.tg_audit_official_prompts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_official, false) then
      insert into public.activity_logs (user_id, level, scope, evt, fields)
      values (v_uid, 'info', 'admin', 'prompt_created',
              jsonb_build_object('prompt_id', new.id, 'via', 'db_trigger'));
    end if;
  elsif tg_op = 'UPDATE' then
    if coalesce(old.is_official, false) or coalesce(new.is_official, false) then
      insert into public.activity_logs (user_id, level, scope, evt, fields)
      values (v_uid, 'info', 'admin', 'prompt_updated',
              jsonb_build_object('prompt_id', new.id, 'via', 'db_trigger'));
    end if;
  else  -- DELETE
    if coalesce(old.is_official, false) then
      insert into public.activity_logs (user_id, level, scope, evt, fields)
      values (v_uid, 'info', 'admin', 'prompt_deleted',
              jsonb_build_object('prompt_id', old.id, 'via', 'db_trigger'));
    end if;
  end if;

  return null;  -- AFTER trigger: retorno ignorado
end $$;

comment on function public.tg_audit_official_prompts() is
  'Auditoria server-side de INSERT/UPDATE/DELETE em prompts oficiais → activity_logs (scope=admin). Loga só o id — nunca template/título (auditoria 2026-06-10, MIGRATIONS-05).';

drop trigger if exists prompt_library_admin_audit on public.prompt_library;

create trigger prompt_library_admin_audit
  after insert or update or delete on public.prompt_library
  for each row execute function public.tg_audit_official_prompts();
