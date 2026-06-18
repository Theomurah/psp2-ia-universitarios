-- =============================================================================
-- Migration 0031 — Flashcards (seção Anki-like): baralhos, cartões, estado SRS,
--                   log de revisões e sessões de estudo.
-- =============================================================================
-- Frente 1 do roadmap de Flashcards (ver project_flashcards / CLAUDE.md).
--
-- Modelo:
--   flashcard_decks    — baralhos do usuário (manual, import .apkg ou geração IA)
--   flashcards         — cartões (frente/verso em markdown+LaTeX, tags, tópico)
--   flashcard_states   — estado de agendamento SRS (1 por cartão), SM-2/Anki.
--                        Campos stability/difficulty ficam reservados pro FSRS.
--   flashcard_reviews  — log append-only de cada revisão. Dupla função: fonte das
--                        ANÁLISES (acertos por card/tópico) e dataset de treino do
--                        FSRS no futuro. NÃO é log de observabilidade.
--   flashcard_study_sessions — agrupa as revisões de uma sessão ("estudar 10").
--
-- Segurança (gabarito 0006): RLS habilitado em todas; policy
-- `(select auth.uid()) = user_id` por operação. `user_id` é denormalizado em
-- cartões/estados/reviews pra manter as policies simples e indexáveis (sem join).
--
-- IMPORTANTE: conteúdo de cartão (front/back/tags) é "conteúdo do aluno" e NUNCA
-- vai pra log (console/activity_logs) — ver CLAUDE.md. As reviews guardam só
-- rating/tempo/intervalos.
-- =============================================================================

-- ============================================================
-- Enums
-- ============================================================
create type flashcard_deck_source as enum ('manual', 'apkg', 'csv', 'ai');

create type flashcard_state as enum ('new', 'learning', 'review', 'relearning');

-- 4 notas (padrão Anki) — ordem reflete a dificuldade percebida.
create type flashcard_rating as enum ('again', 'hard', 'good', 'easy');

-- ============================================================
-- 1. flashcard_decks — baralhos
-- ============================================================
create table public.flashcard_decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  materia_code text,                         -- liga à matéria do perfil (opcional)
  source      flashcard_deck_source not null default 'manual',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.flashcard_decks enable row level security;

create policy "flashcard_decks_select_own" on public.flashcard_decks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "flashcard_decks_insert_own" on public.flashcard_decks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "flashcard_decks_update_own" on public.flashcard_decks
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "flashcard_decks_delete_own" on public.flashcard_decks
  for delete to authenticated using ((select auth.uid()) = user_id);

create index idx_flashcard_decks_user on public.flashcard_decks (user_id, updated_at desc);

