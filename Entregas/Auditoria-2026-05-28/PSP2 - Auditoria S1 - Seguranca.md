# PSP2 — Auditoria S1 — Segurança

**Frente:** Segurança
**Data:** 2026-05-28
**Responsável pela auditoria:** Agente 3 (revisão automatizada)
**Donos sugeridos:** Theo (arquitetura/secrets) · Isaac (backend/RLS) · Pedro (frontend/sanitização)

---

## 1. Objetivo

Confirmar, em cima da auditoria anterior (2026-05-27), que:

- Nenhum segredo server-side vazou pra `apps/web/` ou pro repositório.
- Todas as tabelas com `user_id` mantêm RLS habilitado + policies de ownership por operação.
- Toda Edge Function valida Authorization + body (Zod) + CORS por whitelist + rate limit.
- Token OAuth do Google, prompt-injection no pipeline LLM, MIME server-side, signed URLs e logging de PII estão sob controle.
- O que sobrou da auditoria 27/05 ainda está aberto (e quantificar quanto é explorável **hoje**, com o produto rodando só em dev/staging).

---

## 2. Critério de aceitação

| Item | Status |
|---|---|
| Sem `sk-*`, `service_role`, `GOOGLE_CLIENT_SECRET` literais em `apps/web/` ou em commit do repo | ✅ confirmado (`git grep` limpo, só `Deno.env.get(…)` + `.env.example`) |
| RLS ON em **toda** tabela `public.*` com `user_id`, com policy por operação | ✅ 8 tabelas + `user_consents` cobertas em `0001` + `0006` + `0009` + `0011` |
| Edge Functions com Zod + Authorization + CORS strict + rate limit | ⚠️ `process-document` ainda **sem rate limit** (A1 herdado) |
| `google_refresh_token` cifrado em repouso (encryption-at-rest aplicacional) | ❌ ainda plain-text (A3 herdado) |
| MIME / extensão validados server-side (não só no cliente) | ⚠️ `format` validado por enum Zod, mas **não** cross-checado contra extensão real do `storage_path` |
| Sandbox `<<DOC>>…<</DOC>>` em todos os calls LLM com input do aluno | ✅ aplicado em `classify`/`synthesize`/`compress` + chunked recursivo |
| Signed URL TTL curto / escopo por usuário | ✅ N/A — upload direto via JWT + bucket policy (sem signed URL exposto) |
| OAuth Google scope mínimo (`drive.file`) | ✅ confirmado em `_shared/drive/oauth.ts:80` |
| `REDACT_KEYS` cobre tokens/PII em `_shared/log.ts` | ⚠️ não cobre variantes `gpt_key`/`openai_key` (A5 herdado) nem `provider`/`id_token` |
| Edge Functions usando `createLogger` em vez de `console.error` cru de PostgrestError | ❌ ainda usam `console.error(err)` direto — risco de vazar `details`/`hint` (S-06 herdado) |
| CORS por whitelist (sem `*`) com echo seguro de Origin | ✅ `_shared/cors.ts:32-43` |

---

## 3. Achados

### 🟡 A1 — `process-document` ainda sem rate limit (herdado, **não fixado**)

- **Arquivo:** `supabase/functions/process-document/index.ts:65-99` (entrypoint)
- **Dono:** Isaac
- **Descrição:** A função crítica do pipeline LLM continua sem `checkRateLimit()`. As outras três (`ingest`, `connect-drive`, `generate-system-prompt`) têm. A função aceita JWT do dono do job **ou** service_role como Authorization, e dispara o pipeline em `EdgeRuntime.waitUntil()`. Cada call consome 3-5 chamadas OpenRouter.
- **Risco:** um aluno autenticado pode disparar pipelines em loop sobre jobs próprios (claim atômico previne dupla execução do *mesmo* job, mas múltiplos jobs em sequência queimam quota OpenRouter sem limite). Em produção, sem teto de custo por usuário, vira incidente financeiro.
- **Fix:** após `parsed.success`, antes do `authorizeProcessDocument`, adicionar
  ```ts
  const fp = clientFingerprint(req, /* user id se já extraído ou null */);
  const rl = checkRateLimit(`process:${fp}`, { max: 30, windowSec: 60 });
  if (!rl.ok) return errorResponse(req, 'rate_limited', 429);
  ```
  O `fingerprint` pode ser feito a partir do `job_id` + IP enquanto o user ainda não foi resolvido — ou rate-limitar **depois** do `authorizeProcessDocument` com `user.id`.
