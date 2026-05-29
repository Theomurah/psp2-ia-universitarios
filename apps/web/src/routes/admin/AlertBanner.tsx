/**
 * Banner de incidentes que exigem ação do admin.
 * Aparece só quando há falhas recentes ou jobs presos. Sugere causa/ação
 * pros motivos conhecidos (ex: OPENROUTER_API_KEY ausente).
 */

import type { AdminAlerts } from '../../hooks/useAdminMetrics';

interface Props {
  alerts: AdminAlerts;
}

/** Mapeia um motivo de erro pra uma sugestão de ação acionável. */
function suggestionFor(reason: string): string | null {
  const r = reason.toLowerCase();
  if (r.includes('openrouter_api_key') || r.includes('api key')) {
    return 'Configure o secret nas Edge Functions: supabase secrets set OPENROUTER_API_KEY=...';
  }
  if (r.includes('rate') && r.includes('limit')) {
    return 'Provedor limitou requisições — verifique a cota OpenRouter ou troque o modelo em Modelos.';
  }
  if (r.includes('timeout')) {
    return 'Documento grande ou provedor lento — considere um modelo mais rápido.';
  }
  return null;
}

function fmtRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'há instantes';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} dias`;
}

export default function AlertBanner({ alerts }: Props) {
  const hasErrors = alerts.top_errors.length > 0;
  const hasStuck = alerts.stuck > 0;

  if (!hasErrors && !hasStuck) {
    return (
      <div className="admin-alert admin-alert-ok" role="status">
        <span className="admin-alert-icon" aria-hidden>✓</span>
        <div>
          <strong>Tudo certo</strong>
          <p>Nenhuma falha nos últimos 30 dias e nenhum job preso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-alert admin-alert-error" role="alert">
      <span className="admin-alert-icon" aria-hidden>⚠</span>
      <div className="admin-alert-body">
        <strong>
          {alerts.failed_30d} {alerts.failed_30d === 1 ? 'falha' : 'falhas'} nos últimos 30 dias
          {hasStuck && ` · ${alerts.stuck} ${alerts.stuck === 1 ? 'job preso' : 'jobs presos'}`}
        </strong>

        <ul className="admin-alert-list">
          {alerts.top_errors.map((err) => {
            const suggestion = suggestionFor(err.reason);
            return (
              <li key={err.reason}>
                <div className="admin-alert-reason">
                  <span className="badge tone-error">{err.count}×</span>
                  <span>{err.reason}</span>
                  <small className="hint">{fmtRelative(err.last_seen)}</small>
                </div>
                {suggestion && <p className="admin-alert-fix">→ {suggestion}</p>}
              </li>
            );
          })}
        </ul>

        {hasStuck && (
          <p className="admin-alert-fix">
            → {alerts.stuck} {alerts.stuck === 1 ? 'job está' : 'jobs estão'} em <code>processing</code> há mais de 10 min.
            O watchdog (pg_cron) ainda não está ativo — reprocessar manualmente ou aguardar.
          </p>
        )}
      </div>
    </div>
  );
}
