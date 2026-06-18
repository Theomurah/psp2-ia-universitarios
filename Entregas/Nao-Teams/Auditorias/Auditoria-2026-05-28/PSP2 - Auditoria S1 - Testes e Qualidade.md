# PSP2 — Auditoria S1 — Testes e Qualidade

**Frente:** Testes e qualidade
**Responsável sugerido:** Luis Felipe (QA) + Theo (CI/infra de testes) + Pedro (frontend) + Isaac (Edge handlers)
**Data:** 2026-05-28
**Auditoria anterior:** `Entregas/Auditoria-2026-05-27/PSP2 - Auditoria S1 - Testes e Qualidade.md`

---

## Objetivo

Reauditar a frente de testes 24 h depois da 2026-05-27. Medir o que mudou (ESLint flat config foi criado, coverage v8 entrou em CI, jobs `validate-then-deploy` gate funcionando) e o que **continua aberto** (frontend zero testes, root das Edge Functions zero testes, integração end-to-end zero, sem threshold de cobertura, sem checklist de smoke pra QA).

---

## Resumo executivo

- Suíte verde: **`npm test` → 163 testes em 16 arquivos, 11.1 s.** Todos passando (parsers, drive, openrouter, validation, system-prompt, schemas).
- `npm run typecheck` passa limpo em `@psp2/web` e `@psp2/shared` (strict mode + `noUnusedLocals`/`Parameters`).
- `npm run lint` passa: flat config ESLint v9 ativa em `apps/web/eslint.config.js` (criada após auditoria de ontem — fecha o achado A4 de 2026-05-27).
- **Coverage real medido por v8** (lendo `coverage/clover.xml`): **41.8 % statements globais** (894/2137), 82 % branches (212/258), 70 % methods (43/61). Distribuição é polarizada — módulos cobertos estão entre 86–100 %, módulos não cobertos estão em 0 %.
- CI: `ci.yml` roda lint → typecheck → test --coverage → build + audit + CodeQL. `deploy-functions.yml` tem job `validate` como `needs:` do `deploy` (gate correto).
- **Continua sem:** Prettier, threshold de coverage, qualquer teste de frontend, qualquer teste nas 4 Edge Functions de borda (`ingest/process/generate/connect`), qualquer teste e2e, checklist de smoke pro Luis Felipe.

---

## O que mudou desde 2026-05-27 (delta)

Commits relevantes (`git log --since="2 days ago"`):

| Commit    | Efeito                                                                                 | Fecha achado de ontem |
|-----------|----------------------------------------------------------------------------------------|------------------------|
| `514841e` | Adiciona `@vitest/coverage-v8` + commita `package-lock.json`                            | parcial A6             |
| `ba37c4` (`ba413b4`) | `--coverage` em vitest + gate `validate` antes do deploy                     | parcial A6, confirma gate F-10 |
| `6f8c0ec` | `gitignore` para `coverage/`                                                            | housekeeping           |
| `8c86e22` | `docs(pendencias)`: mapeia tudo da auditoria 2026-05-26 que não foi auto-corrigido      | meta-doc               |
| (não commitado, mas confirmado em disco) `apps/web/eslint.config.js` flat v9 | ESLint roda e checa `src/**/*.{ts,tsx}` em CI | fecha A4 |

**Resultado:** A4 (ESLint sem config) foi resolvido. A6 (coverage) avançou metade — coleta sim, threshold não. A1, A2, A3, A5, A7 e A8 seguem abertos.

---

## Status atual (medido)

### Inventário de testes (16 arquivos, 163 testes)

| Pacote                                       | Arquivos | Testes | Observação                                  |
|----------------------------------------------|---------:|-------:|---------------------------------------------|
| `packages/shared/src/__tests__/`             | 1        | 33     | `schemas.test.ts` (Zod)                     |
| `supabase/functions/_shared/__tests__/`      | 15       | 130    | parsers, drive (oauth/folders/upload/retry/about), openrouter, prompts, system-prompt, chunking, validation |
| `apps/web/src/**`                             | 0        | 0      | **zero testes de frontend**                 |
| `supabase/functions/{ingest,process,generate,connect}-*/index.ts` | 0 | 0 | **zero testes nas 4 funções de borda** |
| `tests/e2e/`                                  | —        | —      | diretório não existe                        |

