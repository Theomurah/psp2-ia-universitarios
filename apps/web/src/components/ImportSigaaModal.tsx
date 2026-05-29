/**
 * Modal "Importar do SIGAA" — fluxo em 3 etapas:
 *   1. Instruções + dropzone (envio do PDF)
 *   2. Loading enquanto a Edge Function parseia
 *   3. Preview do que foi extraído + ações (Confirmar / Cancelar)
 *
 * Não escreve no banco — devolve `SigaaAtestado` via `onConfirm(parsed)`.
 * Caller decide o que fazer (merge no profile, etc.).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { SigaaAtestado } from '@psp2/shared';
import { useImportSigaa, EdgeFunctionMissingError } from '../hooks/useImportSigaa';
import { useToast } from './Toast';
import { colorForMateria } from '../lib/materiaColor';
import { createLogger } from '../lib/log';

const log = createLogger('import-sigaa-modal');

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (parsed: SigaaAtestado) => void;
}

type Stage = 'upload' | 'parsing' | 'preview';

export default function ImportSigaaModal({ open, onClose, onConfirm }: Props) {
  const importMutation = useImportSigaa();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('upload');
  const [parsed, setParsed] = useState<SigaaAtestado | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setStage('upload');
      setParsed(null);
    }
  }, [open]);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stage !== 'parsing') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, stage, onClose]);

  const [missingFunction, setMissingFunction] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setStage('parsing');
    setMissingFunction(false);
    try {
      const data = await importMutation.mutateAsync(file);
      setParsed(data);
      setStage('preview');
      if (data.warnings.length > 0) {
        toast.warning('Algumas informações precisam de revisão',
          `${data.warnings.length} aviso(s) — confira no preview.`);
      }
    } catch (err) {
      if (err instanceof EdgeFunctionMissingError) {
        log.warn('edge_function_missing');
        setMissingFunction(true);
        setStage('upload');
        return;
      }
      log.error('sigaa_import_failed', log.fromError(err));
      toast.error('Falha ao importar atestado', (err as Error).message);
      setStage('upload');
    }
  }, [importMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
    disabled: stage !== 'upload',
    onDrop: (accepted) => {
      const f = accepted[0];
      if (f) handleFile(f);
    },
    onDropRejected: (rejs) => {
      const err = rejs[0]?.errors?.[0]?.message ?? 'Arquivo não aceito.';
      toast.error('Arquivo inválido', err);
    },
  });

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={() => stage !== 'parsing' && onClose()} aria-hidden="true" />
      <div className="modal" role="dialog" aria-modal="true" aria-label="Importar do SIGAA">
        <header className="modal-header">
          <div>
            <h2>Importar do SIGAA</h2>
            <p className="hint">
              {stage === 'upload' && 'Envie o atestado de matrícula em PDF.'}
              {stage === 'parsing' && 'Processando…'}
              {stage === 'preview' && 'Confira os dados antes de salvar.'}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="ghost icon-only"
            aria-label="Fechar"
            onClick={() => stage !== 'parsing' && onClose()}
            disabled={stage === 'parsing'}
          >
            ✕
          </button>
        </header>

        <div className="modal-body">
          {stage === 'upload' && (
            <>
              {missingFunction && (
                <div className="alert alert-warn" role="alert">
                  <strong>Função ainda não está deployada</strong>
                  <p>
                    A Edge Function <code>parse-sigaa-atestado</code> não foi enviada para o Supabase ainda.
                    Sem ela, a importação não funciona. Rode no terminal:
                  </p>
                  <pre className="code-block">supabase functions deploy parse-sigaa-atestado \
  --project-ref &lt;seu-project-ref&gt;</pre>
                  <p className="hint" style={{ margin: 0 }}>
                    Enquanto isso, você pode cadastrar matérias manualmente em{' '}
                    <strong>Configurações</strong>.
                  </p>
                </div>
              )}

              <div className="sigaa-instructions">
                <strong>Como obter o atestado:</strong>
                <ol>
                  <li>Acesse <a href="https://sigaa.unb.br" target="_blank" rel="noreferrer noopener">sigaa.unb.br</a></li>
                  <li>Menu <strong>Discente → Ensino → Emitir Atestado de Matrícula</strong></li>
                  <li>Clique em <strong>Imprimir</strong> e escolha "Salvar como PDF"</li>
                  <li>Arraste o PDF para a área abaixo</li>
                </ol>
              </div>

              <div
                {...getRootProps()}
                className={`dropzone ${isDragActive ? 'active' : ''}`}
                style={{ minHeight: 180 }}
              >
                <input {...getInputProps()} />
                <div className="dropzone-icon">📄</div>
                <p>
                  <strong>Arraste o PDF aqui</strong> ou clique para escolher
                </p>
                <small>PDF, até 5 MB · processamento seguro no Supabase</small>
              </div>
            </>
          )}

          {stage === 'parsing' && (
            <div className="parsing-state">
              <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
              <p className="step">Lendo o PDF e identificando suas matérias…</p>
              <small className="hint">Geralmente leva 2 a 5 segundos.</small>
            </div>
          )}

          {stage === 'preview' && parsed && (
            <ImportPreview parsed={parsed} onCancel={() => setStage('upload')} onConfirm={() => onConfirm(parsed)} />
          )}
        </div>
      </div>
    </>
  );
}

// =============================================================
// Preview do que foi extraído
// =============================================================
function ImportPreview({
  parsed, onConfirm, onCancel,
}: { parsed: SigaaAtestado; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="import-preview">
      <div className="import-preview-meta">
        {parsed.nome_aluno && <div><span>Aluno</span><strong>{parsed.nome_aluno}</strong></div>}
        {parsed.curso && <div><span>Curso</span><strong>{parsed.curso}</strong></div>}
        {parsed.semestre && <div><span>Semestre</span><strong>{parsed.semestre}</strong></div>}
        {parsed.matricula && <div><span>Matrícula</span><strong>{parsed.matricula}</strong></div>}
      </div>

      <h3>Matérias encontradas <span className="count">({parsed.materias.length})</span></h3>
      <ul className="import-preview-list">
        {parsed.materias.map((m) => {
          const color = colorForMateria(m.code);
          return (
            <li key={m.code} style={{ borderLeftColor: color.bg }}>
              <div className="import-preview-head">
                <strong>{m.code}</strong>
                <span className="badge tone-info">Turma {m.turma ?? '—'}</span>
              </div>
              <div className="import-preview-nome">{m.nome}</div>
              <div className="import-preview-meta-line">
                {m.codigo_horario_sigaa && <span className="cell-mono">{m.codigo_horario_sigaa}</span>}
                {m.horarios.length > 0 && (
                  <span>
                    {m.horarios.map((h) => `${h.dia} ${h.inicio}–${h.fim}`).join(' · ')}
                  </span>
                )}
                {m.horarios.length === 0 && <span className="error-text">horário não decodificado</span>}
              </div>
              {(m.local || m.professor) && (
                <div className="import-preview-meta-line">
                  {m.local && <span>📍 {m.local}</span>}
                  {m.professor && <span>👤 {m.professor}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {parsed.warnings.length > 0 && (
        <div className="import-preview-warnings">
          <strong>⚠ {parsed.warnings.length} aviso(s):</strong>
          <ul>
            {parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <p className="hint" style={{ marginTop: '1rem' }}>
        Ao confirmar, vamos <strong>mesclar</strong> com suas matérias atuais (existentes serão atualizadas pelo código).
        Você pode editar tudo depois em Configurações.
      </p>

      <div className="actions-row">
        <button type="button" className="ghost" onClick={onCancel}>← Reenviar</button>
        <button type="button" className="primary" onClick={onConfirm}>
          Salvar {parsed.materias.length} matéria(s)
        </button>
      </div>
    </div>
  );
}
