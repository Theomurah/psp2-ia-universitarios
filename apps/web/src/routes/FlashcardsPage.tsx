/**
 * Página /flashcards — home da seção de Flashcards (Fases 2-3).
 *
 * Lista os baralhos do usuário, permite criar baralho (manual ou de exemplo) e
 * leva pro estudo ou pra gestão de cada um. Importação (.apkg) e análises entram
 * nas fases seguintes — ficam aqui como affordances "em breve".
 *
 * UI 100% no design system UnB (.container, .dashboard-header, .card, .badge…).
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFlashcardDecks, useCreateDeck, useCreateSampleDeck } from '../hooks/useFlashcards';
import { useToast } from '../components/Toast';

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Manual',
  apkg: 'Importado (Anki)',
  csv: 'Importado (CSV)',
  ai: 'Gerado por IA',
};

export default function FlashcardsPage() {
  const { data: decks, isLoading, error } = useFlashcardDecks();
  const createSample = useCreateSampleDeck();
  const createDeck = useCreateDeck();
  const toast = useToast();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreateSample = () => {
    createSample.mutate(undefined, {
      onSuccess: () => toast.success('Baralho de exemplo criado', 'Abra e comece a estudar.'),
      onError: () => toast.error('Não deu pra criar o baralho de exemplo.'),
    });
  };

  const handleCreateDeck = () => {
    if (!name.trim()) {
      toast.error('Dê um nome ao baralho.');
      return;
    }
    createDeck.mutate(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: (deck) => {
          toast.success('Baralho criado');
          navigate(`/flashcards/decks/${deck.id}`);
        },
        onError: () => toast.error('Não deu pra criar o baralho.'),
      },
    );
  };

  return (
    <div className="container">
      <header className="dashboard-header">
        <div>
          <h1>Flashcards</h1>
          <p className="hint">
            Estude com repetição espaçada (estilo Anki). Escolha um baralho pra estudar ou
            crie e edite os seus.
          </p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="primary" onClick={() => setCreating((v) => !v)}>
            Novo baralho
          </button>
          <Link to="/flashcards/import" className="ghost" style={{ textDecoration: 'none' }}>
            Importar
          </Link>
          <Link to="/flashcards/analytics" className="ghost" style={{ textDecoration: 'none' }}>
            Análises
          </Link>
        </div>
      </header>

      {creating && (
        <div className="card" style={{ marginBottom: '1.5rem', display: 'grid', gap: '0.75rem' }}>
          <label className="field">
            <span>Nome do baralho</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Cálculo I" autoFocus />
          </label>
          <label className="field">
            <span>Descrição (opcional)</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Derivadas e integrais da P1"
            />
          </label>
          <div className="actions-row">
            <button type="button" className="primary" onClick={handleCreateDeck} disabled={createDeck.isPending}>
              {createDeck.isPending ? 'Criando…' : 'Criar baralho'}
            </button>
            <button type="button" className="ghost" onClick={() => setCreating(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="full-page-loader" style={{ minHeight: '40vh' }}>
          <span className="spinner" />
          <span>Carregando baralhos…</span>
        </div>
      )}

      {error && (
        <div className="empty">Não foi possível carregar seus baralhos. {(error as Error).message}</div>
      )}

      {!isLoading && !error && decks && decks.length === 0 && !creating && (
        <div className="empty" style={{ display: 'grid', gap: '1rem', justifyItems: 'center' }}>
          <span>Você ainda não tem nenhum baralho.</span>
          <div className="actions-row">
            <button type="button" className="primary" onClick={() => setCreating(true)}>
              Criar baralho
            </button>
            <button type="button" className="ghost" onClick={handleCreateSample} disabled={createSample.isPending}>
              {createSample.isPending ? 'Criando…' : 'Ou criar um de exemplo'}
            </button>
          </div>
        </div>
      )}

      {!isLoading && !error && decks && decks.length > 0 && (
        <div className="deck-grid">
          {decks.map((deck) => (
            <article key={deck.id} className="deck-card">
              <div className="deck-card-body">
                <h2>{deck.name}</h2>
                {deck.description && <p className="hint">{deck.description}</p>}
                <div className="deck-card-meta">
                  <span className="badge tone-info">{SOURCE_LABEL[deck.source] ?? deck.source}</span>
                  <span className="muted">
                    {deck.card_count} {deck.card_count === 1 ? 'cartão' : 'cartões'}
                  </span>
                </div>
              </div>
              <div className="deck-card-actions">
                <Link to={`/flashcards/decks/${deck.id}`} className="ghost" style={{ textDecoration: 'none' }}>
                  Gerenciar
                </Link>
                <Link
                  to={`/flashcards/study/${deck.id}`}
                  className="primary"
                  style={{ textDecoration: 'none' }}
                  aria-disabled={deck.card_count === 0}
                  onClick={(e) => {
                    if (deck.card_count === 0) e.preventDefault();
                  }}
                >
                  Estudar
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
