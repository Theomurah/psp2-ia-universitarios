# PSP2 — Auditoria S1 — Testes e Qualidade

**Frente:** Testes e qualidade
**Responsável sugerido:** Luis Felipe (QA) + Isaac (Edge tests) + Pedro (frontend tests)
**Data:** 2026-05-27

## Objetivo

Sair do estado "backend testado, frontend zero, integração zero" e estabelecer cobertura mínima no caminho crítico (upload → process → drive) com lint/format reais em CI.

## Critério de aceitação

- Frontend tem pelo menos 1 teste por hook crítico (`useJobs`, `useProfile`, `useDocumentActions`) e 1 por componente crítico (`UploadDropzone`, `RequireAuth`, `RequireAdmin`)
- Pelo menos 1 teste de integração simulando pipeline ingest → process → generate → drive (com mocks de OpenRouter e Drive)
- ESLint com config ativa (`.eslintrc` ou `eslint.config.js`) — roda em CI sem warning bloqueante
- Prettier configurado (`.prettierrc` + script `format`)
- Coverage threshold no Vitest (`lines: 60%`, ajustável)
- Smoke test checklist em `docs/qa/smoke-test.md` pro Luis Felipe rodar antes de release

## Status atual

**Testes existentes (~163 passando):**
- `packages/shared/__tests__/`: ~33 testes (schemas, constants)
- `supabase/functions/_shared/__tests__/`: ~130 testes (parsers, drive, openrouter, validation, pipeline)
- Frontend: **0 testes**
- Integração end-to-end: **0 testes**
- Edge Functions root (`ingest`, `process`, `generate`, `connect-drive`): **0 testes** (só helpers em `_shared/` cobertos)

**Lint/format:**
- ESLint instalado mas sem config (`npm run lint` é noop)
- Prettier ausente
- TypeScript: strict mode ✅ (`tsconfig.base.json`); 2 ocorrências de `as any` em `_shared/log.ts` toleráveis

**CI (`.github/workflows/`):**
- `ci.yml`: lint → typecheck → test → build (✅ fluxo)
- `deploy-functions.yml`: validate-then-deploy gate (✅ recente)
- Coverage coletado (`--coverage` em Vitest) mas **sem threshold** validado

## Achados

### A1 — Zero testes de frontend 🔴
- **Diretório:** `apps/web/src/` — nenhum `.test.tsx` ou `.spec.tsx`
- **Dono:** Pedro + Luis Felipe
- **Descrição:** ~29 arquivos `.tsx` (componentes + hooks + páginas) sem cobertura. `RequireAuth`/`RequireAdmin` (guards críticos com bug histórico) sem teste.
- **Risco:** Regressões de auth/permissionamento passam batido (caso "double-click do RequireAdmin" do incidente 2026-05-27).
- **Fix:** Adicionar `@testing-library/react` + `vitest-environment-jsdom`; partir de 5–6 testes no caminho crítico: `RequireAuth`, `RequireAdmin`, `UploadDropzone`, `useJobs`, `useProfile`, `LoginPage`.

### A2 — Zero testes nos `index.ts` das 4 Edge Functions 🔴
- **Arquivos:** `supabase/functions/{ingest,process,generate,connect}-*/index.ts`
- **Dono:** Isaac
- **Descrição:** Só os helpers em `_shared/` têm testes. As 4 funções de borda (orquestração, claim atômico, retry, status) não.
- **Risco:** Bugs de orquestração só pegáveis em prod. (Ex.: claim atômico em `process-document` foi fix recente sem teste de regressão.)
- **Fix:** Teste por função com mocks de Supabase client + OpenRouter + Drive.

### A3 — Sem teste de integração end-to-end 🔴
- **Diretório:** `tests/` (não existe `tests/e2e/`)
- **Dono:** Luis Felipe + Isaac
- **Descrição:** Pipeline `ingest → process → generate → drive` nunca exercitado de ponta a ponta com mocks. Race conditions e ordem de transição de status sem cobertura.
- **Fix:** 1 teste em `tests/e2e/pipeline.test.ts` que:
  1. Cria job mock
  2. Roda `ingest-document` (com Storage mockado)
  3. Roda `process-document` (com OpenRouter mockado)
  4. Roda `generate-system-prompt` se aplicável
  5. Verifica upload pra Drive mockado
  6. Verifica `jobs.status == 'done'` e `job_events` na ordem correta

### A4 — ESLint sem config 🟡
- **Arquivos:** raiz e `apps/web/` (ausência de `.eslintrc*` ou `eslint.config.js`)
- **Dono:** Pedro
- **Descrição:** `npm run lint` retorna 0 sem checar nada → falsa segurança em CI.
- **Fix:** `eslint.config.js` (flat config) com `@typescript-eslint`, `react-hooks`, `react-refresh`. Aceitar warnings, falhar em errors.

