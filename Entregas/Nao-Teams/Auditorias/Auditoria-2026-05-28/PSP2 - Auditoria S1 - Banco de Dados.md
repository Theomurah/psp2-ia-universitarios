# PSP2 — Auditoria S1 — Banco de Dados

**Frente:** Banco de dados (Supabase Postgres)
**Responsável sugerido:** Isaac (migrations / DDL) + Theo (decisões de schema / devops)
**Data:** 2026-05-28
**Auditoria anterior:** 2026-05-27 (resolveu A1 backup-doc parcial, A3 status migrations, A5 schema OK, A6 pg_cron deferred, A7 functions documented)

## Objetivo

Reauditar `supabase/migrations/0001-0012` após o ciclo anterior, com foco em:

1. **Drift de enum** entre migrations admin e schema canônico (`job_status`).
2. **Idempotência real** das migrations 0007-0012 contra prod já populado.
3. **Cobertura de índices** vs. queries reais do frontend e RPCs admin.
4. **Documentação espúria** em `PENDENCIAS.md` (objetos que não existem no schema).
5. Roadmap pg_cron (CLAUDE.md) — preparação pra Sprint 2.

## Critério de aceitação

- Toda referência a `jobs.status` em SQL bate com o enum `job_status` canônico.
- Toda migration nova é idempotente (`if not exists`, `drop ... if exists; create ...`).
- Nenhum objeto fantasma em `docs/PENDENCIAS.md` (tudo que está marcado "aplicada" existe de fato).
- Coluna nova com filtro `WHERE` recorrente tem índice (parcial quando aplicável).
- `pg_cron` continua sem migration aplicada — esperado pra Sprint 1.

---

## Achados

### A1 — `status = 'success'` em 3 RPCs admin não bate com enum 🔴
- **Arquivos:** `supabase/migrations/0009_admin_panel.sql:89,91`, `0010_admin_hardening_and_metrics.sql:63,71,80,162,166,168`
- **Dono:** Isaac
- **Categoria:** correção de schema/dados (precisa migration nova)
- **Descrição:** O enum `job_status` definido em `0001_initial_schema.sql:26-29` contém **apenas** `'pending' | 'processing' | 'needs_review' | 'completed' | 'completed_with_warning' | 'failed'`. **Nunca foi `'success'`.** Confirmado contra o código real: `supabase/functions/process-document/index.ts:447` escreve `'completed'`/`'completed_with_warning'`, frontend (`useActivity.ts:95`, `useJobs.ts:146`, `DashboardPage.tsx:103`) filtra `'completed' || 'completed_with_warning'`. As RPCs admin, porém, contam `where status = 'success'` em:
  - `admin_metrics_overview()` — `cards.jobs.success` (sempre 0)
  - `admin_metrics_timeseries(days)` — CTE `jobs_s` (linha "sucessos" do sparkline sempre vazia, `cost_usd` daily sempre 0)
  - `admin_pipeline_breakdown()` — `jobs_success` e `jobs_retried` (sempre 0); `avg_duration_seconds` (sempre 0 porque o filtro `status='success'` zera o agregado)
  - Efeito visível: dashboard `/admin` mostra "0 jobs com sucesso", "custo total $0", apesar de haver jobs `completed` no banco.
- **Causa raiz:** ambíguo entre o enum (definido `completed`) e o vocabulário coloquial ("success") — quem escreveu 0009/0010 não cruzou com 0001. Postgres não dá erro porque o cast `'success'::text` casa com `job_status::text`, retornando 0 rows.
- **Fix:** `0013_fix_job_status_enum_references.sql` substituindo `'success'` por `('completed','completed_with_warning')` em todas as 3 RPCs. Lista de matches abaixo:

```sql
-- jobs.success
where status in ('completed','completed_with_warning')
-- jobs_retried
where attempt_count > 0 and status in ('completed','completed_with_warning')
-- avg_duration_seconds
where status in ('completed','completed_with_warning') and started_at is not null ...
```

- **Validação:** após aplicar, `admin_metrics_overview()->'jobs'->'success'` retorna o valor esperado (`select count(*) from jobs where status like 'completed%'`).

