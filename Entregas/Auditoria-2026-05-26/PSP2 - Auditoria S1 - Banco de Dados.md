# PSP2 — Auditoria S1 — Banco de Dados (Supabase Postgres)

**Frente:** Banco de dados / Schema / Migrations / RLS / Performance
**Responsável sugerido:** Isaac (backend) com revisão de Theo (GP/arquitetura)
**Data:** 2026-05-26
**Auditor:** Agente 6 — Banco de Dados
**Escopo auditado:**
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_storage_bucket.sql`
- `supabase/migrations/0003_add_curso_horarios.sql`
- `supabase/migrations/0004_drive_oauth.sql`
- `supabase/migrations/0005_seed_prompt_library.sql`
- `supabase/migrations/0006_security_hardening.sql`
- Código que consome o schema (`supabase/functions/*`, `apps/web/src/hooks/*`)

---

## 1. Objetivo

Verificar se o schema Postgres do PSP2 está pronto para suportar o MVP em uso real (Sprint 1 + 2 já fechadas em código), focando em:

- Consistência de nomenclatura, tipos, constraints e FKs.
- Cobertura de índices nos caminhos quentes (lista de jobs, filtros por matéria, dashboard de métricas).
- RLS habilitado e endurecido em toda tabela com dado de usuário.
- Migrations idempotentes, versionadas e aplicáveis sem ordem ambígua.
- Normalização vs. flexibilidade do `jsonb` (especialmente `profiles.materias`).
- Concorrência no worker (`process-document`) — risco de "double processing".
- Documentação de triggers, funções `SECURITY DEFINER` e procedimento de backup.
- Existência (ou ausência justificada) de `pgvector`, `pg_cron` e estratégia de retry persistida.

## 2. Critério de aceitação

A frente é considerada **aprovada para entrega de Sprint 1** quando:

1. Nenhum 🔴 (bloqueante) em aberto.
2. Todos os 🟡 (alto) com batch atribuído e estimativa.
3. Toda tabela contendo `user_id` (ou FK indireta para `auth.users`) tem **RLS habilitado** com policy `(select auth.uid()) = user_id` e cláusula `TO authenticated` + `WITH CHECK` quando aplicável (já feito em `0006`).
4. Toda coluna usada em `WHERE`/`ORDER BY` na UI ou Edge Functions tem índice (ou justificativa documentada — ex.: tabela < 10k rows).
5. Migrations rodam em sequência sem erro num projeto Supabase virgem (`supabase db push` ou Opção C via SQL Editor).
6. Backup automático do Supabase está documentado no projeto (mesmo que seja apenas "Pro plan PITR" ou "exportar diariamente via cron externo").
7. Pipeline assíncrono (`process-document`) tem mecanismo que impede 2 execuções concorrentes do mesmo `job_id` OU está documentada a aceitação do risco.

## 3. Conteúdo — Achados

> **Legenda:** 🔴 Bloqueante (corrigir antes de fechar Sprint) · 🟡 Alto (até o fim da Sprint 2) · 🟢 Médio/baixo (backlog)
>
> **Separação:** achados marcados com `[SCHEMA]` exigem nova migration (DDL). Achados `[POLICY]` ou `[INDEX]` podem entrar em migration menor sem impacto em código. Achados `[CODE]` exigem mudança na Edge Function/hook, não em migration.

### 3.1 Schema — tipos, constraints e FKs

#### A1 — 🟢 [SCHEMA] `attempt_count` existe mas nunca é incrementado
- **Onde:** `supabase/migrations/0001_initial_schema.sql:106` declara `attempt_count smallint not null default 0`; varredura em `supabase/functions/process-document/index.ts` não encontra nenhum `attempt_count: ` num `update`.
- **Por quê:** a coluna foi modelada pensando em retry persistido, mas o pipeline atual (linha 165 e 368) sempre faz update do `status` sem mexer no contador. Resultado: o campo é inútil hoje, e qualquer dashboard que filtre "jobs com várias tentativas" mostra 0.
- **Dono sugerido:** Isaac
- **Estimativa:** 1h (incrementar no `setStep` ou no `fail` + teste)

#### A2 — 🟡 [SCHEMA] `documents.materia_code` é `text` solto, sem FK
- **Onde:** `0001_initial_schema.sql:80` declara `materia_code text`. Os "valores válidos" vivem no jsonb `profiles.materias[].code` (ver comentário em `0003_add_curso_horarios.sql:48`).
- **Risco:** classificação pode salvar `"FIS3"` num documento enquanto o profile só tem `"FISICA3"`. Joins/filtros (`DashboardPage.tsx:60`, `useUserMetrics`) silenciosamente perdem matches. Não há trigger que valide.
- **Trade-off conhecido:** normalizar exige criar tabela `subjects(user_id, code, nome, ...)` + migrar dados. Custa esforço, mas elimina inconsistência. Para Sprint 1 (poucos usuários piloto) o risco é aceitável; para Sprint 3 (validação com 20+ alunos) é preocupante.
- **Dono sugerido:** Theo (decisão arquitetural) + Isaac (implementação)
- **Estimativa:** 4h (criar tabela + FK + script de backfill)

#### A3 — 🟡 [SCHEMA] `user_system_prompts.source_documents uuid[]` denormaliza relação
- **Onde:** `0001_initial_schema.sql:187` usa `uuid[]` em vez de tabela de junção. `generate-system-prompt/index.ts:115-125` preenche o array sem FK enforcement.
- **Risco:** se um documento for deletado (cascade do user funciona, mas delete individual NÃO), o UUID fica órfão no array. Não há `ON DELETE` para `uuid[]`.
- **Quando fica crítico:** quando o aluno apagar documento individualmente (não previsto no MVP, mas previsto na LGPD via `delete_my_account` — esse caso está coberto pelo cascade global).
- **Recomendação:** documentar como dívida técnica ou criar tabela `user_system_prompt_sources(prompt_id, document_id)` com FK.
- **Dono sugerido:** Isaac
- **Estimativa:** 2h (tabela de junção + migração de dados) ou 0h (aceitar dívida e documentar)

#### A4 — 🟢 [SCHEMA] `profiles.google_refresh_token` / `google_access_token` em `text` simples
- **Onde:** `0001_initial_schema.sql:58` e `0004_drive_oauth.sql:15`. O comentário em `0001:58` diz "encrypted (rotina externa)", mas não há rotina, trigger ou extensão `pgcrypto` aplicada nessas colunas.
- **Risco:** se a service_role key vazar ou alguém tirar um dump do banco, tokens OAuth do Google ficam expostos em texto claro.
- **Atenuação atual:** `export_user_data()` em `0006:283` já filtra essas colunas via `- 'google_access_token' - 'google_refresh_token'`. RLS impede leitura via JWT. Apenas service_role lê.
- **Recomendação:** documentar como aceitável para o MVP (Supabase já criptografa em repouso). Se for endurecer, usar `pgsodium` ou criptografar no app antes de salvar.
- **Dono sugerido:** Theo (decisão) + Isaac
- **Estimativa:** 0h (aceitar) ou 4h (`pgsodium` + rewrite das duas Edge Functions que leem)

#### A5 — 🟢 [SCHEMA] `feedback.job_id` usa `ON DELETE SET NULL`, ok, mas sem `NOT NULL` no original
- **Onde:** `0001_initial_schema.sql:201`. Comportamento correto (preserva feedback histórico mesmo se job for apagado), mas como `job_id` é nullable, nada impede o frontend de inserir feedback sem job associado. O check `rating between 1 and 5` está ok.
- **Recomendação:** adicionar comentário SQL explicando que `job_id NULL = feedback geral não atrelado a job`. Sem mudança de schema.
- **Estimativa:** 15min

---

### 3.2 Índices — caminhos quentes da UI

#### B1 — 🟡 [INDEX] `job_events` sem índice composto para `(jobs.user_id, created_at)` via FK
- **Onde:** `useActivity.ts:40-47` faz `from('job_events').select(... jobs!inner(...)).order('created_at', desc).limit(200)`. O índice atual `idx_job_events_job on (job_id, created_at)` ajuda parcialmente, mas o planner ainda precisa fazer join para filtrar via `jobs.user_id`.
- **Risco:** quando job_events cresce (cada doc gera ~10 eventos), a tela `/atividade` fica lenta.
- **Mitigação possível:** denormalizar `user_id` em `job_events` (com trigger que copia do `jobs`), ou aceitar performance atual (RLS já filtra com `exists` em `0006:88`).
- **Dono sugerido:** Isaac
- **Estimativa:** 2h (medir EXPLAIN antes; só denormalizar se necessário)

#### B2 — 🟢 [INDEX] `user_system_prompts.is_active` sem índice — query mais comum é `where user_id=X and is_active=true`
- **Onde:** índice atual `idx_user_prompts_user on (user_id, is_active)` em `0001:193` — **já existe e é composto correto**. Falso alarme, está coberto.
- **Status:** ✅ ok.

#### B3 — 🟢 [INDEX] `feedback.created_at` sem índice descendente
- **Onde:** `0001:208` cria só `idx_feedback_user(user_id)`. Se algum admin/dashboard interno listar feedback por data, faltará índice.
- **Recomendação:** não criar agora; aguardar uso real.
- **Estimativa:** 30min se precisar.

#### B4 — 🟡 [INDEX] `documents.processed_at` sem índice — usado em `generate-system-prompt`
- **Onde:** `generate-system-prompt/index.ts:121` faz `.eq('user_id', user.id).not('processed_at', 'is', null).order('processed_at', desc).limit(N)`. O índice `idx_documents_created on (user_id, created_at desc)` em `0001:93` **não** é equivalente — `processed_at` é diferente de `created_at`.
- **Risco:** escaneamento da partição do user inteira a cada chamada de `generate-system-prompt`. Como a função é raramente chamada (1x por geração), risco baixo; mas o índice é barato.
- **Recomendação:** criar `idx_documents_processed on (user_id, processed_at desc) where processed_at is not null`.
- **Dono sugerido:** Isaac
- **Estimativa:** 30min

---

### 3.3 RLS — cobertura e qualidade

#### C1 — ✅ Cobertura geral
- Todas as 9 tabelas com dado de usuário (`profiles`, `documents`, `jobs`, `job_events`, `generated_content`, `prompt_library`, `user_system_prompts`, `feedback`, `user_consents`) têm RLS habilitado. Cross-check com Agente 3 (Segurança) recomendado, mas a base está sólida.
- A migration `0006_security_hardening.sql` aplicou `(select auth.uid())` wrapper (perf), `TO authenticated` (defesa em profundidade), e `WITH CHECK` separado por operação. Boa prática.

#### C2 — 🟢 [POLICY] `prompt_library` não tem `delete_own` policy original — `0006:135` corrige
- **Status:** ✅ já corrigido em `0006_security_hardening.sql:135-138`.

#### C3 — 🟡 [POLICY] `job_events` não tem policy de `INSERT` — só service_role insere
- **Onde:** `0001:267` tem comentário "Service role faz insert via Edge Function — não precisa policy de insert pra usuário." Isso é tecnicamente correto: service_role bypassa RLS.
- **Risco menor:** se um dia o time decidir permitir o usuário criar eventos manualmente (ex.: marcar revisão), falta a policy. Não bloqueia.
- **Recomendação:** manter. Adicionar comentário SQL mais visível (não só num comentário inline).

#### C4 — 🟢 [POLICY] `user_consents` não permite DELETE
- **Onde:** `0006:230-262` tem select/insert/update mas não delete. Intencional? Provavelmente sim (LGPD pede revogar via `revoked_at`, não apagar histórico).
- **Recomendação:** adicionar comentário explicando que delete é intencional ausente.
- **Estimativa:** 15min

#### C5 — 🟡 [POLICY] Storage bucket — policies de upload/select/delete OK, mas falta UPDATE
- **Onde:** `0002_storage_bucket.sql:13-34` tem insert/select/delete. Não tem update.
- **Risco:** se algum dia precisar atualizar metadata do objeto (raro), vai falhar silenciosamente. Atualmente ninguém atualiza objetos no Storage — só sobrescreve via insert.
- **Recomendação:** opcional; só adicionar se aparecer caso de uso.

---

### 3.4 Concorrência e worker

#### D1 — 🔴 [CODE] Worker `process-document` não tem proteção contra dupla execução do mesmo `job_id`
- **Onde:** `process-document/index.ts:139-149` (`runPipeline`) começa direto com `update status='processing'` sem checar se já está processando. `ingest-document/index.ts:111-121` dispara via `EdgeRuntime.waitUntil(fetch(...))` — se o user retentar o upload (ou houver retry HTTP do client), o mesmo `job_id` pode ser disparado 2x.
- **Risco real:** dois pipelines competem; ambos salvam `generated_content` (constraint `unique(document_id, type)` em `0001:154` causa erro no segundo, mas só DEPOIS de gastar tokens LLM novamente). Custo duplo + telemetria confusa + risco de race no `update`.
- **O que falta:** seleção do job com `for update skip locked` (impossível com supabase-js puro, exigiria RPC) OU um `update jobs set status='processing' where id=$1 and status='pending'` com check de `rowCount` antes de continuar. Esta segunda opção é trivial em supabase-js.
- **Dono sugerido:** Isaac
- **Estimativa:** 2h (mudar `setStep` inicial para condicional + teste de regressão)
- **Severidade 🔴 porque:** cada execução custa dinheiro real (LLM) e o erro só aparece em produção sob carga.

#### D2 — 🟡 [SCHEMA] `progress_percent` é `smallint` sem CHECK
- **Onde:** `0001:105` — nada impede de salvar -3 ou 999.
- **Recomendação:** adicionar `check (progress_percent between 0 and 100)`.
- **Dono sugerido:** Isaac
- **Estimativa:** 30min (migration nova)

---

### 3.5 Migrations — qualidade e idempotência

#### E1 — ✅ Idempotência
- `0003`, `0004`, `0005` usam `if not exists` / `delete from ... where is_official=true` antes de inserir. `0006` faz `drop policy if exists` antes de recriar. Bom padrão.
- `0001` e `0002` **não** são idempotentes (não usam `if not exists` em `create table`). Aceitável: rodam só 1x num projeto novo.

#### E2 — 🟢 [DOC] Migrations 0003-0006 ainda não aplicadas em produção
- **Fonte:** auto-memória do user (`project_migrations_pendentes.md`).
- **Recomendação:** documentar no `PENDENCIAS.md` ou criar um `MIGRATIONS_STATUS.md` com checklist por ambiente (dev local / staging / prod).
- **Dono sugerido:** Theo
- **Estimativa:** 30min

#### E3 — 🟢 [DOC] Instruções de aplicação repetidas em 0003-0005
- O bloco "COMO APLICAR ESTA MIGRATION" em `0003:11-39` é copiado em `0004` e `0005`. Não é problema, mas vira ruído. Sugestão: mover para um `supabase/migrations/README.md` e linkar.
- **Estimativa:** 1h

---

### 3.6 Funcionalidades opcionais — pgvector, pg_cron, backup

#### F1 — ✅ pgvector ausente — correto para o MVP
- Nenhuma migration habilita `pgvector`. A documentação (`docs/PENDENCIAS.md:17,63-77`) menciona RAG apenas como referência teórica do artigo ENEGEP, não como feature implementada.
- **Status:** ✅ ok. Se RAG entrar em Sprint 4+, criar migration própria com `create extension vector` e dimensão definida (1536 para OpenAI ada-002, 768 para outros).

#### F2 — 🟡 [INFRA] pg_cron não usado — nenhum job recorrente registrado
- Nenhuma migration usa `cron.schedule`. Casos onde seria útil:
  - Refresh proativo de `google_access_token` (atualmente refresh é on-demand em `connect-drive`).
  - Limpeza de `job_events` antigos (tabela cresce indefinidamente).
  - Snapshot de métricas para um dashboard agregado.
- **Recomendação:** não bloqueante; documentar no roadmap.
- **Dono sugerido:** Theo
- **Estimativa:** 30min (documentar) ou 2-4h (implementar limpeza)

#### F3 — 🔴 [DOC] Estratégia de backup/restore não documentada no repo
- Não há `BACKUP.md`, `RUNBOOK.md` ou seção em README cobrindo:
  - Qual plano Supabase está sendo usado (Free = sem PITR, Pro = 7d PITR).
  - Procedimento manual de export (`pg_dump` via `supabase db dump`).
  - Quem executa backup, com qual frequência, onde guarda.
  - Procedimento de restore num cenário de incidente.
- **Risco:** Sprint 3 vai testar com alunos reais. Se houver perda de dado (deleção acidental, bug de migration), não há plano.
- **Dono sugerido:** Theo
- **Estimativa:** 2h (documentar) + decisão de upgrade de plano se necessário.
- **Severidade 🔴 porque:** zero documentação de backup é risco operacional em qualquer projeto que vai pra usuário real.

---

### 3.7 Functions/Triggers — documentação e segurança

#### G1 — ✅ search_path seguro em functions SECURITY DEFINER
- `0006:194-221` e `0006:271-354` aplicam `set search_path = ''` em todas as funções `SECURITY DEFINER`. Previne schema hijacking. Boa prática moderna.

#### G2 — ✅ Triggers documentadas com `comment on`
- Comentários SQL em `0003:45-49`, `0004:19-29` documentam shape esperado. Bom para devs futuros.

#### G3 — 🟢 [DOC] `handle_new_user` não está documentado fora do código
- **Onde:** `0001:227-237` cria trigger que insere `profile` quando user é criado em `auth.users`. Migração 0006 reescreve com `search_path = ''`. Não há doc explicando "se você dropar essa trigger, signup quebra silenciosamente".
- **Recomendação:** adicionar `comment on function public.handle_new_user is '...'`.
- **Estimativa:** 15min

#### G4 — 🟢 [POLICY] `export_user_data()` é `stable` mas chama `now()` — em rigor `now()` é estável dentro de uma transação, então `stable` é correto. ✅ ok.

---

## 4. Plano de ação — Batches

### 🔴 Batch DB-S1-CRIT (Sprint 1 — bloqueante) — Total: 4h
| ID | Item | Dono | Horas |
|----|------|------|-------|
| D1 | Proteção contra dupla execução de `job_id` no worker | Isaac | 2h |
| F3 | Documentar estratégia de backup/restore | Theo | 2h |

### 🟡 Batch DB-S2-HIGH (Sprint 2 — alta prioridade) — Total: 11h
| ID | Item | Dono | Horas |
|----|------|------|-------|
| A2 | Decidir e (se ok) criar tabela `subjects` com FK | Theo + Isaac | 4h |
| A3 | Decidir junção `user_system_prompt_sources` ou aceitar dívida | Isaac | 2h |
| B1 | Medir EXPLAIN de `useActivity` e denormalizar `user_id` em `job_events` se necessário | Isaac | 2h |
| B4 | Índice `idx_documents_processed` | Isaac | 0.5h |
| C5 | Avaliar policy UPDATE no storage bucket | Isaac | 0.5h |
| D2 | CHECK `progress_percent between 0 and 100` | Isaac | 0.5h |
| F2 | Documentar futuro uso de pg_cron | Theo | 0.5h |
| A4 | Decidir criptografia de tokens OAuth (aceitar ou implementar) | Theo + Isaac | 1h decisão |

### 🟢 Batch DB-S3-LOW (Sprint 3 — backlog) — Total: 4h
| ID | Item | Dono | Horas |
|----|------|------|-------|
| A1 | Incrementar `attempt_count` no worker | Isaac | 1h |
| A5 | Comentário SQL em `feedback.job_id` | Isaac | 0.25h |
| C3 | Comentário mais visível em `job_events` sobre falta de insert policy | Isaac | 0.25h |
| C4 | Comentário em `user_consents` sobre ausência intencional de DELETE | Isaac | 0.25h |
| E2 | `MIGRATIONS_STATUS.md` por ambiente | Theo | 0.5h |
| E3 | Consolidar instruções de aplicação num README | Theo | 1h |
| G3 | `comment on function handle_new_user` | Isaac | 0.25h |
| B3 | Índice `feedback(user_id, created_at desc)` — só se virar gargalo | — | 0.5h |

---

## 5. Validação

Critérios objetivos para considerar o trabalho desta frente entregue:

1. **D1** validado por teste de integração que dispara `process-document` duas vezes no mesmo `job_id` e verifica que somente uma execução completa (a segunda retorna early sem custo LLM).
2. **F3** validado por documento `BACKUP.md` na raiz ou em `docs/` cobrindo: plano Supabase, frequência, comando exato de dump, local de armazenamento, procedimento de restore.
3. Para cada 🟡 com índice/migration nova: rodar `supabase db push` em projeto Supabase local virgem, sem erro. Confirmar via `supabase db diff` que não há drift.
4. Cross-check com Agente 3 (Segurança) sobre RLS de `user_consents` e `prompt_library`.
5. Re-rodar a auditoria após o batch DB-S1-CRIT (sanity check para garantir que correção de D1 não introduziu regressão).

## 6. Dependências

- **Agente 3 (Segurança):** confirmar avaliação de RLS, especialmente `user_consents` (LGPD) e tratamento de tokens OAuth (A4).
- **Agente 4 (Backend / Edge Functions):** D1 (dupla execução) toca diretamente em `process-document`. Combinar com a frente de Edge Functions para evitar conflito de PR.
- **Agente 5 (Frontend):** A2 (tabela `subjects`) afeta `DashboardPage.tsx`, `useUserMetrics`, `AtividadePage.tsx`. Se decidir implementar, alinhar com Pedro.
- **Agente 7 (Operação / DevOps):** F3 (backup) e F2 (pg_cron) podem virar trabalho de infra.
- **Decisão de Theo:** trade-offs A2, A3, A4 — todos são "aceitar dívida vs. investir agora". Não há resposta única; depende da meta de Sprint 3 (validação com alunos reais).
