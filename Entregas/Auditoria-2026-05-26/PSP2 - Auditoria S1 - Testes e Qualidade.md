# PSP2 — Auditoria Sprint 1 — Frente: Testes e Qualidade

| Campo | Valor |
|---|---|
| **Frente** | Testes e qualidade (Agente 5) |
| **Responsável sugerido** | Luis Felipe (QA) — apoio Theo (GP/arquitetura) e Isaac (backend) |
| **Data** | 2026-05-26 |
| **Branch auditada** | `feature/sprint1-finalization` |
| **Sprint coberta** | Sprint 1 (com observações sobre módulos S2 já mergeados) |

---

## 1. Objetivo

Avaliar o estado da automação de testes, tipagem, lint, CI e processo de QA do repositório PSP2. Identificar lacunas que impeçam a equipe de validar com confiança o caminho crítico do produto (login → upload → pipeline async LLM → entrega Markdown no Drive) antes da Sprint 3 (testes com usuários reais) e da submissão do artigo ENEGEP.

## 2. Critério de aceitação

A auditoria é considerada aceita quando:

- **A.1** — Toda função pública de `supabase/functions/_shared/**` e de `packages/shared/src/**` listada em `vitest.config.ts:include` (`vitest.config.ts:41`) está coberta por pelo menos um teste com asserção de comportamento, não só de "não throw".
- **A.2** — Os 4 handlers `index.ts` das Edge Functions (`ingest-document`, `process-document`, `connect-drive`, `generate-system-prompt`) têm teste de contrato cobrindo: 200 happy-path, 401 sem auth, 405 método errado, 400 payload inválido, 429 rate-limit (onde aplicável).
- **A.3** — Existe pelo menos 1 teste de integração end-to-end do pipeline `ingest → process → drive` rodando contra mocks determinísticos (fetch stub do OpenRouter + Storage in-memory), executado no CI.
- **A.4** — Frontend (`apps/web/`) tem pelo menos teste de smoke em componentes do caminho crítico (`UploadDropzone`, `JobCard`, `RequireAuth`, `LoginPage`) e hooks (`useAuth`, `useJobs`, `useProfile`) usando Vitest + Testing Library.
- **A.5** — `npm run typecheck` e `npm run lint` rodam em CI nos 3 workspaces (root + web + shared) sem warning ignorado; `strict: true` mantido no `tsconfig.base.json`.
- **A.6** — CI tem job separado de cobertura mínima (>= 70% nas linhas de `_shared` e `packages/shared/src`).
- **A.7** — Existe um documento `Testes Manuais/Smoke Checklist` versionado no repo (não só em `.docx`), com checklist por release/feature, mantido pelo QA.
- **A.8** — Cada critério de aceitação descrito nas tarefas Sprint 1 (T01–T21) tem rastreio para pelo menos 1 teste automatizado **OU** 1 item de smoke manual documentado.

---

## 3. Conteúdo — Achados

### 3.1 O que está bem feito

| Item | Evidência |
|---|---|
| Vitest configurado com aliases para imports estilo Deno (`npm:foo@x`) | `vitest.config.ts:27-35` |
| Shim de `Deno.env` injetado globalmente para rodar Edge Functions em Node | `tests/setup.ts:23-31` |
| `tsconfig.base.json` com `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` | `tsconfig.base.json:9-17` |
| CI roda lint + typecheck + test + build + `npm audit --audit-level=high` + CodeQL | `.github/workflows/ci.yml:30-79` |
| 140 testes passando, 14 suítes, sem rede real (chamadas a OpenRouter / Google Drive 100% mockadas via `vi.spyOn(globalThis, 'fetch')`) | `npm test` (executado nesta auditoria) e ex.: `supabase/functions/_shared/__tests__/drive.upload.test.ts:21` |
| Cobertura forte em `parsers.*`, `chunking`, `validation`, `prompts`, `schemas`, `system-prompt`, `openrouter`, `drive/*` | `supabase/functions/_shared/__tests__/` (13 arquivos, 1269 linhas) |
| ESLint flat config v9 + plugin TS + regras pragmáticas | `apps/web/eslint.config.js:1-65` |
| Deploy de Edge Functions automatizado em push de `main` quando `supabase/functions/**` muda | `.github/workflows/deploy-functions.yml:10-17` |
| Mocks documentados (cada arquivo de teste explica por que mocka o que mocka) | ex.: `openrouter.test.ts:2`, `parsers.image.test.ts:5` |

### 3.2 Achados por severidade

#### 🔴 P1 — Bloqueante para Sprint 3 (testes com usuários)

