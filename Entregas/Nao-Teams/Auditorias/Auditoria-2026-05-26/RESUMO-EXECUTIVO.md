# PSP2 — Auditoria 2026-05-26 — Resumo Executivo

**Data:** 2026-05-26
**Branch auditada:** `feature/sprint1-finalization` (HEAD `991fd90`)
**Auditores:** 6 agentes Claude Opus em paralelo, cada um focado em uma frente
**Coordenador:** Theo (GP/arquitetura)
**Escopo:** repositório PSP2 — Mini SaaS de IA para Universitários (UnB, 2026.1)

---

## 1. Síntese por frente

### Agente 1 — Bugs e lacunas funcionais
25 itens (4 🔴, 14 🟡, 7 🟢) · ~43 h efetivas · dono predominante **Isaac** (~22 h). Críticos concentrados no pipeline assíncrono em `process-document/index.ts`: `started_at` é sobrescrito a cada `setStep` quebrando métricas de SLO; o status `needs_review` existe no enum/UI mas o pipeline nunca atribui apesar dos `TARGETS` em `constants.ts`; `validateJudge` (camada 4 de validação T25) está implementada em `_shared/validation.ts:198` sem nenhum call site; e `compressed_cola` é declarado em enum + UI + modelo mas o pipeline só gera `compacta`. Há ainda 3 fluxos órfãos sérios (`connect-drive`, `generate-system-prompt`, tabela `feedback`) marcados como prontos na backlog sem caminho até o aluno — H6 e "system prompt pessoal" estão mentindo. Severidade dominante 🟡. Batch 1 (críticos do pipeline, 7 h) bloqueia o fechamento honesto do Sprint 1.

### Agente 2 — Código morto e não utilizado
9 itens (0 🔴, 6 🟡, 3 🟢) · ~6 h efetivas (2,1 h de pura deleção) · dono predominante **Theo** (4 itens — arquitetura/branches). **Pode deletar agora:** Tailwind/PostCSS/Autoprefixer órfãos em `apps/web/package.json` (sem config nem `@apply`), `ClaudeVisionProvider`/`GeminiVisionProvider` em `_shared/vision/` (factory sempre retorna OpenRouter), helper `extractWithFallback` sem callers, 6 tipos exportados sem uso em `packages/shared/src/types.ts`, const `SLO`, branch remota `feature/sprint1-pipeline` (já em main), e branch `dev` divergente. **Em rota de uso (NÃO deletar):** `connect-drive` e `generate-system-prompt` estão deployadas mas sem caller frontend — overlap explícito com Agente 1 (B2, B3) e indicador real de que Sprint 2 fechou backend-only. Tabela `feedback` é schema-first para H10 Sprint 3. Nenhum 🔴.

### Agente 3 — Segurança
13 achados (3 🔴, 5 🟡, 4 🟢) + 22 itens conferidos OK (chave LLM nunca no front, sem JWT no histórico do git, RLS em todas as 8 tabelas, CORS whitelist, Zod em bodies, OAuth `drive.file` mínimo, `verify_jwt` default ativo, CodeQL + `npm audit high` no CI). ~26 h · dono predominante **Isaac**. Críticos: **S-10** migrations 0003–0006 não aplicadas em prod (todo hardening da `0006` só existe em arquivo — `supabase db push` resolve em 30 min); **S-01** tokens OAuth Google em texto plano em `profiles.google_refresh_token`/`google_access_token` (comentário promete "encrypted" mas não tem rotina); **S-04** prompt injection latente — input do aluno concatenado direto nos prompts em `pipeline.ts:50,114,171` sem sandbox. Postura geral é **boa** — `0006_security_hardening.sql` entregou hardening sério.

### Agente 4 — Observabilidade e logging
11 itens (2 🔴, 7 🟡, 2 🟢) · ~25 h bloqueantes (OBS-1 a OBS-5) · distribuído entre **Pedro/Isaac/Guilherme**. Base não é zero: `errorResponse` em `_shared/http.ts:32` impede vazar detalhes no body, e `runPipeline()` grava transições em `public.job_events` com `step`/`model`/`tokens`/`cost`/`duration_ms`. Críticos: **A1** frontend sem `ErrorBoundary` nem handlers `window.onerror`/`unhandledrejection` (qualquer throw vira tela branca em demo); **A2** ausência total de `request_id` entre frontend → Edge Function → `job_events` → OpenRouter, tornando debug de incidente reportado por aluno em arqueologia. Logs em texto livre (não JSON), Edge Functions só logam no `catch`, e wrapper OpenRouter (`_shared/openrouter.ts`) não loga modelo/latência/tokens/retry. PII e tokens **nunca** são logados — confirmado.

