# PSP2 - Auditoria S1 - Observabilidade e Logging

**Frente:** Observabilidade e logging
**Responsável sugerido:** Theo (GP/arquitetura) com apoio de Isaac (backend) e Pedro (frontend)
**Data:** 2026-05-26
**Branch auditada:** `feature/sprint1-finalization` (HEAD `991fd90`)
**Escopo:** Edge Functions (`supabase/functions/**`), frontend Vite/React (`apps/web/src/**`), pipeline assíncrono (`process-document`), scripts em `tools/`, migrations em `supabase/migrations/`.

---

## 1. Objetivo

Avaliar se o PSP2 hoje permite a um operador (Theo/Isaac/QA) responder, com base em logs, perguntas como:

1. "Qual job falhou para o aluno X às 14h32 e por quê?"
2. "Qual modelo foi usado na síntese do doc Y, quantos tokens custou e quanto demorou?"
3. "Quantas chamadas pro OpenRouter foram retried por 429 nas últimas 24h?"
4. "Esse erro `Uncaught TypeError` reportado por usuário aconteceu em qual rota e que stack?"
5. "Em que ponto exato do pipeline o job ficou preso há 5 minutos?"

Auditar se há (a) instrumentação suficiente, (b) correlação entre frontend/backend/pipeline, (c) ausência de PII em log, (d) painel pra consulta operacional.

---

## 2. Critério de aceitação

A frente está aprovada quando:

- Toda Edge Function loga **entrada** (com `request_id`/correlação), **saída** (status + duração) e **erro estruturado** em formato JSON consistente.
- O frontend tem **ErrorBoundary global** + handler para `unhandledrejection`/`window.onerror`, registrando rota e contexto mínimo.
- Pipeline async grava **toda transição de estado** (`pending→processing→done/failed`) em `job_events`, com `step`, `event_type`, `duration_ms` e (quando LLM) `model`, `tokens_input`, `tokens_output`, `cost_usd`.
- Chamadas a OpenRouter logam **modelo, latência, tokens, custo, tentativa de retry**, sem o conteúdo do prompt do aluno.
- Scripts em `tools/` têm output legível (sucesso/erro/contagem).
- Convenção de log level (`info/warn/error`) consistente e documentada em `CLAUDE.md`/README.
- Nenhum log do backend ou frontend imprime conteúdo de documento, prompt do aluno, email ou access/refresh token.
- Existe instrução documentada de como visualizar logs no Supabase Studio (Functions → Logs / SQL `job_events`) e como filtrar erros das últimas 24h.

---

## 3. Conteúdo — Achados

### 3.1 Visão geral do que JÁ existe

A base de logs **não é zero** — há decisões bem-feitas que merecem ficar registradas antes dos gaps:

- `console.error` está presente em todos os pontos de captura (`catch`) das 4 Edge Functions, com prefixo do nome da função (`ingest-document:`, `process-document:`, `connect-drive:`, `generate-system-prompt:`).
  - Exs.: `ingest-document/index.ts:91, 106, 120, 129`; `process-document/index.ts:86, 124, 383`; `connect-drive/index.ts:89, 122, 131, 140`; `generate-system-prompt/index.ts:72, 141, 151`.
- **Erros nunca vazam pro body** — `errorResponse()` retorna apenas código canônico + mensagem amigável (`supabase/functions/_shared/http.ts:32-61`). Decisão arquitetural correta, documentada no JSDoc (`http.ts:1-6, 28-31`).
- **Pipeline async já tem trilha de auditoria persistida** em `public.job_events` (`supabase/migrations/0001_initial_schema.sql:127-141`), com colunas dedicadas para `step`, `event_type` (`start | success | retry | warning | error`), `duration_ms`, `llm_model`, `tokens_input`, `tokens_output`, `cost_usd`. Isso é, para o pipeline LLM, o equivalente a um span estruturado.
- O `runPipeline()` em `process-document/index.ts:139-386` usa `setStep()` (`L143-150`) e `logEvent()` (`L152-161`) consistentemente em cada estágio (`parse`, `classify`, `synthesize`, `compress`, `nomenclature`, `upload_drive`), inclusive **por chunk** no caso de docs grandes (`L252-267`).
- RLS em `job_events` permite o próprio aluno ler seus eventos (`migrations/0001_initial_schema.sql:262-266`), o que viabiliza um painel "Atividade" no frontend (já existe rota em `apps/web/src/routes/AtividadePage.tsx`).
- Realtime publica `jobs`/`documents`/`generated_content` (`0001:303-307`) — o frontend reage a transições via `useJobsRealtime()` (`apps/web/src/hooks/useJobs.ts:31-85`) e dispara toast em mudança de status.