**F-01 — Frontend tem zero testes automatizados.**
Nenhum arquivo `*.test.ts(x)` em `apps/web/src/**` (verificado via `find apps/web/src -name "*.test.*"`).
`vitest.config.ts:41-44` explicitamente exclui frontend do escopo de testes. Componentes críticos sem cobertura: `UploadDropzone.tsx`, `JobCard.tsx`, `RequireAuth.tsx`, `LoginPage.tsx`, `OnboardingPage.tsx`, `DashboardPage.tsx`. Hooks sem cobertura: `useAuth.ts`, `useJobs.ts`, `useProfile.ts`, `useActivity.ts`, `usePromptLibrary.ts`.
Risco: qualquer refactor em React quebra silenciosamente até o smoke manual do QA. Pra Sprint 3 (≥10 alunos reais), regressão de UI no upload = sessão perdida.

**F-02 — Edge Function handlers (`index.ts`) sem nenhum teste.**
`process-document/index.ts` (462 linhas), `ingest-document/index.ts` (132), `connect-drive/index.ts` (143), `generate-system-prompt/index.ts` (183) — total 920 LoC sem teste de contrato. Testes existem só para utilitários internos.
Cenários não cobertos: autorização (`authorizeProcessDocument` mencionado em `process-document/index.ts:14`), CORS preflight, payload size limits (`requireMaxPayload`), rate-limit, propagação de erro de pipeline para `job.status = failed`.
Risco: T16 (tratamento de erros e fallback) só é validado em prod.

**F-03 — Nenhum teste de integração end-to-end do pipeline async.**
Não existe teste que exercite `ingest → process → classify → synthesize → compress → drive upload` com mocks coordenados. `pipeline.ts` (378 linhas) é importado isoladamente pelo teste de `openrouter.ts`, mas o fluxo completo só é validado em produção (T26 está pendente — `docs/PENDENCIAS.md:160-174`).
Risco: regressão entre estágios (ex.: schema do classify mudou e quebra o synthesize) passa CI verde.

#### 🟡 P2 — Importante, mas não bloqueia release

**F-04 — Módulos `_shared` sem teste.**
Sem cobertura: `cors.ts` (57 LoC), `http.ts` (100), `pipeline.ts` (378), `rate-limit.ts` (69), `models.ts` (52), `supabase-client.ts` (22), `vision/claude.ts` (80), `vision/gemini.ts` (80), `vision/index.ts` (89), `vision/openrouter-vision.ts` (86). Total 1013 LoC sem teste direto. `parsers.image.test.ts` exercita o provider falso de vision, mas não os providers reais.

**F-05 — Sem teste de cobertura mínima no CI.**
`vitest.config.ts:45-52` configura coverage v8, mas `npm test` no CI (`ci.yml:36-37`) não roda `--coverage` nem falha por threshold. Métricas de cobertura não são publicadas nem rastreadas.

**F-06 — `tsc --noEmit` no monorepo passa, mas existem caminhos de tipo frouxos.**
Vários `as string` em `apps/web/src/lib/supabase.ts:3-4` para env vars do Vite; `pipeline.ts:42` retorna tipo inline gigante (duplicado em vários lugares — falta um `type PipelineUsage`).
Não quebra, mas torna refactor caro.

**F-07 — Prettier ausente.**
Nenhum `.prettierrc`, sem `format` script, sem checagem de formatação no CI. `docs/PENDENCIAS.md:278` reconhece "ESLint config no repo (atualmente só Prettier — T05 ficou parcial)" — mas Prettier também não está. Style drift inevitável entre 5 devs.

**F-08 — Sem Husky / lint-staged.**
Pode commitar código com lint error / typecheck error / teste vermelho. CI pega, mas atrasa feedback e bagunça histórico.

**F-09 — Sem checklist de smoke test versionado para o Luis Felipe (QA).**
Não há `docs/QA/smoke-checklist.md` nem equivalente. Os `.docx` de Sprint 1 (`PSP2 - S1T*.docx`) descrevem critérios de aceitação, mas QA não tem documento operacional único pra executar antes de cada deploy.

**F-10 — Job de deploy não roda testes antes de fazer deploy.**
`.github/workflows/deploy-functions.yml:42-64` faz `supabase functions deploy` direto, sem rodar `npm test` nem verificar status do job CI. Pode deployar uma Edge Function quebrada se CI estiver lento ou se o push for direto em main.

#### 🟢 P3 — Polimento

