# PSP2 — Auditoria S1 — Observabilidade e Logging

**Frente:** Observabilidade e logging
**Responsável sugerido:** Isaac (Edge Functions) + Pedro (frontend) + Theo (dashboards/ops)
**Data:** 2026-05-27

## Objetivo

Garantir que toda transição relevante do pipeline (upload → process → generate → drive) gera um evento estruturado e correlacionável (`request_id`, `user_id`, `job_id`) — sem vazar PII nem conteúdo do aluno.

## Critério de aceitação

- As 4 Edge Functions (`ingest-document`, `process-document`, `generate-system-prompt`, `connect-drive`) usam `createLogger` do `_shared/log.ts` — não `console.error` direto
- `OpenRouter` (`callLLMWithRetry`) loga início (modelo, prompt_tokens estimado) e fim (latência, completion_tokens, total_tokens) — nunca o conteúdo do prompt
- `request_id` propagado ponta-a-ponta (frontend → Edge → job_events)
- Existe um script/query salvo em `docs/` ou `tools/ops/` pra ver erros das últimas 24h
- Frontend continua sanitizando `PostgrestError` (`message`/`code` apenas, sem `details`/`hint`)

## Achados

### A1 — 4 Edge Functions não usam `createLogger` 🔴
- **Arquivos:**
  - `supabase/functions/ingest-document/index.ts`
  - `supabase/functions/process-document/index.ts`
  - `supabase/functions/generate-system-prompt/index.ts`
  - `supabase/functions/connect-drive/index.ts`
- **Dono:** Isaac
- **Descrição:** As 4 chamam `console.error`/`console.log` direto, sem o JSON estruturado de `_shared/log.ts` com `REDACT_KEYS`.
- **Risco:** Logs ad-hoc no Supabase Studio sem `evt` filtrável; risco de vazamento de PII (mensagens não-redacted).
- **Fix:** `const log = createLogger('<nome-da-fn>')` em cada função; substituir `console.*` por `log.info`/`log.warn`/`log.error`.

### A2 — `callLLMWithRetry` sem telemetria de início/fim 🔴
- **Arquivo:** `supabase/functions/_shared/openrouter.ts` (função `callLLMWithRetry`)
- **Dono:** Guilherme + Isaac
- **Descrição:** Já há callback `onRetry` (wired em `_shared/pipeline.ts` pra gravar `job_events.event_type='retry'`), mas não há log de **início** (modelo, tamanho do input estimado) nem de **fim** (latência, `usage.completion_tokens`/`prompt_tokens`/`total_tokens`).
- **Risco:** Impossível atribuir custo por job, detectar drift de modelo, ou alertar em SLA estourado.
- **Fix:** Adicionar `log.info('llm_start', { model, attempt })` e `log.info('llm_end', { model, latency_ms, usage })` — `usage` vem da response do OpenRouter.

### A3 — Sem `request_id` ponta-a-ponta 🔴
- **Arquivos:** todo o front (`apps/web/src/lib/upload.ts` e supabase clients) + Edge Functions
- **Dono:** Theo (arquitetura)
- **Descrição:** Frontend não envia `X-Request-Id` em chamadas a Edge Functions, e funções não geram um se ausente. `job_id` existe mas só amarra a partir do enqueue — incidentes em ingest pré-job ficam sem correlação.
- **Risco:** Debug cross-camada lento; suporte ao aluno não consegue mapear "deu erro às 14:32" para um trace específico.
- **Fix:** (a) gerar `crypto.randomUUID()` no front e enviar em `X-Request-Id`; (b) `_shared/log.ts` lê o header (ou gera fallback) e injeta em todo `log.*`; (c) gravar em `job_events.metadata.request_id`.

### A4 — `PostgrestError` no front sem sanitização em 2 hooks 🟡
- **Arquivos:** procurar em `apps/web/src/hooks/` por `console.error.*err` direto (2 ocorrências conhecidas)
- **Dono:** Pedro
- **Descrição:** Convenção em `CLAUDE.md` exige sanitizar `{ message, code }` antes de logar. Em 2 pontos passa-se o objeto inteiro.
- **Fix:** Substituir por `console.error('msg:', { message: err.message, code: err.code })`.

### A5 — Sem script de ops pra erros / jobs falhos 🔴
- **Diretório:** `docs/` e `tools/`
- **Dono:** Theo
- **Descrição:** Não há SQL/script salvo pra responder "quantos jobs falharam nas últimas 24h?", "quais Edge Functions logaram `error` hoje?".
- **Fix:** Criar `tools/ops/jobs-health.sql` + `tools/ops/recent-errors.sql` com queries prontas + nota em `docs/EXTRAS.md`.

### A6 — Scripts em `tools/` com output legível 🟢 ✅
- **Status:** `tools/deliverable-docs/` já tem `✓`/`→` no progresso. OK.

### A7 — Pipeline async com `job_events` ✅
- **Arquivos:** `_shared/pipeline.ts` + `process-document/index.ts`
- **Status:** OK — `logEvent()` registra tentativas, sucesso e retry com duração. Transições `pending → processing → done/failed` cobertas.

### A8 — Frontend com ErrorBoundary global ✅
- **Arquivo:** `apps/web/src/main.tsx` ou `App.tsx`
- **Status:** OK — handlers `window.error` e `unhandledrejection` registrados.

## Plano de ação (batches)

### Batch B-O1 — Adoção do createLogger nas Edge Functions (8h)
- A1 (4 funções × 2h cada — ingest, process, generate, connect-drive)

### Batch B-O2 — Telemetria OpenRouter (2h)
- A2 (log.info start/end + extração de `usage` da response)

### Batch B-O3 — `request_id` ponta-a-ponta (6h)
- A3 — exige mudança em 3 camadas (front, log helper, schema de `job_events.metadata`)

### Batch B-O4 — Dashboard ops básico (4h)
- A5 — 2 SQLs em `tools/ops/` + doc em `docs/EXTRAS.md`

### Batch B-O5 — Sanitização frontend (0.5h)
- A4

**Total:** ~20h. 🔴 dominante: 3 itens (A1, A2, A3, A5).

## Formato JSON padronizado (referência)

```json
{
  "ts": "2026-05-27T18:32:14.123Z",
  "level": "info" | "warn" | "error",
  "fn": "process-document",
  "evt": "llm_start" | "llm_end" | "job_claim" | "drive_upload" | "error",
  "request_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid",
  "...campos_específicos": "..."
}
```

Já é o que `_shared/log.ts` produz; basta adoção universal e adicionar `request_id`.

## Validação

- A1: `grep -r "console\." supabase/functions/{ingest,process,generate,connect}-*/index.ts` deve retornar zero
- A2: log de qualquer chamada LLM bem-sucedida deve ter `evt: llm_start` e `evt: llm_end` com `usage` populado
- A3: chamar Edge Function com `X-Request-Id: abc` e ver o ID em todos os logs subsequentes + em `job_events.metadata.request_id`
- A5: `psql -f tools/ops/jobs-health.sql` retorna contagens por status nas últimas 24h

## Dependências

- A3 (request_id) destrava observabilidade de produção da Sprint 3 (necessário pra suporte do aluno)
- A1 + A2 destravam alertas no Supabase Logs (filtros por `evt` JSON)
- A5 destrava handoff pro Luis Felipe (QA) — checklist de smoke test após deploy

---
**Resumo numérico:** 8 achados | 🔴 4 / 🟡 1 / 🟢 3 | ~20h | Dono predominante: Isaac.