Sobre essa fundação, abaixo os gaps.

---

### 3.2 Achados — gaps e riscos

#### A1 — 🔴 Frontend sem ErrorBoundary e sem handler global de erro não-tratado

**Descrição.** O entrypoint da aplicação React não tem `ErrorBoundary`. `apps/web/src/main.tsx:1-11` apenas envolve o `App` em `<StrictMode>`, e `apps/web/src/App.tsx:47-103` empilha `QueryClientProvider → ToastProvider → BrowserRouter → Routes` sem nenhum boundary. Resultado: qualquer exceção lançada durante render de uma rota (`DashboardPage`, `OnboardingPage`, `SettingsPage`, ...) **derruba o app inteiro pra tela branca**, sem fallback amigável e sem log estruturado.

Adicionalmente, não há listener para:
- `window.addEventListener('error', ...)` — erros não-React fora do ciclo.
- `window.addEventListener('unhandledrejection', ...)` — Promises rejeitadas sem catch (caso típico: `fetch` direto sem `.catch`).

Verificado: `grep` por `ErrorBoundary|componentDidCatch|getDerivedStateFromError|unhandledrejection|window.onerror` em `apps/web/src` retornou **zero ocorrências**.

**Severidade:** 🔴 Alta — usuário final tem tela branca sem mensagem.
**Dono sugerido:** Pedro (frontend).
**Estimativa:** 2h.

---

#### A2 — 🔴 Ausência de `request_id` (correlation id) entre Frontend → Edge Function → `job_events` → Drive

**Descrição.** Hoje, quando algo dá errado, **não há fio condutor** que ligue:

- Toast vermelho que o aluno viu (`UploadDropzone.tsx:39-43`).
- Log `console.error('upload-${file.name}', err)` no DevTools dele.
- Linha do `console.error('ingest-document erro:', err)` no log da função Supabase (`ingest-document/index.ts:129`).
- Eventual job criado em `public.jobs` (sem `request_id` na coluna).
- Eventos em `public.job_events` (sem `request_id`).
- Chamada subsequente a `process-document` (passa `{job_id}` mas não propaga nenhum trace id — `ingest-document/index.ts:118-121`).
- Chamada do `process-document` ao OpenRouter (sem header `X-Request-Id` em `openrouter.ts:72-81`).

Resultado: pra debugar um caso reportado pelo aluno por print de toast, **o operador precisa filtrar logs por timestamp aproximado e cruzar com `created_at` do job**. Pra uma equipe de 5 e produção pequena, sobrevive; pra QA do Luis Felipe rodar relatório de bug, é lento e propenso a colar o log errado.

**Recomendação:** gerar `request_id` (UUID v4) no ponto mais alto possível (frontend, em cada submit de upload/connect-drive/etc.), propagar via header `X-Request-Id`, persistir em `jobs.request_id` e `job_events.request_id`, e ecoar no body de erro (`errorResponse` adicionar campo `request_id`).

**Severidade:** 🔴 Alta para operabilidade — sem isso a auditoria de incidentes vira arqueologia.
**Dono sugerido:** Isaac (backend) com apoio de Pedro (frontend).
**Estimativa:** 6h (geração + propagação + migration + ajuste de UI exibindo `request_id` em mensagem de erro pro aluno).

---

#### A3 — 🟡 Logs em texto livre — sem formato estruturado consistente

**Descrição.** Todas as chamadas de log das Edge Functions usam o padrão `console.error('contexto:', objetoErro)` (ver lista em §3.1). Isso vai pro Supabase Functions Logs como linha de texto. Para grepar/filtrar por user_id, função, código de erro, é necessário regex frágil.

Exemplos:
- `process-document/index.ts:383` — `console.error('runPipeline erro:', err)` (sem `job_id`, sem `user_id`).
- `connect-drive/index.ts:131` — `console.error('connect-drive update profile:', updateError)` (sem `user_id`).
- `ingest-document/index.ts:91, 106` — `console.error('ingest-document insert documents:', docError)` idem.

**Recomendação:** adotar formato JSON 1-linha por evento, no padrão:

```ts
function logJson(level: 'info'|'warn'|'error', evt: string, fields: Record<string, unknown>) {
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    JSON.stringify({ ts: new Date().toISOString(), level, fn: FN_NAME, evt, ...fields })
  );
}
```

