/**
 * Helper de upload: gera signed URL no Storage, faz PUT direto,
 * e dispara a Edge Function ingest-document.
 */

import { supabase } from './supabase';
import type { FormatoDocumento, UploadResponse } from '@psp2/shared';
import { MIME_TO_FORMAT } from '@psp2/shared';

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
  if (!format) throw new Error(`Formato não suportado: ${file.type || file.name}`);

  // 1) Valida sessão ANTES de subir o arquivo pro Storage.
  //    Sem isso, um token expirado fazia o upload do arquivo (até 50MiB) e
  //    só depois a Edge Function rejeitava por unauth — arquivo órfão no bucket.
  //    Origem: auditoria 2026-05-26 (Agente 1, achado C6).
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sessão expirada — faça login novamente');

  // Path: {user_id}/{timestamp}-{filename}
  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const storagePath = `${user.id}/${Date.now()}-${safeName}`;

  // 2) Upload direto pro Storage
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (uploadError) throw uploadError;

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
    throw new Error(`ingest-document falhou (${res.status}): ${body}`);
  }

  return (await res.json()) as UploadResponse;
}
