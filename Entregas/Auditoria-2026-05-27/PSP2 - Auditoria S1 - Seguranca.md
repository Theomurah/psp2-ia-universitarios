# PSP2 — Auditoria S1 — Segurança

**Frente:** Segurança
**Responsável sugerido:** Isaac (backend) + Theo (revisão arquitetural)
**Data:** 2026-05-27

## Objetivo

Confirmar que o SaaS não expõe chaves, dados de aluno nem rotas RLS-livres, e endurecer pontos de hardening pré-produção (rate-limit, encryption-at-rest, validações server-side).

## Critério de aceitação

- Nenhuma chave server-side (`OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`) referenciada em `apps/web/`
- Toda tabela com `user_id` tem RLS habilitado + policy ownership por operação
- Toda Edge Function valida o body com Zod e o header `Authorization`
- `process-document` tem rate limit (hoje só `ingest`, `generate`, `connect-drive` têm)
- `google_refresh_token` deixa de ser plain-text em repouso
- MIME/format validado server-side em `ingest-document` (não só no cliente)

## Achados

### A1 — `process-document` sem rate limit 🟡
- **Arquivo:** `supabase/functions/process-document/index.ts:115-116`
- **Dono:** Isaac
- **Descrição:** A função crítica do pipeline LLM não chama `checkRateLimit()`. Outras críticas (`ingest`, `generate`, `connect-drive`) já têm.
- **Risco:** Negação de serviço por força bruta de `job_id`; queima de quota do OpenRouter via fila enviesada.
- **Fix:** `await checkRateLimit('process:' + fingerprint, { max: 30, windowSec: 60 })` antes do claim atômico.
- **Explorável hoje?** Sim, em dev local.

### A2 — `ingest-document` sem validação server-side de `format` 🟡
- **Arquivo:** `supabase/functions/ingest-document/index.ts` (body schema)
- **Dono:** Isaac
- **Descrição:** O frontend valida MIME em `UploadDropzone` + `lib/upload.ts:25-32`, mas a Edge Function aceita `format` do cliente sem revalidar contra whitelist.
- **Risco:** Cliente malicioso pode declarar `format: "pdf"` num arquivo `.exe` e disparar parser errado.
- **Fix:** Adicionar enum Zod `z.enum(['pdf','docx','pptx','md','image'])` no schema do body + verificar extensão real do `storage_path`.

### A3 — `google_refresh_token` em plain-text 🟡
- **Arquivo:** `supabase/functions/_shared/drive/oauth.ts:73-81` + `supabase/migrations/0004_drive_oauth.sql`
- **Dono:** Isaac + Theo
- **Descrição:** Refresh token persistido em coluna `text` sem encryption-at-rest aplicacional (depende só da encryption do Supabase no disco).
- **Risco:** Vazamento via backup, dump, ou compromisso de service_role expõe tokens longos prazo.
- **Fix:** Cifrar com `pgcrypto` (`pgp_sym_encrypt`) usando chave em vault; wrapper transparente em `_shared/drive/oauth.ts`.
- **Explorável hoje?** Não diretamente, depende de outro vetor.

### A4 — Markdown sem sanitização estrutural antes do Drive 🟡
- **Arquivo:** `supabase/functions/_shared/drive/index.ts` (cf. `process-document/index.ts:489-494`)
- **Dono:** Guilherme + Isaac
- **Descrição:** `MAX_MARKDOWN_BYTES = 1 MB` cobre tamanho mas não conteúdo. Markdown LLM-gerado pode conter `<script>`, `javascript:` em links, ou HTML embutido.
- **Risco:** Se o aluno abrir o markdown em viewer HTML (ex: GitHub) → XSS.
- **Fix:** Filtro de allowlist Markdown (sem HTML inline, sem `javascript:` em URLs) antes do upload pro Drive.

### A5 — `REDACT_KEYS` incompleto 🟢
- **Arquivo:** `supabase/functions/_shared/log.ts:28-43`
- **Dono:** Isaac
- **Descrição:** Faltam variantes históricas de chaves LLM (`gpt_key`, `openai_key`) e o campo `json` pode conter markdown privado se logado sem cuidado.
- **Fix:** Acrescentar variantes; adicionar nota redirecionando `json` pra sanitização contextual.

### A6 — Rate limit in-memory não distribuído 🟢
- **Arquivo:** `supabase/functions/_shared/rate-limit.ts:19`
- **Dono:** Isaac
- **Descrição:** Instâncias horizontais de Edge têm contadores separados — limite efetivo = N × limite configurado.
- **Status:** Documentado in-code. Roadmap: Upstash Redis se carga > 1k req/s.
- **Horas:** 0 (já registrado).

### A7 — RLS / CORS / Prompt-injection / Signed URLs / Validação Zod / Chaves 🟢 ✅
- **Status:** Já corretos. Confirmado em:
  - `supabase/migrations/0001_initial_schema.sql:242-307` — RLS + policy por user em 8 tabelas, reforçado em `0006` com `to authenticated` + `WITH CHECK`
  - `supabase/migrations/0011_advisor_fixes.sql:25-73` — multiple-permissive-policies consolidado por ação (admin + ownership em policy única)
  - `supabase/functions/_shared/cors.ts:32-43` — whitelist + echo de Origin + `Vary: Origin` (linha 41), retorno vazio fora da lista
  - `supabase/functions/_shared/pipeline.ts:18-30` — sandbox `<<DOC>>...<</DOC>>` + remoção de delimitadores prévios + `SANDBOX_INSTRUCTION` no system prompt
  - `apps/web/src/lib/upload.ts:25-32` — confere `access_token` antes de subir pro Storage (evita órfãos)
  - Chaves server-side (`OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`) só em `Deno.env.get()`, nunca em `apps/web/`
  - Validação Zod em `ingest`, `process`, `connect-drive`

## Plano de ação (batches)

### Batch B-S1 — Hardening rápido (2h)
- A1 (rate limit em process-document) — 1h
- A2 (Zod enum format em ingest-document) — 1h

### Batch B-S2 — Sanitização de output LLM (2h)
- A4 (filtro markdown antes do Drive) — 2h

### Batch B-S3 — Encryption-at-rest Google OAuth (3h)
- A3 (pgcrypto wrapper para refresh_token) — 3h
- Requer migration nova (0013) + rewrite de `_shared/drive/oauth.ts`

### Batch B-S4 — Logging/redaction (1h)
- A5 (REDACT_KEYS extras) — 1h

**Total:** ~8h ativas (A6 zerado, A7 já feito).

## Validação

- A1: chamar `process-document` 35× em 60s deve retornar 429 a partir da 31ª
- A2: payload com `format: 'exe'` deve retornar 400 com mensagem Zod
- A3: `select google_refresh_token from drive_credentials` deve retornar string binária / não-decodificável; uso da função deve continuar transparente
- A4: payload markdown com `<script>` ou `javascript:` em link rejeitado antes de chegar ao Drive API
- A5: log de evento com chave `gpt_key` deve aparecer redacted

## Dependências

- Sprint 2 (Google Drive) só consegue produção segura após **B-S3** (encryption do refresh_token)
- Sprint 3 (deploy real) precisa de **B-S1 + B-S2** antes
- Sem dependência cruzada com migrations 0003-0006 pendentes em prod (issue separada de devops)

---
**Resumo numérico:** 12 achados | 🔴 0 / 🟡 5 / 🟢 7 | ~8h ativas + 0h itens já feitos | Dono predominante: Isaac.
