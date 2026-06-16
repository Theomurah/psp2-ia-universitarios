-- =============================================================================
-- Migration 0027 — Índice jobs(user_id, created_at desc)
-- =============================================================================
-- Origem: auditoria 2026-06-10 (MIGRATIONS-08).
--
-- useJobs é a query mais frequente do app (Dashboard, invalidada a cada evento
-- Realtime): ordena jobs por created_at desc com limit 100 sob filtro RLS de
-- user_id. Os índices existentes (0001: user_id / document_id / user_id+status)
-- não cobrem a ordenação — o Postgres buscava todos os jobs do usuário e
-- ordenava em memória.
--
-- Espelha o padrão já usado em idx_documents_created (0001). Custo trivial na
-- escala atual; evita degradação conforme alunos acumulam jobs.
-- =============================================================================

create index if not exists idx_jobs_user_created
  on public.jobs (user_id, created_at desc);