### Agente 5 — Testes e qualidade
20 itens mapeados (3 🔴, 11 🟡, 6 🟢) · ~63 h em 4 batches · distribuído entre 4 devs. **Linha de base verde:** 140 testes / 14 suítes em 1,74 s, `typecheck` e `lint` passam, CI roda build+test+typecheck+`npm audit`+CodeQL. Cobertura forte em `_shared/{parsers,chunking,validation,prompts,system-prompt,openrouter,drive/*}` e schemas. **Lacunas 🔴 P1:** (1) frontend tem **zero testes** — `apps/web/src/**` está fora do `vitest.config.ts:include`; (2) os 4 handlers `index.ts` das Edge Functions (920 LoC, `process-document` sozinha tem 462) não têm teste de contrato; (3) inexiste teste E2E do pipeline async. Dos 10 critérios de aceitação codificáveis da Sprint 1, só T13 (parsers) e parcialmente T15 têm teste — T12/T14/T16/T18–T21 dependem de smoke manual ainda não documentado. CI roda lint+test mas sem `--coverage`, e `deploy-functions.yml` não depende de CI verde.

### Agente 6 — Banco de dados
18 itens (2 🔴, 8 🟡, 8 🟢) · ~19 h em 3 batches · dono predominante **Isaac**. Schema sólido: 9 tabelas com RLS habilitado, migration `0006` aplicou `(select auth.uid())` + `TO authenticated` + `WITH CHECK` separado, funções `SECURITY DEFINER` com `search_path = ''`, LGPD coberta. Críticos: **D1** worker `process-document` não previne dupla execução do mesmo `job_id` — `EdgeRuntime.waitUntil` + retry HTTP pode cobrar LLM 2× (custo financeiro real); **F3** estratégia de backup/restore não documentada em lugar nenhum. Altos 🟡: `documents.materia_code` é `text` solto sem FK (risco de inconsistência com `profiles.materias` jsonb), `user_system_prompts.source_documents uuid[]` denormalizado, falta CHECK em `progress_percent`, falta índice em `documents.processed_at`. pgvector ausente está correto (RAG só citado no artigo); pg_cron não usado — documentar como roadmap.

---

## 2. Top 5 itens críticos globais (ordenados por bloqueio de sprint)

1. 🔴 **Migrations 0003–0006 não aplicadas em prod** (Agente 3 · S-10 + Agente 6 · E2 + memória do Theo) — todo o hardening RLS, LGPD baseline (`user_consents`, `export_user_data`, `delete_my_account`), seed do `prompt_library` e colunas OAuth do Drive só existem em arquivo. Sem isso, `recordConsent` falha silenciosa, `prompt_library` fica vazia, e qualquer release pública está rodando policies mais permissivas. **Dono: Theo · 30 min · ROI altíssimo.**
2. 🔴 **Worker `process-document` sem proteção contra dupla execução** (Agente 6 · D1) — `EdgeRuntime.waitUntil` + retry do client → 2 pipelines competem no mesmo `job_id`, ambos chamam LLM (custo $$ dobrado), o segundo só quebra no `unique(document_id, type)` após gastar tokens. Fix: `update jobs set status='processing' where id=$1 and status='pending'` e checar `rowCount`. **Dono: Isaac · 2 h.**
3. 🔴 **Pipeline assíncrono com 4 features marcadas "feitas" sem código no path** (Agente 1 · A1+A2+A3+A4) — `started_at` sobrescrito (métricas de SLO falsas), `needs_review` nunca atribuído (UX prometida não acontece), `validateJudge` sem caller (T25 mentindo), `compressed_cola` nunca gerado (T10/T23 incompletos). Tudo concentrado em `process-document/index.ts`. **Dono: Isaac + Guilherme · 7 h.** Bloqueia fechamento honesto da Sprint 1 e nota de avaliação se prof testar.
4. 🔴 **Frontend sem `ErrorBoundary` nem handler global** (Agente 4 · A1) — qualquer exception em `DashboardPage`/`OnboardingPage`/`SettingsPage` derruba o app inteiro pra tela branca, sem fallback nem log. Risco direto à demo da entrega final (09/07). **Dono: Pedro · 2 h.**
5. 🔴 **Backup/restore não documentado** (Agente 6 · F3) — zero `BACKUP.md`/`RUNBOOK.md` em todo o repo. Sprint 3 vai testar com alunos reais; sem plano, perda acidental de dado mata demo do dia. **Dono: Theo · 2 h.**

