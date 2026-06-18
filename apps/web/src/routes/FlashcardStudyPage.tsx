/**
 * Página /flashcards/study/:deckId — fluxo de estudo (Fase 2, frente 1.4).
 *
 * Três fases: (1) config — escolhe quantos cartões e quais tags; (2) review —
 * vê a frente, revela o verso (LaTeX via MathMarkdown) e dá uma das 4 notas
 * (Errei/Difícil/Bom/Fácil) com prévia do próximo intervalo; (3) done — resumo.
 *
 * A fila é montada uma vez (snapshot local) priorizando cartões vencidos e
 * depois novos — não re-embaralha no meio da sessão. Cada nota roda o scheduler
 * SRS e persiste estado + review (ver useFlashcards / migration 0031).
 *
 * Atalhos: Espaço/Enter revela; 1-4 dão a nota quando o verso está visível.
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  initialState,
  previewSchedule,
  formatDueIn,
  RATING_ORDER,
  RATING_LABELS,
  type Rating,
  type SchedulingState,
} from '@psp2/shared';
import {
  useDeckCards,
  useSubmitReview,
  useRecordSession,
  recordToScheduling,
  type StudyCard,
} from '../hooks/useFlashcards';
import { useToast } from '../components/Toast';

const MathMarkdown = lazy(() => import('../components/MathMarkdown'));

type Phase = 'config' | 'review' | 'done';
const DEFAULT_LIMIT = 20;

/** Classe de cor por nota (tokens UnB) — ver .grade-btn no index.css. */
const GRADE_CLASS: Record<Rating, string> = {
  again: 'grade-again',
  hard: 'grade-hard',
  good: 'grade-good',
  easy: 'grade-easy',
};

function schedulingOf(sc: StudyCard, now: number): SchedulingState {
  return sc.state ? recordToScheduling(sc.state) : initialState(now);
}

/** Monta a fila: vencidos primeiro (mais atrasados antes), depois novos. */
function buildQueue(cards: StudyCard[], now: number, limit: number, tags: string[]): StudyCard[] {
  const pool = tags.length
    ? cards.filter((c) => (c.card.tags ?? []).some((t) => tags.includes(t)))
    : cards;
  const due = pool
    .filter((c) => c.state && c.state.state !== 'new' && new Date(c.state.due_at).getTime() <= now)
    .sort((a, b) => new Date(a.state!.due_at).getTime() - new Date(b.state!.due_at).getTime());
  const fresh = pool.filter((c) => !c.state || c.state.state === 'new');
  const queue = [...due, ...fresh];
  return limit > 0 ? queue.slice(0, limit) : queue;
}

