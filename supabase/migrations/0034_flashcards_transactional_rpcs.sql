-- =============================================================================
-- Migration 0034 — Flashcards: RPCs transacionais (atomicidade de escrita)
-- =============================================================================
-- Origem: revisão do modelo de persistência (2026-06-23). Duas operações
-- faziam múltiplas escritas separadas do browser, sem transação:
--   (1) Revisar um cartão = upsert em flashcard_states + insert em
--       flashcard_reviews. Se a 2ª falhasse, o agendamento avançava sem o log
--       (ou vice-versa) → análise furada e estado inconsistente.
--   (2) Importar/gerar um baralho = insert do deck + N inserts de cartões em
--       lotes. Falha no meio deixava baralho parcial.
--
-- Ambas viram RPC plpgsql (= 1 transação). SECURITY INVOKER de propósito: a RLS
-- por user_id já garante posse (não há escalada), então NÃO precisamos do guard
-- de SECURITY DEFINER. `search_path` fixo evita o advisor function_search_path_mutable.
--
-- O algoritmo SRS continua só no TS (@psp2/shared/srs.ts) — o cliente calcula o
-- próximo estado e passa os valores; a RPC só persiste atomicamente. Evita
-- duplicar (e arriscar divergir) o SM-2 em plpgsql.
-- =============================================================================

-- ============================================================
-- 1. record_flashcard_review — upsert do estado + insert do review (atômico)
-- ============================================================
create or replace function public.record_flashcard_review(
  p_card_id            uuid,
  p_rating             public.flashcard_rating,
  p_elapsed_ms         integer,
  p_state              public.flashcard_state,
  p_ease               numeric,
  p_interval_days      integer,
  p_repetitions        integer,
  p_lapses             integer,
  p_learning_step      integer,
  p_due_at             timestamptz,
  p_prev_interval_days integer,
  p_prev_ease          numeric
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_uid     uuid := (select auth.uid());
  v_deck_id uuid;
  v_topico  text;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  -- Posse: o SELECT sob RLS só enxerga cartões do próprio usuário.
  select deck_id, topico into v_deck_id, v_topico
  from public.flashcards
  where id = p_card_id and user_id = v_uid;
  if not found then
    raise exception 'card_not_found' using errcode = '42704';
  end if;

  -- Estado SRS (1 por cartão) — created_at/updated_at via default + trigger.
  insert into public.flashcard_states (
    card_id, user_id, state, ease_factor, interval_days, repetitions,
    lapses, learning_step, due_at, last_reviewed_at
  ) values (
    p_card_id, v_uid, p_state, p_ease, p_interval_days, p_repetitions,
    p_lapses, p_learning_step, p_due_at, now()
  )
  on conflict (card_id) do update set
    state            = excluded.state,
    ease_factor      = excluded.ease_factor,
    interval_days    = excluded.interval_days,
    repetitions      = excluded.repetitions,
    lapses           = excluded.lapses,
    learning_step    = excluded.learning_step,
    due_at           = excluded.due_at,
    last_reviewed_at = excluded.last_reviewed_at;

  -- Log append-only (is_correct é coluna gerada; reviewed_at default now()).
  -- deck_id e topico vêm do banco (snapshot autoritativo), não do cliente.
  insert into public.flashcard_reviews (
    card_id, user_id, deck_id, topico, rating, elapsed_ms,
    prev_interval_days, scheduled_interval_days, prev_ease, new_ease
  ) values (
    p_card_id, v_uid, v_deck_id, v_topico, p_rating, p_elapsed_ms,
    p_prev_interval_days, p_interval_days, p_prev_ease, p_ease
  );

  return jsonb_build_object('due_at', p_due_at, 'state', p_state);
end $fn$;

revoke all on function public.record_flashcard_review(
  uuid, public.flashcard_rating, integer, public.flashcard_state, numeric,
  integer, integer, integer, integer, timestamptz, integer, numeric
) from public, anon;
grant execute on function public.record_flashcard_review(
  uuid, public.flashcard_rating, integer, public.flashcard_state, numeric,
  integer, integer, integer, integer, timestamptz, integer, numeric
) to authenticated;

comment on function public.record_flashcard_review(
  uuid, public.flashcard_rating, integer, public.flashcard_state, numeric,
  integer, integer, integer, integer, timestamptz, integer, numeric
) is
  'Persiste uma revisão de flashcard atomicamente: upsert do estado SRS + insert do review. SECURITY INVOKER (RLS por user_id). SRS é calculado no cliente. Migration 0034.';

-- ============================================================
-- 2. import_flashcards — cria baralho + cartões numa transação
-- ============================================================
create or replace function public.import_flashcards(
  p_name   text,
  p_source public.flashcard_deck_source,
  p_cards  jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_uid     uuid := (select auth.uid());
  v_deck_id uuid;
  v_count   integer;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' then
    raise exception 'invalid_cards' using errcode = '22023';
  end if;

  insert into public.flashcard_decks (user_id, name, source)
  values (
    v_uid,
    coalesce(nullif(btrim(p_name), ''), 'Baralho importado'),
    coalesce(p_source, 'manual')
  )
  returning id into v_deck_id;

  -- Insere todos os cartões válidos (frente e verso não-vazios) de uma vez.
  -- tags: extrai do array jsonb com guarda contra não-array (input é untrusted).
  insert into public.flashcards (deck_id, user_id, front, back, tags, topico)
  select
    v_deck_id, v_uid,
    c->>'front',
    c->>'back',
    coalesce(tg.arr, '{}'::text[]),
    nullif(c->>'topico', '')
  from jsonb_array_elements(p_cards) as c
  left join lateral (
    select array_agg(t) as arr
    from jsonb_array_elements_text(
      case when jsonb_typeof(c->'tags') = 'array' then c->'tags' else '[]'::jsonb end
    ) as t
  ) tg on true
  where coalesce(c->>'front', '') <> '' and coalesce(c->>'back', '') <> '';

  get diagnostics v_count = row_count;

  return jsonb_build_object('deck_id', v_deck_id, 'count', v_count);
end $fn$;

revoke all on function public.import_flashcards(text, public.flashcard_deck_source, jsonb) from public, anon;
grant execute on function public.import_flashcards(text, public.flashcard_deck_source, jsonb) to authenticated;

comment on function public.import_flashcards(text, public.flashcard_deck_source, jsonb) is
  'Cria um baralho + seus cartões numa transação (import .apkg/CSV ou geração IA). SECURITY INVOKER (RLS por user_id). p_cards = jsonb array de {front,back,tags,topico}. Migration 0034.';
