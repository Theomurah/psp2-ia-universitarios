-- =============================================================================
-- Migration 0007 — Arquivamento de documentos (soft delete reversível)
-- =============================================================================
-- Adiciona `documents.archived_at` para soft delete.
-- - NULL = ativo (visível no Dashboard)
-- - timestamp = arquivado em (oculto do Dashboard, visível na aba Arquivados)
--
-- Delete permanente continua sendo `DELETE FROM documents WHERE id = ?` —
-- CASCADE limpa jobs, job_events, generated_content. Storage é responsabilidade
-- do client (Edge ou frontend) porque Postgres não tem hook em storage.objects.
-- =============================================================================

alter table public.documents
  add column if not exists archived_at timestamptz;

comment on column public.documents.archived_at is
  'Soft delete: quando set, documento fica oculto da view padrão do dashboard. Reversível. Não afeta dados linkados (jobs, generated_content) — eles continuam acessíveis via FK.';

-- Index parcial para listagem rápida de documentos ATIVOS por usuário
-- (caso mais comum — dashboard padrão). Para arquivados, usamos full scan
-- restrito por user_id (que já tem index).
create index if not exists idx_documents_user_active
  on public.documents(user_id, created_at desc)
  where archived_at is null;
