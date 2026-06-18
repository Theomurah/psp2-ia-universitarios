/**
 * Hooks de Flashcards (Fase 2) — leitura de baralhos/cartões e escrita de
 * revisões aplicando o scheduler SRS (`@psp2/shared`).
 *
 * RLS cobre tudo por `user_id`; as queries dependem das policies da migration
 * 0031. Conteúdo de cartão NÃO vai pra log — só rating/tempo/intervalos.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { createLogger } from '../lib/log';
import {
  initialState,
  review,
  type Rating,
  type SchedulingState,
} from '@psp2/shared';
import type {
  Flashcard,
  FlashcardDeck,
  FlashcardDeckSource,
  FlashcardStateRecord,
  ParsedCard,
} from '@psp2/shared';

const log = createLogger('flashcards');

/** Baralho + contagem de cartões (pro grid da home). */
export interface DeckWithCount extends FlashcardDeck {
  card_count: number;
}

/** Cartão + seu estado de agendamento (null = nunca estudado). */
export interface StudyCard {
  card: Flashcard;
  state: FlashcardStateRecord | null;
}

/** Converte a linha persistida no estado puro consumido pelo scheduler. */
export function recordToScheduling(r: FlashcardStateRecord): SchedulingState {
  return {
    state: r.state,
    ease: Number(r.ease_factor),
    intervalDays: r.interval_days,
    repetitions: r.repetitions,
    lapses: r.lapses,
    learningStep: r.learning_step,
    dueAt: new Date(r.due_at).getTime(),
  };
}

// =============================================================
// Leitura
// =============================================================

/** Lista os baralhos do usuário com a contagem de cartões. */
export function useFlashcardDecks() {
  return useQuery({
    queryKey: ['flashcards', 'decks'],
    queryFn: async (): Promise<DeckWithCount[]> => {
      const { data, error } = await supabase
        .from('flashcard_decks')
        .select('*, flashcards(count)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      type DeckRow = FlashcardDeck & { flashcards: { count: number }[] | null };
      return ((data ?? []) as DeckRow[]).map((row) => {
        const { flashcards, ...deck } = row;
        const card_count = flashcards?.[0]?.count ?? 0;
        return { ...deck, card_count };
      });
    },
  });
}

/** Carrega todos os cartões de um baralho com o estado SRS embutido. */
export function useDeckCards(deckId: string | undefined) {
  return useQuery({
    queryKey: ['flashcards', 'deck-cards', deckId],
    enabled: !!deckId,
    queryFn: async (): Promise<StudyCard[]> => {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*, flashcard_states(*)')
        .eq('deck_id', deckId!);
      if (error) throw error;
      // deno-lint-ignore no-explicit-any
      return (data ?? []).map((row: any) => {
        const { flashcard_states, ...card } = row;
        // PostgREST devolve objeto (1:1) ou array — normaliza pros dois casos.
        const state = Array.isArray(flashcard_states)
          ? (flashcard_states[0] ?? null)
          : (flashcard_states ?? null);
        return { card: card as Flashcard, state: (state as FlashcardStateRecord | null) };
      });
    },
  });
}

// =============================================================
// Escrita
// =============================================================

export interface SubmitReviewArgs {
  card: Flashcard;
  prevState: FlashcardStateRecord | null;
  rating: Rating;
  elapsedMs: number;
  now?: number;
}

/**
 * Aplica uma nota a um cartão: roda o scheduler, faz upsert do estado e grava o
 * review no log append-only. `is_correct` é coluna gerada — não enviamos.
 */
export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ card, prevState, rating, elapsedMs, now }: SubmitReviewArgs) => {
      const ts = now ?? Date.now();
      const prevScheduling = prevState ? recordToScheduling(prevState) : initialState(ts);
      const next = review(prevScheduling, rating, ts);

      const { error: stErr } = await supabase.from('flashcard_states').upsert(
        {
          card_id: card.id,
          user_id: card.user_id,
          state: next.state,
          ease_factor: next.ease,
          interval_days: next.intervalDays,
          repetitions: next.repetitions,
          lapses: next.lapses,
          learning_step: next.learningStep,
          due_at: new Date(next.dueAt).toISOString(),
          last_reviewed_at: new Date(ts).toISOString(),
        },
        { onConflict: 'card_id' },
      );
      if (stErr) throw stErr;

      const { error: rvErr } = await supabase.from('flashcard_reviews').insert({
        card_id: card.id,
        user_id: card.user_id,
        deck_id: card.deck_id,
        topico: card.topico,
        rating,
        elapsed_ms: elapsedMs,
        prev_interval_days: prevScheduling.intervalDays,
        scheduled_interval_days: next.intervalDays,
        prev_ease: prevScheduling.ease,
        new_ease: next.ease,
      });
      if (rvErr) throw rvErr;

      return next;
    },
    onError: (err) => log.error('review_failed', log.fromError(err)),
    onSuccess: () => {
      // Não invalida deck-cards durante a sessão (a fila é snapshot local);
      // refresca a lista de baralhos pra contagens/decks ficarem em dia.
      qc.invalidateQueries({ queryKey: ['flashcards', 'decks'] });
    },
  });
}