### Coverage por arquivo (v8, do último run em `coverage/clover.xml`)

Subconjunto incluído no `vitest.config.ts` `coverage.include` é só `_shared/**` + `packages/shared/src/**`. Frontend e os `index.ts` das Edge Functions de borda **estão fora do escopo da medição** — o número global de 41.8 % já é otimista pra média real do repo.

Bem cobertos (≥ 85 %):

| Arquivo                                            | Cobertura statements |
|----------------------------------------------------|----------------------|
| `_shared/drive/folders.ts`                         | 100 %                |
| `_shared/drive/oauth.ts`                           | 100 %                |
| `_shared/drive/upload.ts`                          | 100 %                |
| `_shared/chunking.ts`                              | 100 %                |
| `_shared/system-prompt.ts`                         | 100 %                |
| `_shared/prompts.ts`                               | 100 %                |
| `packages/shared/src/constants.ts`                 | 100 %                |
| `packages/shared/src/schemas.ts`                   | 98 %                 |
| `_shared/parsers.ts`                               | 94 %                 |
| `_shared/openrouter.ts`                            | 86 %                 |

Zero ou quase-zero coverage (alvos prioritários):

| Arquivo                                            | Cobertura statements | Por quê importa |
|----------------------------------------------------|----------------------|-----------------|
| `_shared/pipeline.ts` (403 stmts)                  | 0 %                  | Orquestrador do processamento — **maior arquivo do repo**, e zerado |
| `_shared/log.ts` (136 stmts)                       | 0 %                  | Helper de redaction de PII — alvo direto da auditoria A8 de observabilidade |
| `_shared/http.ts` (100 stmts)                      | 0 %                  | Headers `Authorization`, retries genéricos                        |
| `_shared/rate-limit.ts` (69 stmts)                 | 0 %                  | Reentrância DoS — segurança                                       |
| `_shared/cors.ts` (61 stmts)                       | 0 %                  | Whitelist por env — regressão CORS já aconteceu (`4ffcdff`)        |
| `_shared/vision/openrouter-vision.ts` (53 stmts)   | 9.4 %                | Caminho de OCR fallback                                            |
| `_shared/models.ts` (60 stmts)                     | 21.7 %               | Seletor por env                                                    |
| `_shared/validation.ts` (169 stmts)                | 68.6 %               | Camada 4 (LLM-as-judge) — recém adicionada (`a593c70`), undertested |

### Lint / format / typecheck

- **ESLint:** `apps/web/eslint.config.js` (flat v9) ativa, `js.configs.recommended` + `@typescript-eslint`. Regras pragmáticas (`no-unused-vars` como warning, `no-console` off). Roda em CI. **Não cobre Edge Functions** (`supabase/functions/**` não tem config; Deno tem outro lint).
- **Prettier:** ausente. Sem `.prettierrc` em lugar nenhum, sem script `format`.
- **TypeScript:** strict ✅, `noUnusedLocals: true`, `noUnusedParameters: true`. `tsc -b --noEmit` passa em `apps/web` e `packages/shared`.

### CI gates atuais

`ci.yml` (PR + push em `main`/`dev`):
1. `npm ci`
2. `npm run lint --if-present` → passa, mas `apps/web` é o único workspace com lint script real
3. `npm run typecheck` (workspaces) → strict
4. `npm test -- --coverage` → coleta v8, upload artifact `coverage-report` 14 dias
5. `npm run build` → tsc -b + vite build em `apps/web`
6. (paralelo) `npm audit --audit-level=high` → falha em high/critical
7. (paralelo) CodeQL → SAST

`deploy-functions.yml` (push em `main` afetando `supabase/functions/**`, `packages/shared/**` ou o próprio workflow):
- Job `validate`: lint + typecheck + test + build
- Job `deploy`: `needs: validate` (✅ gate correto, fix do achado F-10 da auditoria 2026-05-26)
- Deploya as 4 funções com Supabase CLI