create trigger flashcard_decks_updated_at
  before update on public.flashcard_decks
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- 2. flashcards — cartões
-- ============================================================
create table public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid not null references public.flashcard_decks(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,  -- denorm p/ RLS
  front       text not null,                 -- markdown + LaTeX
  back        text not null,                 -- markdown + LaTeX
  tags        text[] not null default '{}',
  topico      text,                          -- usado nas análises "por tópico"
  source_document_id uuid references public.documents(id) on delete set null,  -- geração IA
  anki_note_id bigint,                        -- proveniência do import .apkg (nullable)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.flashcards enable row level security;

create policy "flashcards_select_own" on public.flashcards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "flashcards_insert_own" on public.flashcards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "flashcards_update_own" on public.flashcards
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "flashcards_delete_own" on public.flashcards
  for delete to authenticated using ((select auth.uid()) = user_id);

create index idx_flashcards_deck on public.flashcards (deck_id);
create index idx_flashcards_user on public.flashcards (user_id);
create index idx_flashcards_tags on public.flashcards using gin (tags);

create trigger flashcards_updated_at
  before update on public.flashcards
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- 3. flashcard_states — estado de agendamento SRS (1 por cartão)
-- ============================================================
create table public.flashcard_states (
  card_id        uuid primary key references public.flashcards(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  state          flashcard_state not null default 'new',
  -- SM-2 / Anki
  ease_factor    numeric(5, 3) not null default 2.5,
  interval_days  integer not null default 0,
  repetitions    integer not null default 0,
  lapses         integer not null default 0,
  learning_step  integer not null default 0,
  -- FSRS-ready (reservado; nullable até trocarmos o scheduler)
  stability      numeric(10, 4),
  difficulty     numeric(6, 4),
  due_at         timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.flashcard_states enable row level security;

create policy "flashcard_states_select_own" on public.flashcard_states
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "flashcard_states_insert_own" on public.flashcard_states
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "flashcard_states_update_own" on public.flashcard_states
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "flashcard_states_delete_own" on public.flashcard_states
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Consulta quente do estudo: "cartões vencidos do usuário".
create index idx_flashcard_states_due on public.flashcard_states (user_id, due_at);

create trigger flashcard_states_updated_at
  before update on public.flashcard_states
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- 4. flashcard_reviews — log append-only (análises + treino FSRS)
-- ============================================================
create table public.flashcard_reviews (
  id                uuid primary key default gen_random_uuid(),
  card_id           uuid not null references public.flashcards(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  deck_id           uuid not null references public.flashcard_decks(id) on delete cascade,  -- denorm
  topico            text,                     -- snapshot do tópico no momento da revisão
  rating            flashcard_rating not null,
  -- Derivado do rating — coluna gerada: impossível inserir inconsistente.
  is_correct        boolean generated always as (rating <> 'again'::flashcard_rating) stored,
  elapsed_ms        integer,                  -- tempo até responder (análise + FSRS)
  prev_interval_days integer,
  scheduled_interval_days integer,
  prev_ease         numeric(5, 3),
  new_ease          numeric(5, 3),
  reviewed_at       timestamptz not null default now()
);

alter table public.flashcard_reviews enable row level security;

-- Append-only: só select e insert. Sem update/delete (imutável, como activity_logs).
create policy "flashcard_reviews_select_own" on public.flashcard_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "flashcard_reviews_insert_own" on public.flashcard_reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Análises: por cartão, por tópico, por baralho ao longo do tempo.
create index idx_flashcard_reviews_card on public.flashcard_reviews (user_id, card_id, reviewed_at desc);
create index idx_flashcard_reviews_topico on public.flashcard_reviews (user_id, topico);
create index idx_flashcard_reviews_deck_date on public.flashcard_reviews (user_id, deck_id, reviewed_at desc);

-- ============================================================
-- 5. flashcard_study_sessions — agrupa revisões de uma sessão
-- ============================================================
create table public.flashcard_study_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  deck_id         uuid not null references public.flashcard_decks(id) on delete cascade,
  card_target     integer,                   -- "estudar 10 cartões"
  cards_reviewed  integer not null default 0,
  correct_count   integer not null default 0,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz
);

alter table public.flashcard_study_sessions enable row level security;

create policy "flashcard_sessions_select_own" on public.flashcard_study_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "flashcard_sessions_insert_own" on public.flashcard_study_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "flashcard_sessions_update_own" on public.flashcard_study_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "flashcard_sessions_delete_own" on public.flashcard_study_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create index idx_flashcard_sessions_user on public.flashcard_study_sessions (user_id, started_at desc);

-- ============================================================
-- Comentários
-- ============================================================
comment on table public.flashcard_decks is
  'Baralhos de flashcards do usuário (manual, import .apkg/csv ou geração IA). RLS por user_id. Migration 0031.';
comment on table public.flashcards is
  'Cartões: frente/verso em markdown+LaTeX, tags e tópico. Conteúdo é "do aluno" — nunca em log. RLS por user_id.';
comment on table public.flashcard_states is
  'Estado de agendamento SRS (SM-2/Anki) por cartão. Campos stability/difficulty reservados pro FSRS. RLS por user_id.';
comment on table public.flashcard_reviews is
  'Log append-only de revisões — fonte das análises e dataset do FSRS. Guarda rating/tempo/intervalos, nunca conteúdo. RLS por user_id.';
comment on table public.flashcard_study_sessions is
  'Sessões de estudo (agrupa revisões; "estudar N cartões"). RLS por user_id.';
