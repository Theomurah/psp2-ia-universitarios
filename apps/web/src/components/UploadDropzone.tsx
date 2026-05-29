/**
 * T18 — Componente drag-and-drop de upload.
 *
 * Aceita PDF, DOCX, PPTX, MD, imagens (até 50 MiB).
 * Faz upload via signed URL e dispara o pipeline.
 *
 * [extra] Toasts em sucesso/erro/arquivo rejeitado e ícone visual no estado idle.
 */

import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { uploadDocument } from '../lib/upload';
import { useToast } from './Toast';
import { createLogger } from '../lib/log';
import type { UploadResponse } from '@psp2/shared';

const log = createLogger('upload-dropzone');

interface Props {
  onUploaded?: (response: UploadResponse, file: File) => void;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadDropzone({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      setUploading(true);
      toast.info('Enviando arquivo', `${file.name} (${fmtBytes(file.size)})`);
      try {
        const res = await uploadDocument(file);
        toast.success('Upload concluído', `${file.name} entrou na fila de processamento.`);
        onUploaded?.(res, file);
      } catch (err) {
        const msg = (err as Error).message ?? 'Falha desconhecida.';
        toast.error('Falha no upload', msg);
        // Não loga file.name (PII) — só metadados seguros.
        log.error('upload_failed', { size_bytes: file.size, mime_type: file.type, ...log.fromError(err) });
      } finally {
        setUploading(false);
      }
    }
  }, [onUploaded, toast]);

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    for (const rej of rejections) {
      const first = rej.errors[0];
      const reason = first?.code === 'file-too-large'
        ? 'Arquivo excede 50 MiB.'
        : first?.code === 'file-invalid-type'
          ? 'Formato não suportado.'
          : (first?.message ?? 'Arquivo rejeitado.');
      toast.warning('Arquivo recusado', `${rej.file.name}: ${reason}`);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/markdown': ['.md'],
      'text/plain': ['.txt'],
      'image/*': ['.png', '.jpg', '.jpeg', '.heic', '.webp'],
    },
    maxSize: 50 * 1024 * 1024, // 50 MiB
    disabled: uploading,
  });

  return (
    <div className="upload-zone">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''} ${uploading ? 'uploading' : ''}`}
      >
        <input {...getInputProps()} />
        <span className="dropzone-icon" aria-hidden>⬆</span>
        {uploading ? (
          <p><strong>Enviando…</strong></p>
        ) : isDragActive ? (
          <p><strong>Solte o arquivo aqui</strong></p>
        ) : (
          <>
            <p><strong>Arraste um arquivo</strong> ou clique para escolher</p>
            <small>PDF, DOCX, PPTX, MD ou imagens · até 50 MiB</small>
          </>
        )}
      </div>
    </div>
  );
}
