-- =============================================================================
-- Migration 0002 — Bucket de Storage para uploads
-- =============================================================================
-- Cria o bucket "documents" privado, com policies que permitem o usuário
-- gerenciar apenas arquivos sob o próprio path: documents/{user_id}/...
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)  -- 50 MiB
on conflict (id) do nothing;

-- Usuário pode fazer upload no próprio path
create policy "documents_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Usuário pode ler os próprios arquivos
create policy "documents_select_own"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Usuário pode deletar os próprios arquivos
create policy "documents_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
