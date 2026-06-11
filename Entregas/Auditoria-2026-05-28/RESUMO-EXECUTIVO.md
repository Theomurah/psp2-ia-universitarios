# PSP2 — Auditoria 2026-05-28 — Resumo Executivo

**Sprint atual:** S1 (finalização) → S2
**Auditoria anterior:** `Entregas/Auditoria-2026-05-27/` (24h atrás)
**Auditor:** 6 agentes Claude Opus em paralelo

Esta auditoria reroda os 6 agentes do ciclo anterior. Foco em **achados novos** e em **reincidências** (itens da 2026-05-27 sem fix em código). Lista completa por frente em `PSP2 - Auditoria S1 - {frente}.md` neste mesmo diretório.

---

## 1. Síntese por frente

### Agente 1 — Bugs e lacunas funcionais
13 achados (🔴 3 / 🟡 6 / 🟢 4) | ~14h30 | Dono: Pedro (~6h30) + Isaac (~5h). Confirma que 4 achados de ontem foram fechados (A5 unsubscribe Realtime, A6 invalidate de mutations, A8 Zod no callback Drive, mais um). Continuam abertos sem commit: `needs_review` nunca atribuído (B1-2028 = A2 de ontem), modo `compressed_cola` declarado mas não gerado (B2-2028 = A4), Drive sem botão na UI (B5-2028 = A1), `generate-system-prompt` sem consumidor (B6-2028 = A3), hooks críticos sem `onError` (B7-2028 = A7). **Novos:** `ingest-document` cria `documents`+`jobs` sem transação (B3-2028), upload deixa órfão no Storage quando ingest rejeita (B4-2028), `??` em string vazia do judge devolve `''` em vez do erro real (B8-2028), refresh_token do Google ignorado em rotações (B9-2028).

### Agente 2 — Código morto e não utilizado
11 achados (🔴 0 / 🟡 5 / 🟢 6) | ~1h20 imediato + 2h30 condicional | Dono: Theo (housekeeping) + Isaac. Confirma que duas Edge Functions seguem deployadas sem consumidor no frontend (`connect-drive` 203 LoC, `generate-system-prompt` 151 LoC) — **354 linhas inativas em prod**. Correção importante vs. auditoria de ontem: `process-document` **não** é morto, é invocado server-to-server por `ingest-document:111-120` (a auditoria 27/05 listou as 3 funções como órfãs, era falso). Descoberta nova: branch `origin/dev` também tem 0 commits ahead de `main` (carry-over não documentado). `depcheck` limpo em todos os 3 escopos. `.env.example` 100% consumido. Tabelas `feedback` e `user_system_prompts` sem I/O hoje (schema-first, manter — entram em H7/H10).

### Agente 3 — Segurança
12 achados (🔴 0 / 🟡 5 / 🟢 7) | ~12h | Dono: Isaac (8 de 12). **Exploráveis hoje** (em dev/staging): A1 — `process-document` sem rate limit (queima quota OpenRouter por loop, 1h pra fixar); A2 — `format` declarado pelo cliente sem cross-check com extensão do `storage_path`; A4 — 4 Edge Functions logam `PostgrestError` cru, podendo vazar `details`/`hint` (PII). **Top de pré-produção:** A3 — `google_refresh_token` ainda plain-text em `profiles` (`0004_drive_oauth.sql:14-17`). Confirmados sãos: sem keys vazadas em `apps/web/`, RLS completa em 8 tabelas + `user_consents` + `app_settings` + `prompt_library`, CORS strict com echo seguro de Origin (`_shared/cors.ts:32-43`), scope OAuth mínimo (`drive.file` em `_shared/drive/oauth.ts:80`), sandbox `<<DOC>>` em `classify`/`synthesize`/`compress` + chunked recursivo, `verify_jwt=true` por função em `supabase/config.toml`, Zod nos 4 entrypoints.

### Agente 4 — Observabilidade e logging
10 achados (🔴 4 / 🟡 3 / 🟢 1 / ✅ 2) | ~21h | Dono: Isaac. **4 reincidentes** da 2026-05-27 sem nenhum commit endereçando (A1, A2, A3, A5). **2 novos com risco real:** A9 — `_shared/models.ts:51,64` faz `console.warn` direto fora do schema JSON; A10 — `connect-drive/index.ts:131` loga `updateError` cru de UPDATE em `profiles` (a row sendo persistida contém `google_access_token`/`refresh_token` — risco de vazar token via `details`/`hint` do Postgres). O helper `_shared/log.ts` já existe com `createLogger` + `REDACT_KEYS` + `fromError` que filtra `details`/`hint` — mas **nenhuma Edge Function adotou em 24h**. `ErrorBoundary` global + handlers `window.error`/`unhandledrejection` OK desde 26/05. `job_events` cobre todas as transições do pipeline com `onRetry` wirado (commit `74cb07a`).