**Item de bônus** que apareceu em 3 frentes diferentes e merece destaque: 🔴 **tokens OAuth do Google em texto plano** em `profiles.google_refresh_token`/`google_access_token` (Agente 3 · S-01 + Agente 6 · A4). Comentário promete encryption que não existe. Risco direto pro discurso de LGPD no artigo ENEGEP. Isaac · 4–6 h (pgsodium ou app-side crypto).

---

## 3. Conflitos / sobreposições entre frentes

| Sobreposição | Agentes | Resolução sugerida |
|---|---|---|
| Tokens OAuth Google em texto plano | 3 (S-01) ∩ 6 (A4) | Tratar como um único batch P1 — decisão do Theo "aceitar dívida vs pgsodium". |
| `connect-drive` e `generate-system-prompt` deployadas sem caller frontend | 1 (B2, B3) ∩ 2 (B1, B2) | Não é código morto — é "Sprint 2 backend-only". Priorizar integração no início da Sprint 3 (Pedro), não deletar. |
| RLS de tabelas com `user_id` | 3 (S-10) ∩ 6 (C1, C3, C4, C5) | Agente 6 fez cross-check positivo — alinhado. Não há divergência. |
| Coluna `attempt_count` órfã | 1 (A5) ∩ 6 (A1) | Mesmo achado; A5 é o "fix" (retry com incremento), A6.A1 é a observação. Tratar como um item. |
| Prompt injection + OpenRouter wrapper sem log | 3 (S-04) ∩ 4 (A5) | Ambos tocam `openrouter.ts`/`pipeline.ts`. Combinar em batch único — sanitização + instrumentação no mesmo PR. |
| `request_id` correlacional + teste de contrato dos handlers | 4 (A2 / OBS-1) ∩ 5 (B2.1) | Adicionar migration `0007_add_request_id.sql` antes dos testes de contrato (assim os testes já assertam a coluna). |
| Tabela `feedback` órfã | 1 (E1) ∩ 2 (A8) | Mesmo achado — schema-first para H10 Sprint 3. Não deletar, só comentar SQL. |
| `validateJudge` sem caller + ausência de teste da camada 4 | 1 (A3) ∩ 5 (matriz "Validate 4 camadas") | Mesmo gap. Implementar caller + teste no mesmo PR. |
| `process-document/index.ts` é alvo de várias frentes (proteção dupla execução, started_at, needs_review, compressed_cola, validateJudge, logs estruturados, request_id) | 1, 3, 4, 6 | Risco de PR conflict alto. Recomenda-se um **único feature branch** para tocar `process-document` na Sprint 2, com Isaac como dono e revisão obrigatória do Theo. |

---

## 4. Recomendação de ordem de execução

Alinhado com o que está em `psp2 claude/PSP2 - Consolidado.csv` (sprint atual = Sprint 1 finalizando, Sprint 2 ativa, entrega final 09/07/2026):

### Fase 0 — Pré-produção (antes de qualquer release pública) — ~6 h
1. **Aplicar migrations 0003–0006** em prod (`supabase db push --linked`) — destrava LGPD, hardening RLS, OAuth Drive, seed prompt library.
2. Setar secrets em prod (`ALLOWED_ORIGINS`, `OPENROUTER_API_KEY`, `GOOGLE_*`).
3. Declarar `verify_jwt` explícito por função em `config.toml`.
4. Documentar backup/restore em `docs/BACKUP.md`.