**F-11 — `noUncheckedIndexedAccess` desligado.**
`tsconfig.base.json:9` tem `strict: true` mas não `noUncheckedIndexedAccess`. Vários `arr[0]` em `cors.ts:31` podem ser `undefined`. Não é bug agora, é munição pra futuro.

**F-12 — `vitest.config.ts` não tem `coverage.thresholds`.**
Quando F-05 for resolvido, vale já configurar `lines: 70, statements: 70, functions: 60, branches: 60`.

**F-13 — Sem badge de status do CI no `README.md`.**
README atual (`README.md:1-`) não mostra estado do build — onboarding de novo dev fica sem sinal visual.

**F-14 — Audit de dependência não roda em PR, só em push.**
`ci.yml:42-60` rola no mesmo trigger do CI (PR + push em main/dev), tudo bem aqui — falso alarme. (Conferido.)

**F-15 — Shims em `tests/shims/*` sem testes próprios.**
Os shims (`pdf-parse.ts`, `mammoth.ts`, etc.) são código de teste e podem ter bug silencioso. Baixíssimo risco, mas vale `assert` mínimo em CI.

---

### 3.3 Matriz "o que existe × o que falta" (caminho crítico)

Caminho crítico do produto: **Login → Onboarding (matérias/profs) → Upload doc → ingest-document → process-document (parse → classify → synthesize → compress → validate) → upload Drive → Dashboard mostra concluído → Atividade lista síntese**.

| Etapa | Componente / módulo | Tem teste hoje? | Falta | Severidade | Dono sugerido | Estimativa |
|---|---|---|---|---|---|---|
| Login | `routes/LoginPage.tsx`, `hooks/useAuth.ts` | ❌ | Smoke render + submit válido/inválido + RequireAuth redirect | 🔴 P1 | Pedro | 4h |
| Onboarding matérias | `routes/OnboardingPage.tsx`, `hooks/useProfile.ts`, `ProfileFormSchema` (schema testado em `schemas.test.ts`) | ⚠️ parcial (schema sim, UI não) | Render do form + submit + validação Zod no componente | 🔴 P1 | Pedro | 3h |
| Upload arquivo | `components/UploadDropzone.tsx`, `lib/upload.ts` | ❌ | Drag-and-drop + tipo inválido + > 50MB + erro de rede | 🔴 P1 | Pedro | 5h |
| ingest-document handler | `supabase/functions/ingest-document/index.ts` (132 LoC) | ❌ | Contrato: 200, 401, 405, 413 payload, 415 content-type, propaga `job_id` | 🔴 P1 | Isaac | 4h |
| Parsing (PDF/DOCX/PPTX/MD/Image) | `_shared/parsers.ts` | ✅ (5 suítes, 20 testes) | — | 🟢 | — | — |
| Classify | `_shared/pipeline.ts:classify` | ⚠️ (só via openrouter mock genérico) | Teste direto: input válido → output `ClassificationResult` parseável; LLM retorna lixo → erro tipado | 🟡 P2 | Guilherme | 3h |
| Synthesize / chunking | `pipeline.ts:synthesize`, `synthesizeChunked` | ⚠️ (`chunking.ts` sim; integração não) | Teste de `synthesizeChunked` com doc > `CHUNK_THRESHOLD` mockando LLM por chunk | 🟡 P2 | Guilherme | 4h |
| Compress (compact/cola) | `pipeline.ts:compress` | ❌ | Teste por modo + validação de tamanho de saída | 🟡 P2 | Guilherme | 3h |
| Validate 4 camadas | `_shared/validation.ts` (camadas 1-3) | ✅ (16 testes) | Camada 4 (LLM-judge) ainda fora — anotado em `validation.test.ts:3` | 🟡 P2 | Guilherme | 2h |
| Drive OAuth | `_shared/drive/oauth.ts` | ✅ (7 testes) | — | 🟢 | — | — |
| Drive folders | `_shared/drive/folders.ts` | ✅ (14 testes) | — | 🟢 | — | — |
| Drive upload | `_shared/drive/upload.ts` | ✅ (5 testes) | — | 🟢 | — | — |
| process-document handler | `supabase/functions/process-document/index.ts` (462 LoC) | ❌ | Contrato: 200 com service_role, 200 com JWT do dono, 403 com JWT de terceiro, 404 job inexistente, pipeline.error → `status=failed` + evento | 🔴 P1 | Isaac | 6h |
| connect-drive handler | `supabase/functions/connect-drive/index.ts` (143 LoC) | ❌ | Contrato: 200 com tokens válidos, 400 sem refresh_token, salva `drive_root_folder_id` | 🔴 P1 | Isaac | 3h |
| generate-system-prompt handler | `supabase/functions/generate-system-prompt/index.ts` (183 LoC) | ⚠️ (renderSystemPrompt sim — 13 testes; handler não) | Contrato HTTP + autorização | 🟡 P2 | Isaac | 2h |
| Dashboard / Atividade | `DashboardPage.tsx`, `AtividadePage.tsx`, `useJobs`, `useActivity` | ❌ | Render lista vazia / com itens / erro de rede; subscription Realtime mockada | 🔴 P1 | Pedro | 5h |
| CORS | `_shared/cors.ts` | ❌ | Origin na whitelist → echo; origin fora → não echoes; sem env → localhost default | 🟡 P2 | Isaac | 1h |
| HTTP helpers | `_shared/http.ts` | ❌ | `errorResponse` não vaza stack; `requireMaxPayload`; `requireContentType` | 🟡 P2 | Isaac | 2h |
| Rate limit | `_shared/rate-limit.ts` | ❌ | Bucket reset; max enforced; GC de buckets | 🟡 P2 | Isaac | 2h |
| Vision providers | `_shared/vision/{claude,gemini,openrouter-vision}.ts` | ❌ | Mock por provider; factory por `VISION_PROVIDER` | 🟡 P2 | Guilherme | 4h |
| Pipeline E2E | conjunto | ❌ | 1 teste happy-path completo com fetch stub determinístico | 🔴 P1 | Isaac + Guilherme | 8h |
| QA — smoke checklist | — | ❌ | `docs/QA/smoke-checklist.md` versionado | 🟡 P2 | Luis Felipe | 3h |
| QA — roteiro de testes Sprint 3 | — | ❌ | `docs/QA/roteiro-sprint3.md` (recrutamento → tarefa → SUS/TAM) | 🟡 P2 | Luis Felipe + Theo | 4h |

