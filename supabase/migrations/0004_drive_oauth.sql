-- =============================================================================
-- PSP2 — Migration 0004
-- Campos pra integração com Google Drive (H6 / T27, T28, T29).
-- =============================================================================
-- A coluna `google_refresh_token` já existia no schema inicial.
-- Esta migration adiciona:
--   - google_access_token       cache do access_token vigente
--   - google_token_expires_at   validade do access_token (refresh quando passar)
--   - drive_connected_at        timestamp da 1ª conexão com Drive (telemetria)
--
-- Como aplicar: ver instruções em 0003_add_curso_horarios.sql (mesmo procedimento).
-- =============================================================================

alter table public.profiles
  add column if not exists google_access_token text,
  add column if not exists google_token_expires_at timestamptz,
  add column if not exists drive_connected_at timestamptz;

comment on column public.profiles.google_refresh_token is
  'Refresh token OAuth2 do Google (longa duração). Usado pra obter access tokens sem nova autorização.';

comment on column public.profiles.google_access_token is
  'Access token vigente. Curta duração (≈1h). Revalidado via refresh_token quando expira.';

comment on column public.profiles.google_token_expires_at is
  'Quando o google_access_token expira. Edge Function dá refresh com 60s de margem.';

comment on column public.profiles.drive_connected_at is
  'Timestamp da 1ª conexão bem-sucedida com Drive (telemetria + indicador na UI).';