### Fase 1 — Fechamento honesto da Sprint 1 — ~12 h
1. **Bugs críticos do pipeline** (A1+A2+A3+A4 — `started_at`, `needs_review`, `validateJudge`, `compressed_cola`) — Isaac + Guilherme · 7 h.
2. **Proteção contra dupla execução do worker** (D1) — Isaac · 2 h.
3. **ErrorBoundary global + handlers** (Obs A1) — Pedro · 2 h.

### Fase 2 — Sprint 2 (hardening e UX prometida) — ~30 h
1. **Cifrar tokens OAuth Google** (S-01 / A4 banco) — Isaac · 4–6 h.
2. **Sandbox de prompt injection** + instrumentação OpenRouter (S-04 + A5 obs) — Guilherme · 6 h.
3. **`request_id` ponta-a-ponta** + migration 0007 (Obs A2) — Isaac + Pedro · 6 h.
4. **Integração frontend Drive + System Prompt** (B2, B3 bugs / B1, B2 cod morto) — Pedro · 12 h.
5. **Resiliência do pipeline**: retry com `attempt_count` (A5 bugs) + watchdog pg_cron (A7 bugs) — Isaac + Theo · 8 h.

### Fase 3 — Sprint 3 (testes com alunos reais) — ~50 h
1. **Frontend tests + smoke checklist** (QA-1 do Agente 5) — Pedro + Luis Felipe · 20 h.
2. **Testes de contrato dos handlers + E2E happy-path** (QA-2) — Isaac + Guilherme · 25 h.
3. **CI gate de deploy** (B4.1 do Agente 5) — Theo · 1 h.
4. **Painel ops** (`tools/ops/*.sql`) — Theo · 3 h.

### Fase 4 — Sprint 4 / sustentação — ~20 h
1. Rate limit distribuído via Redis (S-03).
2. Schema cleanup: tabela `subjects` (A2 banco) + junção `user_system_prompt_sources` (A3 banco) + CHECK `progress_percent` (D2 banco).
3. Higienização: deletar Tailwind/PostCSS/vision morto (B-DEAD-1 / B-DEAD-2 do Agente 2).
4. Painel admin web (OBS-6).

---

## 5. Riscos pro projeto acadêmico (entrega 09/07/2026 — artigo + demo + pacote)

| Risco | Frente | Impacto na entrega final |
|---|---|---|
| Migrations não aplicadas em prod | 3, 6, memória | `recordConsent` quebra silenciosa, `prompt_library` vazia → demo "Biblioteca de prompts" fica vazia. **Discurso LGPD do artigo não casa com o produto.** |
| Tela branca em demo (sem ErrorBoundary) | 4 | Qualquer crash em prod (deploy ruim, race condition) durante banca = avaliação derrubada. |
| Pipeline com features fake (`needs_review`, `validateJudge`, `compressed_cola`) | 1 | Se o avaliador testar manualmente, vê inconsistência entre backlog "100% feito" e produto. Nota do quesito "completude" cai. |
| Worker dobra custo LLM (D1) | 6 | Estouro de cota OpenRouter durante demo. Pior: o aluno-cobaia do Sprint 3 vê duplo processamento. |
| Tokens Google em texto plano | 3, 6 | Inconsistência com discurso de privacidade no artigo. Se a banca pergunta "como vocês protegem os dados de Drive?", a resposta correta é "não protegemos". |
| Frontend com zero testes | 5 | Refactor em véspera da entrega → regressão de upload → demo falha. Sem rede de segurança. |
| Backup não documentado | 6 | Perda acidental de dado de aluno durante Sprint 3 = perda de evidência empírica do artigo (SUS, TAM, feedback). Irrecuperável. |
| Integração Drive não fechada (B1/B2 cod morto + B2/B3 bugs) | 1, 2 | Demo do "exporta pro Drive do aluno" não acontece. Feature de venda principal vira slide. |
| Smoke checklist inexistente | 5 | Luis Felipe (QA) não tem roteiro versionado pra rodar antes da banca → bug óbvio passa. |
| Prompt injection latente | 3 | Aluno-cobaia hostil sobe PDF malicioso, contamina o system prompt pessoal dele → vira anedota negativa no relatório. |

**Mitigação mínima viável** (fica em ~20 h de trabalho coordenado): Fase 0 completa + itens 1, 2, 3 da Fase 1 + tokens criptografados + smoke checklist + integração Drive. Cabe em 1 semana de sprint focada.

---

