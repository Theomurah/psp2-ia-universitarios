/**
 * T19 — Dashboard com status de processamento.
 *
 * Lista todos os jobs do usuário (escuta via Realtime),
 * permite selecionar um pra ver o preview (T20),
 * e oferece o componente de upload (T18) no topo.
 */

import { useState } from 'react';
import UploadDropzone from '../components/UploadDropzone';
import JobCard from '../components/JobCard';
import MarkdownPreview from '../components/MarkdownPreview';
import { useJobs, useJobsRealtime, type JobWithDoc } from '../hooks/useJobs';

export default function DashboardPage() {
  const { data: jobs, isLoading } = useJobs();
  const realtimeConnected = useJobsRealtime();
  const [selected, setSelected] = useState<JobWithDoc | null>(null);

  return (
    <div className="container dashboard">
      <header className="dashboard-header">
        <h1>Meus documentos</h1>
        <small className={realtimeConnected ? 'rt-on' : 'rt-off'}>
          {realtimeConnected ? '● Realtime conectado' : '○ Conectando…'}
        </small>
      </header>

      <UploadDropzone />

      <section className="jobs-section">
        <h2>Jobs ({jobs?.length ?? 0})</h2>
        {isLoading && <p>Carregando…</p>}
        {!isLoading && (!jobs || jobs.length === 0) && (
          <p className="empty">Nenhum documento ainda. Faz upload acima pra começar.</p>
        )}
        <div className="jobs-grid">
          {jobs?.map((j) => (
            <JobCard key={j.id} job={j} onSelect={() => setSelected(j)} />
          ))}
        </div>
      </section>

      {selected && (
        <aside className="preview-pane">
          <header>
            <h2>{selected.documents.filename_final ?? selected.documents.filename_original}</h2>
            <button onClick={() => setSelected(null)}>Fechar</button>
          </header>
          {selected.status === 'completed' || selected.status === 'completed_with_warning' ? (
            <MarkdownPreview documentId={selected.document_id} />
          ) : (
            <p>Processamento ainda não concluído — aguardando…</p>
          )}
        </aside>
      )}
    </div>
  );
}