### A2 — `PENDENCIAS.md` documenta objetos que não existem 🟡
- **Arquivo:** `docs/PENDENCIAS.md:121` (linha "0009_admin_panel: tabela `admin_audit_log` + funções de métrica")
- **Dono:** Theo
- **Categoria:** documental (sem migration nova)
- **Descrição:** O ledger de migrations em `PENDENCIAS.md` afirma que `0009` criou tabela `admin_audit_log`. Grep em `supabase/migrations/` por `audit_log` / `record_admin` retorna **0 matches**. A 0009 cria `app_settings` + RPCs `admin_metrics_overview`, `admin_recent_jobs`, `admin_recent_users`, `admin_set_setting` + policies admin em `prompt_library` — não há tabela de audit. A auditoria 2026-05-27 (A7) também menciona `record_admin_action` em 0010 como "presente"; é falso.
- **Fix:** corrigir a linha em `PENDENCIAS.md` pra refletir o conteúdo real de 0009 (`app_settings` + RPCs). Decidir: queremos audit log de ações admin? Se sim, abrir batch separado.
- **Risco:** se a coluna virar requisito de compliance acadêmico ("rastrear quem mudou model_synthesize e quando"), só temos `app_settings.updated_by` + `updated_at` (overwrite, sem histórico).

### A3 — Migration 0012 herdou cabeçalho de 0007 (cosmético, induz confusão) 🟡
- **Arquivo:** `supabase/migrations/0012_archive_documents.sql:2` (`Migration 0007 — Arquivamento de documentos`)
- **Dono:** Isaac
- **Categoria:** documental (sem migration nova — edit in-place)
- **Descrição:** O conteúdo SQL está correto (`alter table documents add column archived_at`), mas o comentário-cabeçalho ainda diz "Migration 0007". Histórico: o arquivo era originalmente `0007_archive_documents.sql`, colidiu com `0007_schema_cleanup.sql`, foi renomeado pra `0012_*` em 27/05 (per `PENDENCIAS.md:126`). O cabeçalho não foi atualizado no rename.
- **Fix:** trocar "Migration 0007" por "Migration 0012" no comment, sem nova migration. Garante self-doc futuro.

### A4 — Cobertura `documents.archived_at` em listagem padrão 🟡
- **Arquivo:** `supabase/migrations/0012_archive_documents.sql:22-24`
- **Dono:** Isaac
- **Categoria:** melhoria de índice
- **Descrição:** A 0012 criou `idx_documents_user_active (user_id, created_at desc) WHERE archived_at IS NULL`. **Falta o simétrico** pra aba "Arquivados": `useJobs.ts:27` faz `q.not('documents.archived_at', 'is', null)` via embed `documents!inner`. Sem índice, qualquer aluno com 100+ docs paga full scan ao abrir a aba. Cardinalidade baixa hoje, mas a coluna **é parte do filtro principal** da view.
- **Fix:** opcional — `create index if not exists idx_documents_user_archived on documents(user_id, archived_at desc) where archived_at is not null;`. Custo: trivial (index parcial só nos archived).
- **Severidade:** 🟡 porque hoje volume é baixo, mas a regra "coluna usada em WHERE recorrente → índice" do critério está descumprida.

### A5 — Filtros do Dashboard (`materia_code`, `tipo`) parcialmente cobertos 🟡
- **Arquivo:** `supabase/migrations/0001_initial_schema.sql:91-93`
- **Dono:** Isaac
- **Categoria:** melhoria de índice
- **Descrição:** `DashboardPage.tsx` filtra documentos por `materia_code` e `tipo` (Sprint 2 vai introduzir filtros UI). Há `idx_documents_materia (user_id, materia_code)` já em 0001 — bom. **Falta `tipo`** (`document_tipo` enum). E não há índice em `data_doc` (usado pra ordenar timeline de aulas).
- **Fix:** quando os filtros UI saírem (Sprint 2), adicionar:
  ```sql
  create index if not exists idx_documents_tipo on documents(user_id, tipo);
  create index if not exists idx_documents_data_doc on documents(user_id, data_doc desc) where data_doc is not null;
  ```
  Não criar agora se a UI ainda não usa — adiar pra evitar bloat. Registrar como follow-up.

### A6 — `source_documents uuid[]` em `user_system_prompts` sem integridade referencial 🟡
- **Arquivo:** `supabase/migrations/0001_initial_schema.sql:187`
- **Dono:** Theo
- **Categoria:** correção de schema (debate de design)
- **Descrição:** `user_system_prompts.source_documents` é `uuid[]` (array Postgres, não tabela de junção). Permite duplicação e **não cascateia**: se um aluno deleta um documento, o id continua no array do prompt como ponteiro morto. `generate-system-prompt/index.ts:94,134` lê e escreve essa coluna direto.
- **Fix proposto:**
  - **Opção A (mínima):** trigger `AFTER DELETE ON documents` que remove o id de todos os arrays `source_documents`. Custo: alto em prompts longos, mas raro.
  - **Opção B (correta):** criar tabela `user_system_prompt_sources (prompt_id uuid, document_id uuid references documents on delete cascade, primary key (prompt_id, document_id))`. Reescreve `generate-system-prompt` pra join.
  - **Decisão:** discutir Theo + Guilherme. Hoje funciona porque archive (soft delete) é o caminho default e o delete hard é raro. Mas é dívida silenciosa.