E criar um helper em `supabase/functions/_shared/log.ts` para todas as Edge Functions reutilizarem. Supabase Functions Logs aceita JSON e fica filtrável por campo no Studio.

**Severidade:** 🟡 Média — funciona hoje, mas dificulta escala.
**Dono sugerido:** Isaac.
**Estimativa:** 4h (helper + refatorar 4 funções + atualizar testes).

---

#### A4 — 🟡 Edge Functions não logam ENTRADA (apenas SAÍDA em erro)

**Descrição.** Hoje as 4 Edge Functions logam **apenas no `catch`**. Em fluxo feliz, **não há log algum** no Supabase Functions Logs. Consequências:

- Não é possível saber se uma função foi chamada e devolveu 202/200 com sucesso sem ir ao DB.
- Não há registro do tempo total da função (latência observada).
- Não há registro do `user.id` (autenticado) nas chamadas de sucesso.

Pontos a instrumentar:
- `ingest-document/index.ts:37-132` — após autenticar, logar `evt: 'ingest.received'` com `user_id`, `format`, `size_bytes`; antes do `return`, logar `evt: 'ingest.accepted'` com `job_id`, `duration_ms`.
- `process-document/index.ts:56-89` — logar `evt: 'process.invoked'` com `job_id`, modo de auth (service_role vs user_jwt).
- `connect-drive/index.ts:47-143` — logar `evt: 'drive.connected'` com `user_id`, sem tokens.
- `generate-system-prompt/index.ts:30-154` — logar `evt: 'system_prompt.generated'` com `user_id`, `version`, `regenerated`.

**Severidade:** 🟡 Média.
**Dono sugerido:** Isaac.
**Estimativa:** 3h (integrado com A3).

---

#### A5 — 🟡 OpenRouter wrapper não loga nada (modelo, latência, tokens, retries)

**Descrição.** `supabase/functions/_shared/openrouter.ts:57-108` faz a chamada HTTP e retorna o resultado, **sem nenhum `console.log/info/warn`**. Em particular:

- `callLLMWithRetry` (`L134-153`) faz backoff em 429/5xx **silenciosamente** — não há registro de tentativas que falharam, só o erro final se `maxAttempts` for atingido.
- Erros `OpenRouterError` com status 4xx que **não são** transientes são propagados sem log até o `catch` do `runPipeline()` (`process-document/index.ts:382-385`), onde caem como `console.error('runPipeline erro:', err)` — perdendo o `status` HTTP, `model`, `body`.

Isso significa que **a única instrumentação de chamada LLM hoje é o que `runPipeline` insere em `job_events`** (cobertura boa para o caminho feliz, ver §3.1). Em caso de retry transitório, **a tentativa não fica registrada em lugar nenhum** — `job_events` só recebe o `success` final.

**Recomendação:** logar dentro de `callLLM` (start + end com `model`, `duration_ms`, `tokens_input`, `tokens_output`, `cost_usd`, `finish_reason`) e em cada retry de `callLLMWithRetry` (`evt: 'openrouter.retry'`, `attempt`, `status`, `delay_ms`). Adicionalmente, registrar `retry` em `job_events` (o enum `job_event_type` já suporta — `migrations/0001:31-33`).

**Severidade:** 🟡 Média — funciona, mas vira caixa-preta quando OpenRouter está instável.
**Dono sugerido:** Guilherme (IA) — ele é dono do wrapper.
**Estimativa:** 3h.

---

#### A6 — 🟡 PII e segredos: 1 ponto comprovado de log com PII potencial; tokens nunca logados (✅)

**Descrição.** Auditei 100% dos `console.*` em `supabase/functions/**` e `apps/web/src/**`. Resultado:

- **Acesso/refresh tokens Google:** ✅ nunca logados literalmente. Em `connect-drive/index.ts:89` o log é `console.error('connect-drive Drive API error:', err)` — `err` é um `DriveError` com `status` + `message` da API do Google, sem token. Conferido também em `process-document/index.ts:432-437` (rotação de tokens) — sem log.
- **Conteúdo de documento do aluno:** ✅ nunca logado. `parseResult.texto` (até 8 MiB de extração) só vai pra LLM e pra DB (`generated_content.markdown`), nunca pra `console.*`.
- **Conteúdo de prompt do aluno (system/user message):** ✅ nunca logado. `callLLM` em `openrouter.ts:57-108` não loga `messages`.
- **PII potencial — 🟡:**
  - `apps/web/src/hooks/useProfile.ts:76` — `console.warn('[useUpdateProfile] coluna "curso" não existe — salvando sem ela.', error)` — o objeto `error` vem do PostgREST e pode ter `details`/`hint`. Não chega a vazar dado do aluno, mas é log de DevTools (visível só ao próprio aluno, baixa criticidade).
  - `apps/web/src/components/UploadDropzone.tsx:42` — `console.error(tag, err)` onde `tag = upload-${file.name}` → o **nome do arquivo do aluno** vai pro DevTools dele mesmo (baixa criticidade, mas violaria política de minimização se algum dia pluga Sentry sem redação).
  - `apps/web/src/routes/LoginPage.tsx:109` — `console.warn('[consent] falha ao registrar:', e)` — `e` pode conter detalhes do PostgREST com `user_id`.

Nenhum risco crítico hoje, mas o ponto de atenção é: **se/quando entrar Sentry ou outro coletor que faz upload de console logs, esses pontos precisam estar mapeados para redaction**.

**Recomendação:** documentar em `CLAUDE.md` regra "todo `console.error` que captura `err` de PostgREST/Supabase deve `pickError(e)` antes de logar, expondo só `code`, `status`, `message` short". Helper de 5 linhas.

**Severidade:** 🟡 Média (preventivo — vira 🔴 no dia que ligar coletor remoto).
**Dono sugerido:** Pedro (frontend).
**Estimativa:** 2h.

---

#### A7 — 🟡 Não há painel/dashboard pra erros de Edge Functions

**Descrição.** Hoje a única forma de ver erros é abrir Supabase Studio → Functions → cada função, individualmente, e ler o stream. Não há:

- Query SQL pronta (em `tools/` ou `docs/`) tipo "últimos 50 erros das 4 funções nas últimas 24h".
- Indicador no frontend (admin/dev-only) de "X jobs failed nas últimas 24h".
- Alertas (e-mail, webhook) em pico de `jobs.status='failed'` ou `job_events.event_type='error'`.

Há base disponível: `public.job_events` é a fonte de verdade do pipeline, então uma SQL view ou um pequeno dashboard interno (mesmo que CLI em `tools/`) resolveria 80% dos casos.

**Recomendação:** criar `tools/ops/` com `errors-last-24h.sql` e `failed-jobs.sql`. Como follow-up (sprint 2), considerar página `/admin` no frontend (gated por allowlist de emails) com cards de "erros últimas 24h", "modelos mais caros", "latência p95 por estágio". Já existe `MetricsCards.tsx` no frontend — bom ponto de partida.

**Severidade:** 🟡 Média.
**Dono sugerido:** Theo (definir alvo) + Pedro (UI).
**Estimativa:** 3h SQL + 6h UI admin (opcional, sprint 2).

---

#### A8 — 🟢 Convenção de log level — informal mas consistente; falta documentar

**Descrição.** Por inspeção:

- `console.error` — exclusivamente em `catch` / falhas de DB.
- `console.warn` — fallback de schema (`useProfile.ts:76`), provider vision fallback (`vision/index.ts:67, 85`), consent best-effort (`LoginPage.tsx:109`).
- `console.log` — só em `tools/deliverable-docs/build.mjs:376` (output de progresso `✓ ...`).
- `console.info`/`console.debug` — não usados.

A convenção implícita é razoável (erro = falha real; warn = degradação graceful; log = progresso de tool). Falta apenas formalizar em `CLAUDE.md` ou `docs/` pra novos contribuidores não inventarem.

**Severidade:** 🟢 Baixa.
**Dono sugerido:** Theo.
**Estimativa:** 0.5h.

---

#### A9 — 🟢 Scripts em `tools/` têm output legível mínimo

**Descrição.** O único script presente hoje é `tools/deliverable-docs/build.mjs`. Output verificado:

- `L368` — `console.warn('Skipping ${file}: sem output path')` — informa quando pula.
- `L376` — `console.log('✓ ${path.relative(ROOT, out)}')` — informa cada arquivo gerado.
- `L380-383` — `main().catch((err) => { console.error(err); process.exit(1); })` — exit code correto em falha.

Suficiente pro propósito. Quando entrar mais script (migrations runner, seed, smoke test), aplicar o mesmo padrão.

**Severidade:** 🟢 OK.
**Dono sugerido:** —
**Estimativa:** —

---

#### A10 — 🟡 Migrations não usam `RAISE NOTICE` pra confirmar passos longos