- **Explorável hoje?** ✅ Sim, em dev. Em produção idem assim que `OPENROUTER_API_KEY` for setada.
- **Esforço:** 1h.

### 🟡 A2 — `format` aceito sem cross-check contra extensão / magic bytes (herdado parcial)

- **Arquivos:** `supabase/functions/ingest-document/index.ts:65-69` + `packages/shared/src/schemas.ts:UploadRequestSchema`
- **Dono:** Isaac
- **Descrição:** Hoje o `format` está validado por `z.enum(['pdf','docx','pptx','md','image'])` — bom. Mas o cliente envia `storage_path` separadamente e o servidor **não confere** que a extensão do `storage_path` casa com o `format` (nem checa magic bytes ao abrir o blob). `parseDocument(buffer, formato, mimeType)` confia no `formato` declarado.
- **Risco:** cliente malicioso sobe `payload.exe`, declara `format: 'pdf'`, e força o parser PDF (que falhará e marcará job como failed). É um vetor de gasto de quota + ruído nos logs, não de RCE — o parser opera sobre buffer, sem execução. Severidade: amarela.
- **Fix:**
  ```ts
  const ext = storage_path.split('.').pop()?.toLowerCase();
  const EXT_BY_FORMAT = { pdf: ['pdf'], docx: ['docx'], pptx: ['pptx'], md: ['md','txt'], image: ['png','jpg','jpeg','webp','heic'] };
  if (!ext || !EXT_BY_FORMAT[format].includes(ext)) {
    return errorResponse(req, 'invalid_body', 400, 'Extensão não casa com formato declarado.');
  }
  ```
- **Explorável hoje?** ✅ Sim — qualquer aluno logado faz upload de arquivo com extensão divergente.
- **Esforço:** 30 min.

### 🟡 A3 — `google_refresh_token` ainda em plain-text no DB (herdado, **não fixado**)

- **Arquivos:** `supabase/migrations/0004_drive_oauth.sql:14-17` + `supabase/functions/connect-drive/index.ts:99-108`
- **Dono:** Isaac + Theo
- **Descrição:** Tokens vivem em `profiles.google_refresh_token text` sem encryption aplicacional. Confiança hoje é só na encryption-at-rest do disco Supabase + RLS. Em backup/dump/compromisso de service_role, tokens longos vazam.
- **Risco:** depende de outro vetor (vazamento de service_role, backup mal-protegido, advisor admin SECURITY DEFINER mal-escrita). Não explorável diretamente, mas é a maior dívida de segurança pré-produção.
- **Fix:** envolver com `pgcrypto.pgp_sym_encrypt` usando chave em Supabase Vault. Wrapper transparente em `_shared/drive/oauth.ts`. Migration 0013.
- **Explorável hoje?** ❌ Não diretamente.
- **Esforço:** 3h (migration + wrapper + reseed tokens em testes).

### 🟡 A4 — Edge Functions logam `PostgrestError` cru (herdado, **não fixado**)

- **Arquivos:**
  - `supabase/functions/ingest-document/index.ts:91,106`
  - `supabase/functions/process-document/index.ts:134,171`
  - `supabase/functions/generate-system-prompt/index.ts:72,141`
  - `supabase/functions/connect-drive/index.ts:89,122,131,140`
