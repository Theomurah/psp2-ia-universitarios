/**
 * T34 — Página /prompts.
 *
 * Lista os prompts oficiais (e os do usuário, no futuro), agrupados por
 * categoria, com filtro de busca. Cada card permite preencher placeholders
 * e copiar o resultado pronto pra colar numa IA.
 */

import { useMemo, useState } from 'react';
import { usePromptLibrary } from '../hooks/usePromptLibrary';
import PromptCard from '../components/PromptCard';
import type { PromptCategory, PromptLibraryItem } from '@psp2/shared';

const CATEGORIES: { value: 'all' | PromptCategory; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'estudo', label: 'Estudo' },
  { value: 'exercicio', label: 'Exercício' },
  { value: 'redacao', label: 'Redação' },
  { value: 'revisao', label: 'Revisão' },
];

export default function PromptsPage() {
  const { data: prompts, isLoading, error } = usePromptLibrary();
  const [filter, setFilter] = useState<'all' | PromptCategory>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!prompts) return [];
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (filter !== 'all' && p.category !== filter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        p.template.toLowerCase().includes(q)
      );
    });
  }, [prompts, filter, query]);

  const byCategory = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <div className="container prompts-page">
      <header className="dashboard-header">
        <div>
          <h1>Biblioteca de Prompts</h1>
          <p className="hint">
            Prompts prontos pra colar em qualquer IA (ChatGPT, Claude, Gemini).
            Personalize as variáveis antes de copiar.
          </p>
        </div>
      </header>

      <section className="prompts-toolbar">
        <input
          type="search"
          placeholder="Buscar por título, descrição ou conteúdo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar prompts"
        />
        <div className="prompts-filter" role="tablist" aria-label="Filtrar por categoria">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="tab"
              aria-selected={filter === c.value}
              className={filter === c.value ? 'active' : ''}
              onClick={() => setFilter(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {isLoading && (
        <div className="full-page-loader" style={{ minHeight: '40vh' }}>
          <span className="spinner" />
          <span>Carregando prompts…</span>
        </div>
      )}

      {error && (
        <div className="empty">
          Não foi possível carregar os prompts. {(error as Error).message}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="empty">
          Nenhum prompt encontrado com os filtros aplicados.
        </div>
      )}

      {Object.entries(byCategory).map(([cat, items]) => (
        <section key={cat} className="prompts-section">
          <h2>{labelFor(cat as PromptCategory)}</h2>
          <div className="prompts-grid">
            {items.map((p) => (
              <PromptCard key={p.id} prompt={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function groupByCategory(items: PromptLibraryItem[]): Record<string, PromptLibraryItem[]> {
  const out: Record<string, PromptLibraryItem[]> = {};
  for (const p of items) {
    if (!out[p.category]) out[p.category] = [];
    out[p.category].push(p);
  }
  return out;
}

function labelFor(c: PromptCategory): string {
  return {
    estudo: 'Estudo',
    exercicio: 'Exercício',
    redacao: 'Redação',
    revisao: 'Revisão',
  }[c];
}
