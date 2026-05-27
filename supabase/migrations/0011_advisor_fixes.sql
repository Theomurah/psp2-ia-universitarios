-- =============================================================================
-- Migration 0011 — Advisor fixes (performance)
-- =============================================================================
-- Endereça achados do Supabase database linter (get_advisors performance)
-- da auditoria 2026-05-26 (Agente 3 + Agente 6):
--
--   A) FK feedback.job_id sem índice (unindexed_foreign_keys)
--      → CREATE INDEX idx_feedback_job
--
--   B) prompt_library com múltiplas policies permissivas pra
--      authenticated em INSERT/UPDATE/DELETE (multiple_permissive_policies)
--      → Consolida em 1 policy por ação combinando "is admin OR is owner"
--
-- Idempotente — usa IF NOT EXISTS / DROP IF EXISTS.
-- =============================================================================

-- A) Índice na FK feedback.job_id ------------------------------------------
create index if not exists idx_feedback_job
  on public.feedback (job_id)
  where job_id is not null;

comment on index public.idx_feedback_job is
  'Cobertura da FK feedback.job_id pra evitar full scan em ON DELETE de jobs. Origem: advisor performance / auditoria 2026-05-26.';

-- B) Consolida policies de prompt_library ----------------------------------
-- Antes: 2 permissive policies por ação (uma pra admin, uma pra owner) =
-- planner precisa executar ambas em toda query. Agora: 1 policy por ação
-- com "is_admin() OR auth.uid() = user_id" — equivalente em comportamento,
-- mais barato no planner.

-- INSERT
drop policy if exists "prompts_admin_insert_official" on public.prompt_library;
drop policy if exists "prompts_insert_own" on public.prompt_library;
create policy "prompts_insert"
  on public.prompt_library for insert
  to authenticated
  with check (
    -- Admin pode inserir oficial (is_official = true e user_id = null)
    -- OU usuário comum insere próprio (is_official = false e user_id = auth.uid())
    (public.is_admin() and is_official = true and user_id is null)
    or
    ((select auth.uid()) = user_id and is_official = false)
  );

-- UPDATE
drop policy if exists "prompts_admin_update_official" on public.prompt_library;
drop policy if exists "prompts_update_own" on public.prompt_library;
create policy "prompts_update"
  on public.prompt_library for update
  to authenticated
  using (
    (public.is_admin() and is_official = true)
    or
    ((select auth.uid()) = user_id and is_official = false)
  )
  with check (
    (public.is_admin() and is_official = true)
    or
    ((select auth.uid()) = user_id and is_official = false)
  );

-- DELETE
drop policy if exists "prompts_admin_delete_official" on public.prompt_library;
drop policy if exists "prompts_delete_own" on public.prompt_library;
create policy "prompts_delete"
  on public.prompt_library for delete
  to authenticated
  using (
    (public.is_admin() and is_official = true)
    or
    ((select auth.uid()) = user_id and is_official = false)
  );

-- Sanity check via NOTICE pra operador ver no output do supabase db push.
-- Origem: auditoria 2026-05-26 (Agente 4 — Observabilidade, A10).
do $$
declare
  perm_count int;
begin
  select count(*) into perm_count
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prompt_library'
      and 'authenticated' = any (roles)
      and cmd in ('INSERT', 'UPDATE', 'DELETE');
  raise notice 'PSP2 0011: prompt_library tem % policies authenticated (INSERT+UPDATE+DELETE) — esperado 3', perm_count;
end $$;
