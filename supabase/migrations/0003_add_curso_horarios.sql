-- =============================================================================
-- PSP2 — Migration 0003
-- Adiciona campos do onboarding: curso e horarios das matérias.
-- =============================================================================
-- [extra] Onboarding pós-cadastro: aluno informa curso + horários de cada
-- matéria. Os horários ficam no jsonb `materias.horarios` (array), pra evitar
-- criar uma tabela separada e manter o schema flexível.
-- =============================================================================
--
-- COMO APLICAR ESTA MIGRATION
-- ---------------------------
--
-- Opção A — Projeto Supabase na nuvem (recomendado em dev/prod):
--
--   1. Linkar o repo ao projeto (uma única vez):
--        supabase link --project-ref <seu-project-ref>
--      (o project-ref aparece na URL do dashboard: app.supabase.com/project/<ref>)
--
--   2. Aplicar todas as migrations pendentes:
--        supabase db push
--
-- Opção B — Supabase rodando localmente (precisa do Docker/Postgres local):
--
--   1. Subir o stack local primeiro:
--        supabase start
--
--   2. Rodar as migrations:
--        supabase migration up
--
-- Opção C — Manual via SQL Editor (mais rápido pra quem só quer rodar uma vez):
--
--   1. Abra https://app.supabase.com/project/<ref>/sql/new
--   2. Copie e cole TODO o bloco SQL abaixo (a partir de `alter table`)
--   3. Clique em "Run"
--
-- O erro `dial tcp 127.0.0.1:54322: connect: connection refused` significa que
-- você rodou `supabase migration up` sem ter o Supabase local rodando.
-- Use a Opção A ou C.
-- =============================================================================

alter table public.profiles
  add column if not exists curso text;

-- Comentários para documentar o shape esperado do jsonb (informativo, não enforced).
comment on column public.profiles.curso is
  'Curso do aluno (ex: "Engenharia de Produção"). Coletado no onboarding.';

comment on column public.profiles.materias is
  'Array de matérias: [{ code: "FISICA3", nome: "Física 3", profs?: string[], horarios?: Array<{ dia: "seg"|"ter"|...|"sab", inicio: "HH:MM", fim: "HH:MM" }> }]';