## 6. Distribuição de esforço estimado

| Frente | Itens | Horas | Dono predominante |
|---|---|---|---|
| Bugs (Agente 1) | 25 | 43 | Isaac (22 h) |
| Código morto (Agente 2) | 9 | 6 | Theo (4 itens) |
| Segurança (Agente 3) | 13 | 26 | Isaac (6 itens) |
| Observabilidade (Agente 4) | 11 | 25 | Pedro / Isaac (split) |
| Testes (Agente 5) | 20 | 63 | distribuído entre 4 |
| Banco (Agente 6) | 18 | 19 | Isaac |
| **Total bruto** | **96** | **~182** | — |

Aplicando o desconto por **sobreposições** (~15 itens em comum entre frentes — pipeline, tokens, request_id, attempt_count, validateJudge, fluxos órfãos), o esforço efetivo cai para **~150 h** distribuídas entre 5 devs ao longo das Sprints 2–4. Cabe no orçamento até 09/07/2026 se a Fase 0 + Fase 1 (~18 h) forem feitas na próxima semana.

---

## 7. Quickwins aplicados (2026-05-26)

Triagem de 96 achados → **7 candidatos** que cumpriam os critérios estritos (95% certeza, ≤30 linhas, ≤3 arquivos, sem contrato público, sem migration, ≤20 min, sem conflito com trabalho ativo). Após verificação in loco, **4 foram aplicados** e **3 foram pulados**.

### Aplicados (4 commits, todos locais — sem push)
```
9ed319d docs: adiciona badge de status do CI no README
522c039 chore(web): remove devDeps Tailwind/PostCSS/Autoprefixer não utilizadas
ab9412f chore(vision): remove providers Claude/Gemini e extractWithFallback órfãos
f8f08e4 chore(shared): adiciona image/jpg ao MIME_TO_FORMAT
```
- **Validação:** `npm test` (140 testes verdes), `npm run typecheck`, `npm run lint` e `npm run build` (apps/web) — tudo verde após cada commit.
- **Total alterado:** 5 arquivos modificados, 2 arquivos deletados, **183 linhas a menos** no codebase (na maior parte vision dead code).

### Pulados na triagem (3) — input pro próximo planejamento
- **QW-01 (regex de acentos em `validation.ts`)** — **achado inválido**. O regex `/[̀-ͯ]/g` é literalmente o range UTF-8 `̀–ͯ` (combining diacritical marks). `od -c` confirma bytes `\314\200-\315\257`. O Agente 3 (Segurança) interpretou mal o rendering em terminal. **Nada a corrigir.**
- **QW-02 (limitar `lastStatusRef` em `useJobs.ts`)** — arquivo tem WIP local não commitado do Theo. Violaria critério "não toca código em desenvolvimento ativo". Replanejar quando WIP for commitada.
- **QW-06 (guard de 1 MB em upload pro Drive)** — mesma situação: `process-document/index.ts` tem WIP local. Replanejar.

### Observação importante para a próxima revisão
O working tree estava bem sujo durante a auditoria — várias modificações locais em arquivos críticos (`useJobs.ts`, `process-document/index.ts`, `pipeline.ts`, `cors.ts`, `schemas.ts`) e muitos arquivos novos não rastreados (migrations 0003–0006, `tests/`, `drive/`, `connect-drive/`, `generate-system-prompt/`, `vitest.config.ts`, `package-lock.json`). Os 4 quickwins aplicados tocaram **somente arquivos limpos**, mas o Theo deve confirmar antes de fazer push — o ideal é commitar a WIP primeiro (sprint 2 finalização?) e os quickwins por cima.

Detalhes completos por item em [`QUICKWINS.md`](./QUICKWINS.md).

---

## 8. Execução autônoma estendida (2026-05-26)

Depois dos 4 quickwins iniciais, o Theo autorizou tocar tudo que tivesse alta certeza e baixo risco. Resultado: **26 commits locais** (sem push), endereçando **20 dos ~96 achados da auditoria**. Estado final do branch `feature/sprint1-finalization`:

