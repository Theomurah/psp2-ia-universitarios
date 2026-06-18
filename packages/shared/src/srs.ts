/**
 * SRS — Spaced Repetition Scheduler (Flashcards, frente 1.7).
 *
 * Implementa o agendamento estilo Anki (variante do SM-2 de Woźniak, 1987) com
 * 4 botões de grade — Errei / Difícil / Bom / Fácil. É puro e determinístico:
 * recebe o estado atual + a nota + `now` e devolve o novo estado, sem tocar em
 * relógio nem em I/O. Isso o torna trivial de testar e seguro pra rodar tanto no
 * frontend (preview de intervalos nos botões) quanto numa Edge Function.
 *
 * Escolha de algoritmo (ver pesquisa em project_flashcards): SM-2/Anki é
 * determinístico e não precisa de histórico — ideal no dia 1. O FSRS (default
 * no Anki desde v23.10) rende ~20-30% menos revisões, mas exige histórico pra
 * otimizar; os campos `stability`/`difficulty` ficam reservados no schema
 * (migration 0031) pra trocar o scheduler depois sem migração de dados.
 *
 * Referências:
 * - SuperMemo SM-2: https://super-memory.com/english/ol/sm2.htm
 * - Anki scheduler:  https://docs.ankiweb.net/studying.html
 */

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;

/** As 4 notas do usuário ao revisar um cartão (padrão Anki). */
export type Rating = 'again' | 'hard' | 'good' | 'easy';

/** Rótulos pt-BR pros botões da UI, na ordem de exibição. */
export const RATING_LABELS: Record<Rating, string> = {
  again: 'Errei',
  hard: 'Difícil',
  good: 'Bom',
  easy: 'Fácil',
};

export const RATING_ORDER: Rating[] = ['again', 'hard', 'good', 'easy'];

/** Ciclo de vida do cartão. Espelha o enum `flashcard_state` no Postgres. */
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

/**
 * Estado de agendamento de um cartão — espelha as colunas de `flashcard_states`.
 * `dueAt` é epoch em ms (no banco é `timestamptz due_at`).
 */
export interface SchedulingState {
  state: CardState;
  /** Ease factor (SM-2): começa em 2.5, nunca abaixo de `minEase`. */
  ease: number;
  /** Intervalo atual de revisão em dias (0 enquanto em learning/relearning). */
  intervalDays: number;
  /** Acertos consecutivos em estado de revisão. */
  repetitions: number;
  /** Quantas vezes o cartão "caiu" (lapse) a partir de review. */
  lapses: number;
  /** Índice na lista de passos de learning/relearning. */
  learningStep: number;
  /** Epoch (ms) da próxima revisão. */
  dueAt: number;
}

/** Parâmetros do scheduler. Defaults batem com os do Anki. */
export interface SrsConfig {
  /** Passos de aprendizagem em minutos (cartão novo). */
  learningStepsMin: number[];
  /** Passos de reaprendizagem em minutos (após um lapse). */
  relearningStepsMin: number[];
  /** Intervalo ao graduar com "Bom", em dias. */
  graduatingIntervalDays: number;
  /** Intervalo ao graduar com "Fácil", em dias. */
  easyIntervalDays: number;
  /** Ease inicial. */
  startingEase: number;
  /** Ease mínimo (SM-2 trava em 1.3). */
  minEase: number;
  /** Bônus multiplicativo do "Fácil" em review. */
  easyBonus: number;
  /** Multiplicador do "Difícil" em review. */
  hardMultiplier: number;
  /** Multiplicador aplicado ao intervalo ao cair (lapse). 0 = recomeça do 1. */
  lapseMultiplier: number;
  /** Teto de intervalo em dias (Anki: 36500 = 100 anos). */
  maxIntervalDays: number;
}

