# PSP2 — Auditoria S1 — Observabilidade e Logging

**Frente:** Observabilidade e logging
**Responsável sugerido:** Isaac (Edge Functions) + Pedro (frontend) + Theo (arquitetura de logging / ops)
**Data:** 2026-05-28
**Auditor:** Agente 4

## Objetivo

Verificar se toda transição relevante do pipeline (`upload → process → generate → drive`) e cada chamada externa (LLM, Drive, Storage) gera um evento estruturado, correlacionável (`request_id`, `user_id`, `job_id`) e sem PII/conteúdo do aluno vazado. Validar adoção do helper `_shared/log.ts` e verificar regressões/avanços desde a auditoria 2026-05-27.

## Contexto vs. auditoria 2026-05-27

A auditoria de ontem mapeou 8 achados (4 🔴 / 1 🟡 / 3 ✅). Desde então (`git log --since="2 days ago"`), houve trabalho intenso de hardening — Zod no body de `process-document`, advisor fixes, validateJudge, sandbox de prompt injection, `attempt_count++`, claim atômico, gates de CI — **mas nenhum commit endereçou diretamente A1, A2, A3 ou A5 (todos 🔴)** da frente de Observabilidade. Confirma `docs/PENDENCIAS.md` (linhas 511–522, "OBS-A2/A4/A5/A7" listados em aberto, dono Isaac).

Esta auditoria portanto **reconfirma os 4 🔴** com diagnóstico atualizado, escala um deles, e adiciona 2 achados novos (A9, A10) descobertos nesta passada.

## Critério de aceitação

- As 4 Edge Functions (`ingest-document`, `process-document`, `generate-system-prompt`, `connect-drive`) usam `createLogger` de `_shared/log.ts` — zero `console.error` direto
- `callLLMWithRetry` loga `llm_start` (modelo, attempt) e `llm_end` (latência, `usage.prompt_tokens`/`completion_tokens`/`total_cost`) sem o conteúdo do prompt
- `request_id` propagado ponta-a-ponta: front gera UUID, envia em `X-Request-Id`, helper de log injeta em todo evento, `job_events.metadata.request_id` persiste
- Existem queries de ops salvas em `tools/ops/` (jobs falhos 24h, erros recentes)
- Frontend continua sanitizando `PostgrestError` (`{ message, code }` apenas)
- `ErrorBoundary` + handlers `window.error`/`unhandledrejection` ativos (✅ desde 2026-05-26)
- `job_events` continua cobrindo transições `pending → processing → done/failed` (✅)

## Achados

### A1 — 4 Edge Functions ainda chamam `console.*` direto 🔴
- **Arquivos:**
  - `supabase/functions/ingest-document/index.ts` (linhas 91, 106, 120, 129 — 4 ocorrências)
  - `supabase/functions/process-document/index.ts` (linhas 96, 134, 171, 176, 461 — 5 ocorrências)
  - `supabase/functions/generate-system-prompt/index.ts` (linhas 72, 141, 151 — 3 ocorrências)
  - `supabase/functions/connect-drive/index.ts` (linhas 89, 122, 131, 140 — 4 ocorrências)
- **Dono:** Isaac
- **Descrição:** Nenhuma das 4 funções importou `createLogger`. Mensagens em texto livre, com objetos `PostgrestError` inteiros passados como segundo argumento (ex.: `console.error('ingest-document insert documents:', docError)` em `ingest-document/index.ts:91`) — `details`/`hint` do Postgres podem conter valor da linha (PII).
- **Risco:** Não cumpre `CLAUDE.md` §"O que nunca logar" (categoria "Detalhe do banco"). Logs no Supabase Studio sem `evt` filtrável dificultam triagem.
- **Fix:** `const log = createLogger('<fn>')` em cada função; substituir `console.*` por `log.error('insert_failed', log.fromError(err))`. Helper já filtra `details`/`hint` automaticamente (`fromError` em `_shared/log.ts:73-99`).
- **Reincidência:** ✅ idêntico ao A1 da 2026-05-27 — nenhuma mitigação aplicada em 24h.

