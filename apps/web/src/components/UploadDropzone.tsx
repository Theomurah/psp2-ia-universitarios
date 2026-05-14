/**
 * T18 — Componente drag-and-drop de upload.
 *
 * Aceita PDF, DOCX, PPTX, MD, imagens (até 50 MiB).
 * Faz upload via signed URL e dispara o pipeline.
 */

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadDocument } from '../lib/upload';
import type { UploadResponse } from '@psp2/shared';

interface Props {
  onUploaded?: (response: UploadResponse, file: File) => void;
}

export default function UploadDropzone({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    for (const file of acceptedFiles) {
      setUploading(true);
      try {
        const res = await uploadDocument(file);
        onUploaded?.(res, file);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setUploading(false);
      }
    }
  }, [onUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
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
        {uploading ? (
          <p>Enviando…</p>
        ) : isDragActive ? (
          <p>Solta aqui pra subir o arquivo</p>
        ) : (
          <>
            <p><strong>Arrasta um arquivo</strong> ou clica pra escolher</p>
            <small>PDF, DOCX, PPTX, MD ou imagens (até 50 MiB)</small>
          </>
        )}
      </div>
      {error && <p className="error">Erro: {error}</p>}
    </div>
  );
}
