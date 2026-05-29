import { useEffect, useRef, useState } from 'react';
import type { JobWithDoc } from '../hooks/useJobs';

const STATUS_LABEL: Record<string, { text: string; tone: 'info' | 'success' | 'warn' | 'error' }> = {
  pending: { text: 'Aguardando', tone: 'info' },
  processing: { text: 'Processando', tone: 'info' },
  needs_review: { text: 'Precisa revisão', tone: 'warn' },
  completed: { text: 'Concluído', tone: 'success' },
  completed_with_warning: { text: 'Concluído (warning)', tone: 'warn' },
  failed: { text: 'Erro', tone: 'error' },
};

const STEP_LABEL: Record<string, string> = {
  parse: 'Extraindo texto',
  classify: 'Classificando',
  synthesize: 'Sintetizando',
  compress: 'Comprimindo',
  validate: 'Validando',
  nomenclature: 'Renomeando',
  upload_drive: 'Enviando ao Drive',
};

interface Props {
  job: JobWithDoc;
  onSelect?: () => void;
  /** Card está sendo exibido na view de arquivados (muda label do menu). */
  archivedView?: boolean;
  onArchive?: (job: JobWithDoc) => void;
  onUnarchive?: (job: JobWithDoc) => void;
  onDelete?: (job: JobWithDoc) => void;
}

export default function JobCard({
  job, onSelect, archivedView = false, onArchive, onUnarchive, onDelete,
}: Props) {
  const status = STATUS_LABEL[job.status] ?? { text: job.status, tone: 'info' as const };
  const stepText = job.current_step ? STEP_LABEL[job.current_step] : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside fecha o menu (e cancela confirmação de delete)
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleCardClick = (e: React.MouseEvent) => {
    // Se clicou no menu ou em um item dele, não abre preview
    if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
    onSelect?.();
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <article
      className={`job-card tone-${status.tone}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect?.(); }}
    >
      <header>
        <span className="filename" title={job.documents.filename_original}>
          {job.documents.filename_original}
        </span>
        <div className="job-card-header-right">
          <span className={`badge tone-${status.tone}`}>{status.text}</span>
          {(onArchive || onUnarchive || onDelete) && (
            <div className="job-card-menu" ref={menuRef} onClick={stop}>
              <button
                type="button"
                className="ghost icon-only job-card-menu-trigger"
                aria-label="Mais opções"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                title="Mais opções"
              >
                ⋯
              </button>
              {menuOpen && (
                <div className="job-card-menu-dropdown" role="menu">
                  {!confirmDelete && archivedView && onUnarchive && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { onUnarchive(job); setMenuOpen(false); }}
                    >
                      Desarquivar
                    </button>
                  )}
                  {!confirmDelete && !archivedView && onArchive && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { onArchive(job); setMenuOpen(false); }}
                    >
                      Arquivar
                    </button>
                  )}
                  {!confirmDelete && onDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      className="danger-link"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Excluir…
                    </button>
                  )}
                  {confirmDelete && onDelete && (
                    <div className="job-card-confirm">
                      <small>Excluir permanentemente?</small>
                      <div className="job-card-confirm-actions">
                        <button
                          type="button"
                          className="danger"
                          onClick={() => { onDelete(job); setMenuOpen(false); setConfirmDelete(false); }}
                        >
                          Excluir
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setConfirmDelete(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {job.documents.materia_code && (
        <p className="meta">
          {job.documents.materia_code} · {job.documents.tipo}
          {job.documents.data_doc ? ` · ${job.documents.data_doc}` : ''}
        </p>
      )}

      {job.status === 'processing' && (
        <>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${job.progress_percent}%` }} />
          </div>
          <small>{stepText ?? 'Em andamento'} — {job.progress_percent}%</small>
        </>
      )}

      {job.status === 'failed' && job.error_reason && (
        <small className="error">{job.error_reason}</small>
      )}

      {job.documents.filename_final && (
        <small className="filename-final">→ {job.documents.filename_final}</small>
      )}
    </article>
  );
}
