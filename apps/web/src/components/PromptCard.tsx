/**
 * Card de prompt com placeholders editáveis + botão Copiar (T34).
 *
 * - Detecta {{var}} no template e mostra inputs editáveis abaixo.
 * - Botão "Copiar" preenche placeholders antes de mandar pro clipboard.
 * - Selo "Oficial" pros prompts curados pelo time (is_official=true).
 */

import { useMemo, useState } from 'react';
import type { PromptLibraryItem, PromptCategory } from '@psp2/shared';
import { useToast } from './Toast';
import { useIncrementPromptUsage } from '../hooks/usePromptLibrary';
import { createLogger } from '../lib/log';

const log = createLogger('prompt-card');

interface Props {
  prompt: PromptLibraryItem;
}

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  estudo: 'Estudo',
  exercicio: 'Exercício',
  redacao: 'Redação',
  revisao: 'Revisão',
};

export default function PromptCard({ prompt }: Props) {
  const placeholders = useMemo(() => extractPlaceholders(prompt.template), [prompt.template]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const inc = useIncrementPromptUsage();

  const rendered = useMemo(
    () => renderPromptTemplate(prompt.template, values),
    [prompt.template, values],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rendered);
      toast.success('Prompt copiado', 'Cole em qualquer IA (ChatGPT, Claude, Gemini).');
      inc.mutate(prompt.id);
    } catch (err) {
      log.warn('clipboard_copy_failed', { prompt_id: prompt.id, ...log.fromError(err) });
      toast.error('Não foi possível copiar', 'Selecione manualmente e copie.');
    }
  };

  return (
    <article className="prompt-card" data-category={prompt.category}>
      <header className="prompt-card-header">
        <h3>{prompt.title}</h3>
        <div className="prompt-card-tags">
          <span className="prompt-tag prompt-tag-category">
            {CATEGORY_LABEL[prompt.category]}
          </span>
          {prompt.is_official && <span className="prompt-tag official">Oficial</span>}
        </div>
      </header>
      {prompt.description && <p className="prompt-description">{prompt.description}</p>}

      {placeholders.length > 0 && (
        <details
          className="prompt-vars"
          open={open}
          onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>Personalizar ({placeholders.length} {placeholders.length === 1 ? 'variável' : 'variáveis'})</summary>
          <div className="prompt-vars-grid">
            {placeholders.map((p) => (
              <label key={p} className="field">
                <span>{p}</span>
                <input
                  type="text"
                  placeholder={p}
                  value={values[p] ?? ''}
                  onChange={(e) => setValues({ ...values, [p]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </details>
      )}

      <pre className="prompt-preview" aria-label="Preview do prompt">
        {rendered.length > 280 ? rendered.slice(0, 280) + '…' : rendered}
      </pre>

      <footer className="prompt-card-footer">
        {prompt.usage_count > 0 && (
          <span className="prompt-usage hint">{prompt.usage_count} {prompt.usage_count === 1 ? 'uso' : 'usos'}</span>
        )}
        <button type="button" className="secondary" onClick={handleCopy}>
          Copiar
        </button>
      </footer>
    </article>
  );
}

function extractPlaceholders(template: string): string[] {
  const re = /\{\{(\w+)\}\}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) found.add(m[1]);
  return Array.from(found);
}

function renderPromptTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = values[key];
    return v ? v : `{{${key}}}`;
  });
}
