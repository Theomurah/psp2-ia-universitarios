/**
 * Página /flashcards/decks/:deckId — gestão de um baralho (Fase 3, frente 1.1).
 *
 * Visualiza os cartões (frente/verso renderizados com LaTeX), permite adicionar,
 * editar e excluir cartões, renomear o baralho e excluí-lo. Ações destrutivas
 * usam confirmação em dois cliques (sem dialog nativo).
 */

import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Flashcard } from '@psp2/shared';
import {
  useDeck,
  useDeckCards,
  useDeleteCard,
  useDeleteDeck,
  useUpdateDeck,
} from '../hooks/useFlashcards';
import FlashcardEditor from '../components/FlashcardEditor';
import { useToast } from '../components/Toast';

const MathMarkdown = lazy(() => import('../components/MathMarkdown'));

export default function FlashcardDeckPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { data: deck, isLoading: deckLoading } = useDeck(deckId);
  const { data: cards, isLoading: cardsLoading } = useDeckCards(deckId);
  const deleteCard = useDeleteCard();
  const deleteDeck = useDeleteDeck();
  const updateDeck = useUpdateDeck();
  const toast = useToast();

  const [editing, setEditing] = useState<Flashcard | 'new' | null>(null);
  const [confirmCard, setConfirmCard] = useState<string | null>(null);
  const [confirmDeck, setConfirmDeck] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  if (deckLoading || cardsLoading) {
    return (
      <div className="container">
        <div className="full-page-loader" style={{ minHeight: '40vh' }}>
          <span className="spinner" />
          <span>Carregando baralho…</span>
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="container">
        <div className="empty">Baralho não encontrado.</div>
        <Link to="/flashcards" className="ghost" style={{ textDecoration: 'none' }}>
          Voltar aos baralhos
        </Link>
      </div>
    );
  }

  const list = cards ?? [];

  const handleDeleteDeck = () => {
    if (!deckId) return;
    deleteDeck.mutate(deckId, {
      onSuccess: () => {
        toast.success('Baralho excluído');
        navigate('/flashcards');
      },
      onError: () => toast.error('Não deu pra excluir o baralho.'),
    });
  };

  const handleDeleteCard = (id: string) => {
    deleteCard.mutate(id, {
      onSuccess: () => {
        toast.success('Cartão excluído');
        setConfirmCard(null);
      },
      onError: () => toast.error('Não deu pra excluir o cartão.'),
    });
  };

  const saveRename = () => {
    const name = nameDraft.trim();
    if (!name || !deckId) return setRenaming(false);
    updateDeck.mutate(
      { id: deckId, name },
      {
        onSuccess: () => {
          toast.success('Baralho renomeado');
          setRenaming(false);
        },
        onError: () => toast.error('Não deu pra renomear.'),
      },
    );
  };

  return (
    <div className="container">
      <header className="dashboard-header">
        <div>
          {renaming ? (
            <div className="actions-row">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                aria-label="Nome do baralho"
              />
              <button type="button" className="primary" onClick={saveRename}>Salvar</button>
              <button type="button" className="ghost" onClick={() => setRenaming(false)}>Cancelar</button>
            </div>
          ) : (
            <h1>{deck.name}</h1>
          )}
          {deck.description && !renaming && <p className="hint">{deck.description}</p>}
        </div>
        <div className="dashboard-header-actions">
          <Link
            to={`/flashcards/study/${deck.id}`}
            className="primary"
            style={{ textDecoration: 'none' }}
            aria-disabled={list.length === 0}
            onClick={(e) => list.length === 0 && e.preventDefault()}
          >
            Estudar
          </Link>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setNameDraft(deck.name);
              setRenaming(true);
            }}
          >
            Renomear
          </button>
          {confirmDeck ? (
            <>
              <button type="button" className="danger" onClick={handleDeleteDeck} disabled={deleteDeck.isPending}>
                Confirmar exclusão
              </button>
              <button type="button" className="ghost" onClick={() => setConfirmDeck(false)}>Cancelar</button>
            </>
          ) : (
            <button type="button" className="danger" onClick={() => setConfirmDeck(true)}>
              Excluir baralho
            </button>
          )}
        </div>
      </header>

      <div className="actions-row" style={{ margin: '0.5rem 0 1rem' }}>
        {editing !== 'new' && (
          <button type="button" className="primary" onClick={() => setEditing('new')}>
            + Adicionar cartão
          </button>
        )}
        <Link to="/flashcards" className="link">Voltar aos baralhos</Link>
      </div>

      {editing === 'new' && deckId && (
        <FlashcardEditor deckId={deckId} onClose={() => setEditing(null)} />
      )}

      {list.length === 0 && editing !== 'new' && (
        <div className="empty">Este baralho ainda não tem cartões. Adicione o primeiro.</div>
      )}

      <div className="fc-card-list">
        {list.map(({ card }) =>
          editing !== 'new' && typeof editing === 'object' && editing?.id === card.id && deckId ? (
            <FlashcardEditor key={card.id} deckId={deckId} initial={card} onClose={() => setEditing(null)} />
          ) : (
            <article key={card.id} className="fc-card-item">
              <div className="fc-card-faces">
                <div className="fc-card-face">
                  <Suspense fallback={<span className="muted">…</span>}>
                    <MathMarkdown content={card.front} />
                  </Suspense>
                </div>
                <div className="fc-card-face fc-card-back">
                  <Suspense fallback={<span className="muted">…</span>}>
                    <MathMarkdown content={card.back} />
                  </Suspense>
                </div>
              </div>
              <div className="fc-card-footer">
                <div className="fc-card-tags">
                  {card.topico && <span className="badge tone-info">{card.topico}</span>}
                  {card.tags.map((t) => (
                    <span key={t} className="muted">#{t}</span>
                  ))}
                </div>
                <div className="actions-row">
                  <button type="button" className="ghost" onClick={() => setEditing(card)}>Editar</button>
                  {confirmCard === card.id ? (
                    <>
                      <button type="button" className="danger" onClick={() => handleDeleteCard(card.id)}>
                        Confirmar
                      </button>
                      <button type="button" className="ghost" onClick={() => setConfirmCard(null)}>Cancelar</button>
                    </>
                  ) : (
                    <button type="button" className="danger" onClick={() => setConfirmCard(card.id)}>
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            </article>
          ),
        )}
      </div>
    </div>
  );
}
