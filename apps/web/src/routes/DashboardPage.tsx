/**
 * T19 — Dashboard com status de processamento.
 *
 * Lista todos os jobs do usuário (escuta via Realtime),
 * permite selecionar um pra ver o preview (T20),
 * e oferece o componente de upload (T18) no topo.
 *
 * [extra] Cards de métricas pessoais + filtros (matéria, status, busca).
 * [extra 2026-05-26] Preview drawer reformulado: backdrop clicável, fecha com ESC,
 * lock de scroll do body, estado "processando" com spinner + step + progresso,
 * estado "falhou" mostrando motivo. Header sticky dentro do drawer.
 * [extra 2026-05-26] Arquivar (soft delete) e Excluir (hard delete) docs/execuções.
 */

import { useEffect, useMemo, useState } from 'react';
import UploadDropzone from '../components/UploadDropzone';
import JobCard from '../components/JobCard';
import MarkdownPreview from '../components/MarkdownPreview';
import MetricsCards from '../components/MetricsCards';
import ActivityFeed from '../components/ActivityFeed';
import { useJobs, useJobsRealtime, type JobsView, type JobWithDoc } from '../hooks/useJobs';
import { useSetArchived, useDeleteDocument } from '../hooks/useDocumentActions';
import { useToast } from '../components/Toast';

type StatusFilter = 'all' | 'processing' | 'completed' | 'failed' | 'needs_review';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'processing', label: 'Processando' },
  { value: 'completed', label: 'Concluídos' },
  { value: 'needs_review', label: 'Revisar' },
  { value: 'failed', label: 'Falhou' },
];

const STEP_LABEL: Record<string, string> = {
  parse: 'Extraindo texto',
  classify: 'Classificando',
  synthesize: 'Sintetizando',
  compress: 'Comprimindo',
  nomenclature: 'Nomeando',
  upload_drive: 'Salvando no Drive',
  validate: 'Validando',
};