export const DEFAULT_SRS_CONFIG: SrsConfig = {
  learningStepsMin: [1, 10],
  relearningStepsMin: [10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startingEase: 2.5,
  minEase: 1.3,
  easyBonus: 1.3,
  hardMultiplier: 1.2,
  lapseMultiplier: 0,
  maxIntervalDays: 36500,
};

/** Estado de um cartão recém-criado: novo, vencido imediatamente. */
export function initialState(now: number, config: SrsConfig = DEFAULT_SRS_CONFIG): SchedulingState {
  return {
    state: 'new',
    ease: config.startingEase,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    learningStep: 0,
    dueAt: now,
  };
}

/** Um cartão está pronto pra revisar se a hora atual já passou do `dueAt`. */
export function isDue(state: SchedulingState, now: number): boolean {
  return state.dueAt <= now;
}

function clampEase(ease: number, config: SrsConfig): number {
  return Math.max(config.minEase, ease);
}

function clampInterval(days: number, config: SrsConfig): number {
  return Math.min(config.maxIntervalDays, Math.max(1, Math.round(days)));
}

/**
 * Aplica uma nota a um cartão e devolve o novo estado de agendamento.
 * Função pura: não muta `prev` nem lê o relógio.
 */
export function review(
  prev: SchedulingState,
  rating: Rating,
  now: number,
  config: SrsConfig = DEFAULT_SRS_CONFIG,
): SchedulingState {
  const next: SchedulingState = { ...prev };

  // --- Cartões em aprendizagem (new/learning) ou reaprendizagem (relearning) ---
  if (prev.state === 'new' || prev.state === 'learning') {
    return scheduleLearning(next, prev, rating, now, config, config.learningStepsMin, 'review');
  }
  if (prev.state === 'relearning') {
    return scheduleLearning(next, prev, rating, now, config, config.relearningStepsMin, 'review');
  }

  // --- Cartões em revisão (review) ---
  if (rating === 'again') {
    // Lapse: cai pra reaprendizagem, perde ease e encurta o intervalo guardado.
    next.lapses = prev.lapses + 1;
    next.repetitions = 0;
    next.ease = clampEase(prev.ease - 0.2, config);
    next.intervalDays = clampInterval(prev.intervalDays * config.lapseMultiplier, config);
    next.state = 'relearning';
    next.learningStep = 0;
    next.dueAt = now + config.relearningStepsMin[0] * MIN_MS;
    return next;
  }

  let intervalDays: number;
  if (rating === 'hard') {
    next.ease = clampEase(prev.ease - 0.15, config);
    intervalDays = prev.intervalDays * config.hardMultiplier;
  } else if (rating === 'easy') {
    next.ease = clampEase(prev.ease + 0.15, config);
    intervalDays = prev.intervalDays * next.ease * config.easyBonus;
  } else {
    // good — ease inalterado
    intervalDays = prev.intervalDays * prev.ease;
  }

  // Garante progresso: o intervalo sempre cresce ao menos 1 dia.
  next.intervalDays = clampInterval(Math.max(intervalDays, prev.intervalDays + 1), config);
  next.repetitions = prev.repetitions + 1;
  next.state = 'review';
  next.learningStep = 0;
  next.dueAt = now + next.intervalDays * DAY_MS;
  return next;
}

/**
 * Lógica compartilhada de learning e relearning. Avança/repete passos em
 * minutos e gradua pra `review` quando os passos terminam.
 */
function scheduleLearning(
  next: SchedulingState,
  prev: SchedulingState,
  rating: Rating,
  now: number,
  config: SrsConfig,
  steps: number[],
  graduateTo: CardState,
): SchedulingState {
  const relearning = prev.state === 'relearning';

  if (rating === 'again') {
    next.state = relearning ? 'relearning' : 'learning';
    next.learningStep = 0;
    next.dueAt = now + steps[0] * MIN_MS;
    return next;
  }

  if (rating === 'easy') {
    // Gradua na hora. Relearning volta pro intervalo guardado (>=1); novo usa o easy.
    next.state = graduateTo;
    next.intervalDays = relearning
      ? clampInterval(prev.intervalDays, config)
      : config.easyIntervalDays;
    next.repetitions = prev.repetitions + 1;
    next.learningStep = 0;
    next.dueAt = now + next.intervalDays * DAY_MS;
    return next;
  }

  if (rating === 'hard') {
    // Repete o passo atual (não avança).
    next.state = prev.state === 'new' ? 'learning' : prev.state;
    next.learningStep = prev.learningStep;
    next.dueAt = now + steps[prev.learningStep] * MIN_MS;
    return next;
  }

  // good — avança um passo; se acabaram os passos, gradua.
  const nextStep = prev.learningStep + 1;
  if (nextStep >= steps.length) {
    next.state = graduateTo;
    next.intervalDays = relearning
      ? clampInterval(prev.intervalDays, config)
      : config.graduatingIntervalDays;
    next.repetitions = prev.repetitions + 1;
    next.learningStep = 0;
    next.dueAt = now + next.intervalDays * DAY_MS;
    return next;
  }

  next.state = prev.state === 'new' ? 'learning' : prev.state;
  next.learningStep = nextStep;
  next.dueAt = now + steps[nextStep] * MIN_MS;
  return next;
}

/**
 * Prévia dos 4 resultados possíveis a partir de um estado — usado pra rotular
 * os botões da UI ("Bom · 4 d", "Fácil · 6 d") sem duplicar a lógica.
 */
export function previewSchedule(
  prev: SchedulingState,
  now: number,
  config: SrsConfig = DEFAULT_SRS_CONFIG,
): Record<Rating, SchedulingState> {
  return {
    again: review(prev, 'again', now, config),
    hard: review(prev, 'hard', now, config),
    good: review(prev, 'good', now, config),
    easy: review(prev, 'easy', now, config),
  };
}

/** Rótulo curto do intervalo até `dueAt` ("agora", "10 min", "3 d", "2 mes"). */
export function formatDueIn(state: SchedulingState, now: number): string {
  const ms = Math.max(0, state.dueAt - now);
  if (ms < MIN_MS) return 'agora';
  if (ms < DAY_MS) return `${Math.round(ms / MIN_MS)} min`;
  const days = Math.round(ms / DAY_MS);
  if (days < 30) return `${days} d`;
  if (days < 365) return `${Math.round(days / 30)} mes`;
  return `${(days / 365).toFixed(1)} ano`;
}