export interface SessionSummary {
  deckId: string;
  cardTarget: number | null;
  cardsReviewed: number;
  correctCount: number;
  startedAt: number;
}

/** Grava a sessão de estudo concluída (best-effort — falha não trava o fluxo). */
export function useRecordSession() {
  return useMutation({
    mutationFn: async (s: SessionSummary) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('flashcard_study_sessions').insert({
        user_id: user.id,
        deck_id: s.deckId,
        card_target: s.cardTarget,
        cards_reviewed: s.cardsReviewed,
        correct_count: s.correctCount,
        started_at: new Date(s.startedAt).toISOString(),
        ended_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onError: (err) => log.warn('session_record_failed', log.fromError(err)),
  });
}

/** Conteúdo do baralho de demonstração (mostra LaTeX inline e em bloco). */
const SAMPLE_CARDS: Array<Pick<Flashcard, 'front' | 'back' | 'tags' | 'topico'>> = [
  {
    front: 'Qual a derivada de $f(x) = x^n$?',
    back: '$$f\'(x) = n\\,x^{n-1}$$\n\nRegra do tombo (power rule).',
    tags: ['cálculo', 'derivadas'],
    topico: 'Derivadas',
  },
  {
    front: 'Enuncie o **Teorema Fundamental do Cálculo**.',
    back: 'Se $F$ é primitiva de $f$ em $[a,b]$, então:\n$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$',
    tags: ['cálculo', 'integrais'],
    topico: 'Integrais',
  },
  {
    front: 'Qual a **identidade de Euler**?',
    back: '$$e^{i\\pi} + 1 = 0$$\n\nLiga as cinco constantes fundamentais.',
    tags: ['álgebra', 'complexos'],
    topico: 'Números complexos',
  },
  {
    front: 'Segunda lei de Newton (forma vetorial)?',
    back: '$$\\vec{F} = m\\,\\vec{a}$$\n\nA resultante das forças é igual à massa vezes a aceleração.',
    tags: ['física', 'mecânica'],
    topico: 'Mecânica',
  },
];

/** Cria um baralho de exemplo com cartões em LaTeX — pra testar de ponta a ponta. */
export function useCreateSampleDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<FlashcardDeck> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not_authenticated');

      const { data: deck, error: deckErr } = await supabase
        .from('flashcard_decks')
        .insert({
          user_id: user.id,
          name: 'Exemplo — Cálculo & Física',
          description: 'Baralho de demonstração com fórmulas em LaTeX.',
          source: 'manual',
        })
        .select()
        .single();
      if (deckErr || !deck) throw deckErr ?? new Error('deck_insert_failed');

      const rows = SAMPLE_CARDS.map((c) => ({ ...c, deck_id: deck.id, user_id: user.id }));
      const { error: cardsErr } = await supabase.from('flashcards').insert(rows);
      if (cardsErr) throw cardsErr;

      return deck as FlashcardDeck;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flashcards'] }),
    onError: (err) => log.error('sample_deck_failed', log.fromError(err)),
  });
}