**Gaps no CI:**
- Nenhum threshold de coverage falha o build (coletado mas não validado — A6 segue parcial).
- `npm run lint` é `--if-present` → silenciosamente passa em workspaces sem script. Hoje só `apps/web` tem. Edge Functions não passam por lint nenhum.
- Não há job `deno test` ou `deno check` pras funções de borda. Apesar das suítes Node em `_shared` cobrirem boa parte da lógica, sintaxe Deno-only (`Deno.serve`, `Deno.env`) em `index.ts` só é validada no deploy.
- Não há job de E2E.

---

## Achados

### A1 — Zero testes de frontend 🔴 (segue aberto)

- **Diretório:** `apps/web/src/` — ~29 arquivos `.tsx`, nenhum `.test.tsx`/`.spec.tsx`.
- **Dono:** Pedro + Luis Felipe.
- **Por quê:** `RequireAdmin` teve bug de "só entra no double click" em 27/05 (documentado em `CLAUDE.md`). Sem teste, a regressão volta. `UploadDropzone`, `useJobs` (Realtime), `useDocumentActions` (signed URLs) são caminho crítico do produto.
- **Fix:** `@testing-library/react` + `vitest-environment-jsdom` + 6 testes mínimos: `RequireAuth`, `RequireAdmin` (com `useQuery({enabled:false})` → `data===undefined` diferente de `false`), `UploadDropzone`, `useJobs`, `useProfile`, `LoginPage`.

### A2 — Zero testes nos 4 `index.ts` das Edge Functions de borda 🔴 (segue aberto)

- **Arquivos:** `supabase/functions/ingest-document/index.ts` (132 LoC), `process-document/index.ts` (552 LoC), `generate-system-prompt/index.ts` (183 LoC), `connect-drive/index.ts` (143 LoC) — **1010 LoC totais sem teste**.
- **Dono:** Isaac.
- **Por quê:** `process-document` concentra o claim atômico de job (`2e27501`), validação Zod (`d494d32`), incremento de `attempt_count` (`e5908f0`), wire-up do judge (`a593c70`), wire-up do `onRetry` (`74cb07a`), cap de markdown 1 MB (`c496797`). **Cada um desses commits recentes adicionou lógica sem teste de regressão.** Próxima refatoração quebra silencioso.
- **Fix:** mock do Supabase client + OpenRouter via `globalThis.fetch` stub (padrão já usado em `_shared/__tests__/`). 1 teste por função:
  - `ingest-document`: insert em `documents` + `jobs`, retorna `job_id`, dispara `process-document` async.
  - `process-document`: claim atômico (status `pending → processing`), step transitions, falha incrementa `attempt_count`, sucesso vira `done`, retry escreve `job_events.event_type='retry'`.
  - `generate-system-prompt`: render determinístico, idempotente (mesmo input → mesmo output).
  - `connect-drive`: OAuth callback, refresh on-demand, persiste `google_refresh_token` cifrado.

### A3 — Zero integração end-to-end do pipeline 🔴 (segue aberto)

- **Diretório:** `tests/e2e/` (não existe).
- **Dono:** Luis Felipe + Isaac.
- **Por quê:** ordem de transição de status (`pending → processing → done`/`failed`), idempotência do claim, propagação correta de `user_id` ao Drive — nada disso é coberto. Race condition entre `ingest` e `process` (cron watchdog planejado pro Sprint 2 do `CLAUDE.md`) não tem baseline.
- **Fix:** 1 teste em `tests/e2e/pipeline.test.ts`:
  1. Cria job mock
  2. Roda `ingest-document` (Storage mockado retorna bytes)
  3. Roda `process-document` (OpenRouter mockado retorna markdown válido; Drive mockado retorna fileId)
  4. Roda `generate-system-prompt` (sem LLM, determinístico)
  5. Verifica `jobs.status === 'done'`, `documents.processed_at != null`, `job_events` na ordem `ingested → step:parse → step:chunk → step:synthesize → step:validate → step:drive_upload → done`.