### A2 — `callLLMWithRetry` sem telemetria de início/fim 🔴
- **Arquivo:** `supabase/functions/_shared/openrouter.ts` (`callLLM` linhas 57–108; `callLLMWithRetry` linhas 150–184)
- **Dono:** Guilherme + Isaac
- **Descrição:** A response do OpenRouter já é parseada em `LLMCallResult` com `tokens_input`/`tokens_output`/`cost_usd`/`model`/`finish_reason` (linhas 99–107). Esses dados são propagados pro chamador, que grava em `job_events` no `process-document` (`logEvent(..., 'success', { tokens_input, tokens_output, cost_usd, llm_model, duration_ms })`). **Boa cobertura no plano "happy path por etapa".** Falta: log estruturado de **cada attempt** (modelo, attempt N de M, tamanho aproximado do input em chars) **antes** da chamada — útil pra diagnosticar timeouts e drift de modelo entre tentativas. Hoje só `onRetry` registra (e só dispara em erro transitório).
- **Risco:** Quando um job demora 90s, é impossível saber se foram 3 attempts seriados, 1 attempt lento, ou Drive lento — só vemos o `duration_ms` agregado de `synthesize` em `job_events`.
- **Fix:** Em `callLLM` (não `callLLMWithRetry`), no início: `log.info('llm_start', { model: opts.model, msg_count: opts.messages.length, max_tokens: opts.max_tokens })`. No fim: `log.info('llm_end', { model, latency_ms, tokens_input, tokens_output, finish_reason })`. Helper de log precisa ser importável em `_shared/openrouter.ts` (hoje só `process-document` usa).
- **Reincidência:** ✅ idêntico ao A2 da 2026-05-27.

### A3 — Sem `request_id` ponta-a-ponta 🔴 (escalado pra crítico)
- **Arquivos:** `apps/web/src/lib/upload.ts` (não inclui header), `apps/web/src/lib/supabase.ts`, 4 Edge Functions, `_shared/log.ts`, schema `job_events`
- **Dono:** Theo (arquitetura)
- **Descrição:** Reconfirmado: front não envia `X-Request-Id`, funções não geram fallback, `job_events` não tem coluna pra correlação. **Escalada:** com hardening de Zod, advisor fixes e novos paths de erro (claim duplicado, markdown > 1MB) entrando em produção, o volume de mensagens distintas cresceu — sem `request_id` o suporte ao aluno fica cego. `docs/PENDENCIAS.md` linha 511 já cita "**Precisa migration 0012**" — confirma que falta migration adicionando `jobs.request_id` + `job_events.metadata.request_id` (ou coluna dedicada).
- **Risco:** Quando o Theo for fazer suporte na Sprint 3 ("aluno X disse que falhou às 14:32"), só consegue triangular via `created_at` aproximado + `user_id` — frágil em horários de pico.
- **Fix:** (a) `crypto.randomUUID()` no front em cada chamada a Edge Function, passar em `X-Request-Id`; (b) `_shared/log.ts.createLogger` aceitar `requestId` opcional via param ou ler de `req.headers`; (c) migration 0013 adiciona `jobs.request_id text` + índice; (d) `process-document` passa `request_id` em cada `logEvent`.
- **Reincidência:** ✅ idêntico ao A3 da 2026-05-27.

### A4 — `PostgrestError` no front sem sanitização — 1 ocorrência restante 🟡
- **Arquivos:**
  - `apps/web/src/components/UploadDropzone.tsx:42` — `console.error(tag, err)` com `err` cru (objeto Error/PostgrestError completo)
  - `apps/web/src/hooks/useIsAdmin.ts:22` — já sanitiza (`{ message, code }`) ✅
  - `apps/web/src/hooks/useProfile.ts:76` — passa `error` cru ❌
  - `apps/web/src/hooks/useDocumentActions.ts:58` — só `storageRes.error.message` ✅
  - `apps/web/src/routes/LoginPage.tsx:109` — passa `e` cru em `.catch((e) => console.warn(..., e))` ❌
