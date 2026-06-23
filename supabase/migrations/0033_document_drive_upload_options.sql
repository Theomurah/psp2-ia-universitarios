-- =============================================================================
-- Migration 0033 — Opções de envio ao Drive por documento
-- =============================================================================
-- Permite escolher, NO MOMENTO DO UPLOAD, o que vai pro Google Drive:
--   - synthesized : só o .md sintetizado (comportamento atual / default)
--   - raw         : só o arquivo original, sem síntese (pula o LLM — custo zero)
--   - both        : síntese + original
--
-- drive_raw_name_mode controla o nome do arquivo CRU no Drive (só vale quando
-- há classificação, i.e. modo 'both'):
--   - original  : mantém o nome que o aluno subiu (default)
--   - organized : aplica a nomenclatura (MATERIA - Tipo - ...) com a extensão original
--
-- drive_raw_file_id rastreia o upload do cru (idempotência no reprocesso, igual
-- ao drive_file_id da síntese).
-- =============================================================================

alter table public.documents
  add column if not exists drive_upload_mode text not null default 'synthesized'
    check (drive_upload_mode in ('synthesized', 'raw', 'both')),
  add column if not exists drive_raw_name_mode text not null default 'original'
    check (drive_raw_name_mode in ('original', 'organized')),
  add column if not exists drive_raw_file_id text;

comment on column public.documents.drive_upload_mode is
  'O que enviar pro Drive: synthesized (só .md) | raw (só original, sem síntese) | both. Escolhido no upload. Migration 0033.';
comment on column public.documents.drive_raw_name_mode is
  'Nome do arquivo cru no Drive: original (nome subido) | organized (nomenclatura). Só aplicável quando há classificação (modo both).';
comment on column public.documents.drive_raw_file_id is
  'ID no Drive do arquivo original enviado (modos raw/both). Null se não enviado. Espelha drive_file_id da síntese.';