- **Dono:** Isaac
- **Descrição:** Padrão `console.error('xxx insert:', error)` ainda passa pro stdout o objeto inteiro do `PostgrestError`, que pode conter `details` e `hint` com conteúdo da row (ex: titulo de doc do aluno, identificador). O helper `_shared/log.ts` (`createLogger` + `fromError`) **já existe e já redacta**, mas nenhuma Edge Function migrou. CLAUDE.md (§ Convenção de logging) trata isso como obrigatório.
- **Risco:** PII / conteúdo de documento do aluno vaza para logs do Supabase Studio. Quem tiver acesso ao Studio (= qualquer admin futuro) lê tudo.
- **Fix:** trocar `console.error('xxx:', err)` por
  ```ts
  const log = createLogger('ingest-document');
  log.error('insert_failed', log.fromError(err));
  ```
  em cada um dos 4 entrypoints.
- **Explorável hoje?** Parcial — em dev local o log fica no terminal; em produção fica no Supabase logs (auditável pela equipe). Severidade amarela porque o vetor exige acesso aos logs.
- **Esforço:** 4h (todas as 4 funções).

### 🟡 A5 — Markdown gerado pelo LLM não passa por sanitização antes do Drive (herdado, **não fixado**)

- **Arquivo:** `supabase/functions/process-document/index.ts:485-495` + `_shared/drive/upload.ts:uploadMarkdown`
- **Dono:** Isaac (+ Guilherme se houver sanitizer pronto)
- **Descrição:** Cap de 1 MB existe (`MAX_MARKDOWN_BYTES`), mas o **conteúdo** não é filtrado. LLM pode emitir `<script>`, `<iframe>`, `javascript:` em links, ou HTML embutido. O Drive vai armazenar como `text/markdown`, mas se o aluno abrir o `.md` num viewer que renderiza HTML (GitHub Gist, qualquer share público, MarkdownPreview do próprio app), vira XSS.
- **Risco:** depende da rota de visualização. Hoje o `MarkdownPreview.tsx` do app usa `react-markdown` + `rehype-sanitize`? Vale conferir em paralelo no front (escopo do Pedro).
- **Fix:** antes de `uploadMarkdown`, rodar filtro allowlist (`rehype-sanitize` no servidor é exagero; uma regex simples removendo `<script>`, `<iframe>`, `<object>`, `<embed>` e neutralizando `javascript:`/`data:text/html` em links já elimina o vetor prático).
- **Explorável hoje?** Não — `T30` ainda não rodou Drive em produção, pipeline LLM não executa sem secrets. Mas marca pré-Sprint 3.
- **Esforço:** 2h.

### 🟢 A6 — `REDACT_KEYS` incompleto (herdado, **não fixado**)

- **Arquivo:** `supabase/functions/_shared/log.ts:28-43`
- **Dono:** Isaac
- **Descrição:** Faltam variantes históricas de chaves LLM (`gpt_key`, `openai_key`, `anthropic_key`, `api_key`) e o conjunto não cobre `id_token` nem campos vindos do Supabase Auth (`provider`, `provider_id`). Como ninguém ainda usa `createLogger` (ver A4), o gap é hipotético — quando A4 for resolvido, vale ampliar.
- **Risco:** zero hoje (helper não está em uso).
- **Fix:** acrescentar `'gpt_key'`, `'openai_key'`, `'anthropic_key'`, `'api_key'`, `'id_token'`, `'provider_token'` (já presente), `'provider_refresh_token'` (presente). Bom também: redactar valores que se parecem com Bearer tokens via regex (`/^[a-zA-Z0-9_\-]{40,}$/` → `[redacted-likely-token]`).
- **Esforço:** 30 min.

### 🟢 A7 — Logs do `errorResponse` não diferenciam erro de cliente de erro de servidor