- **Dono:** Pedro
- **Descrição:** Antes a auditoria estimava 2 ocorrências; mapeei agora 3 ocorrências de erro cru (UploadDropzone, useProfile, LoginPage). `useIsAdmin` já segue convenção (`message`/`code`).
- **Risco:** Em DevTools/Sentry futuro vazam `details`/`hint` (PII), além de descumprir `CLAUDE.md` §"Frontend".
- **Fix:** Em cada uma das 3 ocorrências: `console.error('tag:', { message: err.message, code: (err as any).code })`. Trivial.

### A5 — Sem queries/scripts de ops salvos 🔴
- **Diretório:** `tools/ops/` **não existe**; `docs/EXTRAS.md` não tem seção de queries
- **Dono:** Theo
- **Descrição:** Reconfirmado. Nenhum SQL prontinho pra "quantos jobs falharam nas últimas 24h?", "quais funções logaram error hoje?", "top 5 `error_reason`?". As RPCs `admin_metrics_overview()`, `admin_metrics_timeseries()`, `admin_pipeline_breakdown()` (migration 0009/0010) cobrem o dashboard `/admin` web, mas não substituem queries CLI pra incidentes/SRE.
- **Risco:** Em incidente, qualquer dev precisa abrir Supabase Studio e digitar SQL ad-hoc — risco de query errada em produção.
- **Fix:** Criar `tools/ops/jobs-health.sql`, `tools/ops/recent-errors.sql`, `tools/ops/stuck-jobs.sql` (jobs `processing` há > 10min — combina com o watchdog pg_cron planejado em `CLAUDE.md`). Mencionar em `docs/EXTRAS.md`.
- **Reincidência:** ✅ idêntico ao A5 da 2026-05-27.

### A6 — Scripts em `tools/deliverable-docs/` com output legível 🟢 ✅
- **Status:** `tools/deliverable-docs/build.mjs:376` usa `console.log` `✓ ${path}` — OK conforme convenção `CLAUDE.md` §"Convenção de logging" (`console.log` permitido em `tools/`).

### A7 — Pipeline async com `job_events` ✅
- **Arquivos:** `_shared/pipeline.ts` + `process-document/index.ts`
- **Status:** OK. Cobertura ampla: `parse`/`classify`/`synthesize` (com chunk events granular `synthesize.chunk_N_of_M`)/`judge`/`compress`/`upload_drive`/`unknown` — todos com `event_type` `start`/`success`/`retry`/`warning`/`error` e métricas (`duration_ms`, `tokens_input/output`, `cost_usd`, `llm_model`).
- **Observação positiva:** o `makeRetryHook` (linhas 205-213) wira `onRetry` do OpenRouter → `job_events.event_type='retry'` — entregue na sessão anterior, funcionando.

### A8 — Frontend com ErrorBoundary global + handlers window ✅
- **Arquivos:** `apps/web/src/main.tsx` (linhas 7–22) e `apps/web/src/components/ErrorBoundary.tsx`
- **Status:** OK. `componentDidCatch` loga `{ message, stack[:5], componentStack[:5] }` (sanitizado), handlers `window.error` e `unhandledrejection` loggam `{ message, filename, lineno, colno }` / `{ reason }`. Convenção respeitada.

