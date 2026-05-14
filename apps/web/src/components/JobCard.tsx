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
}

export default function JobCard({ job, onSelect }: Props) {
  const status = STATUS_LABEL[job.status] ?? { text: job.status, tone: 'info' as const };
  const stepText = job.current_step ? STEP_LABEL[job.current_step] : null;

  return (
    <article className={`job-card tone-${status.tone}`} onClick={onSelect}>
      <header>
        <strong>{job.documents.filename_original}</strong>
        <span className={`badge tone-${status.tone}`}>{status.text}</span>
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