**Descrição.** As 6 migrations (`supabase/migrations/0001..0006`) usam apenas `RAISE EXCEPTION` em 1 ponto (`0006_security_hardening.sql:348`, RPC `delete_my_account`). Nenhum `RAISE NOTICE` pra confirmar conclusão de blocos importantes (criação de RLS policies, seed do prompt library, etc.).

Quando rodar `supabase db push` manualmente (lembrar memória do Theo: 0003/0004/0005/0006 ainda não aplicadas em prod), o operador vê apenas "applied X migrations" sem o detalhe. Para uma migration de hardening (`0006`) com 350+ linhas, isso é desconfortável.

**Recomendação:** adicionar `do $$ begin raise notice 'PSP2: % policies aplicadas em job_events', count(...); end $$;` em blocos críticos.

**Severidade:** 🟡 Baixa-média (operacional, baixa frequência).
**Dono sugerido:** Isaac.
**Estimativa:** 1.5h.

---

#### A11 — 🟢 Pipeline logs em `job_events` cobrem retry? Não no nível LLM.

**Descrição.** O enum `job_event_type` já tem `retry` (`0001:31-33`), mas **nenhum lugar do código insere evento com `event_type='retry'`**. O `callLLMWithRetry` (`openrouter.ts:134-153`) faz retry interno e não notifica o caller. Quando OpenRouter retorna 429 e a chamada acaba dando sucesso na 2ª tentativa, o log final é só `success` com a duração inflada.

**Recomendação:** passar callback opcional `onRetry` pra `callLLMWithRetry`, e em `runPipeline` chamar `logEvent(step, 'retry', { message, llm_model })` em cada retry.

**Severidade:** 🟢 Baixa (observabilidade fina, não crítica).
**Dono sugerido:** Guilherme.
**Estimativa:** 1.5h.

---

### 3.3 Formato padronizado proposto

**Recomendação:** JSON estruturado 1-evento-por-linha, schema único pra Edge Functions + frontend (quando entrar coletor remoto).

```jsonc
{
  "ts": "2026-05-26T14:32:11.482Z",
  "level": "error",                    // info | warn | error
  "fn": "process-document",            // nome lógico do componente
  "evt": "openrouter.call",            // verb.noun
  "request_id": "req_8f3c1...",        // correlação ponta-a-ponta (A2)
  "user_id": "uuid-do-aluno",          // se autenticado
  "job_id": "uuid-do-job",             // se aplicável
  "step": "synthesize",                // se pipeline
  "model": "anthropic/claude-sonnet-4.6",
  "duration_ms": 1820,
  "tokens_input": 4231,
  "tokens_output": 1102,
  "cost_usd": 0.0181,
  "attempt": 1,
  "status": 200,
  "msg": "ok"                          // mensagem curta humana
}
```

Regras de redaction (helper `redactError(err)`):

- Nunca incluir: `messages[]`, `markdown`, `texto`, `provider_token`, `provider_refresh_token`, `google_access_token`, `google_refresh_token`, `email`.
- Sempre incluir, se vier de erro PostgREST: `code`, `details.length`, `hint` (truncado a 80 chars).
- Sempre incluir, se vier de `OpenRouterError`: `status`, `message` (truncada a 200 chars).

Manter em `supabase/functions/_shared/log.ts` (novo) com export `log.info / log.warn / log.error / log.fromError`.

---

### 3.4 Plano de ação em batches priorizados

Ordenado por **dor real do operador × esforço**. Sprint 2 sugerido.

**Batch OBS-1 — Fundação (8h, 🔴)**
Resolve A1 + A2 + parcial A3.
- (A1, 2h) `ErrorBoundary` global em `apps/web/src/components/ErrorBoundary.tsx`, envelopar Routes; `window.onerror` + `unhandledrejection` listeners em `main.tsx` chamando `console.error` estruturado.
- (A2, 6h) Helper `genRequestId()` em frontend (`lib/`); propagação via header `X-Request-Id` em todo `fetch`; migration `0007_add_request_id.sql` adicionando coluna em `jobs` e `job_events`; ajuste de `ingest-document` e `process-document` pra ler/persistir; `errorResponse` retorna `request_id` no body; UI mostra `request_id` em toast de erro pra aluno copiar em report.