- **Arquivo:** `supabase/functions/_shared/http.ts:32-42`
- **Dono:** Isaac
- **Descrição:** O `errorResponse` devolve sempre body `{ error, message }` — bom. Mas o frontend hoje (`apps/web/src/lib/upload.ts:60-63`) joga o `await res.text()` inteiro no `Error.message`, e o `console.error` na UploadDropzone manda o err pro console **cru**. Se um endpoint futuro mudar `errorResponse` pra incluir mais campos, isso pode acabar nos logs do browser.
- **Risco:** baixíssimo hoje (apenas `error` + `message` curto). Mas é uma armadilha de manutenção: o frontend deveria parsear `{ error }` e exibir `defaultMessageForCode` em vez de concatenar.
- **Fix:** `lib/upload.ts` → `const { error, message } = await res.json(); throw new Error(message ?? error);`. Mesmo padrão nas outras fetches da web (`apps/web/src/hooks/usePromptLibrary.ts`, etc.).
- **Esforço:** 1h.

### 🟢 A8 — Rate limit in-memory ainda não-distribuído (herdado, documentado)

- **Arquivo:** `supabase/functions/_shared/rate-limit.ts:19`
- **Dono:** Isaac
- **Descrição:** Replicado da auditoria anterior — em N instâncias horizontais o limite efetivo é N×configurado. Doc roadmap (`Upstash Redis`) já está in-code.
- **Status:** aceitar até carga > 1k req/s. Sem ação.

### 🟢 A9 — Funções `admin_*` `SECURITY DEFINER` expostas a `authenticated` (advisor warn)

- **Arquivos:** `supabase/migrations/0009_admin_panel.sql` + `0010_admin_hardening_and_metrics.sql`
- **Dono:** Isaac + Theo
- **Descrição:** 11 RPCs admin (`admin_metrics_overview`, `admin_recent_jobs`, `admin_recent_users`, `admin_set_setting`, `admin_metrics_timeseries`, `admin_top_users`, `admin_pipeline_breakdown`, `admin_materia_distribution`) são `SECURITY DEFINER` com `grant execute … to authenticated`. **Todas** checam `public.is_admin()` no corpo, então o desenho é correto (defesa em profundidade), mas o advisor reporta. `delete_my_account()` e `export_user_data()` também são SECURITY DEFINER (LGPD by design).
- **Risco:** zero. Cada RPC raise `42501` se `is_admin()` for false.
- **Status:** já documentado em `docs/PENDENCIAS.md`. Sem ação além de citar no relatório do artigo.

### 🟢 A10 — `auth_leaked_password_protection` desativado em prod (operacional)

- **Onde:** Supabase Dashboard → Auth → Settings
- **Dono:** Theo
- **Descrição:** Advisor de auth reporta. HaveIBeenPwned check desabilitado.
- **Fix:** 1 clique no Dashboard.
- **Esforço:** 5 min.

### 🟢 A11 — `ALLOWED_ORIGINS` ainda não setado em produção (operacional)

- **Onde:** `supabase secrets set ALLOWED_ORIGINS="https://psp2-ia-universitarios.vercel.app"` (ou domínio final)
- **Dono:** Theo
- **Descrição:** Sem essa env, `cors.ts:17-21` cai pro default `localhost:5173/4173/127.0.0.1:5173` — em produção isso significa que o frontend hospedado **não receberá** `Access-Control-Allow-Origin`, e qualquer browser bloqueará as Edge Functions. Já documentado em PENDENCIAS, mas é um bloqueador de deploy.
- **Risco:** quebra prod no primeiro request real, sem janela de exploração.
- **Esforço:** 5 min (1 comando).

### 🟢 A12 — `0008_admin_role.sql` faz `do $$ … raise exception …$$` em ambiente novo

- **Arquivo:** `supabase/migrations/0008_admin_role.sql:62-77`
- **Dono:** Theo
- **Descrição:** Não é falha de segurança, mas é uma armadilha de deploy: a migration **falha** se ninguém com email `theo.murah@gmail.com` ainda criou conta. Em produção fresh, ou em ambiente de QA isolado, o deploy quebra. Marcando aqui porque a frente pediu pra olhar dependências.
- **Fix:** transformar o sanity check num `raise notice` em vez de `raise exception`. Ou condicionar a migration ao ambiente.
- **Severidade:** verde (operacional, não segurança), mas vale fixar.
- **Esforço:** 15 min.