### A9 — `_shared/models.ts` usa `console.warn` direto, fora do helper 🟡 (NOVO)
- **Arquivo:** `supabase/functions/_shared/models.ts` (linhas 51, 64)
- **Dono:** Isaac
- **Descrição:** `models.ts` faz fetch de `app_settings` e loga warning em texto livre (`console.warn('app_settings fetch non-200', { status })` e `console.warn('app_settings fetch failed', { message })`). Não passa por `createLogger` — quebra o schema JSON único.
- **Risco:** Baixo (não tem PII), mas inconsistente com o resto. Achado **novo** vs. 2026-05-27.
- **Fix:** `const log = createLogger('models')` ou aceitar logger via DI. Se preferir manter `_shared/` neutro, pelo menos formatar igual JSON.

### A10 — `connect-drive` loga tokens via mensagem de erro do Postgres 🟡 (NOVO, risco real)
- **Arquivo:** `supabase/functions/connect-drive/index.ts:131` — `console.error('connect-drive update profile:', updateError)`
- **Dono:** Isaac
- **Descrição:** O `updateError` aqui é `PostgrestError` do `service.from('profiles').update({ google_access_token, google_refresh_token, ... })`. Em alguns modos de falha (constraint violation, type cast), o `details`/`hint` do Postgres **inclui o valor da row sendo inserida** — ou seja, o token do Google. Mesmo problema na linha 122 (`fallback update`).
- **Risco:** 🟡-tendendo-🔴 se algum dia rodar com `constraint violation` em coluna de token. Casa direto com `CLAUDE.md` §"O que nunca logar" → "Tokens" e "Detalhe do banco".
- **Fix:** Migrar pro `log.error('update_profile_failed', log.fromError(updateError))` — `fromError` filtra `details`/`hint`. Resolvido junto com A1.

## Plano de ação (batches)

### Batch B-O1 — `createLogger` nas 4 Edge Functions (8h, fecha A1 + A10)
- Endereça A1 e A10 ao mesmo tempo (`fromError` é o cinto de segurança contra vazar `details` do Postgres)
- 4 funções × 2h cada — substituir `console.*` por `log.info/warn/error`, semantizar `evt` (`received`, `insert_failed`, `auth_unauthorized`, `claim_skipped`, etc.)

### Batch B-O2 — Telemetria OpenRouter (3h, fecha A2)
- Importar `createLogger` no `_shared/openrouter.ts`
- Logger nomeado `'openrouter'`; `llm_start` antes do fetch, `llm_end` após parse — extrair `usage` da response (já tem)
- Atenção: NÃO logar `opts.messages` (mesmo truncado). Logar apenas count + sum de `content.length` aproximado.

### Batch B-O3 — `request_id` ponta-a-ponta (6h, fecha A3)
- (1h) front: `crypto.randomUUID()` em `lib/upload.ts` + helper genérico `apps/web/src/lib/edge.ts`, header `X-Request-Id`
- (1h) `_shared/log.ts`: aceitar `requestId` no `createLogger(fn, requestId?)` e propagar em cada evento
- (2h) migration 0013: `alter table jobs add column request_id text`; índice opcional
- (2h) `process-document`: ler `X-Request-Id` no início, propagar pra `logEvent(..., { request_id })` e gravar em `jobs.request_id` no claim

### Batch B-O4 — Painel ops básico (3h, fecha A5)
- `tools/ops/jobs-health.sql` — contagem por status nas últimas 24h
- `tools/ops/recent-errors.sql` — top 20 `job_events.event_type='error'` 24h com `step`, `error_reason`
- `tools/ops/stuck-jobs.sql` — jobs em `processing` há > 10min (prepara A7 da auditoria de banco / watchdog pg_cron)
- Doc em `docs/EXTRAS.md` §Ops

### Batch B-O5 — Sanitização frontend (0.5h, fecha A4)
- 3 edits triviais: `UploadDropzone.tsx:42`, `useProfile.ts:76`, `LoginPage.tsx:109`

### Batch B-O6 — `_shared/models.ts` no esquema JSON (0.5h, fecha A9)
- Substituir 2 `console.warn` por `createLogger('models')`

