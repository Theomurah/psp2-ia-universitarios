/**
 * Painel /admin/feedback — agregado das avaliações dos alunos (H10).
 *
 * Dados via RPC admin_feedback_overview (SECURITY DEFINER, só admin).
 * Estilo: vocabulário visual do app (.dashboard-header, .metric-card,
 * .metric-bars, .atividade-table, .badge tone-*, .empty).
 */

import { FEEDBACK_TOPIC_LABELS } from '@psp2/shared';
import { useAdminFeedbackOverview } from '../../hooks/useFeedback';
import { useAdminPrefs } from '../../hooks/useAdminPrefs';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function ratingTone(r: number): 'success' | 'warn' | 'error' {
  if (r >= 4) return 'success';
  if (r === 3) return 'warn';
  return 'error';
}

export default function AdminFeedback() {
  const { includeTest } = useAdminPrefs();
  const { data, isLoading, error } = useAdminFeedbackOverview(includeTest);

  if (isLoading) {
    return (
      <div className="full-page-loader" style={{ minHeight: '30vh' }}>
        <span className="spinner" />
        <span>Carregando feedback…</span>
      </div>
    );
  }

  if (error) {
    return <div className="empty">{(error as Error).message}</div>;
  }

  if (!data || data.total === 0) {
    return (
      <>
        <header className="dashboard-header">
          <div>
            <h1>Feedback</h1>
            <p className="hint">Avaliações que os alunos deixam nas sínteses.</p>
          </div>
        </header>
        <div className="empty">Nenhum feedback recebido ainda.</div>
      </>
    );
  }

  const ratings = [5, 4, 3, 2, 1];
  const maxRatingCount = Math.max(1, ...ratings.map((r) => data.by_rating[String(r)] ?? 0));
  const positives = (data.by_rating['4'] ?? 0) + (data.by_rating['5'] ?? 0);
  const positivePct = data.total > 0 ? Math.round((positives / data.total) * 100) : 0;
  const maxTopicCount = Math.max(1, ...data.by_topic.map((t) => t.count));

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Feedback</h1>
          <p className="hint">
            Avaliações que os alunos deixam nas sínteses. Insumo direto para ajustar prompts e modelos.
          </p>
        </div>
      </header>

      <section className="metrics-cards" aria-label="Resumo do feedback">
        <div className="metric-card">
          <span className="metric-label">Avaliações</span>
          <strong className="metric-value">{data.total}</strong>
          <span className="metric-foot">total recebido</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Nota média</span>
          <strong className="metric-value">{Number(data.avg_rating).toFixed(1)}<small style={{ fontWeight: 400, color: 'var(--text-muted)' }}> /5</small></strong>
          <span className="metric-foot">de 1 a 5</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Positivas</span>
          <strong className="metric-value">{positivePct}%</strong>
          <span className="metric-foot">notas 4 e 5</span>
        </div>
      </section>

      <section className="admin-grid-2">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Distribuição por nota</h2>
          <ul className="metric-bars">
            {ratings.map((r) => {
              const count = data.by_rating[String(r)] ?? 0;
              const pct = Math.round((count / maxRatingCount) * 100);
              return (
                <li key={r}>
                  <span className="metric-bar-label">{r} ★</span>
                  <span className="metric-bar-track">
                    <span className="metric-bar-fill" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="metric-bar-count">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Por tópico</h2>
          {data.by_topic.length === 0 ? (
            <div className="empty">Sem dados.</div>
          ) : (
            <ul className="metric-bars">
              {data.by_topic.map((t) => {
                const pct = Math.round((t.count / maxTopicCount) * 100);
                return (
                  <li key={t.topic}>
                    <span className="metric-bar-label">{FEEDBACK_TOPIC_LABELS[t.topic] ?? t.topic}</span>
                    <span className="metric-bar-track">
                      <span className="metric-bar-fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="metric-bar-count">{t.count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginBottom: '1rem' }}>Comentários recentes</h2>
        {data.recent.length === 0 ? (
          <div className="empty">Nenhuma avaliação recente.</div>
        ) : (
          <div className="atividade-table-wrapper">
            <table className="atividade-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Nota</th>
                  <th>Tópico</th>
                  <th>Documento</th>
                  <th>Comentário</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((f) => (
                  <tr key={f.id}>
                    <td className="cell-mono" title={fmtDate(f.created_at)}>{fmtDate(f.created_at)}</td>
                    <td>
                      <span className={`badge tone-${ratingTone(f.rating)}`}>{f.rating}/5</span>
                    </td>
                    <td>{FEEDBACK_TOPIC_LABELS[f.topic] ?? f.topic}</td>
                    <td className="cell-truncate" title={f.document_title ?? 'Feedback geral'}>
                      {f.document_title ?? <span className="hint">Feedback geral</span>}
                    </td>
                    <td className="cell-message">{f.comments ?? <span className="hint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
