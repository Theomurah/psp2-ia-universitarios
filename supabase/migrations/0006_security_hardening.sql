-- =============================================================================
-- Migration 0006 — Hardening de segurança (RLS + Functions + LGPD)
-- =============================================================================
-- Re-cria policies de RLS com boas práticas 2026:
--   - TO authenticated explícito (defesa em profundidade)
--   - (select auth.uid()) wrapper para que o planner cacheie via initPlan
--   - WITH CHECK explícito em INSERT/UPDATE (mesmo que herde do USING)
--   - Index nas colunas referenciadas pelas policies
--
-- Garante search_path seguro em todas as funções SECURITY DEFINER.
--
-- Adiciona tabela user_consents (LGPD) + RPCs export_user_data + delete_my_account.
-- =============================================================================

-- =============================================================================
-- A) Hardening de policies existentes
-- =============================================================================

-- profiles -------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- documents ------------------------------------------------------------------
drop policy if exists "documents_all_own" on public.documents;

-- Separa por operação pra ficar explícito + ganha WITH CHECK próprio
create policy "documents_select_own"
  on public.documents for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "documents_insert_own"
  on public.documents for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "documents_update_own"
  on public.documents for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "documents_delete_own"
  on public.documents for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- jobs ------------------------------------------------------------------------
drop policy if exists "jobs_all_own" on public.jobs;

create policy "jobs_select_own"
  on public.jobs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "jobs_insert_own"
  on public.jobs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "jobs_update_own"
  on public.jobs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "jobs_delete_own"
  on public.jobs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- job_events ------------------------------------------------------------------
drop policy if exists "job_events_select_via_job" on public.job_events;

create policy "job_events_select_via_job"
  on public.job_events for select
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_events.job_id and j.user_id = (select auth.uid())
    )
  );

-- generated_content ----------------------------------------------------------
drop policy if exists "generated_select_via_doc" on public.generated_content;

create policy "generated_select_via_doc"
  on public.generated_content for select
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = generated_content.document_id and d.user_id = (select auth.uid())
    )
  );

-- prompt_library --------------------------------------------------------------
drop policy if exists "prompts_select_official_or_own" on public.prompt_library;
drop policy if exists "prompts_insert_own" on public.prompt_library;
drop policy if exists "prompts_update_own" on public.prompt_library;

create policy "prompts_select_official_or_own"
  on public.prompt_library for select
  to authenticated
  using (
    is_official = true or (select auth.uid()) = user_id
  );

create policy "prompts_insert_own"
  on public.prompt_library for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id and is_official = false
  );

-- WITH CHECK explícito: impede que UPDATE mude is_official=false para true
create policy "prompts_update_own"
  on public.prompt_library for update
  to authenticated
  using ((select auth.uid()) = user_id and is_official = false)
  with check ((select auth.uid()) = user_id and is_official = false);

create policy "prompts_delete_own"
  on public.prompt_library for delete
  to authenticated
  using ((select auth.uid()) = user_id and is_official = false);

-- user_system_prompts ---------------------------------------------------------
drop policy if exists "user_prompts_all_own" on public.user_system_prompts;

create policy "user_prompts_select_own"
  on public.user_system_prompts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_prompts_insert_own"
  on public.user_system_prompts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_prompts_update_own"
  on public.user_system_prompts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_prompts_delete_own"
  on public.user_system_prompts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- feedback --------------------------------------------------------------------
drop policy if exists "feedback_all_own" on public.feedback;

create policy "feedback_select_own"
  on public.feedback for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "feedback_insert_own"
  on public.feedback for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "feedback_update_own"
  on public.feedback for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "feedback_delete_own"
  on public.feedback for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- =============================================================================
-- B) Functions — search_path seguro
-- =============================================================================
-- Previne privilege escalation via schema hijacking.
-- =============================================================================

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- handle_new_user: precisa de SECURITY DEFINER pra escrever em public.profiles
-- enquanto roda sob auth.users INSERT trigger. search_path = '' + nomes qualificados.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end $$;

-- =============================================================================
-- C) LGPD — user_consents
-- =============================================================================
-- Registra cada termo aceito pelo usuário (versão, timestamp, IP, user agent).
-- Permite comprovar consentimento Art. 8º + auditoria.
-- =============================================================================

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,          -- 'tos', 'privacy', 'lgpd', 'marketing'
  version text not null,                -- 'v1.0', '2026-05-26', ...
  accepted boolean not null default true,
  given_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip inet,
  user_agent text,
  unique (user_id, consent_type, version)
);

create index if not exists idx_user_consents_user on public.user_consents(user_id);

alter table public.user_consents enable row level security;

create policy "user_consents_select_own"
  on public.user_consents for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_consents_insert_own"
  on public.user_consents for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Atualizar (ex: revogar) também precisa preservar ownership
create policy "user_consents_update_own"
  on public.user_consents for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- =============================================================================
-- D) LGPD — RPC: export_user_data
-- =============================================================================
-- Retorna todos os dados do próprio usuário em JSON.
-- Implementa Art. 18 II (acesso) e V (portabilidade).
-- =============================================================================

create or replace function public.export_user_data()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'user_id', (select auth.uid()),
    'profile', (
      select to_jsonb(p) - 'google_access_token' - 'google_refresh_token'
      from public.profiles p where p.id = (select auth.uid())
    ),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.created_at desc)
      from public.documents d where d.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'jobs', coalesce((
      select jsonb_agg(to_jsonb(j) order by j.created_at desc)
      from public.jobs j where j.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'job_events', coalesce((
      select jsonb_agg(to_jsonb(je) order by je.created_at)
      from public.job_events je
      join public.jobs j on j.id = je.job_id
      where j.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'generated_content', coalesce((
      select jsonb_agg(to_jsonb(gc))
      from public.generated_content gc
      join public.documents d on d.id = gc.document_id
      where d.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'prompt_library', coalesce((
      select jsonb_agg(to_jsonb(pl))
      from public.prompt_library pl
      where pl.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'user_system_prompts', coalesce((
      select jsonb_agg(to_jsonb(usp) order by usp.version desc)
      from public.user_system_prompts usp
      where usp.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at desc)
      from public.feedback f
      where f.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(to_jsonb(uc) order by uc.given_at desc)
      from public.user_consents uc
      where uc.user_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.export_user_data() from public, anon;
grant execute on function public.export_user_data() to authenticated;

-- =============================================================================
-- E) LGPD — RPC: delete_my_account
-- =============================================================================
-- Apaga TODOS os dados do usuário e o registro em auth.users (cascade).
-- Implementa Art. 18 VI (eliminação).
-- =============================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- profiles ON DELETE CASCADE em auth.users cobre todas as tabelas linkadas
  -- a public.profiles (documents, jobs, job_events, generated_content, etc.)
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
