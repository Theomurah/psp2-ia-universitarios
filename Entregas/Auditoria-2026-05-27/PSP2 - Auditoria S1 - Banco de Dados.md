# PSP2 — Auditoria S1 — Banco de Dados

**Frente:** Banco de dados (Supabase Postgres)
**Responsável sugerido:** Isaac (migrations) + Theo (decisões de schema/devops)
**Data:** 2026-05-27

## Objetivo

Confirmar que o schema, RLS, FKs e índices estão prontos pra produção, e fechar os gaps documentais (backup/restore, comentários SQL, status de migrations pendentes).

## Critério de aceitação

- Toda FK tem `ON DELETE` explícito
- Toda tabela com `user_id` tem RLS habilitado + policy ownership por operação
- Toda coluna usada em `WHERE` / `ORDER BY` frequente tem índice
- Backup/restore documentado em `docs/`
- Migrations pendentes em prod (0003/0004/0005/0006) têm status claro em `docs/PENDENCIAS.md`

## Achados

### A1 — Backup/restore não documentado 🟡
- **Arquivo:** `docs/` (ausente)
- **Dono:** Theo
- **Descrição:** Não há procedimento documentado pra (a) gerar snapshot do banco, (b) restaurar em ambiente novo, (c) testar restore. Supabase managed faz backup automático, mas o processo de DR (disaster recovery) e RPO/RTO esperados não estão documentados.
- **Fix:** `docs/backup-restore.md` com: política de retenção do Supabase managed, comando `supabase db dump`/`pg_dump`, procedimento de restore, frequência de teste de restore.

### A2 — Migrations 0001/0002 sem `COMMENT` SQL 🟡
- **Arquivos:** `supabase/migrations/0001_initial_schema.sql`, `0002_storage_bucket.sql`
- **Dono:** Isaac
- **Descrição:** Migrations mais recentes (0006+) usam `comment on table` / `comment on column` pra documentar propósito. As primeiras não — a estrutura central (`documents`, `jobs`, `profiles`) fica sem self-doc.
- **Fix:** Migration nova `0013_retroactive_comments.sql` adicionando `comment on table`/`column` retroativos. Sem mudança de schema.

### A3 — Status de 0003/0004/0005/0006 em prod ambíguo 🟡
- **Arquivos:** `supabase/migrations/0003_add_curso_horarios.sql`, `0004_drive_oauth.sql`, `0005_seed_prompt_library.sql`, `0006_security_hardening.sql`
- **Dono:** Theo
- **Descrição:** Per memória do projeto, essas 4 não foram aplicadas em prod. `docs/PENDENCIAS.md` mapeia parcialmente. Sem aplicar 0006, RLS hardening (`to authenticated`, `WITH CHECK`) **não está vigente em produção** — gap silencioso e perigoso.
- **Fix:** Confirmar via `supabase migration list` se aplicadas; se não, aplicar imediatamente (são idempotentes); atualizar `PENDENCIAS.md` com status final.

### A4 — pgvector roadmap sem decisão 🟡
- **Diretório:** `supabase/migrations/`
- **Dono:** Guilherme + Theo
- **Descrição:** RAG aparece como possibilidade em sprints futuros mas não há migration habilitando `pgvector` nem coluna de embedding em `documents`. Decisão (entra no MVP? dim 1536/3072? índice IVFFlat/HNSW?) pendente.
- **Fix:** Decisão arquitetural; se sim, migration nova habilitando extensão + coluna `embedding vector(1536)` + índice.

### A5 — Schema, FKs, índices, RLS, idempotência ✅
- **Status:** OK em 0001-0012.
  - **FKs:** Todas com `ON DELETE` explícito (auditado em 0001, 0003, 0004, 0008, 0009, 0010, 0012)
  - **RLS:** Habilitado nas 10+ tabelas com `user_id`; policies consolidadas em 0011 conforme advisor do Supabase (uma policy permissiva por ação)
  - **Índices:** FKs indexadas (0011 fechou os gaps); `jobs(status, user_id)`, `jobs(user_id, created_at desc)`, `job_events(job_id)`, `documents(user_id)` cobertos
  - **Idempotência:** `create table if not exists`, `drop policy if exists ... ; create policy ...` em todas as migrations relevantes
  - **Ordem:** sem saltos (0001 → 0012, sequencial)

### A6 — pg_cron 🟢
- **Status:** Roadmap em `CLAUDE.md` lista 4 jobs futuros (watchdog jobs presos, refresh proativo de token, limpeza de events antigos, snapshot de métricas). Nenhum aplicado ainda. Sem urgência pra Sprint 1.

### A7 — Triggers/functions documentadas ✅
- **Status:** OK em 0006 (`update_updated_at_column`), 0008 (`is_admin()`), 0010 (`record_admin_action`). `comment on function` presente.

## Plano de ação (batches)

### Batch B-DB1 — Validar/aplicar migrations pendentes em prod (2h)
- A3 — confirmar status, aplicar 0003-0006 se ausentes, atualizar `PENDENCIAS.md`

### Batch B-DB2 — Documentação de DR (4h)
- A1 — `docs/backup-restore.md` + procedimento testado em ambiente staging

### Batch B-DB3 — Migration retroativa de comentários (3h)
- A2 — `0013_retroactive_comments.sql`

### Batch B-DB4 — Decisão pgvector + housekeeping (6h)
- A4 — discussão Guilherme+Theo + (se sim) `0014_enable_pgvector.sql`

**Total:** ~15h. Severidade dominante: 🟡 (documental + housekeeping). 0 itens 🔴.

## Validação

- A1: `docs/backup-restore.md` existe e foi seguido em pelo menos um restore-test documentado (data, autor)
- A2: `\d+ tablename` mostra COMMENT em todas as tabelas core
- A3: `select version, applied from supabase_migrations.schema_migrations` mostra 0001-0012 todas aplicadas; `PENDENCIAS.md` removeu o item das migrations pendentes
- A4: registro de decisão arquitetural em `docs/EXTRAS.md` ou ADR dedicado

## Dependências

- A3 destrava o Sprint 2 (Google Drive depende de 0004 aplicada) — **bloqueante prioritário**
- A4 destrava (ou descarta) RAG no Sprint 3
- A1 + A2 são pré-requisitos pra entrega final do projeto acadêmico (rubrica de "documentação técnica")

---
**Resumo numérico:** 7 achados | 🔴 0 / 🟡 4 / 🟢 3 | ~15h | Dono predominante: Theo (decisões) + Isaac (execução).
