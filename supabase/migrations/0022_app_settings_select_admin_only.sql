-- =============================================================================
-- Migration 0022 — app_settings: leitura restrita a admin
-- =============================================================================
-- Origem: auditoria 2026-06-10 (MIGRATIONS-03).
--
-- A policy app_settings_select_all (0009) liberava SELECT pra qualquer
-- authenticated com `using (true)`. Hoje a tabela só guarda nomes de modelos
-- LLM, mas é configuração interna de admin — qualquer flag/limite/custo
-- colocado ali no futuro vazaria pra todos os usuários por padrão.
--
-- Verificado antes de restringir (2026-06-10):
--   - Único leitor no front: useAppSettings.ts, consumido apenas por
--     AdminModelos.tsx (rota /admin, atrás de RequireAdmin).
--   - Edge Functions leem via service_role (_shared/models.ts) — bypassa RLS.
--   - O trabalho em andamento do /admin (useAdminPrefs/useAdminMetrics/
--     useFeedback, branch sprint1-finalization) não lê app_settings.
-- Logo nenhum não-admin depende da leitura → seguro trocar pra is_admin().
-- =============================================================================

drop policy if exists "app_settings_select_all" on public.app_settings;
drop policy if exists "app_settings_select_admin" on public.app_settings;

-- (select ...) wrapper: o planner cacheia via initPlan (padrão do 0006).
create policy "app_settings_select_admin"
  on public.app_settings for select
  to authenticated
  using ((select public.is_admin()));

comment on table public.app_settings is
  'Configs runtime-editáveis (modelos LLM, flags). Leitura restrita a admin (RLS via is_admin); escrita só via admin_set_setting(). Edge Functions usam service_role.';
