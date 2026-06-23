/**
 * T18 — Componente drag-and-drop de upload.
 *
 * Aceita PDF, DOCX, PPTX, MD, imagens (até 50 MiB).
 *
 * Fluxo de staging (migration 0033): ao soltar, o arquivo fica numa lista de
 * pré-envio onde o aluno escolhe o que vai pro Drive — Síntese / Original /
 * Ambos — e (quando aplicável) o nome do arquivo cru. Só então confirma.
 */

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { uploadDocument } from '../lib/upload';
import { useToast } from './Toast';
import { createLogger } from '../lib/log';
import type { UploadResponse, DriveUploadMode, DriveRawNameMode } from '@psp2/shared';

const log = createLogger('upload-dropzone');

interface Props {
  onUploaded?: (response: UploadResponse, file: File) => void;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const MODE_LABEL: Record<DriveUploadMode, string> = {
  synthesized: 'Síntese',
  raw: 'Original',
  both: 'Ambos',
};

const MODE_HINT: Record<DriveUploadMode, string> = {
  synthesized: 'Só o resumo sintetizado (.md) vai pro Drive.',
  raw: 'Só o arquivo original, sem síntese — não consome IA.',
  both: 'Síntese + o arquivo original, na mesma pasta da matéria.',
};

export default function UploadDropzone({ onUploaded }: Props) {
  const [staged, setStaged] = useState<File[]>([]);
  const [driveMode, setDriveMode] = useState<DriveUploadMode>('synthesized');
  const [rawNameMode, setRawNameMode] = useState<DriveRawNameMode>('original');
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  // Stage: acumula os arquivos pra escolher as opções antes de enviar.
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setStaged((prev) => [...prev, ...acceptedFiles]);
  }, []);

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

  const removeStaged = (idx: number) => setStaged((prev) => prev.filter((_, i) => i !== idx));

  const confirmUpload = useCallback(async () => {
    if (staged.length === 0) return;
    setUploading(true);
    const files = staged;
    for (const file of files) {
      toast.info('Enviando arquivo', `${file.name} (${fmtBytes(file.size)})`);
      try {
        const res = await uploadDocument(file, {
          driveUploadMode: driveMode,
          driveRawNameMode: rawNameMode,
        });
        // Invalida ['jobs'] pra lista refletir o novo job mesmo com o canal
        // Realtime caído (auditoria 2026-06-10, achado WEB-COMPONENTS-03).
        void queryClient.invalidateQueries({ queryKey: ['jobs'] });
        toast.success('Upload concluído', `${file.name} entrou na fila de processamento.`);
        onUploaded?.(res, file);
      } catch (err) {
        const msg = (err as Error).message ?? 'Falha desconhecida.';
        toast.error('Falha no upload', msg);
        // Não loga file.name (PII) — só metadados seguros.
        log.error('upload_failed', { size_bytes: file.size, mime_type: file.type, ...log.fromError(err) });
      }
    }
    setStaged([]);
    setUploading(false);
  }, [staged, driveMode, rawNameMode, onUploaded, toast, queryClient]);

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
        {...getRootProps({
          role: 'button',
          'aria-label': 'Enviar arquivo: PDF, DOCX, PPTX, MD, TXT ou imagem, até 50 MiB',
          'aria-disabled': uploading,
          'aria-busy': uploading,
        })}
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

      {staged.length > 0 && (
        <div className="upload-staging card">
          <ul className="upload-staged-list">
            {staged.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span className="cell-truncate">{f.name}</span>
                <span className="muted">{fmtBytes(f.size)}</span>
                <button
                  type="button"
                  className="icon-only"
                  aria-label={`Remover ${f.name} da lista`}
                  onClick={() => removeStaged(i)}
                  disabled={uploading}
                >✕</button>
              </li>
            ))}
          </ul>

          <div className="field">
            <span>Enviar pro Google Drive</span>
            <div className="prompts-filter" role="group" aria-label="O que enviar pro Drive">
              {(['synthesized', 'raw', 'both'] as DriveUploadMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={driveMode === m ? 'active' : ''}
                  aria-pressed={driveMode === m}
                  onClick={() => setDriveMode(m)}
                  disabled={uploading}
                >{MODE_LABEL[m]}</button>
              ))}
            </div>
            <small className="hint">{MODE_HINT[driveMode]}</small>
          </div>

          {driveMode === 'both' && (
            <div className="field">
              <span>Nome do arquivo original no Drive</span>
              <div className="prompts-filter" role="group" aria-label="Nome do arquivo original">
                {(['original', 'organized'] as DriveRawNameMode[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={rawNameMode === n ? 'active' : ''}
                    aria-pressed={rawNameMode === n}
                    onClick={() => setRawNameMode(n)}
                    disabled={uploading}
                  >{n === 'original' ? 'Nome original' : 'Organizado'}</button>
                ))}
              </div>
              <small className="hint">
                {rawNameMode === 'original'
                  ? 'Mantém o nome que você subiu.'
                  : 'Renomeia no padrão da matéria (ex: "FISICA3 - Aula - U5 ....pdf").'}
              </small>
            </div>
          )}

          <div className="upload-staging-actions">
            <button type="button" className="ghost" onClick={() => setStaged([])} disabled={uploading}>
              Cancelar
            </button>
            <button type="button" className="primary" onClick={confirmUpload} disabled={uploading}>
              {uploading ? 'Enviando…' : `Enviar${staged.length > 1 ? ` (${staged.length})` : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