**Totais por severidade:** 🔴 9 itens (~38h) · 🟡 11 itens (~30h) · 🟢 cobertos.

---

### 3.4 Rastreio dos critérios de aceitação Sprint 1 → teste

| Tarefa | Critério resumido | Tem teste automatizado? |
|---|---|---|
| T01–T05 (planejamento / repo / arquitetura) | Decisões documentadas | N/A (não é código) |
| T12 — Endpoint de upload | Aceita doc, devolve job_id, valida tipo/tamanho | ❌ (handler sem teste — F-02) |
| T13 — Parsers por formato | Extrair texto de PDF/DOCX/PPTX/MD/Image | ✅ (`parsers.*.test.ts`) |
| T14 — Fila assíncrona | `waitUntil` dispara pipeline | ❌ (apenas pipeline interno coberto, não o disparo) |
| T15 — Testes unitários | Suítes Vitest + integração CI | ✅ — esta auditoria confirma 140 testes |
| T16 — Tratamento de erros e fallback | Falha vira `status=failed` + evento | ❌ (cobertura parcial via `openrouter.test.ts` — retry; falta E2E) |
| T18 — Drag-and-drop | Componente aceita arquivo | ❌ (F-01) |
| T19 — Dashboard de status | Mostra jobs em tempo real | ❌ (F-01) |
| T20 — Preview de documentos | Render Markdown | ❌ (F-01 — `MarkdownPreview.tsx`) |
| T21 — Tela de configuração | Form de perfil | ❌ (F-01 — `SettingsPage.tsx`) |

**Síntese:** dos 10 critérios de Sprint 1 que dependem de código, apenas **2 estão coberto por teste automatizado** (T13 e parcialmente T15). O resto depende de smoke manual ainda inexistente como documento.

---

### 3.5 Plano de ação em batches

#### Batch QA-1 — Frente "destrava Sprint 3" (semana 1, ~20h)

- **B1.1** Criar `docs/QA/smoke-checklist.md` com matriz feature × passo × resultado esperado. Dono: Luis Felipe. 3h.
- **B1.2** Adicionar Vitest + `@testing-library/react` + `jsdom` em `apps/web/`. Configurar `vitest.config.ts` do workspace web. Dono: Pedro. 2h.
- **B1.3** Escrever testes de smoke para `LoginPage`, `RequireAuth`, `UploadDropzone`, `DashboardPage`. Dono: Pedro. 8h.
- **B1.4** Adicionar `jobs.web-tests` no CI (paralelo ao `validate` atual). Dono: Theo. 1h.
- **B1.5** Bloquear merge em `main` sem CI verde (branch protection). Dono: Theo. 30min.

#### Batch QA-2 — Frente "handlers e E2E" (semana 2, ~25h)