export default function FlashcardStudyPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { data: cards, isLoading, error } = useDeckCards(deckId);
  const submitReview = useSubmitReview();
  const recordSession = useRecordSession();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>('config');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);

  const [queue, setQueue] = useState<StudyCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Rating[]>([]);
  const shownAtRef = useRef<number>(0);
  const sessionStartRef = useRef<number>(0);
  const sessionSavedRef = useRef(false);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards ?? []) for (const t of c.card.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [cards]);

  // Contagens pra mostrar na config (respeitando o filtro de tags atual).
  const { dueCount, newCount } = useMemo(() => {
    const now = Date.now();
    const q = buildQueue(cards ?? [], now, 0, selectedTags);
    let d = 0;
    let n = 0;
    for (const c of q) {
      if (!c.state || c.state.state === 'new') n++;
      else d++;
    }
    return { dueCount: d, newCount: n };
  }, [cards, selectedTags]);

  const totalAvailable = dueCount + newCount;

  const start = () => {
    const now = Date.now();
    const q = buildQueue(cards ?? [], now, limit, selectedTags);
    if (q.length === 0) return;
    setQueue(q);
    setIndex(0);
    setRevealed(false);
    setResults([]);
    sessionStartRef.current = now;
    sessionSavedRef.current = false;
    shownAtRef.current = now;
    setPhase('review');
  };

  const current = queue[index];

  const advance = useCallback(() => {
    setRevealed(false);
    setIndex((i) => {
      const nextIdx = i + 1;
      if (nextIdx >= queue.length) {
        setPhase('done');
        return i;
      }
      shownAtRef.current = Date.now();
      return nextIdx;
    });
  }, [queue.length]);

  const grade = useCallback(
    (rating: Rating) => {
      if (!current) return;
      const now = Date.now();
      submitReview.mutate(
        {
          card: current.card,
          prevState: current.state,
          rating,
          elapsedMs: Math.max(0, now - shownAtRef.current),
          now,
        },
        { onError: () => toast.error('Não deu pra salvar a revisão. Sua nota não foi registrada.') },
      );
      setResults((r) => [...r, rating]);
      advance();
    },
    [current, submitReview, toast, advance],
  );

  // Atalhos de teclado (estilo Anki).
  useEffect(() => {
    if (phase !== 'review') return;
    const onKey = (e: KeyboardEvent) => {
      if (!revealed && (e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        grade(RATING_ORDER[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, revealed, grade]);

  // Grava a sessão ao terminar (best-effort, só uma vez).
  useEffect(() => {
    if (phase !== 'done' || sessionSavedRef.current || !deckId) return;
    sessionSavedRef.current = true;
    recordSession.mutate({
      deckId,
      cardTarget: limit,
      cardsReviewed: results.length,
      correctCount: results.filter((r) => r !== 'again').length,
      startedAt: sessionStartRef.current,
    });
  }, [phase, deckId, limit, results, recordSession]);

  // ---- Estados de carregamento / erro ----
  if (isLoading) {
    return (
      <div className="container">
        <div className="full-page-loader" style={{ minHeight: '50vh' }}>
          <span className="spinner" />
          <span>Carregando cartões…</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="container">
        <div className="empty">Erro ao carregar o baralho. {(error as Error).message}</div>
        <BackLink />
      </div>
    );
  }

  // ---- Fase: configuração ----
  if (phase === 'config') {
    return (
      <div className="container">
        <header className="dashboard-header">
          <div>
            <h1>Estudar</h1>
            <p className="hint">
              {totalAvailable > 0
                ? `${dueCount} para revisar · ${newCount} novos`
                : 'Nada pendente neste baralho agora.'}
            </p>
          </div>
        </header>

        <div className="card study-config">
          <label className="field">
            <span>Quantos cartões nesta sessão?</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, totalAvailable)}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>

          {allTags.length > 0 && (
            <div className="field">
              <span>Filtrar por tags (opcional)</span>
              <div className="prompts-filter" role="group" aria-label="Filtrar por tags">
                {allTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      className={active ? 'active' : ''}
                      onClick={() =>
                        setSelectedTags((prev) =>
                          active ? prev.filter((t) => t !== tag) : [...prev, tag],
                        )
                      }
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="actions-row">
            <button type="button" className="primary" onClick={start} disabled={totalAvailable === 0}>
              Começar
            </button>
            <BackLink />
          </div>
        </div>
      </div>
    );
  }

  // ---- Fase: concluído ----
  if (phase === 'done') {
    const reviewed = results.length;
    const correct = results.filter((r) => r !== 'again').length;
    const accuracy = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0;
    return (
      <div className="container">
        <header className="dashboard-header">
          <div>
            <h1>Sessão concluída 🎉</h1>
            <p className="hint">Bom trabalho! Os próximos intervalos já foram agendados.</p>
          </div>
        </header>
        <div className="card study-summary">
          <div className="metrics-cards">
            <div className="metric-card">
              <span className="metric-label">Revisados</span>
              <span className="metric-value">{reviewed}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Acertos</span>
              <span className="metric-value">{correct}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Aproveitamento</span>
              <span className="metric-value">{accuracy}%</span>
            </div>
          </div>
          <div className="actions-row" style={{ marginTop: '1rem' }}>
            <button type="button" className="primary" onClick={() => setPhase('config')}>
              Estudar de novo
            </button>
            <BackLink />
          </div>
        </div>
      </div>
    );
  }

  // ---- Fase: revisão ----
  if (!current) {
    return (
      <div className="container">
        <div className="empty">Nada para estudar.</div>
        <BackLink />
      </div>
    );
  }

  const now = Date.now();
  const scheduling = schedulingOf(current, now);
  const preview = previewSchedule(scheduling, now);

  return (
    <div className="container study-page">
      <div className="study-progress" aria-live="polite">
        <span>
          {index + 1} / {queue.length}
        </span>
        <Link to="/flashcards" className="link">
          Sair
        </Link>
      </div>

      <div className="study-card">
        <div className="study-card-face" aria-label="Frente do cartão">
          <Suspense fallback={<span className="muted">…</span>}>
            <MathMarkdown content={current.card.front} />
          </Suspense>
        </div>

        {revealed && (
          <>
            <hr className="study-card-divider" />
            <div className="study-card-face study-card-back" aria-label="Verso do cartão">
              <Suspense fallback={<span className="muted">…</span>}>
                <MathMarkdown content={current.card.back} />
              </Suspense>
            </div>
          </>
        )}
      </div>

      {!revealed ? (
        <div className="actions-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="primary" onClick={() => setRevealed(true)}>
            Mostrar resposta <kbd>Espaço</kbd>
          </button>
        </div>
      ) : (
        <div className="grade-buttons" role="group" aria-label="Como você foi?">
          {RATING_ORDER.map((rating, i) => (
            <button
              key={rating}
              type="button"
              className={`grade-btn ${GRADE_CLASS[rating]}`}
              onClick={() => grade(rating)}
            >
              <span className="grade-btn-label">
                <kbd>{i + 1}</kbd> {RATING_LABELS[rating]}
              </span>
              <span className="grade-btn-interval">{formatDueIn(preview[rating], now)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/flashcards" className="ghost" style={{ textDecoration: 'none' }}>
      Voltar aos baralhos
    </Link>
  );
}