export default function DashboardPage() {
  const [view, setView] = useState<JobsView>('active');
  const { data: jobs, isLoading } = useJobs({ view });
  const realtimeConnected = useJobsRealtime();
  const [selected, setSelected] = useState<JobWithDoc | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [materiaFilter, setMateriaFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  const toast = useToast();
  const setArchived = useSetArchived();
  const deleteDoc = useDeleteDocument();

  // Mantém `selected` sincronizado com a versão fresca do job (realtime atualiza)
  const selectedLive = useMemo<JobWithDoc | null>(() => {
    if (!selected || !jobs) return selected;
    return jobs.find((j) => j.id === selected.id) ?? null;
  }, [selected, jobs]);

  // Se o doc selecionado sumiu da lista atual (foi arquivado/desarquivado/excluído),
  // fecha o drawer pra não mostrar dados stale.
  useEffect(() => {
    if (selected && jobs && !jobs.some((j) => j.id === selected.id)) {
      setSelected(null);
    }
  }, [jobs, selected]);

  // ESC fecha drawer + body scroll lock enquanto aberto
  useEffect(() => {
    if (!selectedLive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedLive]);

  // Lista de matérias presentes nos jobs (para o filtro)
  const materias = useMemo(() => {
    if (!jobs) return [];
    const set = new Set<string>();
    for (const j of jobs) {
      const m = j.documents?.materia_code;
      if (m) set.add(m);
    }
    return Array.from(set).sort();
  }, [jobs]);

  const filtered = useMemo<JobWithDoc[]>(() => {
    if (!jobs) return [];
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'completed') {
          if (j.status !== 'completed' && j.status !== 'completed_with_warning') return false;
        } else if (statusFilter === 'processing') {
          if (j.status !== 'processing' && j.status !== 'pending') return false;
        } else {
          if (j.status !== statusFilter) return false;
        }
      }
      if (materiaFilter !== 'all' && j.documents?.materia_code !== materiaFilter) return false;
      if (!q) return true;
      const name = (j.documents?.filename_final ?? j.documents?.filename_original ?? '').toLowerCase();
      const title = (j.documents?.titulo ?? '').toLowerCase();
      return name.includes(q) || title.includes(q);
    });
  }, [jobs, statusFilter, materiaFilter, query]);

  const handleArchive = async (job: JobWithDoc) => {
    try {
      await setArchived.mutateAsync({ documentId: job.document_id, archived: true });
      toast.success('Arquivado', 'O documento foi movido para Arquivados.', {
        action: { label: 'Desfazer', onClick: () => handleUnarchive(job) },
      });
    } catch (err) {
      toast.error('Não foi possível arquivar', (err as Error).message);
    }
  };

  const handleUnarchive = async (job: JobWithDoc) => {
    try {
      await setArchived.mutateAsync({ documentId: job.document_id, archived: false });
      toast.success('Desarquivado', 'O documento voltou pra lista ativa.');
    } catch (err) {
      toast.error('Não foi possível desarquivar', (err as Error).message);
    }
  };

  const handleDelete = async (job: JobWithDoc) => {
    try {
      await deleteDoc.mutateAsync({
        documentId: job.document_id,
        storagePath: job.documents.storage_path,
      });
      toast.success('Excluído', 'O documento e todos os dados associados foram removidos.');
    } catch (err) {
      toast.error('Não foi possível excluir', (err as Error).message);
    }
  };

  const emptyMessage = view === 'archived'
    ? 'Nenhum documento arquivado.'
    : 'Nenhum documento ainda. Faça upload acima para começar.';

  return (
    <div className="container dashboard">
      <header className="dashboard-header">
        <h1>Meus documentos</h1>
        <span className={`realtime-pill ${realtimeConnected ? 'on' : ''}`}>
          <span className="dot" />
          {realtimeConnected ? 'Conectado em tempo real' : 'Conectando…'}
        </span>
      </header>

      {view === 'active' && <MetricsCards />}

      {view === 'active' && <UploadDropzone />}

      <section className="jobs-section">
        <div className="jobs-section-header">
          <h2>
            {view === 'archived' ? 'Arquivados' : 'Jobs'}{' '}
            <span className="count">({filtered.length}{jobs && filtered.length !== jobs.length ? ` / ${jobs.length}` : ''})</span>
          </h2>
          <div className="view-toggle" role="tablist" aria-label="Visualização">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'active'}
              className={view === 'active' ? 'active' : ''}
              onClick={() => setView('active')}
            >
              Ativos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'archived'}
              className={view === 'archived' ? 'active' : ''}
              onClick={() => setView('archived')}
            >
              Arquivados
            </button>
          </div>
        </div>

        {jobs && jobs.length > 0 && (
          <div className="prompts-toolbar dashboard-toolbar">
            <input
              type="search"
              placeholder="Buscar por nome ou título…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar jobs"
            />
            <select
              value={materiaFilter}
              onChange={(e) => setMateriaFilter(e.target.value)}
              aria-label="Filtrar por matéria"
            >
              <option value="all">Todas as matérias</option>
              {materias.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="prompts-filter" role="tablist" aria-label="Filtrar por status">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === s.value}
                  className={statusFilter === s.value ? 'active' : ''}
                  onClick={() => setStatusFilter(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="full-page-loader" style={{ minHeight: '120px' }}>
            <span className="spinner" />
            <span>Carregando…</span>
          </div>
        )}
        {!isLoading && (!jobs || jobs.length === 0) && (
          <div className="empty">{emptyMessage}</div>
        )}
        {!isLoading && jobs && jobs.length > 0 && filtered.length === 0 && (
          <div className="empty">
            Nenhum job corresponde aos filtros aplicados.
          </div>
        )}
        <div className="jobs-grid">
          {filtered.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              archivedView={view === 'archived'}
              onSelect={() => setSelected(j)}
              onArchive={view === 'active' ? handleArchive : undefined}
              onUnarchive={view === 'archived' ? handleUnarchive : undefined}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </section>

      {view === 'active' && <ActivityFeed />}

      {selectedLive && (
        <>
          <div
            className="preview-pane-backdrop"
            role="presentation"
            onClick={() => setSelected(null)}
            aria-hidden="true"
          />
          <aside
            className="preview-pane"
            role="dialog"
            aria-modal="true"
            aria-label={`Preview de ${selectedLive.documents.filename_final ?? selectedLive.documents.filename_original}`}
          >
            <header className="preview-pane-header">
              <div className="preview-pane-title">
                <h2 title={selectedLive.documents.filename_final ?? selectedLive.documents.filename_original}>
                  {selectedLive.documents.filename_final ?? selectedLive.documents.filename_original}
                </h2>
                {selectedLive.documents.materia_code && (
                  <small>
                    {selectedLive.documents.materia_code}
                    {selectedLive.documents.titulo ? ` · ${selectedLive.documents.titulo}` : ''}
                  </small>
                )}
              </div>
              <div className="preview-pane-actions">
                {view === 'active' ? (
                  <button
                    type="button"
                    onClick={() => handleArchive(selectedLive)}
                    className="ghost"
                    title="Arquivar"
                    disabled={setArchived.isPending}
                  >
                    Arquivar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUnarchive(selectedLive)}
                    className="ghost"
                    title="Desarquivar"
                    disabled={setArchived.isPending}
                  >
                    Desarquivar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="ghost icon-only"
                  aria-label="Fechar preview (Esc)"
                  title="Fechar (Esc)"
                >
                  ✕
                </button>
              </div>
            </header>

            <div className="preview-pane-body">
              <PreviewBody job={selectedLive} />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

// =============================================================
// Corpo do drawer — alterna preview pronto / processando / falhou
// =============================================================
function PreviewBody({ job }: { job: JobWithDoc }) {
  if (job.status === 'completed' || job.status === 'completed_with_warning') {
    return <MarkdownPreview documentId={job.document_id} />;
  }

  if (job.status === 'failed') {
    return (
      <div className="preview-pane-status">
        <span className="badge tone-error" style={{ alignSelf: 'center' }}>Falhou</span>
        <p className="step">Não foi possível processar este documento.</p>
        {job.error_reason && (
          <p className="hint" style={{ maxWidth: 360 }}>
            <strong>Motivo:</strong> {job.error_reason}
          </p>
        )}
        <p className="hint" style={{ fontSize: '0.82rem' }}>
          Veja o feed <strong>Últimas operações</strong> abaixo para o histórico detalhado.
        </p>
      </div>
    );
  }

  if (job.status === 'needs_review') {
    return (
      <div className="preview-pane-status">
        <span className="badge tone-warn" style={{ alignSelf: 'center' }}>Precisa revisar</span>
        <p className="step">A classificação ficou abaixo do limite de confiança.</p>
        <p className="hint">Edite os dados do documento em Configurações ou refaça o upload com mais contexto.</p>
      </div>
    );
  }

  // pending | processing
  const stepLabel = job.current_step ? (STEP_LABEL[job.current_step] ?? job.current_step) : 'Aguardando início';
  const progress = Math.max(0, Math.min(100, job.progress_percent ?? 0));

  return (
    <div className="preview-pane-status">
      <span className="spinner" />
      <p className="step">{stepLabel}…</p>
      <div className="preview-pane-progress" aria-label="Progresso">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="hint" style={{ fontSize: '0.82rem' }}>
        {progress}% · atualizando em tempo real
      </p>
    </div>
  );
}