- **B2.1** Teste de contrato dos 4 handlers Edge Functions (mock de `req` + assert status/headers/body). Dono: Isaac. 15h.
- **B2.2** 1 teste E2E happy-path do pipeline com fetch stub determinístico (parse → classify → synthesize → compress → drive). Dono: Isaac + Guilherme. 8h.
- **B2.3** Adicionar `--coverage` no CI e publicar resultado (`actions/upload-artifact`). Dono: Theo. 2h.

#### Batch QA-3 — Frente "qualidade contínua" (semana 3, ~12h)

- **B3.1** Adicionar Prettier + script `format` + check no CI. Dono: Theo. 2h.
- **B3.2** Husky + lint-staged. Dono: Theo. 2h.
- **B3.3** Cobertura mínima 70% nas linhas de `_shared` (threshold em `vitest.config.ts`). Dono: Theo. 1h.
- **B3.4** Cobrir `cors.ts`, `http.ts`, `rate-limit.ts`, `vision/*`. Dono: Isaac + Guilherme. 6h.
- **B3.5** Badge de status do CI no `README.md`. Dono: Theo. 30min.

#### Batch QA-4 — Frente "deploy seguro" (semana 4, ~6h)

- **B4.1** `deploy-functions.yml` depende do job `validate` (`needs: validate`) e só roda se CI verde. Dono: Theo. 1h.
- **B4.2** Roteiro de teste com usuário Sprint 3 — `docs/QA/roteiro-sprint3.md` (recrutamento, TCLE, tarefas, SUS, TAM). Dono: Luis Felipe + Theo. 4h.
- **B4.3** Definir `noUncheckedIndexedAccess: true` e corrigir fallout. Dono: Theo. 1h.

**Capacidade total estimada:** ~63h, distribuída entre 4 devs ao longo de 4 semanas (~4h/dev/semana). Cabe no orçamento da Sprint 3 sem comprometer H8/H9.

---

## 4. Validação

A auditoria passa quando, em execução local:

```bash
# 1. Tudo verde hoje (linha de base)
npm test          # 140 testes, 14 suítes, ~1.7s
npm run typecheck # 3 workspaces sem erro
npm run lint      # sem warning bloqueante
npm run build     # build do web sem erro
```

Após implementar Batches QA-1 a QA-4:

```bash
npm test -- --coverage
# espera-se >= 70% lines em supabase/functions/_shared/** e packages/shared/src/**
# >= 50% lines em apps/web/src/**
```

E ainda:

- `git ls-files docs/QA/` deve listar `smoke-checklist.md` e `roteiro-sprint3.md`.
- `gh workflow run ci.yml` em PR aberto deve ter jobs `validate`, `web-tests`, `audit`, `codeql` — todos verdes.
- `gh workflow view deploy-functions.yml` deve mostrar dependência de `validate`.

## 5. Dependências

- **Org / processo**
  - Equipe alinhada de que QA tem prioridade compartilhada (Pedro/Isaac/Guilherme contribuem com testes, não só Luis Felipe).
  - Branch protection em `main` exigindo CI verde — depende do Theo configurar no GitHub.

- **Técnicas**
  - `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` precisam ser instalados em `apps/web/devDependencies` (B1.2).
  - Para teste E2E do pipeline (B2.2) é preciso um Storage stub — `tests/shims/supabase-js.ts` já existe e cobre 80%; talvez precise estender pra storage download.
  - Cobertura no CI exige `@vitest/coverage-v8` (já configurado em `vitest.config.ts:46`, falta entrar como devDep no `package.json` raiz).

- **Outras frentes da auditoria (cross-check)**
  - **Frente Backend / Edge Functions** (`F-02`, `F-04`, `F-09`) — auditor de backend precisa confirmar que os handlers expostos hoje são os corretos antes de escrever teste de contrato.
  - **Frente Segurança / LGPD** — auditor de segurança deve apontar quais ataques precisam virar teste (CORS, rate-limit, authorization bypass, SSRF em vision providers).
  - **Frente Pipeline LLM** — auditor de IA precisa definir fixtures determinísticos (corpora pequenos) pro teste E2E não consumir crédito.
  - **Frente Frontend** — auditor de frontend deve priorizar quais componentes entram no Batch QA-1 (a matriz acima é palpite informado, não definitiva).

---

**Última execução nesta auditoria (2026-05-26):**
- `npm test` → 14 suítes, 140 testes, 100% verdes em 1.74s
- `npm run typecheck` → sem erro nos 3 workspaces
- `npm run lint` → sem warning em `apps/web/src/**`
- Não houve commit; arquivos modificados pré-existentes não foram tocados.