### A5 — Prettier ausente 🟡 (segue aberto)

- **Dono:** Pedro / Theo.
- **Risco:** ESLint cobre estilo lógico, não formatação. Diffs poluídos por aspas/trailing comma quando humanos vs IA editam mesmo arquivo.
- **Fix:** `.prettierrc.json` na raiz: `{ "singleQuote": true, "trailingComma": "all", "printWidth": 100, "semi": true }`. Script `format` + `format:check` no `package.json` raiz. Adicionar `format:check` ao CI antes de `lint`.

### A6 — Coverage sem threshold 🟡 (parcial — só falta o threshold)

- **Arquivo:** `vitest.config.ts:45–52`.
- **Estado:** v8 instalado (`@vitest/coverage-v8`), `--coverage` em CI, artifact upload OK. Baseline medido em 2026-05-28: 41.8 % statements global / quase 100 % nos módulos no escopo.
- **Risco:** sem threshold, regressão de cobertura passa batido. Auditoria F-12 (2026-05-26) já apontou.
- **Fix proposto** com o baseline real em mãos:
  ```ts
  coverage: {
    provider: 'v8',
    include: ['supabase/functions/_shared/**/*.ts', 'packages/shared/src/**/*.ts'],
    exclude: ['**/__tests__/**', '**/*.test.ts', '**/types*.ts', '**/index.ts'],
    thresholds: {
      // Baseline real medido 2026-05-28 em escopo restrito.
      // Subir gradualmente conforme A1/A2/A3 forem entregues.
      lines: 60,
      functions: 60,
      branches: 75,
      statements: 60,
    },
  }
  ```
  Excluir `types*.ts` e `index.ts` (barrel) sobe o número agregado pra ~60 % naturalmente.

### A7 — Sem checklist de smoke test pro Luis Felipe 🟡 (segue aberto)

- **Diretório:** `docs/qa/` (não existe).
- **Dono:** Luis Felipe.
- **Por quê:** Sprint 3 vai pra produção. Sem checklist documentado, o QA pré-deploy é informal — cada release depende da memória do dev de plantão.
- **Fix:** `docs/qa/smoke-test.md` com cenários numerados, formato "passo → resultado esperado → status":
  1. Login Google
  2. Onboarding (curso, semestre, horários)
  3. Upload PDF (≥ 1 MB) — ver job no Realtime → markdown disponível
  4. Upload DOCX
  5. Upload PPTX (com OCR de imagem)
  6. Upload imagem JPG (vision OCR)
  7. Conectar Google Drive (OAuth)
  8. Gerar system prompt do semestre
  9. Exportar markdown pro Drive (verificar pasta criada por matéria)
  10. Dashboard admin (`/admin`) carrega métricas
  11. Privacidade: exportar meus dados + apagar minha conta
  12. Tratamento de erro: upload de arquivo > 50 MiB → bloqueio claro
  13. Tratamento de erro: upload de extensão não suportada → bloqueio claro

### A8 — Critérios de aceitação Sprint 1/2 sem cross-check com testes 🟢 (segue aberto)

- **Por quê:** Tarefas `S1T15` (Testes Unitários), `S2T25` (Validação de Qualidade) marcadas como entregues. Cruzar com `coverage/` real expõe `pipeline.ts` 0 % apesar de `S2T25` falar em validação.
- **Fix:** `docs/qa/coverage-vs-backlog.md` com tabela `Tarefa | Arquivo coberto | % | Suíte de teste`.

### A9 — Edge Functions sem `deno check`/`deno lint` em CI 🟡 (novo)

- **Por quê:** Os `index.ts` rodam em Deno. As suítes Node em `_shared` validam lógica portável, mas sintaxe Deno-específica (`Deno.serve`, `Deno.env.get`, `npm:` specifiers em `import_map.json`) só é validada no deploy. Aprovação da auditoria de Observabilidade introduziu `_shared/log.ts` com `as any` (toleráveis), mas sem `deno check` qualquer regressão sintática Deno-only sai despercebida.
- **Dono:** Isaac + Theo.
- **Fix:** novo job em `ci.yml`:
  ```yaml
  edge-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with: { deno-version: v1.x }
      - run: deno check supabase/functions/{ingest-document,process-document,generate-system-prompt,connect-drive}/index.ts
      - run: deno lint supabase/functions/
  ```