### Agente 5 — Testes e qualidade
8 achados (🔴 3 / 🟡 4 / 🟢 1) | ~48h | Dono: Isaac (Edge handlers + pipeline) > Luis Felipe (e2e + QA docs). **Suíte verde:** `npm test` → 163 testes / 16 arquivos / 11.1s. `typecheck` e `lint` (flat config ESLint v9 em `apps/web/eslint.config.js`) passam limpos. **Coverage real (v8):** 41.8% statements no escopo restrito (`_shared/**` + `packages/shared/src/**`); fora do escopo: frontend (4895 LoC) e os 4 `index.ts` das Edge Functions (1010 LoC) — coverage real do produto está em ~25–30%. **Top 3 gaps:** zero testes de frontend (inclui `RequireAdmin` com bug histórico documentado em `CLAUDE.md`); zero testes nos 4 `index.ts` de borda (`process-document` tem 552 LoC sem teste apesar de claim atômico, judge e retry recém-mexidos); zero integração e2e. **Avanços vs 27/05:** A4 (ESLint config) fechado, A6 (coverage v8) parcial — coleta sim, threshold não. Gate `validate-then-deploy` em `deploy-functions.yml` confirmado. **Novos:** A9 — sem `deno check`/`deno lint` em CI; A10 — `npm run lint --if-present` mascara workspaces sem script.

### Agente 6 — Banco de dados
11 achados (🔴 1 / 🟡 8 / 🟢 1 / ✅ 1) | ~10h críticos + 10h opcionais | Dono: Isaac (DDL) + Theo (decisões). **Achado 🔴 crítico:** RPCs `admin_metrics_overview`, `admin_metrics_timeseries`, `admin_pipeline_breakdown` em `0009`/`0010` consultam `status = 'success'` que **não existe no enum `job_status`** (canônico: `pending|processing|needs_review|completed|completed_with_warning|failed`). Dashboard `/admin` mostra "0 sucessos / $0 custo" mesmo com jobs `completed` no banco. **Fix de 15 min**, mas requer migration 0013. Schema canônico OK: FKs com `ON DELETE`, RLS coberta em tudo com `user_id`, índices das policies em `0011`. Carry-over: `docs/backup-restore.md` ainda não existe (A11 herdado, sem progresso). Inconsistência menor no CLAUDE.md: roadmap pg_cron menciona `attempt_count < max_retries`, mas só existe `attempt_count` (sem coluna `max_retries`). Cabeçalho de `0012_archive_documents.sql` ainda diz "Migration 0007" (rename pós-conflito não atualizado).

---

## 2. Top 5 críticos globais (cross-frente)

| # | Item | Frente(s) | Arquivo:linha | Esforço | Bloqueia |
|---|------|-----------|---------------|---------|----------|
| 1 | **Métricas `/admin` zeradas por drift de enum** (RPCs filtram `status='success'` que não existe; canônico é `completed`) | BD A1 | `supabase/migrations/0009_admin_panel.sql:89,91` + `0010_admin_hardening_and_metrics.sql:63,71,80,162,166,168` | 15min código + migration 0013 | Demo/defesa do projeto |
| 2 | **Adoção do `createLogger` nas 4 Edge Functions** (resolve A1 obs + A10 obs + A4 seg em um único batch — vazamento de PII e tokens Google via `PostgrestError`) | OBS A1 + OBS A10 + SEG A4 | `ingest-document/index.ts:91,106,120,129` + `process-document/index.ts:96,134,171,176,461` + `generate-system-prompt/index.ts:72,141,151` + `connect-drive/index.ts:89,122,131,140` | 8h | Sprint 3 (logs com PII bloqueia claim LGPD do artigo) |
| 3 | **`needs_review` nunca atribuído pelo pipeline** (warnings de `validateClassification` descartados silenciosamente; doc com confiança 0.4–0.7 vai como `completed` pro Drive) | BUG B1-2028 | `supabase/functions/process-document/index.ts:283-287` (+ `_shared/validation.ts:64-66`) | 2h | Critério S1T10 + Tabela 1 do artigo (precisa demonstrar 3 status) |
| 4 | **`google_refresh_token` plain-text em `profiles`** (sem encryption aplicacional; depende só da at-rest + RLS) | SEG A3 | `supabase/migrations/0004_drive_oauth.sql:14-17` + `_shared/drive/oauth.ts` | 3h (migration + wrapper) | Sprint 3 hardening pré-prod |
| 5 | **`ingest-document` sem transação + Storage órfão** (dois inserts independentes; arquivo fica no bucket quando ingest rejeita por rate-limit/validação) | BUG B3-2028 + B4-2028 | `supabase/functions/ingest-document/index.ts:79-108` + `apps/web/src/lib/upload.ts:43-65` | 3h (RPC + try/finally) | T26 (smoke de 50 docs polui métricas e bucket) |

