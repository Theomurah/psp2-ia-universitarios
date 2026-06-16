-- =============================================================================
-- Migration 0023 — Hardening das policies do bucket "documents"
-- =============================================================================
-- Origem: auditoria 2026-06-10 (MIGRATIONS-04).
--
-- As policies da 0002 estavam funcionalmente seguras (ownership de path via
-- (storage.foldername(name))[1] = auth.uid()), mas:
--   1) Não declaravam `to authenticated` — valiam pro role public (inclui
--      anon), seguro apenas implicitamente porque auth.uid() é null em anon.
--   2) Não existia policy de UPDATE — overwrite/upsert pelo próprio dono era
--      bloqueado silenciosamente pela RLS de storage.objects. Hoje o upload
--      usa `upsert: false` com path timestampado, mas o gap ficava à espreita.
--
-- Recria as 3 policies com escopo explícito + (select auth.uid()) cacheável
-- (padrão do 0006) e adiciona a policy de UPDATE com o mesmo ownership.
-- =============================================================================

-- INSERT --------------------------------------------------------------------
drop policy if exists "documents_upload_own" on storage.objects;

create policy "documents_upload_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- SELECT --------------------------------------------------------------------
drop policy if exists "documents_select_own" on storage.objects;

create policy "documents_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- UPDATE (novo — overwrite/upsert do próprio arquivo) -------------------------
drop policy if exists "documents_update_own" on storage.objects;

create policy "documents_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- DELETE --------------------------------------------------------------------
drop policy if exists "documents_delete_own" on storage.objects;

create policy "documents_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
