/**
 * Helper de upload: gera signed URL no Storage, faz PUT direto,
 * e dispara a Edge Function ingest-document.
 */

import { supabase } from './supabase';
import { createLogger } from './log';
import type { FormatoDocumento, UploadResponse } from '@psp2/shared';
import { MIME_TO_FORMAT } from '@psp2/shared';

const log = createLogger('upload');

export function detectFormat(file: File): FormatoDocumento | null {
  if (file.type in MIME_TO_FORMAT) return MIME_TO_FORMAT[file.type];
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'pptx') return 'pptx';
  if (ext === 'md' || ext === 'txt') return 'md';
  if (['png', 'jpg', 'jpeg', 'heic', 'webp'].includes(ext ?? '')) return 'image';
  return null;
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const format = detectFormat(file);
  if (!format) {
    // Loga só mime/ext — nunca o nome do arquivo (PII).
    log.warn('unsupported_format', { mime_type: file.type, ext: file.name.split('.').pop()?.toLowerCase() });
    throw new Error(`Formato não suportado: ${file.type || file.name}`);
  }

  // 1) Valida sessão ANTES de subir o arquivo pro Storage.
  //    Sem isso, um token expirado fazia o upload do arquivo (até 50MiB) e
  //    só depois a Edge Function rejeitava por unauth — arquivo órfão no bucket.
  //    Origem: auditoria 2026-05-26 (Agente 1, achado C6).
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    log.warn('upload_no_user');
    throw new Error('Não autenticado');
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    log.warn('session_expired_pre_upload', { user_id: user.id });
    throw new Error('Sessão expirada — faça login novamente');
  }

  log.info('upload_started', { user_id: user.id, format, size_bytes: file.size });

  // Path: {user_id}/{timestamp}-{filename}
  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const storagePath = `${user.id}/${Date.now()}-${safeName}`;

  // 2) Upload direto pro Storage
  const t0 = Date.now();
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (uploadError) {
    log.error('storage_upload_failed', { user_id: user.id, format, size_bytes: file.size, ...log.fromError(uploadError) });
    throw uploadError;
  }
  log.info('storage_upload_ok', { user_id: user.id, format, size_bytes: file.size, duration_ms: Date.now() - t0 });

  // 3) Dispara ingest-document
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const res = await fetch(`${supabaseUrl}/functions/v1/ingest-document`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename_original: file.name,
      format,
      size_bytes: file.size,
      storage_path: storagePath,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error('ingest_call_failed', { user_id: user.id, http_status: res.status });
    throw new Error(`ingest-document falhou (${res.status}): ${body}`);
  }

  const json = (await res.json()) as UploadResponse;
  log.info('ingest_ok', { user_id: user.id, format, job_id: (json as { job_id?: string }).job_id });
  return json;
}
