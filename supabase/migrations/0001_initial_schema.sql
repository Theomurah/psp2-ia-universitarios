-- =============================================================================
-- PSP2 — Mini SaaS de IA para Universitários
-- Migration 0001 — Schema inicial
-- =============================================================================
-- Cria as 8 tabelas do MVP, índices, e habilita Row Level Security em todas.
-- Polices: usuário só vê/altera o que pertence ao próprio user_id.
-- =============================================================================

-- ============================================================
-- Extensões
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- Tipos enum
-- ============================================================
create type document_format as enum ('pdf', 'docx', 'pptx', 'md', 'image');

create type document_tipo as enum (
  'Aula', 'Plano', 'Programa', 'Cronograma', 'Ficha', 'Guia',
  'Resumo', 'Resumão', 'Questionário', 'Estudo Dirigido',
  'Unidade', 'Lista', 'Apostila', 'Cola', 'Outro'
);

create type job_status as enum (
  'pending', 'processing', 'needs_review',
  'completed', 'completed_with_warning', 'failed'
);

create type job_event_type as enum (
  'start', 'success', 'retry', 'warning', 'error'
);

create type generated_content_type as enum (
  'synthesized', 'compressed_compact', 'compressed_cola'
);

create type prompt_category as enum (
  'estudo', 'exercicio', 'redacao', 'revisao'
);

create type feedback_topic as enum (
  'sintese', 'nomenclatura', 'drive', 'prompts', 'outro'
);

-- ============================================================
-- 1. profiles
-- Estende auth.users do Supabase.
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  semestre_atual text,                    -- "2026.1"
  materias jsonb not null default '[]',   -- [{ code: "FISICA3", nome: "Física 3" }, ...]
  drive_root_folder_id text,
  google_refresh_token text,              -- encrypted (rotina externa)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. documents
-- ============================================================
create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  filename_original text not null,
  filename_final text,
  format document_format not null,
  size_bytes bigint not null,
  storage_path text not null,

  drive_file_id text,
  drive_folder_path text,                 -- "2026.1/Física 3"

  -- Resultado da classificação (T09)
  materia_code text,
  tipo document_tipo,
  data_doc date,
  identificador text,
  titulo text,
  classificacao_confianca numeric(3, 2),  -- 0.00 a 1.00

  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_documents_user_id on public.documents(user_id);
create index idx_documents_materia on public.documents(user_id, materia_code);
create index idx_documents_created on public.documents(user_id, created_at desc);

-- ============================================================
-- 3. jobs
-- ============================================================
create table public.jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,

  status job_status not null default 'pending',
  current_step text,                      -- parse | classify | synthesize | ...
  progress_percent smallint not null default 0,
  attempt_count smallint not null default 0,
  error_reason text,

  chars_input integer,
  chars_synthesis integer,
  chars_compression integer,
  cost_usd_total numeric(10, 6) default 0,

  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_jobs_user_id on public.jobs(user_id);
create index idx_jobs_document on public.jobs(document_id);
create index idx_jobs_status on public.jobs(user_id, status);

-- ============================================================
-- 4. job_events
-- Log granular pra debug e dashboard interno.
-- ============================================================
create table public.job_events (
  id bigserial primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  step text not null,
  event_type job_event_type not null,
  message text,
  duration_ms integer,
  llm_model text,
  tokens_input integer,
  tokens_output integer,
  cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);

create index idx_job_events_job on public.job_events(job_id, created_at);

-- ============================================================
-- 5. generated_content
-- ============================================================
create table public.generated_content (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references public.documents(id) on delete cascade,
  type generated_content_type not null,
  markdown text not null,
  metadata jsonb not null default '{}',   -- { topicos, formulas_count, secoes_count, ... }
  validation_score numeric(3, 1),         -- 0.0 a 10.0 (judge)
  created_at timestamptz not null default now(),
  unique (document_id, type)              -- 1 por (doc, tipo)
);

create index idx_generated_doc on public.generated_content(document_id);

-- ============================================================
-- 6. prompt_library
-- Prompts oficiais (user_id NULL) + customizações do aluno.
-- ============================================================
create table public.prompt_library (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,  -- null = oficial
  title text not null,
  description text,
  template text not null,                 -- com placeholders {{materia}}, etc.
  category prompt_category not null,
  is_official boolean not null default false,
  usage_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_prompt_user on public.prompt_library(user_id);
create index idx_prompt_official on public.prompt_library(is_official) where is_official = true;

-- ============================================================
-- 7. user_system_prompts
-- Output principal do produto: prompt personalizado do aluno.
-- ============================================================
create table public.user_system_prompts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt_text text not null,
  semester_snapshot text not null,        -- "2026.1"
  source_documents uuid[] not null default '{}',
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_user_prompts_user on public.user_system_prompts(user_id, is_active);

-- ============================================================
-- 8. feedback
-- ============================================================
create table public.feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  topic feedback_topic not null,
  comments text,
  created_at timestamptz not null default now()
);

create index idx_feedback_user on public.feedback(user_id);

-- ============================================================
-- Triggers — updated_at automático
-- ============================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- Trigger — cria profile automaticamente quando user é criado
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- Regra geral: usuário só acessa o que tem user_id = auth.uid()
-- ============================================================

-- profiles
alter table public.profiles enable row level security;
create policy "profiles_select_own"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = id);

-- documents
alter table public.documents enable row level security;
create policy "documents_all_own"
  on public.documents for all using (auth.uid() = user_id);

-- jobs
alter table public.jobs enable row level security;
create policy "jobs_all_own"
  on public.jobs for all using (auth.uid() = user_id);

-- job_events (leitura via FK do job)
alter table public.job_events enable row level security;
create policy "job_events_select_via_job"
  on public.job_events for select using (
    exists (select 1 from public.jobs j where j.id = job_events.job_id and j.user_id = auth.uid())
  );
-- Service role faz insert via Edge Function — não precisa policy de insert pra usuário.

-- generated_content (leitura via FK do doc)
alter table public.generated_content enable row level security;
create policy "generated_select_via_doc"
  on public.generated_content for select using (
    exists (select 1 from public.documents d where d.id = generated_content.document_id and d.user_id = auth.uid())
  );

-- prompt_library
alter table public.prompt_library enable row level security;
create policy "prompts_select_official_or_own"
  on public.prompt_library for select using (
    is_official = true or auth.uid() = user_id
  );
create policy "prompts_insert_own"
  on public.prompt_library for insert with check (
    auth.uid() = user_id and is_official = false
  );
create policy "prompts_update_own"
  on public.prompt_library for update using (
    auth.uid() = user_id and is_official = false
  );

-- user_system_prompts
alter table public.user_system_prompts enable row level security;
create policy "user_prompts_all_own"
  on public.user_system_prompts for all using (auth.uid() = user_id);

-- feedback
alter table public.feedback enable row level security;
create policy "feedback_all_own"
  on public.feedback for all using (auth.uid() = user_id);

-- ============================================================
-- Realtime — publica tabelas que o frontend escuta
-- ============================================================
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.generated_content;
