/**
 * Cards de métricas pessoais no topo do Dashboard.
 * Total de jobs, concluídos, falhas, caracteres processados, custo agregado,
 * + distribuição por matéria (mini-barras).
 *
 * [extra] Não estava no backlog. Útil pro aluno ver o próprio uso.
 */

import { useUserMetrics } from '../hooks/useActivity';

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function fmtCost(usd: number): string {
  if (usd === 0) return 'US$ 0';
  if (usd < 0.01) return `< US$ 0,01`;
  return `US$ ${usd.toFixed(2)}`;
}

export default function MetricsCards() {
  const { data: m, isLoading } = useUserMetrics();

  if (isLoading || !m || m.totalJobs === 0) {
    return null; // Não polui a tela de quem ainda não enviou nada
  }

  const successRate = m.totalJobs > 0 ? Math.round((m.completedJobs / m.totalJobs) * 100) : 0;
  const maxMateriaCount = m.byMateria[0]?.count ?? 1;

  return (
    <section className="metrics-cards" aria-label="Suas métricas">
      <div className="metric-card">
        <span className="metric-label">Documentos processados</span>
        <strong className="metric-value">{m.completedJobs}</strong>
        <span className="metric-foot">de {m.totalJobs} ({successRate}%)</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Caracteres analisados</span>
        <strong className="metric-value">{fmtNumber(m.totalCharsInput)}</strong>
        <span className="metric-foot">total de entrada nos jobs</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Custo acumulado</span>
        <strong className="metric-value">{fmtCost(m.totalCostUsd)}</strong>
        <span className="metric-foot">soma LLM (todos os jobs)</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Falhas</span>
        <strong className="metric-value">{m.failedJobs}</strong>
        <span className="metric-foot">{m.failedJobs > 0 ? 'veja o feed abaixo' : 'tudo certo ✓'}</span>
      </div>

      {m.byMateria.length > 0 && (
        <div className="metric-card metric-card-wide">
          <span className="metric-label">Distribuição por matéria</span>
          <ul className="metric-bars">
            {m.byMateria.map((row) => {
              const pct = Math.round((row.count / maxMateriaCount) * 100);
              return (
                <li key={row.materia}>
                  <span className="metric-bar-label">{row.materia}</span>
                  <span className="metric-bar-track">
                    <span className="metric-bar-fill" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="metric-bar-count">{row.count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
