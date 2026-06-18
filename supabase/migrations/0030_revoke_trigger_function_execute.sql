-- =============================================================================
-- Migration 0030 — Revoga EXECUTE das trigger functions de auditoria
-- =============================================================================
-- Origem: advisor de segurança após a 0024 (anon/authenticated_security_definer
-- _function_executable).
--
-- tg_audit_app_settings() e tg_audit_official_prompts() (criadas na 0024) são
-- TRIGGER functions SECURITY DEFINER. Por viverem no schema `public`, o
-- PostgREST as expôs como RPC chamável (/rest/v1/rpc/tg_audit_*) por anon e
-- authenticated — algo que trigger function nunca deveria oferecer.
--
-- Risco real é baixo (sem contexto de trigger elas referenciam NEW/OLD
-- inexistente e falham), mas o correto é não deixá-las na superfície da API:
-- o trigger as dispara como dono da tabela, sem depender de privilégio de
-- EXECUTE dos roles da API.
-- =============================================================================

revoke execute on function public.tg_audit_app_settings()     from public, anon, authenticated;
revoke execute on function public.tg_audit_official_prompts()  from public, anon, authenticated;
