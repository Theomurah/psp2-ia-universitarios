/**
 * Feed de "Últimas operações" — lista os job_events do usuário com filtros,
 * busca textual e tabela paginada. Renderizado ao fim do Dashboard.
 *
 * Histórico: até 2026-05-29 vivia numa rota dedicada (/atividade);
 * agora é embutido no Dashboard pra concentrar tudo numa tela só.
 */

import { useMemo, useState } from 'react';
import { useActivity, type ActivityRow } from '../hooks/useActivity';

type EventType = 'start' | 'success' | 'retry' | 'warning' | 'error';

const ALL_EVENT_TYPES: { value: EventType; label: string; tone: string }[] = [
  { value: 'start', label: 'Início', tone: 'info' },
  { value: 'success', label: 'Sucesso', tone: 'success' },
  { value: 'warning', label: 'Aviso', tone: 'warn' },
  { value: 'error', label: 'Erro', tone: 'error' },
  { value: 'retry', label: 'Retry', tone: 'info' },
];

const STEPS = [
  '(todos)', 'parse', 'classify', 'synthesize', 'compress',
  'nomenclature', 'upload_drive', 'validate',
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date} ${time}`;
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatCost(usd: number | null): string {
  if (!usd || usd <= 0) return '—';
  return `US$ ${usd.toFixed(4)}`;
}

function describeStep(step: string): string {
  if (step.startsWith('synthesize.chunk_')) return step.replace(/^synthesize\./, '');
  return step;
}

export interface ActivityFeedProps {
  /** Quantas linhas pedir do banco (default 500). */
  limit?: number;
  /** Mostrar o título "Últimas operações" + descrição. Default true. */
  showHeader?: boolean;
}

export default function ActivityFeed({ limit = 500, showHeader = true }: ActivityFeedProps) {
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>([]);
  const [selectedStep, setSelectedStep] = useState<string>('(todos)');
  const [query, setQuery] = useState('');

  const { data: rows, isLoading, error } = useActivity({
    eventTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    step: selectedStep === '(todos)' ? undefined : selectedStep,
    limit,
  });

  const filtered = useMemo<ActivityRow[]>(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const filename = r.jobs?.documents?.filename_final ?? r.jobs?.documents?.filename_original ?? '';
      return (
        (r.message ?? '').toLowerCase().includes(q) ||
        filename.toLowerCase().includes(q) ||
        (r.llm_model ?? '').toLowerCase().includes(q) ||
        (r.jobs?.documents?.materia_code ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  const toggleType = (t: EventType) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((p) => p !== t) : [...prev, t],
    );
  };

  return (
    <section className="atividade">
      {showHeader && (
        <header className="dashboard-header">
          <div>
            <h1>Últimas operações</h1>
            <p className="hint">
              Histórico de eventos dos seus jobs de processamento — parse, classificação,
              síntese, upload no Drive e mais. Cada linha corresponde a uma etapa registrada.
            </p>
          </div>
        </header>
      )}

      <div className="prompts-toolbar atividade-toolbar">
        <input
          type="search"
          placeholder="Buscar por documento, matéria, modelo, mensagem…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar atividade"
        />
        <select
          value={selectedStep}
          onChange={(e) => setSelectedStep(e.target.value)}
          aria-label="Filtrar por etapa"
        >
          {STEPS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="prompts-filter" role="group" aria-label="Filtrar por tipo">
          {ALL_EVENT_TYPES.map((et) => (
            <button
              key={et.value}
              type="button"
              aria-pressed={selectedTypes.includes(et.value)}
              className={selectedTypes.includes(et.value) ? 'active' : ''}
              onClick={() => toggleType(et.value)}
            >
              {et.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="full-page-loader" style={{ minHeight: '30vh' }}>
          <span className="spinner" />
          <span>Carregando atividade…</span>
        </div>
      )}

      {error && (
        <div className="empty">
          Erro ao carregar atividade.
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="empty">
          Nenhum evento encontrado{rows && rows.length > 0 ? ' com os filtros atuais.' : ' ainda. Envie um documento pra começar.'}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="atividade-table-wrapper">
          <table className="atividade-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Documento</th>
                <th>Etapa</th>
                <th>Tipo</th>
                <th>Modelo</th>
                <th>Duração</th>
                <th>Custo</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const tone = ALL_EVENT_TYPES.find((t) => t.value === r.event_type)?.tone ?? 'info';
                const filename = r.jobs?.documents?.filename_final
                  ?? r.jobs?.documents?.filename_original
                  ?? '—';
                const materia = r.jobs?.documents?.materia_code;
                return (
                  <tr key={r.id}>
                    <td className="cell-mono">{formatDate(r.created_at)}</td>
                    <td>
                      <span className="cell-filename">{filename}</span>
                      {materia && <small className="cell-materia">{materia}</small>}
                    </td>
                    <td className="cell-mono">{describeStep(r.step)}</td>
                    <td>
                      <span className={`badge tone-${tone}`}>{r.event_type}</span>
                    </td>
                    <td className="cell-mono cell-truncate" title={r.llm_model ?? ''}>
                      {r.llm_model ?? '—'}
                    </td>
                    <td className="cell-mono">{formatDuration(r.duration_ms)}</td>
                    <td className="cell-mono">{formatCost(r.cost_usd)}</td>
                    <td className="cell-message" title={r.message ?? ''}>{r.message ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint atividade-footer">
            Mostrando {filtered.length} de {rows?.length ?? 0} eventos recentes.
          </p>
        </div>
      )}
    </section>
  );
}