```
74cb07a feat(pipeline): wira onRetry → job_events.event_type='retry' nas 3 etapas
d63c3eb feat(openrouter): callback onRetry opcional em callLLMWithRetry
b7922b5 docs(shared): TODO em SLO const apontando consumo futuro
e5908f0 fix(process-document): incrementa attempt_count em cada falha
430b64b docs(claude): roadmap operacional de pg_cron (4 jobs futuros)
74be6e5 refactor(web): migra MarkdownPreview para useQuery (cancel + dedup + cache)
a593c70 feat(process-document): wira validateJudge (camada 4 — LLM-as-judge)
af0b793 fix(web): filter user_id no Realtime de jobs (defesa em profundidade)
2e27501 fix(process-document): claim atômico do job + started_at não-regressivo
d494d32 fix(process-document): valida body com Zod (UUID estrito)
4ffcdff fix(cors): retorna string vazia quando Origin está fora da whitelist
c496797 fix(process-document): aborta upload pro Drive se markdown > 1 MB
ead7624 fix(web): cap em lastStatusRef de useJobsRealtime pra evitar leak
67a9fb1 refactor(shared): move tipos órfãos schema-first para types.internal.ts
b811ecf feat(shared): whitelist canônica de extensions em buildFilenameFinal
2e0f7d7 feat(pipeline): sandbox de prompt injection com delimitadores <<DOC>>
e4c5d38 wip: trabalho pré-auditoria nos 7 arquivos da Fase B   ← AUTOR: Theo Murahovschi
c1e552e fix(web): valida sessão antes de subir arquivo pro Storage
1a5ab75 docs: adiciona CLAUDE.md com convenção de log/segurança/estilo
c5e04ca feat(shared): helper de log estruturado em JSON com redaction de PII
23f7046 feat(web): ErrorBoundary global + listeners window.error/unhandledrejection
f029f61 feat(db): migration 0007 — CHECK progress_percent + idx processed_at + comments SQL
9ed319d docs: adiciona badge de status do CI no README
522c039 chore(web): remove devDeps Tailwind/PostCSS/Autoprefixer não utilizadas
ab9412f chore(vision): remove providers Claude/Gemini e extractWithFallback órfãos
f8f08e4 chore(shared): adiciona image/jpg ao MIME_TO_FORMAT
```

### Mapeamento commit → achado

| Achado | Severidade | Commit | Comentário |
|---|---|---|---|
| Agente 2 · A1 (Tailwind órfão) | 🟡 | `522c039` | uninstall |
| Agente 2 · A2+A3 (vision dead) | 🟡🟡 | `ab9412f` | -182 linhas |
| Agente 1 · D2 (image/jpg) | 🟢 | `f8f08e4` | 1 linha |
| Agente 5 · F-13 (CI badge) | 🟢 | `9ed319d` | doc |
| Agente 6 · D2+B4+A5+C3+C4+G3 | 🟡🟡🟢🟢🟢🟢 | `f029f61` | migration 0007 (CHECK + índice + 4 comments SQL) |
| Agente 4 · A1 (ErrorBoundary) | 🔴 | `23f7046` | global + handlers window |
| Agente 4 · A3+A6 (helper log) | 🟡🟡 | `c5e04ca` | `_shared/log.ts` (fundação) |
| Agente 4 · A8 (convenção log) | 🟢 | `1a5ab75` | `CLAUDE.md` criado |
| Agente 1 · C6 (getSession upload) | 🟢 | `c1e552e` | falha rápida sem subir arquivo |
| (WIP do Theo, 616 inserções) | — | `e4c5d38` | agrupado pra destravar fixes da Fase B |
| Agente 3 · S-04 (prompt injection) | 🟡 | `2e0f7d7` | sandbox `<<DOC>>` nos 3 estágios |
| Agente 3 · S-07 (extension whitelist) | 🟢 | `b811ecf` | `ALLOWED_FILE_EXTENSIONS` |
| Agente 2 · A4 (tipos órfãos) | 🟡 | `67a9fb1` | `types.internal.ts` |
| Agente 1 · C5 (leak lastStatusRef) | 🟢 | `ead7624` | cap 200 + drop em status terminal |
| Agente 3 · S-08 (markdown > 1 MB) | 🟢 | `c496797` | guard em `tryUploadToDrive` |
| Agente 1 · B4 (CORS fallback) | 🟢 | `4ffcdff` | string vazia |
| Agente 1 · B1 (Zod body) | 🟡 | `d494d32` | UUID estrito local |
| Agente 6 · D1 + Agente 1 · A1 | 🔴🔴 | `2e27501` | claim atômico + `started_at` não-regressivo |
| Agente 1 · C2 (filter Realtime) | 🟡 | `af0b793` | `user_id=eq.{user.id}` |
| Agente 1 · A3 (validateJudge) | 🔴 | `a593c70` | camada 4 wirada (warning OU 5% sample) |
| Agente 1 · C4 (MarkdownPreview) | 🟡 | `74be6e5` | migrado pra `useQuery` + AbortSignal |
| Agente 6 · F2 (roadmap pg_cron) | 🟡 | `430b64b` | 4 jobs documentados em `CLAUDE.md` |
| Agente 1 · A5 + Agente 6 · A1 | 🟡🟢 | `e5908f0` | `attempt_count++` no `fail()` |
| Agente 2 · A5 (SLO TODO) | 🟢 | `b7922b5` | comment apontando OBS-6 |
| Agente 4 · A11 (retry events) | 🟢 | `d63c3eb` + `74cb07a` | helper `OnRetryCallback` + wiring |