**Não-críticos mas atenção:** zero testes de frontend / Edge Function de borda / e2e (Agente 5 A1/A2/A3) — 30h totais, único caminho que fecha a porta pra regressão silenciosa nas semanas de polish.

---

## 3. Conflitos e sobreposições entre planos

1. **OBS A1 ↔ OBS A10 ↔ SEG A4 — mesma raiz** (Edge Functions usando `console.error(err)` cru). Executar como **um único batch B-O1** de 8h que substitui `console.*` por `createLogger` + `log.fromError`. `fromError` filtra `details`/`hint` do PostgrestError → fecha A4 (PII genérica) e A10 (tokens Google) automaticamente. **Não fazer separado.**

2. **OBS A3 (`request_id` ponta-a-ponta) ↔ DB A1 (RPCs admin)** — ambos planejam mexer em migration. Consolidar como **0013_fix_admin_metrics_and_observability.sql**: (a) fix `status='success'`, (b) CHECK ranges (BD A7), (c) `alter table jobs add column request_id text` + índice. Uma migration única reduz risco e ordem de apply.

3. **BUG B5 (Drive UI) ↔ CÓD MORTO A1 (`connect-drive` órfã)** — mesmo problema visto de dois lados. Se wirar a UI agora (Batch B-D3, Sprint 1 final), a função deixa de ser código morto. **Decisão:** não desativar deploy de `connect-drive` no CI (CÓD MORTO B1.5) se vamos wirar essa semana; tratar a função como **em ativação**, não morta.

4. **BUG B6 (system prompt UI) ↔ CÓD MORTO A2 (`generate-system-prompt` órfã)** — idem ao item 3, mesma decisão.

5. **DB A1 (RPCs erradas) ↔ TESTES A2 (zero teste nos `index.ts`)** — não é conflito, é evidência: se houvesse 1 teste de smoke nas RPCs admin, o drift `'success'` ≠ `'completed'` teria sido pego na escrita do `0009`. Reforça a urgência de B-T2 (Testes).

6. **SEG A2 (format×extensão) ↔ BUG B4 (storage órfão)** — ambos no caminho de upload. Pedro/Isaac devem coordenar para não retrabalhar o handler do `ingest-document` duas vezes na semana.

7. **CÓD MORTO B1.1/B1.2 (deletar branches `dev`/`feature/sprint1-pipeline`) — destrutivo remoto.** Não executar sem aprovação explícita do Theo, mesmo sendo "0 commits ahead". Listar no quickwin como **rejeitado** com motivo.

---

## 4. Ordem de execução recomendada

Calibrada à sprint atual (S1 → S2, deadline final 09/07/2026, ~6 semanas).

### Fase 0 — Quickwins (hoje, este auditor)
Itens que cabem nos critérios de ≤30 LOC / ≤3 arquivos / ≤20min / sem migration / sem decisão de produto. Lista detalhada em [QUICKWINS.md](QUICKWINS.md).

### Fase 1 — Fim do Sprint 1 (próximos 5 dias úteis, ~13h)
1. **Migration 0013** consolidada (BD A1 + BD A7 + OBS A3 prep) — 3h — Isaac
2. **createLogger nas 4 Edge Functions** (OBS A1+A10 + SEG A4) — 8h — Isaac
3. **B1-2028 `needs_review` attribution** — 2h — Isaac + Guilherme

Resultado: dashboard `/admin` funcional na demo, logs sem vazar PII/tokens, pipeline produz 3 status (alimenta Tabela 1 do artigo).

### Fase 2 — Sprint 2 (semanas 2-3, ~20h)
4. B3-2028 transação ingest + B4-2028 storage cleanup — 3h — Isaac + Pedro
5. SEG A1 rate limit em `process-document` — 1h — Isaac
6. SEG A2 cross-check `format` × extensão — 30min — Isaac
7. B5-2028 + B6-2028 (Drive UI + system prompt UI) — 4h — Pedro
8. B7-2028 `QueryCache.onError` global — 1h — Pedro
9. OBS A3 `request_id` ponta-a-ponta (frente já preparada em 0013) — 4h — Theo + Isaac
10. OBS B-O4 painel ops básico (`tools/ops/*.sql`) — 3h — Theo
11. TESTES B-T4 thresholds + `deno check` + Prettier em CI — 4h — Theo

