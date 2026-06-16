-- =============================================================================
-- Migration 0009 — Painel Admin (app_settings + RPCs de leitura/escrita)
-- =============================================================================
-- Destrava o painel /admin:
--   - app_settings: chave/valor jsonb pra configs editáveis em runtime
--                   (modelos LLM por estágio, no futuro também system prompts).
--   - RPCs SECURITY DEFINER que checam is_admin() internamente — defesa em
--     profundidade. Frontend pode mentir; RPC não.
--   - Policy admin em prompt_library: admin pode editar/deletar oficiais.
-- =============================================================================

-- =============================================================================
-- A) app_settings — store chave/valor editável em runtime
-- =============================================================================

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

comment on table public.app_settings is
  'Configs runtime-editáveis (modelos LLM, flags). Leitura aberta pra authenticated; escrita só via admin_set_setting().';

create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.tg_set_updated_at();

alter table public.app_settings enable row level security;

-- Leitura: qualquer authenticated lê. Edge Functions usam service_role
-- (bypassa RLS), e o frontend só lê via admin (RPC) ou config pública.
drop policy if exists "app_settings_select_all" on public.app_settings;
create policy "app_settings_select_all"
  on public.app_settings for select
  to authenticated
  using (true);

-- Escrita: bloqueada via RLS. Apenas pelo RPC admin_set_setting()
-- que é SECURITY DEFINER e checa is_admin().

-- Seed dos modelos LLM por estágio (defaults vivem em packages/shared/constants.ts;
-- aqui guardamos o override editável). value é uma string JSON simples.
insert into public.app_settings (key, value, description) values
  ('model_classify',        '"openai/gpt-4o-mini"'::jsonb,                  'Modelo para classify (extrair matéria/tipo/data do documento)'),
  ('model_synthesize',      '"deepseek/deepseek-chat-v3"'::jsonb,           'Modelo para synthesize (sumarizar conteúdo do documento)'),
  ('model_compress_compact','"google/gemini-2.0-flash-exp"'::jsonb,         'Modelo para compress compact (modo "compacta")'),
  ('model_compress_cola',   '"google/gemini-2.0-flash-exp"'::jsonb,         'Modelo para compress cola (modo "cola")'),
  ('model_judge',           '"openai/gpt-4o-mini"'::jsonb,                  'Modelo para judge (avaliar qualidade da síntese)'),
  ('model_vision',          '"anthropic/claude-sonnet-4.6"'::jsonb,         'Modelo para vision (OCR de imagens/PDFs scaneados)')
on conflict (key) do nothing;

-- =============================================================================
-- B) RPC admin_metrics_overview() — cards do dashboard
-- =============================================================================

create or replace function public.admin_metrics_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $fn$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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
      'success',      (select count(*) from public.jobs where status = 'success'),
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

revoke all on function public.admin_metrics_overview() from public, anon;
grant execute on function public.admin_metrics_overview() to authenticated;

comment on function public.admin_metrics_overview() is
  'Retorna JSON consolidado pros cards do dashboard /admin. Raises 42501 se chamado por não-admin.';

-- =============================================================================
-- C) RPC admin_recent_jobs(p_limit) — tabela de atividade recente
-- =============================================================================

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
           j.completed_at
      from public.jobs j
      join public.profiles p on p.id = j.user_id
      join public.documents d on d.id = j.document_id
     order by j.created_at desc
     limit greatest(1, least(p_limit, 100));
end $fn$;

revoke all on function public.admin_recent_jobs(integer) from public, anon;
grant execute on function public.admin_recent_jobs(integer) to authenticated;

-- =============================================================================
-- D) RPC admin_recent_users(p_limit) — tabela de usuários recentes
-- =============================================================================

create or replace function public.admin_recent_users(p_limit integer default 20)
returns table (
  id uuid,
  email text,
  full_name text,
  curso text,
  semestre_atual text,
  is_admin boolean,
  drive_connected boolean,
  doc_count bigint,
  created_at timestamptz
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
    select p.id,
           p.email,
           p.full_name,
           p.curso,
           p.semestre_atual,
           p.is_admin,
           (p.drive_connected_at is not null),
           (select count(*) from public.documents d where d.user_id = p.id),
           p.created_at
      from public.profiles p
     order by p.created_at desc
     limit greatest(1, least(p_limit, 100));
end $fn$;

revoke all on function public.admin_recent_users(integer) from public, anon;
grant execute on function public.admin_recent_users(integer) to authenticated;

-- =============================================================================
-- E) RPC admin_set_setting(key, value) — única forma de escrever em app_settings
-- =============================================================================

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns public.app_settings
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_row public.app_settings;
  v_uid uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.app_settings (key, value, updated_by)
       values (p_key, p_value, v_uid)
  on conflict (key) do update
     set value = excluded.value,
         updated_by = excluded.updated_by,
         updated_at = now()
  returning * into v_row;

  return v_row;
end $fn$;

revoke all on function public.admin_set_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;

-- =============================================================================
-- F) Policy admin em prompt_library — admins editam oficiais
-- =============================================================================
-- A policy de UPDATE/DELETE/INSERT existentes restringem a is_official = false.
-- Admin precisa de UPDATE/DELETE/INSERT em oficiais também. Adicionamos
-- policies separadas via OR (PostgreSQL combina policies de mesma operação por OR).
-- =============================================================================

drop policy if exists "prompts_admin_insert_official" on public.prompt_library;
drop policy if exists "prompts_admin_update_official" on public.prompt_library;
drop policy if exists "prompts_admin_delete_official" on public.prompt_library;

create policy "prompts_admin_insert_official"
  on public.prompt_library for insert
  to authenticated
  with check (public.is_admin() and is_official = true and user_id is null);

create policy "prompts_admin_update_official"
  on public.prompt_library for update
  to authenticated
  using (public.is_admin() and is_official = true)
  with check (public.is_admin() and is_official = true);

create policy "prompts_admin_delete_official"
  on public.prompt_library for delete
  to authenticated
  using (public.is_admin() and is_official = true);
