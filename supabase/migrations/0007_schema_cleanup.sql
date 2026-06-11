-- =============================================================================
-- Migration 0007 — Schema cleanup (CHECK, índice, comentários SQL)
-- =============================================================================
-- Endereça achados da auditoria 2026-05-26:
--   - Agente 6, D2: CHECK em jobs.progress_percent (0..100)
--   - Agente 6, B4: índice em documents.processed_at (caminho do generate-system-prompt)
--   - Agente 6, A5: comentário em feedback.job_id (NULL = feedback geral)
--   - Agente 6, C3: comentário em job_events sobre policy de INSERT
--   - Agente 6, C4: comentário em user_consents sobre ausência intencional de DELETE
--   - Agente 6, G3: comment on function handle_new_user
--
-- Pode aplicar com `supabase db push --linked` (idempotente — usa IF NOT EXISTS).
-- =============================================================================

-- A) jobs.progress_percent: garante 0..100 ----------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_progress_percent_range'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_progress_percent_range
      check (progress_percent between 0 and 100);
  end if;
end $$;

-- B) Índice em documents.processed_at (parcial, só linhas processadas) -----
create index if not exists idx_documents_processed
  on public.documents (user_id, processed_at desc)
  where processed_at is not null;

-- C) Comentários SQL ---------------------------------------------------------
comment on column public.feedback.job_id is
  'Job avaliado pelo feedback. NULL significa feedback geral do produto (não atrelado a um job específico). ON DELETE SET NULL preserva histórico.';

comment on table public.job_events is
  'Trilha de eventos do pipeline assíncrono (parse/classify/synthesize/compress/...). Inserts são feitos exclusivamente pela service_role via Edge Function — por isso não há policy de INSERT para usuários. Leitura RLS via FK do job.';

comment on table public.user_consents is
  'Registro LGPD de consentimentos (política/termos). DELETE intencionalmente ausente nas policies — revogação se faz via revoked_at, preservando trilha de auditoria.';

comment on function public.handle_new_user() is
  'Trigger AFTER INSERT em auth.users que cria automaticamente a row em public.profiles. Crítica: se dropada, o signup fica funcionando mas o profile nunca é criado e o app quebra silenciosamente em todo lugar que faz `select * from profiles where id = auth.uid()`.';