### A5 — Prettier ausente 🟡
- **Dono:** Pedro
- **Descrição:** Sem config → formatação inconsistente entre arquivos editados por humanos vs IA.
- **Fix:** `.prettierrc` mínimo (`{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }`) + `format` script.

### A6 — Coverage sem threshold 🟡
- **Arquivo:** `vitest.config.ts`
- **Dono:** Luis Felipe
- **Descrição:** Coverage coletado mas não falha o build se cair. Métrica decora-tipo.
- **Fix:** `coverage.thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 }` em `vitest.config.ts`; ajustar conforme estado real depois de adicionar testes A1/A2.

### A7 — Smoke test docs ausente 🟡
- **Diretório:** `docs/qa/` (não existe)
- **Dono:** Luis Felipe
- **Descrição:** QA não tem checklist documentado pra rodar antes de deploy.
- **Fix:** `docs/qa/smoke-test.md` com cenários: login, onboarding, upload PDF, upload DOCX, ver job rolar pelo realtime, baixar markdown, conectar Drive, gerar system prompt, exportar pro Drive, ver dashboard admin.

### A8 — Critérios de aceitação Sprint 1/2 sem cross-check com testes 🟢
- **Arquivos:** `Entregas/Sprint 1/**`, `Entregas/Sprint 2/**` (docx)
- **Descrição:** Cruzar nomes de tarefas (S1T15 "Testes Unitários", S2T25 "Validação de Qualidade") com testes que existem realmente — possivelmente algumas marcadas feitas com cobertura parcial.
- **Fix:** Tabela de mapping em `docs/qa/coverage-vs-backlog.md`.

## Matriz "existe × falta" por camada

| Camada                       | Existe                            | Falta                                                             | Severidade |
|------------------------------|-----------------------------------|-------------------------------------------------------------------|------------|
| Shared (`packages/shared/`)  | 33 testes (schemas, constants)    | nada crítico                                                       | 🟢         |
| Edge `_shared/`              | 130 testes (parsers, drive, etc)  | nada crítico                                                       | 🟢         |
| Edge `index.ts` root         | 0                                 | 4 testes (1 por função)                                            | 🔴         |
| Frontend componentes/hooks   | 0                                 | ~10 testes no caminho crítico                                      | 🔴         |
| Integração e2e               | 0                                 | 1 teste pipeline full                                              | 🔴         |
| Lint                         | ESLint instalado sem config       | flat config ativa                                                  | 🟡         |
| Format                       | nada                              | Prettier mínimo                                                    | 🟡         |
| Coverage                     | coleta sem threshold              | threshold validado em CI                                           | 🟡         |
| Smoke test docs              | nada                              | checklist pro Luis Felipe                                          | 🟡         |

## Plano de ação (batches)

### Batch B-T1 — Frontend testing setup + smoke (10h)
- Configurar `@testing-library/react` + jsdom (2h)
- 6 testes mínimos: RequireAuth, RequireAdmin, UploadDropzone, useJobs, useProfile, LoginPage (8h)

### Batch B-T2 — Edge Functions root tests (12h)
- ingest-document.test.ts (3h)
- process-document.test.ts (4h — claim atômico, retry, status transitions)
- generate-system-prompt.test.ts (2h)
- connect-drive.test.ts (3h)

### Batch B-T3 — Integração e2e (8h)
- Setup MSW pra OpenRouter + Drive
- 1 teste full pipeline (8h)

### Batch B-T4 — Lint/format/coverage threshold (4h)
- ESLint flat config (2h)
- Prettier mínimo (0.5h)
- Coverage threshold + ajuste (1.5h)

### Batch B-T5 — QA docs (3h)
- Smoke test checklist (2h)
- Coverage-vs-backlog mapping (1h)

**Total:** ~37h. 🔴 dominante: 3 itens (A1, A2, A3) somam 30h.

## Validação

- A1: `npm test --workspace=apps/web` retorna > 0 testes passando
- A2: `deno test supabase/functions/{ingest,process,generate,connect}-*/index.ts` ou Vitest com mocks roda os 4
- A3: `npm run test:e2e` (novo script) roda o pipeline mockado em < 10s
- A4: `npm run lint` falha em erro real (testar com `let x: any = 1; console.log(x)`)
- A6: `npm test -- --coverage` falha se métricas abaixo do threshold
- A7: revisão do `docs/qa/smoke-test.md` pelo Luis Felipe

## Dependências

- B-T1 + B-T2 + B-T3 destravam confiança pra deploy de produção (Sprint 3)
- B-T1 destrava captura de regressões de auth (gate de qualidade pro projeto acadêmico)
- B-T5 destrava handoff pro Luis Felipe (QA) na entrega final

---
**Resumo numérico:** 8 achados | 🔴 3 / 🟡 4 / 🟢 1 | ~37h | Dono predominante: Pedro (frontend) + Luis Felipe (QA) + Isaac (edge).