### Resumo numérico — antes vs depois

| Métrica | Antes | Depois |
|---|---|---|
| Achados 🔴 totais | 14 | **9** (-5: A1+A2+A3 bugs + D1 banco + obs A1) |
| Achados 🟡 totais | 44 | **35** (-9) |
| Achados 🟢 totais | 38 | **32** (-6) |
| Migrations no repo | 6 (0001–0006) | **7** (+0007) |
| Arquivos novos criados | 0 | 4 (`ErrorBoundary.tsx`, `log.ts`, `CLAUDE.md`, `types.internal.ts`, `0007_*.sql`) |
| Arquivos deletados | 0 | 2 (`vision/claude.ts`, `vision/gemini.ts`) |
| Linhas adicionadas | — | +1395 |
| Linhas removidas | — | -346 |
| Testes | 140 verdes | **140 verdes** (cobertura mantida; nenhum teste novo) |

### O que ficou de fora (precisa decisão sua ou trabalho maior)

**Decisão de produto / arquitetura:**
- 🔴 A2 bugs (`needs_review` pausa o pipeline ou completa com flag?)
- 🔴 A4 bugs (gerar `compressed_cola` dobra custo LLM — autorizar?)
- 🔴 S-01 (cifrar tokens Google: pgsodium vs `crypto.subtle` vs aceitar dívida documentada?)
- 🟡 A2 banco (criar tabela `subjects` normalizada ou aceitar `jsonb`?)
- 🟡 A3 banco (junção `user_system_prompt_sources` ou aceitar `uuid[]`?)
- 🟡 D1 bugs (`curso` obrigatório no onboarding — produto)
- 🟢 C7 bugs (`recordConsent` await + retry — LGPD compliance)

**Acesso a infra remota (você tem credencial, eu não):**
- 🔴 S-10 aplicar migrations 0003–0007 em prod (`supabase db push --linked`)
- 🟡 S-11/S-12 declarar `verify_jwt` explícito + secret `ALLOWED_ORIGINS` em prod
- 🔴 F3 banco (criar `BACKUP.md` documentando plano Supabase real)

**Trabalho substancial (precisa coordenação ou novo batch):**
- 🟡 OBS-A2 `request_id` ponta-a-ponta (migration 0008 + 4 Edge Functions + UI + body de erro — 6h)
- 🟡 OBS-A4 adotar `createLogger` nas 4 Edge Functions (refactor cross-cutting, depende de outras WIP)
- 🟡 B2/B3 bugs — UI de Conectar Drive + página `/meu-prompt` (Pedro, 12h)
- 🟡 A6 bugs — RPC transacional `create_document_with_job` (Isaac, 2h)
- 🟡 A7 bugs — watchdog pg_cron de jobs presos (4h — já documentado o pattern em `CLAUDE.md`)
- 🔴 Frontend tests + smoke checklist (Pedro + Luis Felipe, 20h)
- 🔴 Testes de contrato dos handlers + E2E (Isaac, 25h)

**Destrutivo (precisa seu OK explícito):**
- 🟡 A6/A7 cod morto: deletar branches remotas `feature/sprint1-pipeline` e `dev`
