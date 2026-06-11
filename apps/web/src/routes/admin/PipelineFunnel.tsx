/**
 * Funil simplificado: upload → processed → success / failed.
 * Usa as cores dos tokens UnB: success, warn, error, primary.
 */

import type { PipelineBreakdown } from '../../hooks/useAdminMetrics';

interface Props {
  data: PipelineBreakdown;
}

interface Row {
  label: string;
  value: number;
  color: string;
}

export default function PipelineFunnel({ data }: Props) {
  const rows: Row[] = [
    { label: 'Docs enviados',     value: data.docs_uploaded,                              color: 'var(--text-muted)' },
    { label: 'Docs processados',  value: data.docs_processed,                             color: 'var(--info)'       },
    { label: 'Jobs em andamento', value: data.jobs_pending + data.jobs_processing,        color: 'var(--warn)'       },
    { label: 'Jobs com sucesso',  value: data.jobs_success,                               color: 'var(--success)'    },
    { label: 'Jobs com falha',    value: data.jobs_failed,                                color: 'var(--error)'      },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="funnel">
      <div className="funnel-rows">
        {rows.map((r) => {
          const pct = max === 0 ? 0 : Math.max(2, (r.value / max) * 100);
          return (
            <div key={r.label} className="funnel-row">
              <span className="funnel-row-label">{r.label}</span>
              <span className="funnel-row-track">
                <span className="funnel-row-fill" style={{ width: `${pct}%`, background: r.color }} />
              </span>
              <span className="funnel-row-value">{r.value}</span>
            </div>
          );
        })}
      </div>
      <div className="funnel-stats">
        <div>
          <span className="funnel-stats-label">Taxa de sucesso</span>
          <strong>{successRate(data)}%</strong>
        </div>
        <div>
          <span className="funnel-stats-label">Retentativas</span>
          <strong>{data.jobs_retried}</strong>
        </div>
        <div>
          <span className="funnel-stats-label">Duração média</span>
          <strong>{fmtSeconds(data.avg_duration_seconds)}</strong>
        </div>
      </div>
    </div>
  );
}

function successRate(d: PipelineBreakdown): number {
  const total = d.jobs_success + d.jobs_failed;
  if (total === 0) return 0;
  return Math.round((d.jobs_success / total) * 100);
}

function fmtSeconds(s: number): string {
  if (!s || !isFinite(s)) return '—';
  if (s < 1) return '<1s';
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s - m * 60);
  return `${m}m ${rest}s`;
}