### A7 — `documents.classificacao_confianca` sem CHECK de range 🟡
- **Arquivo:** `supabase/migrations/0001_initial_schema.sql:85`
- **Dono:** Isaac
- **Categoria:** correção de schema (constraint)
- **Descrição:** `classificacao_confianca numeric(3,2)` aceita qualquer valor entre `-9.99` e `9.99`. O domínio real é `0.00..1.00` (mesmo padrão de `validation_score` em `generated_content`, que também não tem CHECK — aceita -9.9 a 99.9 com `numeric(3,1)`). Risco baixo (LLM sempre devolve em [0,1]), mas viola padrão "constraints declarativas" que 0007 começou a aplicar pra `progress_percent`.
- **Fix:** `0013_*` (mesma migration do A1):
  ```sql
  alter table documents
    add constraint documents_confianca_range
    check (classificacao_confianca is null or classificacao_confianca between 0 and 1);
  alter table generated_content
    add constraint generated_validation_range
    check (validation_score is null or validation_score between 0 and 10);
  ```
- **Risco de aplicação:** se o histórico tiver alguma row fora de range, o ALTER falha. Usar `NOT VALID` + `VALIDATE CONSTRAINT` em duas etapas é o padrão correto pra prod populado.

### A8 — Tabelas `materias` e `prompt_library` realtime não publicadas ✅
- **Status:** OK. `0001:304-306` publica `jobs`, `documents`, `generated_content` no `supabase_realtime`. Frontend usa realtime só nessas três (`useJobs.ts` faz subscribe em `jobs`). `app_settings` e `prompt_library` não precisam (admin recarrega manualmente). Sem ação.

### A9 — `pg_cron` continua sem migration (esperado) 🟢
- **Status:** Roadmap em `CLAUDE.md` lista 4 jobs (watchdog, refresh token, GC events, snapshot métricas). Nenhum aplicado. **Achado novo:** o exemplo de migration no CLAUDE.md usa `attempt_count < 2`, mas **não existe coluna `max_retries` em `jobs`** — só `attempt_count`. O CLAUDE.md também referencia `max_retries` em prosa (`attempt_count < max_retries`). Inconsistência menor pra ajustar quando entrar a migration `0015_pg_cron_watchdog.sql`.
- **Ação:** sem urgência. Quando vier, fixar literal `2` ou adicionar coluna `jobs.max_retries smallint default 2`.

### A10 — pgvector / RAG sem decisão (carrega da auditoria anterior) 🟡
- **Status:** mantido — A4 da auditoria 2026-05-27. Sem mudança. Decisão Guilherme + Theo no início do Sprint 3.

### A11 — Backup/restore documentado? (verificar) 🟡
- **Status:** auditoria anterior listou como A1. Conferência atual: **`docs/backup-restore.md` não existe** (verificado via `ls docs/`). PENDENCIAS.md não menciona. Item pendente da auditoria 2026-05-27 que **não foi feito**. Mantém severidade 🟡.
- **Fix:** criar `docs/backup-restore.md` (procedimento Supabase managed: retention 7d free / 30d pro, `pg_dump`, `supabase db dump --linked`, restore em projeto novo, frequência de teste DR).

---

## Categorização

### Correções de schema (precisam migration nova `0013_*`)
- **A1** 🔴 — `status = 'success'` → `in ('completed','completed_with_warning')` em 3 RPCs
- **A7** 🟡 — CHECK ranges em `classificacao_confianca` e `validation_score`
- **A6** 🟡 — junção `user_system_prompt_sources` (debate de design)

### Melhorias de índice/policy (migrations menores ou follow-ups)
- **A4** 🟡 — índice parcial `documents(user_id, archived_at desc) where archived_at is not null`
- **A5** 🟡 — índices em `documents.tipo` e `documents.data_doc` (Sprint 2)