### Fase 3 — Sprint 3 / pre-prod (semanas 4-5, ~24h)
12. SEG A3 encryption do `google_refresh_token` — 3h — Isaac + Theo
13. SEG A5 sanitização de markdown LLM antes do Drive — 2h — Isaac
14. TESTES B-T1 6 testes de frontend (prioridade `RequireAdmin`) — 10h — Pedro + Luis Felipe
15. TESTES B-T2 4 testes nos `index.ts` Edge — 12h — Isaac

### Fase 4 — Polish e entrega (semana 6)
16. TESTES B-T3 e2e do pipeline — 8h — Luis Felipe + Isaac
17. TESTES B-T5 `docs/qa/smoke-test.md` — 3h — Luis Felipe
18. BD A11 `docs/backup-restore.md` — 1h — Theo
19. CÓD MORTO B1.x housekeeping (com aprovação do Theo) — 1h30 — Theo
20. Decisões deferidas: BD A6 `source_documents` schema, BD A10 pgvector — Theo + Guilherme

---

## 5. Riscos pro projeto acadêmico (deadline 09/07/2026)

Ordenados por probabilidade × impacto na entrega final (artigo + demo + pacote).

| Risco | Probabilidade se nada mudar | Impacto na entrega | Mitigação na Fase |
|-------|------------------------------|----------------------|-------------------|
| Dashboard `/admin` mostra "0 sucessos / $0" na demo de defesa | Alta (já está assim hoje) | Embaraço de demo + descrédito da rubrica de "painel administrativo" | Fase 1, item 1 |
| Tabela 1 do artigo só consegue mostrar 2 dos 3 status declarados (`completed`/`failed`, sem `needs_review`) | Alta | Contradição com claim de "validação em 4 camadas" do corpo do artigo | Fase 1, item 3 |
| Logs com PII bloqueiam o claim de LGPD/anonimização no artigo | Alta (vazamento via PostgrestError comum) | Pode invalidar seção 4 do artigo | Fase 1, item 2 |
| Aluno-teste queima budget OpenRouter na semana da defesa por falta de rate limit em `process-document` | Média | Incidente financeiro + degrada demo | Fase 2, item 5 |
| Regressão silenciosa em `process-document` (claim atômico, judge, retry) entre semanas de polish — zero teste cobre os 552 LoC | Média | Bug "do nada" na semana da demo | Fase 3, item 15 |
| `google_refresh_token` plain-text exposto em backup/dump | Baixa (depende de vazamento secundário) | Risco real pra produção — não bloqueia entrega acadêmica em si | Fase 3, item 12 |
| `RequireAdmin` regride pro bug "só entra no double click" documentado em CLAUDE.md | Média (sem teste) | UX quebrada na demo do `/admin` | Fase 3, item 14 |
| Smoke test informal não pega quebra em algum dos 13 caminhos críticos (login → OAuth → upload → processo → drive → admin → privacidade) | Alta sem checklist | Bug aparece na própria sessão de demo | Fase 4, item 17 |

**Conclusão pragmática:** os 3 primeiros itens da Fase 1 (~13h) cobrem 60% do risco de demo embaraçosa. Os testes da Fase 3 cobrem 30%. O restante (encryption, backup-doc) é polimento pré-prod, não fator decisivo da entrega acadêmica.

---

## 6. Estado das migrations

| Migration | Estado em prod (PENDENCIAS.md) | Recomendação |
|-----------|--------------------------------|---------------|
| 0001–0012 | Aplicadas | OK |
| **0013** | Não criada | **Criar nesta sprint**: fix `status='success'` (BD A1) + CHECK ranges (BD A7) + `jobs.request_id` (OBS A3 prep) |
| 0014 (futura) | — | Índices follow-up condicionais (BD A4 + A5) — só quando Sprint 2 entregar filtros UI |
| 0015 (futura) | — | Decisões deferidas (BD A6 `source_documents`, BD A10 pgvector) |
| pg_cron jobs | Roadmap em CLAUDE.md | Sprint 2 (watchdog), Sprint 3 (refresh token), Sprint 4 (GC + snapshot) |

---

## 7. Métricas agregadas

