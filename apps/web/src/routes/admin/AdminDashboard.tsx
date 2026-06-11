/**
 * Painel /admin/dashboard — visão consolidada do sistema.
 *
 * Estilo: vocabulário visual do app (.dashboard-header, .metric-card,
 * .atividade-table, .badge tone-*, .empty, .prompts-filter).
 *
 * Recursos: banner de alertas, seletor de período, tendência nos KPIs,
 * sparklines, funil, top users, distribuição por matéria, jobs recentes
 * com eventos expansíveis, refresh manual.
 */

import { useEffect, useState } from 'react';
import {
  useAdminMetricsOverview,
  useAdminRecentJobs,
  useAdminTimeseries,
  useAdminTopUsers,
  useAdminPipelineBreakdown,
  useAdminMateriaDistribution,
  useAdminAlerts,
  useAdminJobEvents,
  type AdminRecentJob,
} from '../../hooks/useAdminMetrics';
import { useQueryClient } from '@tanstack/react-query';
import { fmtNumber, fmtCost, fmtDate, fmtRelative } from '../../lib/format';
import Sparkline from './Sparkline';
import PipelineFunnel from './PipelineFunnel';
import AlertBanner from './AlertBanner';
import TrendBadge from './TrendBadge';

const PERIODS = [7, 14, 30, 90] as const;
type Period = (typeof PERIODS)[number];

const STATUS_TONE: Record<string, string> = {
  pending: 'info',
  processing: 'info',
  completed: 'success',
  completed_with_warning: 'warn',
  needs_review: 'warn',
  failed: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  processing: 'Processando',
  completed: 'Sucesso',
  completed_with_warning: 'Sucesso c/ aviso',
  needs_review: 'Revisar',
  failed: 'Falhou',
};

const EVENT_TONE: Record<string, string> = {
  start: 'info',
  success: 'success',
  warning: 'warn',
  error: 'error',
  retry: 'info',
};