### Documental / housekeeping (sem migration)
- **A2** 🟡 — corrigir entrada falsa `admin_audit_log` em `PENDENCIAS.md`
- **A3** 🟡 — atualizar cabeçalho `0012_archive_documents.sql`
- **A11** 🟡 — `docs/backup-restore.md` (rolou da auditoria 27/05)

### Decisões pendentes
- **A6** 🟡 — design `source_documents` (Theo + Guilherme)
- **A10** 🟡 — pgvector / RAG (carry-over)

### Sem ação
- **A8** ✅ — realtime OK
- **A9** 🟢 — pg_cron deferred conforme roadmap

---

## Plano de ação (batches)

### Batch B-DB1 — Migration 0013 crítica (3h) 🔴
- A1 — fix `status='success'` em `admin_metrics_overview`, `admin_metrics_timeseries`, `admin_pipeline_breakdown`
- A7 — CHECK ranges em `classificacao_confianca` e `validation_score` (via `NOT VALID` + `VALIDATE`)
- Sanity test: `select admin_metrics_overview()->'jobs'->'success'` retorna número > 0 contra prod com jobs `completed`

### Batch B-DB2 — Housekeeping documental (1h) 🟡
- A2 — corrigir `PENDENCIAS.md` (remover `admin_audit_log`, descrever conteúdo real de 0009)
- A3 — fixar cabeçalho `0012_archive_documents.sql` (in-place, sem nova migration)
- A11 — criar `docs/backup-restore.md`

### Batch B-DB3 — Migration 0014 índices follow-up (2h) 🟡
- A4 — `idx_documents_user_archived`
- A5 — `idx_documents_tipo`, `idx_documents_data_doc` (**condicional** à entrega dos filtros UI no Sprint 2)

### Batch B-DB4 — Decisão `source_documents` (4h) 🟡
- A6 — debate arquitetural Theo + Guilherme. Se Opção B: migration 0015 + reescrita de `generate-system-prompt`.

### Batch B-DB5 — pgvector decision (carry-over) (6h) 🟡
- A10 — A4 da auditoria anterior, sem novidade.

**Total estimado novo trabalho:** ~10h (B-DB1+2+3). +10h se A6+A10 forem destravados nesta sprint.

---

## Validação

- **A1:** depois de aplicar 0013, `select (admin_metrics_overview()->'jobs'->>'success')::int` ≥ `(select count(*) from jobs where status='completed')`.
- **A2:** `grep -i audit_log docs/PENDENCIAS.md` retorna vazio (ou ponteiro explícito "não implementado, ver batch X").
- **A3:** `head -3 supabase/migrations/0012_archive_documents.sql` cita "0012".
- **A4:** `\di+ public.idx_documents_user_archived` existe após 0014; `EXPLAIN` em `select * from documents where user_id=$1 and archived_at is not null order by archived_at desc` usa o index.
- **A7:** `select 1.5::numeric` inserido em `classificacao_confianca` retorna erro `check_violation`.
- **A11:** `docs/backup-restore.md` existe e tem ≥1 restore-test datado.

---

## Dependências

- **B-DB1 é bloqueante** para qualquer demonstração do `/admin` antes da defesa — sem ele os cards mostram 0 e parece bug "do dashboard".
- **B-DB2** é pré-requisito da rubrica de "documentação técnica fidedigna" (PENDENCIAS.md hoje é fonte autoritativa incorreta).
- **B-DB3** depende dos filtros UI do Sprint 2 (Guilherme/Pedro).
- **B-DB4** destrava limpeza correta de docs no Sprint 3 (LGPD reforça eliminação completa).
- **B-DB5** destrava ou descarta RAG (Sprint 3).

---

**Resumo numérico:** 11 achados | 🔴 1 / 🟡 8 / 🟢 1 / ✅ 1 | ~10h críticos + ~10h opcionais | Dono predominante: Isaac (execução), Theo (decisões A2/A6/A10/A11).

**Top 3 críticos:**
1. **A1** 🔴 — métricas `/admin` zeradas por drift de enum (`'success'` ≠ `'completed'`). Visível, embaraçoso, fix de 15 min.
2. **A2** 🟡 — `PENDENCIAS.md` afirma que existe `admin_audit_log` que nunca foi criada — desinforma quem revisar o repo.
3. **A11** 🟡 — DR continua sem documentação (pendente da auditoria 27/05).

**Migrations sugeridas:** `0013_fix_admin_metrics_and_check_ranges.sql` (B-DB1), `0014_indices_documents_followup.sql` (B-DB3, condicional), eventualmente `0015_*` pra A6/A10 conforme decisões.