**Total:** ~21h. 🔴 dominante: 3 itens (A1, A2, A3, A5) — todos reincidentes da 2026-05-27.

## Top 3 críticos

1. **A1 — Adoção do `createLogger`** (8h) — destrava A10 de quebra e fecha vazamento potencial de PII via `PostgrestError`. Helper já existe há 2 dias e não foi adotado em nenhuma função.
2. **A3 — `request_id` ponta-a-ponta** (6h) — escalado pra crítico porque a Sprint 3 abre suporte a alunos. Sem isso, não há triagem de incidente possível.
3. **A2 — Telemetria OpenRouter `llm_start`/`llm_end`** (3h) — bloqueio do custo por job e detecção de drift de modelo; baixíssimo custo, valor altíssimo.

## Formato JSON padronizado (referência)

```json
{
  "ts": "2026-05-28T18:32:14.123Z",
  "level": "info" | "warn" | "error",
  "fn": "process-document",
  "evt": "llm_start" | "llm_end" | "job_claim" | "drive_upload" | "insert_failed",
  "request_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid",
  "...campos_específicos": "..."
}
```

`_shared/log.ts` já produz isso (sem `request_id` ainda). Falta universalizar adoção + A3.

## Validação

- A1: `grep -rE "console\.(log|warn|error)" supabase/functions/{ingest,process,generate,connect}-*/index.ts` deve retornar 0
- A2: log de qualquer chamada LLM bem-sucedida deve ter `evt:llm_start` e `evt:llm_end` com `usage` populado
- A3: chamar Edge Function com `X-Request-Id: abc` → ID em todos os logs subsequentes + em `jobs.request_id`
- A4: `grep -rE "console\.(error|warn).*[^,]\\s+err[\\)\\s]" apps/web/src` retorna 0 (heurística)
- A5: `psql -f tools/ops/jobs-health.sql` retorna contagens por status nas últimas 24h
- A9: `grep -nE "console\." supabase/functions/_shared/models.ts` retorna 0
- A10: cobre-se com A1 (`fromError` filtra `details`/`hint`)

## Dependências

- A3 destrava observabilidade de produção da Sprint 3 (suporte ao aluno)
- A1 + A2 destravam alertas no Supabase Logs (filtros por `evt` JSON) e relatório de custo por usuário (handoff pro `/admin`)
- A5 destrava handoff pro Luis Felipe (QA) — checklist de smoke test pós-deploy
- B-O1 (A1) deve vir **antes** de B-O3 (A3) — A3 reaproveita `createLogger` já adotado

## Diff vs. auditoria 2026-05-27

| Achado     | 2026-05-27 | 2026-05-28 | Notas                                                  |
|------------|------------|------------|--------------------------------------------------------|
| A1         | 🔴         | 🔴         | Reincidente — nenhum commit endereçou                  |
| A2         | 🔴         | 🔴         | Reincidente — nenhum commit endereçou                  |
| A3         | 🔴         | 🔴 (escal.)| Reincidente + escalado (Sprint 3 = suporte de aluno)   |
| A4         | 🟡         | 🟡         | 3 ocorrências mapeadas (antes estimativa de 2)         |
| A5         | 🔴         | 🔴         | Reincidente — nenhum commit endereçou                  |
| A6 tools   | 🟢         | 🟢         | OK                                                     |
| A7 events  | ✅         | ✅         | OK + reforço de `onRetry` wirado                       |
| A8 errboundary | ✅     | ✅         | OK                                                     |
| **A9 models.ts** | —    | 🟡         | NOVO                                                   |
| **A10 connect-drive token**| — | 🟡    | NOVO — risco real de vazar token em err Postgres       |

---
**Resumo numérico:** 10 achados | 🔴 4 / 🟡 3 / 🟢 1 / ✅ 2 | ~21h | Dono predominante: Isaac. 4 reincidentes de 2026-05-27 + 2 novos.