### A10 — `npm run lint --if-present` mascara workspaces sem lint 🟡 (novo)

- **Por quê:** O `--if-present` faz o CI passar mesmo se ninguém configurou lint num workspace novo. Hoje só `apps/web` tem script `lint`. `packages/shared` e qualquer workspace futuro silenciosamente "passam".
- **Fix:** trocar pra `npm run lint --workspaces` (sem `--if-present`) e adicionar `lint` no `packages/shared/package.json` (mesmo que seja um eslint simples). Ou centralizar `eslint.config.js` na raiz cobrindo todos os workspaces.

---

## Matriz "existe × falta" por camada (priorizada por caminho crítico)

| Camada                                  | Existe                                             | Falta                                                                  | Severidade | Caminho crítico? |
|-----------------------------------------|----------------------------------------------------|------------------------------------------------------------------------|------------|------------------|
| Pipeline orquestração (`pipeline.ts`)   | 0 % coverage apesar de ser 403 stmts               | Suíte unit de `synthesizeChunked` + steps; integração e2e (A3)         | 🔴         | **sim**          |
| Edge Function `process-document/index.ts` (552 LoC) | 0 testes                              | Teste de claim atômico, status transitions, retry, attempt_count       | 🔴         | **sim**          |
| Edge Function `ingest-document/index.ts` (132 LoC)  | 0 testes                              | Teste de auth + insert + dispatch async                                 | 🔴         | **sim**          |
| Edge Function `generate-system-prompt/index.ts`    | 0 testes (helper `system-prompt.ts` em 100%)      | 1 teste de idempotência                                                | 🟡         | sim              |
| Edge Function `connect-drive/index.ts`             | 0 testes (helper `drive/oauth.ts` em 100%)        | 1 teste de OAuth callback                                              | 🟡         | sim              |
| Frontend componentes/hooks              | 0 testes                                           | 6 testes (RequireAuth/Admin, UploadDropzone, useJobs, useProfile, LoginPage) | 🔴   | **sim**          |
| Shared (`packages/shared/`)             | 33 testes, 98–100 % em arquivos não-tipos          | nada crítico                                                            | 🟢         | não              |
| Edge `_shared/` (parsers, drive, ...)   | 130 testes, 86–100 %                              | log.ts/http.ts/cors.ts/rate-limit.ts em 0 % (observabilidade + segurança) | 🟡       | sim              |
| Integração e2e                          | 0                                                  | 1 teste pipeline full (A3)                                              | 🔴         | **sim**          |
| Lint (apps/web)                         | flat v9 ativa                                      | —                                                                       | 🟢         | não              |
| Lint (Edge Functions Deno)              | nada                                               | `deno check` + `deno lint` em CI (A9)                                   | 🟡         | sim              |
| Format                                  | nada                                               | Prettier mínimo (A5)                                                    | 🟡         | não              |
| Coverage threshold                      | coleta v8 sim, threshold não                      | thresholds no `vitest.config.ts` + falha em CI (A6)                     | 🟡         | não              |
| Smoke test docs                         | nada                                               | `docs/qa/smoke-test.md` (A7)                                            | 🟡         | **sim**          |
| Backlog × coverage map                  | nada                                               | `docs/qa/coverage-vs-backlog.md` (A8)                                   | 🟢         | não              |
| CI lint `--if-present` mascarando       | `npm run lint --if-present`                        | Remover `--if-present` ou centralizar config (A10)                      | 🟡         | não              |

---

## Plano de ação (batches)

