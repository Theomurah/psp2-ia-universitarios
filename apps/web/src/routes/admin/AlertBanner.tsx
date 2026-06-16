/**
 * Banner de incidentes que exigem ação do admin.
 * Aparece só quando há falhas recentes ou jobs presos. Sugere causa/ação
 * pros motivos conhecidos (ex: OPENROUTER_API_KEY ausente).
 *
 * [auditoria 2026-06-10, WEB-ROUTES-05] Ação de requeue: jobs presos
 * (`processing` há >10min desde started_at, ou `pending` há >10min — disparo
 * perdido) podem ser reenfileirados via RPC admin_requeue_job (migration
 * 0025). A RPC só devolve o job pra 'pending'; como NADA consome 'pending'
 * automaticamente (sem watchdog; process-document só é invocado pelo
 * ingest-document), o handleRequeue dispara o pipeline na sequência via
 * functions.invoke('process-document') — autorizado pelo JWT de admin.
 * Os jobs presos são identificados na lista de jobs recentes que o
 * AdminDashboard já busca (admin_recent_jobs).
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { createLogger } from '../../lib/log';
import { useToast } from '../../components/Toast';
import { fmtRelative } from '../../lib/format';
import type { AdminAlerts, AdminRecentJob } from '../../hooks/useAdminMetrics';

// 'admin_ui' (não 'admin'): scope 'admin' é reservado pra auditoria server-side
// (migration 0024) — a RLS rejeitaria a persistência client-side em silêncio.
const log = createLogger('admin_ui');

interface Props {
  alerts: AdminAlerts;
  /** Jobs recentes (admin_recent_jobs) — usados pra localizar os presos. */
  recentJobs?: AdminRecentJob[];
}

/** Mesmo limiar do admin_alerts() (migrations 0015/0029): >10 min. */
const STUCK_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * Base do tempo "preso" — paridade com o admin_alerts():
 *   processing → coalesce(started_at, created_at) — usar created_at marcava
 *     como preso um job que esperou na fila e acabou de ser claimado, e o
 *     requeue de job ainda ativo duplicaria o pipeline (custo LLM dobrado);
 *   pending    → created_at (nunca foi claimado; idade da fila é o que conta).
 * O `?? created_at` também cobre RPC antigo sem a coluna (pré-0029).
 */
function stuckSince(job: AdminRecentJob): string {
  return job.status === 'processing' ? job.started_at ?? job.created_at : job.created_at;
}

function isStuck(job: AdminRecentJob): boolean {
  if (job.status !== 'processing' && job.status !== 'pending') return false;
  return Date.now() - new Date(stuckSince(job)).getTime() > STUCK_THRESHOLD_MS;
}

/** PostgREST devolve PGRST202 quando a função não existe no schema cache. */
function isMissingRpc(code: string | null, message: string): boolean {
  return code === 'PGRST202' || /could not find the function/i.test(message);
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

export default function AlertBanner({ alerts, recentJobs }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [requeueingId, setRequeueingId] = useState<string | null>(null);

  const hasErrors = alerts.top_errors.length > 0;
  const hasStuck = alerts.stuck > 0;
  const stuckJobs = (recentJobs ?? []).filter(isStuck);

  const handleRequeue = async (jobId: string) => {
    setRequeueingId(jobId);
    try {
      const { error } = await supabase.rpc('admin_requeue_job', { p_job_id: jobId });
      if (error) {
        if (isMissingRpc(error.code, error.message)) {
          toast.warning(
            'Requeue ainda indisponível',
            'A migration que cria admin_requeue_job ainda não foi aplicada no banco.',
          );
        } else {
          toast.error('Não foi possível reenfileirar', error.message);
        }
        log.warn('admin_requeue_failed', { job_id: jobId, code: error.code });
        return;
      }
      // A RPC só devolve o job pra 'pending' — nenhum worker consome 'pending'
      // sozinho (watchdog pg_cron é Sprint 2; process-document só é invocado
      // pelo ingest-document). O disparo do pipeline é responsabilidade daqui:
      // authorizeProcessDocument aceita JWT de admin desde a auditoria 2026-06-10.
      const { error: dispatchErr } = await supabase.functions.invoke('process-document', {
        body: { job_id: jobId },
      });
      if (dispatchErr) {
        log.warn('admin_requeue_dispatch_failed', { job_id: jobId });
        toast.warning(
          'Job na fila, mas o disparo falhou',
          'O job voltou pra "pending", porém o reprocessamento não foi disparado. Ele segue listado como preso — tente de novo em instantes.',
        );
      } else {
        log.info('admin_requeue_succeeded', { job_id: jobId });
        toast.success('Job reenfileirado', 'Reprocessamento disparado — acompanhe o status na tabela.');
      }
      qc.invalidateQueries({ queryKey: ['admin'] });
    } finally {
      setRequeueingId(null);
    }
  };

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
          <>
            <p className="admin-alert-fix">
              → {alerts.stuck} {alerts.stuck === 1 ? 'job está preso' : 'jobs estão presos'} (<code>processing</code> ou <code>pending</code>) há mais de 10 min.
              O watchdog (pg_cron) ainda não está ativo — use Reprocessar abaixo pra reenfileirar e disparar o pipeline.
            </p>
            {stuckJobs.length > 0 ? (
              <ul className="admin-alert-list">
                {stuckJobs.map((j) => (
                  <li key={j.id}>
                    <div className="admin-alert-reason">
                      <span className="badge tone-warn">preso</span>
                      <span className="cell-truncate" title={j.document_title}>{j.document_title}</span>
                      <small className="hint">{fmtRelative(stuckSince(j))}</small>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleRequeue(j.id)}
                        disabled={requeueingId !== null}
                      >
                        {requeueingId === j.id ? 'Reenfileirando…' : 'Reprocessar'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">
                Os jobs presos não aparecem entre os jobs recentes carregados — atualize o painel
                pra localizá-los.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
