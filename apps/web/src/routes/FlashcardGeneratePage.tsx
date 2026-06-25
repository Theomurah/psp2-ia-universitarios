/**
 * Página /flashcards/generate — geração de cartões por IA (Fase 6, frente 2.1).
 *
 * Fluxo simples: o aluno cola/envia um material (.txt/.md) + um contexto, a IA
 * (Edge Function generate-flashcards) devolve cartões frente/verso em LaTeX, que
 * são pré-visualizados e salvos num baralho novo (source 'ai').
 */

import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ParsedCard } from '@psp2/shared';
import { useGenerateFlashcards, useImportDeck } from '../hooks/useFlashcards';
import { useToast } from '../components/Toast';

const MathMarkdown = lazy(() => import('../components/MathMarkdown'));

export default function FlashcardGeneratePage() {
  const navigate = useNavigate();
  const generate = useGenerateFlashcards();
  const importDeck = useImportDeck();
  const toast = useToast();

  const [text, setText] = useState('');
  const [context, setContext] = useState('');
  const [count, setCount] = useState(10);
  const [cards, setCards] = useState<ParsedCard[] | null>(null);
  const [deckName, setDeckName] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setText(await file.text());
    } catch {
      toast.error('Não consegui ler esse arquivo. Cole o conteúdo manualmente.');
    }
  };

  const handleGenerate = () => {
    if (text.trim().length < 20) {
      toast.error('Cole um material com pelo menos algumas frases.');
      return;
    }
    generate.mutate(
      { text, context, count },
      {
        onSuccess: (result) => {
          setCards(result);
          setDeckName(context.trim().slice(0, 60) || 'Cartões gerados por IA');
          toast.success(`${result.length} ${result.length === 1 ? 'cartão gerado' : 'cartões gerados'}`, 'Revise e salve.');
        },
        onError: () => toast.error('A IA não conseguiu gerar agora. Tente de novo em instantes.'),
      },
    );
  };

  const handleSave = () => {
    if (!cards || cards.length === 0) return;
    importDeck.mutate(
      { name: deckName.trim() || 'Cartões gerados por IA', source: 'ai', cards },
      {
        onSuccess: ({ deckId, count: n }) => {
          toast.success(`${n} cartões salvos`, 'Pronto pra estudar.');
          navigate(`/flashcards/decks/${deckId}`);
        },
        onError: () => toast.error('Não deu pra salvar os cartões.'),
      },
    );
  };

  const removeCard = (i: number) => setCards((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev));

  return (
    <div className="container">
      <header className="dashboard-header">
        <div>
          <h1>Gerar cartões por IA</h1>
          <p className="hint">
            Cole um material (ou envie um .txt/.md), descreva o que quer, e a IA monta os
            cartões com fórmulas em LaTeX. Revise antes de salvar.
          </p>
        </div>
        <Link to="/flashcards" className="ghost" style={{ textDecoration: 'none' }}>
          Voltar
        </Link>
      </header>

      <div className="card" style={{ display: 'grid', gap: '0.85rem', marginBottom: '1.5rem' }}>
        <label className="field">
          <span>Material</span>
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o conteúdo da aula, resumo, lista de exercícios…"
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>
        <label className="field">
          <span>Ou envie um arquivo (.txt, .md)</span>
          <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>
        <div className="fc-editor-row" style={{ margin: 0 }}>
          <label className="field">
            <span>Contexto / instruções</span>
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Ex.: foco em derivadas, nível P1, perguntas objetivas"
            />
          </label>
          <label className="field">
            <span>Quantos cartões</span>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            />
          </label>
        </div>
        <div className="actions-row">
          <button type="button" className="primary" onClick={handleGenerate} disabled={generate.isPending}>
            {generate.isPending ? 'Gerando…' : 'Gerar com IA'}
          </button>
        </div>
      </div>

      {generate.isPending && (
        <div className="full-page-loader" style={{ minHeight: '20vh' }}>
          <span className="spinner" />
          <span>A IA está montando seus cartões…</span>
        </div>
      )}

      {cards && cards.length > 0 && (
        <>
          <div className="card" style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <label className="field">
              <span>Nome do baralho</span>
              <input value={deckName} onChange={(e) => setDeckName(e.target.value)} />
            </label>
            <div className="actions-row">
              <button type="button" className="primary" onClick={handleSave} disabled={importDeck.isPending}>
                {importDeck.isPending ? 'Salvando…' : `Salvar ${cards.length} cartões`}
              </button>
              <button type="button" className="ghost" onClick={handleGenerate} disabled={generate.isPending}>
                Gerar de novo
              </button>
            </div>
          </div>

          <h2 style={{ fontSize: '1rem' }}>Cartões gerados</h2>
          <div className="fc-card-list">
            {cards.map((c, i) => (
              <article key={i} className="fc-card-item">
                <div className="fc-card-faces">
                  <div className="fc-card-face">
                    <Suspense fallback={<span className="muted">…</span>}>
                      <MathMarkdown content={c.front} />
                    </Suspense>
                  </div>
                  <div className="fc-card-face fc-card-back">
                    <Suspense fallback={<span className="muted">…</span>}>
                      <MathMarkdown content={c.back} />
                    </Suspense>
                  </div>
                </div>
                <div className="fc-card-footer">
                  <div className="fc-card-tags">
                    {c.topico && <span className="badge tone-info">{c.topico}</span>}
                    {c.tags.map((t) => (
                      <span key={t} className="muted">#{t}</span>
                    ))}
                  </div>
                  <button type="button" className="ghost" onClick={() => removeCard(i)}>
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