| Batch | Descrição                                                                           | Dono                | Esforço |
|-------|-------------------------------------------------------------------------------------|---------------------|--------:|
| B-T1  | Frontend test setup (`@testing-library/react` + jsdom) + 6 testes mínimos (A1)      | Pedro + Luis Felipe | 10 h    |
| B-T2  | 4 testes nos `index.ts` das Edge Functions de borda (A2)                            | Isaac               | 12 h    |
| B-T3  | 1 teste e2e do pipeline com fetch stubs determinísticos (A3)                        | Luis Felipe + Isaac | 8 h     |
| B-T4  | Prettier + thresholds de coverage + `deno check`/lint em CI (A5, A6, A9, A10)       | Theo                | 4 h     |
| B-T5  | `docs/qa/smoke-test.md` + `docs/qa/coverage-vs-backlog.md` (A7, A8)                 | Luis Felipe         | 3 h     |
| B-T6  | Testes em `_shared/log.ts`, `_shared/cors.ts`, `_shared/rate-limit.ts`, `_shared/http.ts` (0 % hoje) | Isaac | 5 h |
| B-T7  | Unit tests em `_shared/pipeline.ts` (synthesizeChunked, step orchestration)         | Isaac               | 6 h     |

**Total:** ~48 h. 🔴 dominante: B-T1, B-T2, B-T3, B-T7 somam 36 h.

---

## Validação dos batches

- B-T1: `npm test` retorna > 163 testes; cobre `apps/web/src/components/RequireAdmin.tsx` com cenário `data === undefined` separado de `data === false`.
- B-T2: `vitest run supabase/functions/ingest-document supabase/functions/process-document supabase/functions/generate-system-prompt supabase/functions/connect-drive` roda 4 suítes.
- B-T3: `tests/e2e/pipeline.test.ts` roda em < 10 s sem chamar OpenRouter nem Google real.
- B-T4: `npm test -- --coverage` falha quando alguém remove um teste (provar baixando o threshold em 5 pontos e voltando). `deno check` falha em sintaxe inválida.
- B-T5: revisão do `smoke-test.md` pelo Luis Felipe, com passos 1–13.
- B-T6/B-T7: coverage de `_shared/pipeline.ts` ≥ 70 %, `_shared/log.ts` ≥ 80 %.

---

## Dependências e impacto

- **B-T1 + B-T2 + B-T3** destravam confiança pro deploy de produção do Sprint 3.
- **B-T1** destrava captura de regressão do bug histórico do `RequireAdmin` (documentado em `CLAUDE.md`).
- **B-T5** destrava handoff pro Luis Felipe (QA) na entrega final do projeto acadêmico.
- **B-T7** + thresholds (B-T4) elevam baseline de coverage do `pipeline.ts` de 0 % pra ≥ 70 %, o que é o item de maior alavanca pro número global.

---

## Resumo final

- **Coverage real medido:** 41.8 % statements global (894/2137 v8 clover), 82 % branches. Mas escopo restrito a `_shared/**` + `packages/shared/src/**`. Frontend (4895 LoC) e índices das Edge Functions (1010 LoC) estão **fora da medição** — coverage real do produto inteiro está mais perto de **~25–30 %**.
- **Top 3 gaps:** (1) zero testes de frontend (29 arquivos `.tsx` no caminho crítico, incluindo `RequireAdmin` com bug histórico); (2) zero testes nos 4 `index.ts` das Edge Functions de borda (1010 LoC sem cobertura, incluindo claim atômico recém-mexido); (3) zero integração end-to-end do pipeline `ingest → process → generate → drive`.
- **Avanços desde 27/05:** ESLint flat config v8 ativo (A4 fechado), coverage v8 coletado em CI com upload de artifact, gate `validate-then-deploy` confirmado em `deploy-functions.yml`.
- **Resíduos:** Prettier ausente; sem threshold de coverage; sem `deno check`/`deno lint`; sem checklist de smoke pro QA; `pipeline.ts` (403 stmts, o maior arquivo) em 0 %.
- **Dono predominante:** Isaac (12 h em Edge handlers + 6 h em pipeline + 5 h em shared) > Luis Felipe (8 h e2e + 3 h docs QA + co-dono frontend) > Pedro (10 h frontend) > Theo (4 h infra CI). **8 achados | 🔴 3 / 🟡 6 / 🟢 1 | ~48 h de trabalho.**