---

## 4. Itens ✅ verificados e mantidos sãos

- **Sem secrets vazados:** `git grep -E "(sk-or-v1|sk-[a-zA-Z0-9]{20,}|service_role|SERVICE_ROLE_KEY|GOOGLE_CLIENT_SECRET|OPENROUTER_API_KEY)"` em `apps/web/` → 0 hits. No repo todo, só `.env.example`, `Deno.env.get(…)` e docs.
- **RLS:** 8 tabelas iniciais + `user_consents` (0006) + `app_settings` (0009, read-aberto autenticado, write via RPC admin) + `prompt_library` (admin via OR policy em 0009) — todas com policies por operação (`select/insert/update/delete`) + `to authenticated` + `with check`.
- **Storage policy:** bucket `documents` privado, policies escopadas por `(storage.foldername(name))[1] = auth.uid()::text` (`0002`). Frontend confirma sessão antes de subir (`apps/web/src/lib/upload.ts:25-32`, fix do auditor 26-05).
- **CORS:** whitelist via `ALLOWED_ORIGINS` env, echo seguro do Origin, retorno `''` fora da lista, `Vary: Origin` presente (`_shared/cors.ts:32-43`).
- **Validação Zod nos 4 entrypoints:** `ingest-document` (`UploadRequestSchema`), `process-document` (`ProcessDocumentBodySchema` UUID estrito), `connect-drive` (`ConnectDriveSchema`), `generate-system-prompt` (sem body, mas valida Authorization).
- **Authorization checado:** `verify_jwt = true` declarado em `supabase/config.toml:46-56` para as 4 funções + `createAuthClient(req).auth.getUser()` em cada handler. `process-document` aceita também `Bearer SERVICE_ROLE_KEY` (chamada interna) com check explícito (`process-document/index.ts:104-144`).
- **Prompt-injection sandbox:** `<<DOC>>...<</DOC>>` aplicado em `classify`/`synthesize`/`compress` (`_shared/pipeline.ts:18-30, 70-82, 132-141, 188-197`). `synthesizeChunked` (T24) recorre em `synthesize`, então o sandbox propaga pra chunks e reduce.
- **OAuth scope:** `drive.file` em `_shared/drive/oauth.ts:80` — mínimo possível pra ler/escrever só os arquivos criados pelo app.
- **MIME server-side parcial:** `format` validado por enum Zod no body (não basta — ver A2).
- **Logging baseline:** helper `_shared/log.ts` existe com `REDACT_KEYS` + truncate de strings + `fromError` que descarta `details`/`hint`. Falta migrar as Edge Functions (A4).
- **CI gate de deploy:** `.github/workflows/deploy-functions.yml` exige `needs: validate` antes de subir Edge Function.
- **`config.toml` verify_jwt explícito** por função (commit `abe11bd`).

---

## 5. Plano de ação (batches)

### Batch B-S1 — Hardening rápido (≈ 2h)
- **A1** — rate limit em `process-document` — 1h — *Isaac*
- **A2** — cross-check `format` × extensão de `storage_path` — 30 min — *Isaac*
- **A11** — setar `ALLOWED_ORIGINS` em prod — 5 min — *Theo*
- **A10** — habilitar leaked password protection — 5 min — *Theo*

### Batch B-S2 — Logging e PII (≈ 5h)
- **A4** — migrar 4 Edge Functions pra `createLogger` + `log.fromError` — 4h — *Isaac*
- **A6** — ampliar `REDACT_KEYS` (chaves LLM legadas + id_token + regex bearer) — 30 min — *Isaac*
- **A7** — frontend parsea `{ error, message }` de Edge Function — 1h — *Pedro*