**Batch OBS-2 — Estruturar Edge Function logs (7h, 🟡)**
Resolve A3 + A4.
- (4h) Criar `supabase/functions/_shared/log.ts` (helper `log.info/warn/error/fromError` em JSON 1-linha, com `redactError`).
- (3h) Refatorar 4 Edge Functions: log de entrada (`fn.received` com `user_id` + payload meta), log de saída (`fn.ok` com `duration_ms`), log de erro via `log.fromError`. Atualizar testes em `_shared/__tests__/`.

**Batch OBS-3 — Instrumentar OpenRouter (4.5h, 🟡)**
Resolve A5 + A11.
- (3h) Adicionar logs em `openrouter.ts` (`openrouter.call.start/end/retry` com model, attempt, status, latency, tokens, cost).
- (1.5h) `callLLMWithRetry` aceita `onRetry`; `runPipeline` registra `event_type='retry'` em `job_events`.

**Batch OBS-4 — Redaction defensiva no frontend (2h, 🟡)**
Resolve A6.
- Helper `pickErrorForLog(err)` em `apps/web/src/lib/log.ts`; aplicar nos 3 `console.error/warn` mapeados.
- Documentar regra em `CLAUDE.md`.

**Batch OBS-5 — Operacional (3.5h, 🟡 + 🟢)**
Resolve A7 (parcial) + A8 + A10.
- (3h) `tools/ops/errors-last-24h.sql`, `tools/ops/failed-jobs.sql`, `tools/ops/expensive-jobs.sql` (top jobs por `cost_usd_total`).
- (0.5h) Documentar convenção de log level em `CLAUDE.md`.
- (depois) `RAISE NOTICE` nas migrations futuras.

**Batch OBS-6 — Painel admin (12h, opcional sprint 3, 🟡)**
Resolve A7 completo.
- Rota `/admin` no frontend gated por allowlist (`profiles.email IN (...)`).
- Cards de erros últimas 24h, modelos mais usados, latência p95 por estágio, custo agregado por dia.
- Reuso de `MetricsCards.tsx`.

**Total bloqueante (OBS-1 a OBS-5):** ~25h, distribuído entre Pedro/Isaac/Guilherme.

---

## 4. Validação

Cada batch é considerado entregue quando:

- **OBS-1:** Forçar `throw new Error('x')` no render de `DashboardPage` mostra tela de erro amigável (não branca). Forçar `Promise.reject('y')` sem catch é capturado em listener global. Upload com bug propositado (ex.: mockar 500 no ingest-document) mostra toast com `request_id` no formato `req_xxxx`, e o mesmo `request_id` aparece grep'ável no log do Supabase Functions + na linha `jobs.request_id` do DB.
- **OBS-2:** `supabase functions logs ingest-document --tail` mostra linhas JSON 1-por-evento, filtráveis por `jq '.evt'`. Cada chamada gera no mínimo `fn.received` + (`fn.ok` ou `fn.error`).
- **OBS-3:** Forçar 429 no OpenRouter (mock) gera log `openrouter.retry attempt=1,2` e linha `event_type='retry'` em `job_events` para o job afetado.
- **OBS-4:** Greppar bundle de produção `dist/` por padrões de PII (`full_name`, `email`, tokens) em `console.*` retorna zero.
- **OBS-5:** Rodar `psql -f tools/ops/errors-last-24h.sql` lista os erros formatados; smoke test passa.

QA (Luis Felipe) executa um cenário de upload com falha proposital e consegue, em < 2 minutos, achar a linha de log correspondente apenas com o `request_id` que o aluno colou no report.

---

## 5. Dependências

- **Migrations pendentes (memória do Theo: 0003/0004/0005/0006 ainda não aplicadas em prod).** OBS-1 vai adicionar `0007_add_request_id.sql`. Aplicar tudo numa janela só evita arrastar contexto.
- **Não bloqueia, mas se houver intenção de Sentry/Logflare/Datadog (a equipe não usa hoje — `grep` por Sentry/Logflare/pino/winston em todo `apps`, `supabase`, `packages`, `tools` retorna zero):** decidir antes de OBS-2 pra escolher formato compatível. Recomendação: ficar em `console.*` JSON estruturado por enquanto, Supabase Functions Logs já captura — Sentry é tema de sprint 3+.
- **Auditoria de Segurança (Agente 2) e Privacidade/LGPD (Agente 3)** podem ter achados que mudam o que é PII e precisa de redaction. A regra do `redactError` no Batch OBS-2 deve ser revisada após esses relatórios para garantir alinhamento com a lista canônica de campos sensíveis.
- **`request_id` pode ser exibido ao aluno** em mensagem de erro — confirmar com Theo se quer expor (recomendado) ou só logar internamente.
