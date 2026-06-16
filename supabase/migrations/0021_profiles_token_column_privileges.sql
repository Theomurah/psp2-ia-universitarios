-- =============================================================================
-- Migration 0021 — Privilégio de coluna em profiles: tokens Google fora do front
-- =============================================================================
-- Origem: auditoria 2026-06-10 (tokens OAuth legíveis pelo próprio dono).
--
-- RLS limita a LINHA, não a COLUNA: o dono da row lia google_access_token,
-- google_refresh_token e google_token_expires_at com um select('*') comum.
-- Pela regra do CLAUDE.md, token OAuth nunca deve chegar ao browser — só as
-- Edge Functions (service_role) precisam dessas colunas.
--
-- Mecânica do Postgres: privilégio de COLUNA só tem efeito quando NÃO existe
-- privilégio de TABELA — por isso o REVOKE é table-level, seguido de GRANT
-- por lista explícita das colunas não-sensíveis.
--
-- ATENÇÃO (deploy acoplado): após esta migration, select('*') em profiles
-- falha com "permission denied" (42501) no PostgREST. O front (useProfile.ts)
-- é corrigido em paralelo pra lista explícita de colunas — aplicar esta
-- migration JUNTO do deploy desse front (front primeiro é seguro; migration
-- primeiro quebra o fetch de profile do app inteiro).
--
-- service_role não é afetado (mantém os grants próprios e bypassa RLS), então
-- connect-drive / process-document / generate-system-prompt seguem intactos.
-- =============================================================================

-- anon nem deveria enxergar profiles (policies são `to authenticated`);
-- remove o grant default por higiene, sem grant de volta.
revoke select on table public.profiles from authenticated, anon;

-- Lista explícita: tudo MENOS google_access_token, google_refresh_token e
-- google_token_expires_at. (drive_connected_at fica — é o indicador de
-- "Drive conectado" usado na UI, sem valor de credencial.)
--
-- NOTA DE MANUTENÇÃO: coluna nova em profiles que o front precise ler exige
-- GRANT adicional aqui (senão o PostgREST devolve 42501 pra ela).
grant select (
  id,
  email,
  full_name,
  semestre_atual,
  materias,
  drive_root_folder_id,
  drive_connected_at,
  curso,
  is_admin,
  is_test,
  created_at,
  updated_at
) on public.profiles to authenticated;