export default function AdminDashboard() {
  const [period, setPeriod] = useState<Period>(30);
  const qc = useQueryClient();

  const { data: m, isLoading, error, isFetching, dataUpdatedAt } = useAdminMetricsOverview(period);
  const { data: alerts } = useAdminAlerts();
  const { data: jobs } = useAdminRecentJobs(15);
  const { data: timeseries } = useAdminTimeseries(period);
  const { data: topUsers } = useAdminTopUsers(8);
  const { data: pipeline } = useAdminPipelineBreakdown();
  const { data: materias } = useAdminMateriaDistribution();

  // Tick de 30s só pra re-renderizar o rótulo relativo "atualizado há X" —
  // sem ele o texto congela entre polls (achado WEB-ROUTES-02).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['admin'] });
  };

  if (isLoading) {
    return (
      <div className="full-page-loader" style={{ minHeight: '40vh' }}>
        <span className="spinner" />
        <span>Carregando métricas…</span>
      </div>
    );
  }

  if (error || !m) {
    return (
      <div className="empty">
        Não foi possível carregar as métricas.
        {error instanceof Error && <p className="hint" style={{ marginTop: '0.5rem' }}>{error.message}</p>}
      </div>
    );
  }

  const docsSeries        = (timeseries ?? []).map((p) => p.docs);
  const jobsSuccessSeries = (timeseries ?? []).map((p) => p.jobs_success);
  const jobsFailedSeries  = (timeseries ?? []).map((p) => p.jobs_failed);
  const costSeries        = (timeseries ?? []).map((p) => p.cost_usd);
  const maxMatCount       = materias?.[0]?.doc_count ?? 1;

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Visão geral</h1>
          <p className="hint">Métricas consolidadas do sistema.</p>
        </div>
        <div className="admin-header-actions">
          {/* dataUpdatedAt reflete o último fetch real (manual OU refetchInterval) */}
          {dataUpdatedAt > 0 && (
            <span className="admin-refreshed">
              atualizado {fmtRelative(new Date(dataUpdatedAt).toISOString())}
            </span>
          )}
          <button type="button" className="ghost" onClick={handleRefresh} disabled={isFetching} aria-label="Atualizar agora">
            {isFetching ? 'Atualizando…' : '↻ Atualizar'}
          </button>
        </div>
      </header>

      {/* Banner de alertas -------------------------------------------------- */}
      {alerts && <AlertBanner alerts={alerts} recentJobs={jobs} />}

      {/* Seletor de período ------------------------------------------------- */}
      <div className="admin-period">
        <span className="admin-period-label">Período</span>
        {/* Botões toggle simples — role=tablist sem o padrão completo de tabs
            engana leitores de tela (achado WEB-ROUTES-09). */}
        <div className="prompts-filter" role="group" aria-label="Selecionar período">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              className={period === p ? 'active' : ''}
              onClick={() => setPeriod(p)}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs principais com tendência -------------------------------------- */}
      <section className="metrics-cards" aria-label="KPIs principais">
        <div className="metric-card">
          <span className="metric-label">Usuários</span>
          <strong className="metric-value">{fmtNumber(m.users.total)}</strong>
          <span className="metric-foot">
            +{m.users.period} no período <TrendBadge current={m.users.period} previous={m.users.period_prev} />
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Documentos</span>
          <strong className="metric-value">{fmtNumber(m.documents.total)}</strong>
          <span className="metric-foot">
            +{m.documents.period} no período <TrendBadge current={m.documents.period} previous={m.documents.period_prev} />
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Jobs</span>
          <strong className="metric-value">{fmtNumber(m.jobs.total)}</strong>
          <span className="metric-foot">
            {m.jobs.success} ok · {m.jobs.failed} falhas <TrendBadge current={m.jobs.period} previous={m.jobs.period_prev} />
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Custo acumulado</span>
          <strong className="metric-value">{fmtCost(m.cost_usd.total)}</strong>
          <span className="metric-foot">
            {fmtCost(m.cost_usd.period)} no período <TrendBadge current={m.cost_usd.period} previous={m.cost_usd.period_prev} invertColor />
          </span>
        </div>
      </section>

      {/* Pipeline + sparklines --------------------------------------------- */}
      <section className="admin-grid-2">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Pipeline</h2>
          {pipeline ? <PipelineFunnel data={pipeline} /> : <p className="hint">Sem dados.</p>}
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Tendência ({period} dias)</h2>
          <div className="sparklines-row">
            <Sparkline label="Documentos" values={docsSeries}        color="var(--info)" />
            <Sparkline label="Sucessos"   values={jobsSuccessSeries} color="var(--success)" />
            <Sparkline label="Falhas"     values={jobsFailedSeries}  color="var(--error)" />
            <Sparkline label="Custo"      values={costSeries}        color="var(--primary)" formatValue={fmtCost} />
          </div>
        </div>
      </section>

      {/* Top users + matérias --------------------------------------------- */}
      <section className="admin-grid-2">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Top usuários</h2>
          {!topUsers?.length ? (
            <div className="empty">Nenhum usuário com atividade ainda.</div>
          ) : (
            <div className="atividade-table-wrapper">
              <table className="atividade-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Docs</th>
                    <th>Jobs</th>
                    <th>Custo</th>
                    <th>Atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="cell-stack">
                          <strong>{u.full_name ?? u.email.split('@')[0]}</strong>
                          <small className="cell-curso">{u.email}{u.curso ? ` · ${u.curso}` : ''}</small>
                        </div>
                      </td>
                      <td className="cell-mono">{u.doc_count}</td>
                      <td className="cell-mono">{u.job_count}</td>
                      <td className="cell-mono">{fmtCost(Number(u.cost_usd))}</td>
                      <td className="cell-mono" title={fmtDate(u.last_activity)}>{fmtRelative(u.last_activity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Distribuição por matéria</h2>
          {!materias?.length ? (
            <div className="empty">Nenhum documento classificado ainda.</div>
          ) : (
            <ul className="metric-bars">
              {materias.map((row) => {
                const pct = Math.round((row.doc_count / maxMatCount) * 100);
                return (
                  <li key={row.materia_code}>
                    <span className="metric-bar-label">{row.materia_code}</span>
                    <span className="metric-bar-track">
                      <span className="metric-bar-fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="metric-bar-count">
                      {row.doc_count}
                      <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {row.user_count} {row.user_count === 1 ? 'aluno' : 'alunos'}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Jobs recentes ----------------------------------------------------- */}
      <section className="card">
        <h2 style={{ marginBottom: '1rem' }}>Jobs recentes</h2>
        {!jobs?.length ? (
          <div className="empty">Nenhum job ainda.</div>
        ) : (
          <div className="atividade-table-wrapper">
            <table className="atividade-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Usuário</th>
                  <th>Documento</th>
                  <th>Status</th>
                  <th>Custo</th>
                  <th>Tent.</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => <JobRow key={j.id} job={j} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// =============================================================
// Linha de job com eventos expansíveis
// =============================================================
function JobRow({ job }: { job: AdminRecentJob }) {
  const [open, setOpen] = useState(false);
  const tone = STATUS_TONE[job.status] ?? 'info';

  return (
    <>
      <tr className={job.status === 'failed' ? 'row-failed' : ''}>
        <td className="cell-mono" title={fmtDate(job.created_at)}>{fmtRelative(job.created_at)}</td>
        <td className="cell-mono cell-truncate" title={job.user_email}>{job.user_email}</td>
        <td title={job.document_title}>
          <span className="cell-filename">{job.document_title}</span>
          <small className="cell-materia">{job.document_format}</small>
        </td>
        <td>
          <span className={`badge tone-${tone}`}>{STATUS_LABEL[job.status] ?? job.status}</span>
          {job.error_reason && (
            <small className="error-text" style={{ display: 'block', marginTop: '0.2rem' }}>{job.error_reason}</small>
          )}
        </td>
        <td className="cell-mono">{fmtCost(Number(job.cost_usd_total ?? 0))}</td>
        <td className="cell-mono">{job.attempt_count}</td>
        <td>
          <button type="button" className="link" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'ocultar' : 'ver eventos'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="job-events-row">
          <td colSpan={7}>
            <JobEvents jobId={job.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function JobEvents({ jobId }: { jobId: string }) {
  const { data: events, isLoading } = useAdminJobEvents(jobId);

  if (isLoading) {
    return <div className="job-events-loading"><span className="spinner" /> Carregando eventos…</div>;
  }
  if (!events?.length) {
    return <p className="hint" style={{ margin: '0.5rem 0' }}>Nenhum evento registrado pra este job.</p>;
  }

  return (
    <ol className="job-events-timeline">
      {events.map((e) => {
        const tone = EVENT_TONE[e.event_type] ?? 'info';
        return (
          <li key={e.id}>
            <span className={`badge tone-${tone}`}>{e.event_type}</span>
            <span className="job-events-step">{e.step}</span>
            {e.llm_model && <span className="job-events-model cell-mono">{e.llm_model}</span>}
            {e.duration_ms != null && <span className="job-events-meta">{(e.duration_ms / 1000).toFixed(1)}s</span>}
            {e.cost_usd != null && e.cost_usd > 0 && <span className="job-events-meta">US$ {Number(e.cost_usd).toFixed(4)}</span>}
            {e.message && <span className="job-events-msg" title={e.message}>{e.message}</span>}
            <time className="job-events-time" dateTime={e.created_at}>
              {new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
