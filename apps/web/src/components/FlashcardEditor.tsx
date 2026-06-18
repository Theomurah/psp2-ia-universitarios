/**
 * Editor de cartão (Fase 3) — cria ou edita um flashcard, com prévia LaTeX ao
 * vivo da frente e do verso. Usado na página de gestão do baralho.
 */

import { Suspense, lazy, useState } from 'react';
import type { Flashcard } from '@psp2/shared';
import { useCreateCard, useUpdateCard } from '../hooks/useFlashcards';
import { useToast } from './Toast';

const MathMarkdown = lazy(() => import('./MathMarkdown'));

interface Props {
  deckId: string;
  /** Cartão a editar; ausente = criação. */
  initial?: Flashcard;
  onClose: () => void;
}

function parseTags(s: string): string[] {
  return s.split(',').map((t) => t.trim()).filter(Boolean);
}

export default function FlashcardEditor({ deckId, initial, onClose }: Props) {
  const [front, setFront] = useState(initial?.front ?? '');
  const [back, setBack] = useState(initial?.back ?? '');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [topico, setTopico] = useState(initial?.topico ?? '');
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const toast = useToast();
  const saving = createCard.isPending || updateCard.isPending;

  const save = () => {
    if (!front.trim() || !back.trim()) {
      toast.error('Frente e verso são obrigatórios.');
      return;
    }
    const payload = {
      front: front.trim(),
      back: back.trim(),
      tags: parseTags(tags),
      topico: topico.trim() || null,
    };
    const done = {
      onSuccess: () => {
        toast.success(initial ? 'Cartão atualizado' : 'Cartão criado');
        onClose();
      },
      onError: () => toast.error('Não deu pra salvar o cartão.'),
    };
    if (initial) updateCard.mutate({ id: initial.id, ...payload }, done);
    else createCard.mutate({ deckId, ...payload }, done);
  };

  return (
    <div className="card fc-editor">
      <div className="fc-editor-grid">
        <label className="field">
          <span>Frente (markdown + LaTeX)</span>
          <textarea
            rows={5}
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Ex.: Qual a derivada de $x^2$?"
          />
        </label>
        <div className="fc-editor-preview">
          <span className="metric-label">Prévia · frente</span>
          <Suspense fallback={<span className="muted">…</span>}>
            <MathMarkdown content={front || '_(vazio)_'} />
          </Suspense>
        </div>

        <label className="field">
          <span>Verso (markdown + LaTeX)</span>
          <textarea
            rows={5}
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="Ex.: $$\frac{d}{dx}x^2 = 2x$$"
          />
        </label>
        <div className="fc-editor-preview">
          <span className="metric-label">Prévia · verso</span>
          <Suspense fallback={<span className="muted">…</span>}>
            <MathMarkdown content={back || '_(vazio)_'} />
          </Suspense>
        </div>
      </div>

      <div className="fc-editor-row">
        <label className="field">
          <span>Tags (separadas por vírgula)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="cálculo, derivadas" />
        </label>
        <label className="field">
          <span>Tópico</span>
          <input value={topico} onChange={(e) => setTopico(e.target.value)} placeholder="Derivadas" />
        </label>
      </div>

      <div className="actions-row">
        <button type="button" className="primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