### Batch B-S3 — Sanitização markdown LLM → Drive (≈ 2h)
- **A5** — filtro allowlist antes de `uploadMarkdown` — 2h — *Isaac*

### Batch B-S4 — Encryption-at-rest do refresh token Google (≈ 3h)
- **A3** — `pgcrypto` wrapper + migration 0013 + rewrite de `_shared/drive/oauth.ts` — 3h — *Isaac + Theo*

### Batch B-S5 — Higiene operacional (≈ 15 min)
- **A12** — migration 0008 sanity check vira notice — 15 min — *Theo*
- **A9** — documentar no artigo que os SECURITY DEFINER admin têm check duplo — *N/A horas, só documentação*

**Total ativo:** ≈ 12h. (A8 segue documentada e zero horas.)

---

## 6. Validação

| Achado | Como confirmar |
|---|---|
| A1 | Disparar `process-document` 35× em 60s deve retornar 429 a partir da 31ª resposta. |
| A2 | POST `/ingest-document` com `format:"pdf"` + `storage_path` terminado em `.exe` deve retornar 400 `invalid_body`. |
| A3 | `select google_refresh_token from profiles` retorna binário/bytea — não string legível. Pipeline Drive segue funcionando. |
| A4 | `console.error` zero em entrypoints; logs em Studio aparecem como JSON 1-linha; `fromError` testado com PostgrestError mockada redacta `details`/`hint`. |
| A5 | Síntese contendo `<script>alert(1)</script>` rejeitada antes de chegar em `uploadMarkdown`. |
| A6 | Log de evento com `{ gpt_key: "sk-..." }` aparece `[redacted]`. |
| A7 | Erro 500 simulado mostra mensagem amigável (`defaultMessageForCode`) em toast, não JSON cru. |
| A10/A11 | Dashboard Supabase: flag de leaked-pw ON; `supabase secrets list` mostra `ALLOWED_ORIGINS`. |
| A12 | Apagar admin local + rerodar migration → completa sem erro. |

---

## 7. Dependências

- Sprint 2 H6 (Drive em produção) **só vira segura após B-S4 (A3) + B-S3 (A5)**.
- Sprint 3 (deploy real) **bloqueia em B-S1 (A1+A2+A10+A11)**.
- B-S2 (logging) deveria preceder o smoke test com 50 docs (T26 da Sprint 2), porque vai inevitavelmente surfar erros que precisam ser legíveis sem PII.
- Sem dependência com a frente Banco de Dados de hoje (A3 mexe em coluna existente, não em schema novo).
- Sem dependência com migrations 0003-0012 (todas já aplicadas em prod conforme PENDENCIAS § Migrations sincronizadas).

---

## 8. Resumo numérico

**Total:** 12 achados | 🔴 0 / 🟡 5 / 🟢 7 | ≈ 12h ativas + 0h itens documentados.

**Exploráveis hoje (com produto em dev/staging):**
- A1 (rate limit ausente em `process-document`) — queima quota OpenRouter por loop.
- A2 (format sem cross-check) — upload de extensão divergente passa.
- A4 (PostgrestError cru no log) — vaza PII para quem tem acesso ao Supabase logs.

**Não-exploráveis hoje, mas críticos pré-prod:**
- A3 (refresh token plain-text) — depende de outro vetor.
- A5 (markdown LLM sem sanitização) — depende de Drive estar em uso real.
- A11 (`ALLOWED_ORIGINS` faltando) — quebra prod no primeiro request.

**Dono predominante:** Isaac (8 achados). Theo aparece em 4 (decisões + ops).

**Top 3 críticos:**
1. **A3** — `google_refresh_token` plain-text. Maior dívida pré-produção.
2. **A1** — rate limit em `process-document`. Mais barato de explorar, mais barato de fixar (1h).
3. **A4** — logs de PostgrestError cru. Resolver isso destrava a observabilidade boa pro teste de 50 docs (T26).
