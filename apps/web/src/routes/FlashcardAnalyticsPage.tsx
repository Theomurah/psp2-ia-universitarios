/**
 * Página /flashcards/analytics — análises (Fase 5, frente 1.3).
 *
 * A partir do log `flashcard_reviews`: distribuição das notas, acerto por tópico
 * (barras) e os cartões com pior aproveitamento (tabela), pra orientar o estudo.
 * Reusa o design system (.metric-card, .metric-bars, .atividade-table).
 */

import { Link } from 'react-router-dom';
import { RATING_ORDER, RATING_LABELS } from '@psp2/shared';
import { useFlashcardAnalytics } from '../hooks/useFlashcards';

/** Tom do badge conforme o aproveitamento. */
function accuracyTone(pct: number): string {
  if (pct >= 80) return 'tone-success';
  if (pct >= 50) return 'tone-warn';
  return 'tone-error';
}

/** Frente do cartão em texto plano (sem markdown/LaTeX) pro rótulo da tabela. */
function plainFront(front: string): string {
  return front
    .replace(/\$\$?([^$]*)\$\$?/g, '$1')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function FlashcardAnalyticsPage() {
  const { data, isLoading, error } = useFlashcardAnalytics();

  return (
    <div className="container">
      <header className="dashboard-header">
        <div>
          <h1>Análises</h1>
          <p className="hint">Seu desempenho por tópico e por cartão, a partir das revisões.</p>
        </div>
        <Link to="/flashcards" className="ghost" style={{ textDecoration: 'none' }}>
          Voltar
        </Link>
      </header>

      {isLoading && (
        <div className="full-page-loader" style={{ minHeight: '40vh' }}>
          <span className="spinner" />
          <span>Calculando…</span>
        </div>
      )}

      {error && <div className="empty">Não foi possível carregar as análises. {(error as Error).message}</div>}

      {!isLoading && !error && data && data.totalReviews === 0 && (
        <div className="empty">
          Ainda não há revisões. Estude alguns cartões e volte aqui pra ver suas análises.
        </div>
      )}

      {!isLoading && !error && data && data.totalReviews > 0 && (
        <>
          <div className="metrics-cards">
            <div className="metric-card">
              <span className="metric-label">Revisões</span>
              <span className="metric-value">{data.totalReviews}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Aproveitamento</span>
              <span className="metric-value">{data.accuracy}%</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Cartões estudados</span>
              <span className="metric-value">{data.cardsStudied}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Tópicos</span>
              <span className="metric-value">{data.topicsCount}</span>
            </div>
          </div>

          <section className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Distribuição das notas</h2>
            <ul className="metric-bars">
              {RATING_ORDER.map((r) => {
                const count = data.ratingCounts[r] ?? 0;
                const pct = data.totalReviews ? Math.round((count / data.totalReviews) * 100) : 0;
                return (
                  <li key={r}>
                    <span className="metric-bar-label">{RATING_LABELS[r]}</span>
                    <span className="metric-bar-track">
                      <span className="metric-bar-fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="metric-bar-count">{count}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Acerto por tópico</h2>
            <ul className="metric-bars">
              {data.byTopic.map((t) => (
                <li key={t.topico}>
                  <span className="metric-bar-label" title={t.topico}>{t.topico}</span>
                  <span className="metric-bar-track">
                    <span className="metric-bar-fill" style={{ width: `${t.accuracy}%` }} />
                  </span>
                  <span className="metric-bar-count">{t.accuracy}%</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1rem' }}>Cartões para focar</h2>
            <p className="hint" style={{ marginTop: 0 }}>Ordenados do menor aproveitamento pro maior.</p>
            <div className="atividade-table-wrapper">
              <table className="atividade-table">
                <thead>
                  <tr>
                    <th>Cartão (frente)</th>
                    <th>Revisões</th>
                    <th>Acertos</th>
                    <th>Aproveitamento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCard.map((c) => {
                    const label = plainFront(c.front);
                    return (
                      <tr key={c.cardId}>
                        <td className="cell-truncate" title={label}>{label || '—'}</td>
                        <td className="cell-mono">{c.total}</td>
                        <td className="cell-mono">{c.correct}</td>
                        <td>
                          <span className={`badge ${accuracyTone(c.accuracy)}`}>{c.accuracy}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
