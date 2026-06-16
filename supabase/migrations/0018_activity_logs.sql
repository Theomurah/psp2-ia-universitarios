-- =============================================================================
-- Migration 0018 — activity_logs: trilha durável de logs estruturados do app
-- =============================================================================
-- Origem: porta o modelo de observabilidade do app irmão (Kawi) pro PSP2.
-- Hoje os logs do frontend morrem no console do browser (efêmeros) e os das
-- Edge Functions têm retenção curta no Supabase Logs. Esta tabela dá um sink
-- DURÁVEL e consultável via SQL — base pro futuro painel /admin/logs e pra
-- auditoria das ações administrativas (scope='admin').
--
-- O logger do frontend (apps/web/src/lib/log.ts) persiste aqui de forma
-- não-bloqueante (fire-and-forget) os eventos info+ que passam pelo threshold.
-- Schema espelha o registro emitido pelo logger: { ts, level, scope, evt, ...fields }.
--
-- Append-only: NÃO há policy de update/delete — logs são imutáveis. A limpeza
-- de registros antigos (> 90 dias) entra como pg_cron numa migration futura,
-- junto com o watchdog/cleanup já previsto no roadmap (CLAUDE.md).
-- =============================================================================

create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  level       text not null check (level in ('debug', 'info', 'warn', 'error')),
  scope       text,                       -- módulo/feature (ex: 'upload', 'auth', 'admin')
  evt         text not null,              -- nome curto do evento (ex: 'upload_failed')
  request_id  text,                       -- correlação ponta-a-ponta de uma sessão/fluxo
  fields      jsonb,                      -- campos já sanitizados pelo logger (sem PII/segredo)
  created_at  timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

-- Usuário só insere log pra si mesmo (defesa em profundidade junto do logger).
create policy activity_logs_insert_own on public.activity_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Usuário lê os próprios logs.
create policy activity_logs_select_own on public.activity_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Admin lê tudo (pro painel /admin/logs). is_admin() já existe (0010/0015).
-- (select ...) evita reavaliação por linha — mesmo padrão do CLAUDE.md.
create policy activity_logs_select_admin on public.activity_logs
  for select to authenticated
  using ((select public.is_admin()));

-- Consulta quente: "logs do usuário X, mais recentes primeiro".
create index if not exists idx_activity_logs_user_date
  on public.activity_logs (user_id, created_at desc);

-- Filtro por severidade no painel (ex: só errors da última semana).
create index if not exists idx_activity_logs_level_date
  on public.activity_logs (level, created_at desc);

-- Filtro por origem (ex: todas as ações scope='admin').
create index if not exists idx_activity_logs_scope_date
  on public.activity_logs (scope, created_at desc);

comment on table public.activity_logs is
  'Trilha durável de logs estruturados do app (frontend + edge). Append-only, RLS por user_id + leitura admin via is_admin(). Populada pelo logger lib/log.ts. Origem: porta do modelo Kawi, 2026-06-01.';
