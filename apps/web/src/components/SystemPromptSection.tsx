/**
 * Seção "Prompt de estudo personalizado" em /settings (H7).
 *
 * Mostra a versão ativa do user_system_prompt e deixa o aluno (re)gerar via
 * Edge Function generate-system-prompt. Esse prompt é injetado na síntese
 * (process-document) quando ativo.
 *
 * Botões são type="button" de propósito: a seção vive dentro do <form> de
 * perfil da SettingsPage e não deve disparar o submit do perfil.
 */

import { useState } from 'react';
import { useActiveSystemPrompt, useRegenerateSystemPrompt } from '../hooks/useSystemPrompt';
import { useToast } from './Toast';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SystemPromptSection() {
  const { data: prompt, isLoading } = useActiveSystemPrompt();
  const regenerate = useRegenerateSystemPrompt();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);

  const handleRegenerate = async () => {
    try {
      const res = await regenerate.mutateAsync();
      if (res.regenerated) {
        toast.success('Prompt atualizado', `Nova versão (v${res.prompt.version}) gerada a partir dos seus dados.`);
      } else {
        toast.info('Já estava atualizado', 'Seu prompt já reflete o semestre atual.');
      }
    } catch (err) {
      toast.error('Não foi possível gerar', (err as Error).message);
    }
  };

  return (
    <section className="settings-section">
      <h2>Prompt de estudo personalizado</h2>
      <p className="hint" style={{ marginTop: '-0.5rem' }}>
        Um resumo do seu perfil (curso, semestre, matérias e tópicos dos seus documentos)
        que o sistema injeta nas sínteses para deixá-las mais alinhadas ao que você estuda.
      </p>

      {isLoading ? (
        <div className="full-page-loader" style={{ minHeight: '80px' }}>
          <span className="spinner" />
          <span>Carregando…</span>
        </div>
      ) : prompt ? (
        <div className="card system-prompt-card">
          <div className="system-prompt-meta">
            <span className="badge tone-success">Ativo · v{prompt.version}</span>
            <span className="hint">
              Semestre {prompt.semester_snapshot} · {prompt.source_documents.length}{' '}
              {prompt.source_documents.length === 1 ? 'documento' : 'documentos'} de base · gerado {fmtDate(prompt.created_at)}
            </span>
          </div>

          <pre className={`system-prompt-text ${expanded ? 'expanded' : ''}`}>{prompt.prompt_text}</pre>

          <div className="actions-row">
            <button type="button" className="ghost" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Recolher' : 'Ver completo'}
            </button>
            <button type="button" className="primary" onClick={handleRegenerate} disabled={regenerate.isPending}>
              {regenerate.isPending ? 'Gerando…' : 'Atualizar prompt'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty">Você ainda não tem um prompt personalizado.</div>
          <div className="actions-row">
            <button type="button" className="primary" onClick={handleRegenerate} disabled={regenerate.isPending}>
              {regenerate.isPending ? 'Gerando…' : 'Gerar meu prompt'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
