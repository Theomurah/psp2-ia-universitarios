/**
 * Painel /admin/prompts — edita prompts oficiais da prompt_library.
 *
 * Lista por categoria; cada item expande pra editor inline.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { createLogger } from '../../lib/log';
import type { PromptLibraryItem, PromptCategory } from '@psp2/shared';

const log = createLogger('admin');

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  estudo: 'Estudo',
  exercicio: 'Exercício',
  redacao: 'Redação',
  revisao: 'Revisão',
};

function useOfficialPrompts() {
  return useQuery({
    queryKey: ['admin', 'official_prompts'],
    queryFn: async (): Promise<PromptLibraryItem[]> => {
      const { data, error } = await supabase
        .from('prompt_library')
        .select('*')
        .eq('is_official', true)
        .order('category')
        .order('title');
      if (error) throw new Error(error.message);
      return (data ?? []) as PromptLibraryItem[];
    },
  });
}

function useUpdatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; description: string | null; template: string }) => {
      const { error } = await supabase
        .from('prompt_library')
        .update({
          title: input.title,
          description: input.description,
          template: input.template,
        })
        .eq('id', input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      // Auditoria: prompt oficial editado afeta todos os alunos.
      // Logamos id + tamanho do template (não o conteúdo).
      log.info('prompt_updated', { prompt_id: input.id, template_chars: input.template.length });
      qc.invalidateQueries({ queryKey: ['admin', 'official_prompts'] });
      qc.invalidateQueries({ queryKey: ['prompt_library'] });
    },
    onError: (err, input) => {
      log.error('prompt_update_failed', { prompt_id: input.id, ...log.fromError(err) });
    },
  });
}

interface EditorProps {
  prompt: PromptLibraryItem;
  onClose: () => void;
}

function PromptEditor({ prompt, onClose }: EditorProps) {
  const [title, setTitle] = useState(prompt.title);
  const [description, setDescription] = useState(prompt.description ?? '');
  const [template, setTemplate] = useState(prompt.template);
  const update = useUpdatePrompt();
  const toast = useToast();

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: prompt.id,
        title,
        description: description.trim() || null,
        template,
      });
      toast.success('Prompt atualizado', prompt.title);
      onClose();
    } catch (err) {
      toast.error('Não foi possível salvar', (err as Error).message);
    }
  };

  return (
    <div className="admin-prompt-editor">
      <div className="field">
        <span>Título</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </div>
      <div className="field">
        <span>Descrição</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </div>
      <div className="field">
        <span>Template (placeholders <code>{'{{materia}}'}</code>, <code>{'{{topico}}'}</code>, <code>{'{{titulo_doc}}'}</code>)</span>
        <textarea value={template} onChange={(e) => setTemplate(e.target.value)} spellCheck={false} />
      </div>
      <div className="admin-prompt-editor-actions">
        <button type="button" className="ghost" onClick={onClose} disabled={update.isPending}>Cancelar</button>
        <button type="button" className="primary" onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

export default function AdminPrompts() {
  const { data, isLoading, error } = useOfficialPrompts();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="full-page-loader" style={{ minHeight: '30vh' }}>
        <span className="spinner" />
        <span>Carregando prompts…</span>
      </div>
    );
  }

  if (error) {
    return <div className="empty">{(error as Error).message}</div>;
  }

  const byCategory = (data ?? []).reduce<Record<string, PromptLibraryItem[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Prompts oficiais</h1>
          <p className="hint">
            Templates visíveis pra todos os alunos na página <code>/prompts</code>. Edite com cuidado — afeta todo mundo.
          </p>
        </div>
      </header>

      {Object.entries(byCategory).map(([category, prompts]) => (
        <section key={category} className="prompts-section">
          <h2>{CATEGORY_LABEL[category as PromptCategory] ?? category}</h2>
          <div>
            {prompts.map((p) => (
              <div key={p.id}>
                {editingId === p.id ? (
                  <PromptEditor prompt={p} onClose={() => setEditingId(null)} />
                ) : (
                  <div className="admin-prompt-row">
                    <div className="admin-prompt-row-info">
                      <strong>{p.title}</strong>
                      {p.description && <p>{p.description}</p>}
                      <small>{p.usage_count} {p.usage_count === 1 ? 'uso' : 'usos'} · {p.template.length} caracteres</small>
                    </div>
                    <button type="button" className="ghost" onClick={() => setEditingId(p.id)}>
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