// =============================================================
// Gestão (Fase 3) — CRUD de baralhos e cartões
// =============================================================

export interface DeckInput {
  name: string;
  description?: string | null;
  materia_code?: string | null;
}

/** Carrega um baralho específico (pra página de gestão). */
export function useDeck(deckId: string | undefined) {
  return useQuery({
    queryKey: ['flashcards', 'deck', deckId],
    enabled: !!deckId,
    queryFn: async (): Promise<FlashcardDeck | null> => {
      const { data, error } = await supabase
        .from('flashcard_decks')
        .select('*')
        .eq('id', deckId!)
        .maybeSingle();
      if (error) throw error;
      return (data as FlashcardDeck | null) ?? null;
    },
  });
}

export function useCreateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeckInput): Promise<FlashcardDeck> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not_authenticated');
      const { data, error } = await supabase
        .from('flashcard_decks')
        .insert({
          user_id: user.id,
          name: input.name,
          description: input.description ?? null,
          materia_code: input.materia_code ?? null,
          source: 'manual',
        })
        .select()
        .single();
      if (error || !data) throw error ?? new Error('deck_insert_failed');
      return data as FlashcardDeck;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flashcards'] }),
    onError: (err) => log.error('deck_create_failed', log.fromError(err)),
  });
}

export function useUpdateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<DeckInput>) => {
      const { error } = await supabase.from('flashcard_decks').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flashcards'] }),
    onError: (err) => log.error('deck_update_failed', log.fromError(err)),
  });
}

/** Exclui o baralho. CASCADE limpa cartões, estados, reviews e sessões. */
export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('flashcard_decks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flashcards'] }),
    onError: (err) => log.error('deck_delete_failed', log.fromError(err)),
  });
}

export interface CardInput {
  front: string;
  back: string;
  tags: string[];
  topico?: string | null;
}

export function useCreateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deckId, ...input }: { deckId: string } & CardInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not_authenticated');
      const { error } = await supabase.from('flashcards').insert({
        deck_id: deckId,
        user_id: user.id,
        front: input.front,
        back: input.back,
        tags: input.tags,
        topico: input.topico ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flashcards'] }),
    onError: (err) => log.error('card_create_failed', log.fromError(err)),
  });
}

export function useUpdateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CardInput>) => {
      const { error } = await supabase.from('flashcards').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flashcards'] }),
    onError: (err) => log.error('card_update_failed', log.fromError(err)),
  });
}

/** Exclui o cartão. CASCADE limpa estado e reviews ligados. */
export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('flashcards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flashcards'] }),
    onError: (err) => log.error('card_delete_failed', log.fromError(err)),
  });
}

// =============================================================
// Importação (Fase 4) — cria baralho + insere cartões em lotes
// =============================================================

export interface ImportDeckArgs {
  name: string;
  source: FlashcardDeckSource; // 'apkg' | 'csv'
  cards: ParsedCard[];
}

const IMPORT_BATCH = 500;

export function useImportDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, source, cards }: ImportDeckArgs): Promise<{ deck: FlashcardDeck; count: number }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not_authenticated');

      const { data: deck, error: deckErr } = await supabase
        .from('flashcard_decks')
        .insert({ user_id: user.id, name, source })
        .select()
        .single();
      if (deckErr || !deck) throw deckErr ?? new Error('deck_insert_failed');

      const rows = cards.map((c) => ({
        deck_id: deck.id,
        user_id: user.id,
        front: c.front,
        back: c.back,
        tags: c.tags,
        topico: c.topico,
      }));
      for (let i = 0; i < rows.length; i += IMPORT_BATCH) {
        const { error } = await supabase.from('flashcards').insert(rows.slice(i, i + IMPORT_BATCH));
        if (error) throw error;
      }
      return { deck: deck as FlashcardDeck, count: rows.length };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flashcards'] }),
    onError: (err) => log.error('import_deck_failed', log.fromError(err)),
  });
}