| Frente | Achados | 🔴 | 🟡 | 🟢 / ✅ | Esforço | Dono |
|--------|---------|-----|-----|---------|---------|------|
| 1. Bugs | 13 | 3 | 6 | 4 | ~14h30 | Pedro + Isaac |
| 2. Código morto | 11 | 0 | 5 | 6 | ~4h | Theo + Isaac |
| 3. Segurança | 12 | 0 | 5 | 7 | ~12h | Isaac |
| 4. Observabilidade | 10 | 4 | 3 | 1 / 2 | ~21h | Isaac |
| 5. Testes | 8 | 3 | 4 | 1 | ~48h | Isaac + Luis Felipe |
| 6. Banco | 11 | 1 | 8 | 1 / 1 | ~20h | Isaac + Theo |
| **Total** | **65** | **11** | **31** | **23** | **~120h** | Isaac dominante |

Isaac aparece como dono em 5 das 6 frentes — confirma a alta concentração de carga no backend/pipeline na finalização do Sprint 1. Distribuir wire-up de UI (B5/B6) pra Pedro e e2e pra Luis Felipe na Sprint 2 alivia.

---

## 8. Quickwins aplicados

8 itens passaram na triagem (ver [QUICKWINS.md](QUICKWINS.md) pra critérios e detalhes).
**3 aplicados, 5 pulados** (todos por WIP local do Theo nos arquivos-alvo, não por falha do critério).

### ✅ Aplicados (3 commits, não pushados)

```
914e6c0 fix(process-document): troca `??` por `||` no message do judge
25a2eaf feat(log): amplia REDACT_KEYS com variantes de chaves LLM e id_token
7fb45d7 docs(readme): remove fluxo `dev` morto do git flow
```

- **QW-3** (`docs(readme)`) — `README.md`: remove fluxo `feature/* → dev` morto (branch tem 0 commits ahead de `main`). Origem: CÓD MORTO A11.
- **QW-4** (`feat(log)`) — `_shared/log.ts`: amplia `REDACT_KEYS` com `api_key`, `openai_key`, `anthropic_key`, `gpt_key`, `openrouter_api_key`, `id_token`. Defesa em profundidade antes da adoção universal (Batch B-O1 do plano). Origem: SEG A6.
- **QW-5** (`fix(process-document)`) — `process-document/index.ts:367`: troca `??` por `||` no fallback de `message` do judge. `??` não tratava `[].join(';') === ''` como falsy, zerando o erro real quando `warnings: []` e `errors: ['...']`. Origem: BUG B8-2028.

**Gates pós-batch:** `npm test` 163/163 ✅ · `npm run typecheck` 3 workspaces ✅ · `npm run lint` ✅.

### ⏭️ Pulados (5 — WIP local nos arquivos-alvo)

| ID | Item | Arquivo-alvo | WIP local (linhas) | Razão |
|----|------|-------------|---------------------|--------|
| QW-1 | Fix doc-only (header de 0012 + `admin_audit_log` em PENDENCIAS) | `0012_archive_documents.sql`, `docs/PENDENCIAS.md` | untracked, +68/−23 | Misturaria WIP no commit; `0012` está untracked (commitá-lo aqui ataria o arquivo inteiro). |
| QW-2 | Remover ref a `max_retries` na prosa do roadmap pg_cron | `CLAUDE.md` | +94 | Misturaria WIP grande no commit do fix. |
| QW-6 | Sanitizar 3 `console.error/warn` no front | `UploadDropzone.tsx`, `useProfile.ts`, `LoginPage.tsx` | +36/−10, +64/−7, +230/−85 | Misturaria ~500 linhas de WIP no fix de ~6 linhas. |
| QW-7 | `setUploading` pra batch inteiro | `UploadDropzone.tsx` | (mesmo WIP do QW-6) | Idem. |
| QW-8 | Dep `selected?.id` no `useEffect` do `DashboardPage` | `DashboardPage.tsx` | +347/−24 | WIP maciço; idem. |

**Para o Theo:** os 5 pulados continuam válidos com `arquivo:linha` exato em `QUICKWINS.md` e nos relatórios das frentes. Recomendação: terminar/commitar o WIP atual desta branch, depois reaplicar os 5 (ou pedir um novo ciclo do auditor pós-WIP).

### Itens rejeitados na triagem (não eram quickwin)

Os ≥ 50 outros achados foram rejeitados por critério: necessitam migration nova (BD A1 — fix do `/admin`!), tocam código recém-mexido (SEG A1 rate limit em `process-document`), exigem decisão de produto (BUG B2 `compressed_cola`), são destrutivos remotos (deletar branches `dev`/`feature/sprint1-pipeline`), ou exigem novos arquivos de teste / config de CI. Todos catalogados nos relatórios das 6 frentes neste mesmo diretório com plano de execução nos respectivos batches.
