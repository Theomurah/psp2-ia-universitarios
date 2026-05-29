# PSP2 — Quickwins da Auditoria 2026-05-26

**Data:** 2026-05-26
**Triagem:** 7 itens aprovados (de ~96 achados totais) que cumprem **TODOS** os critérios:
- Certeza ≥ 95% no fix · escopo ≤ 30 linhas · ≤ 3 arquivos · sem mudar contrato público
- Reversível em 1 commit · sem nova migration · sem teste novo de integração · ≤ 20 min cada
- Não toca código em desenvolvimento ativo (último commit do repo: 14/05, sem trabalho concorrente)

**Estratégia:** 1 commit por quickwin (Conventional Commits), commits ficam locais, push fica com o Theo.

---

## ✅ Quickwins aprovados

| ID | Origem | Descrição (1 linha) | Arquivos afetados | Justificativa |
|----|--------|----------------------|-------------------|---------------|
| **QW-01** | Agente 3 · S-05 | Corrigir regex de remoção de acentos (2 ocorrências) em `validation.ts` | `supabase/functions/_shared/validation.ts` | Bug confirmado: `/[̀-ͯ]/g` no source code é literal de 2 caracteres combinantes, não o range Unicode. Fix é trocar pelo range `̀-ͯ`. 2 linhas alteradas. Sem teste de integração; testes unitários da validation continuam passando. |
| **QW-02** | Agente 1 · C5 | Limitar `lastStatusRef` em `useJobs.ts` a 200 entries para evitar leak de memória | `apps/web/src/hooks/useJobs.ts` | Map sem GC. Adicionar cap quando atinge 200 (drop oldest). Surgical, sem mudança de API, sem teste novo. |
| **QW-03** | Agente 1 · D2 | Adicionar `image/jpg` em `MIME_TO_FORMAT` em `constants.ts` | `packages/shared/src/constants.ts` | Apenas mapeamento de variante de MIME comum. Não muda contrato (constante é dicionário expansível). 1 linha. |
| **QW-04** | Agente 2 · A1 | Uninstall `tailwindcss`/`postcss`/`autoprefixer` órfãos (sem config nem `@apply`) | `apps/web/package.json` + `package-lock.json` | `depcheck` confirma. CSS é hand-rolled (1435 linhas com variáveis CSS). Reversível com `npm install`. |
| **QW-05** | Agente 2 · A2+A3 | Deletar `vision/claude.ts`, `vision/gemini.ts` e função `extractWithFallback`; ajustar reexports em `vision/index.ts` | `supabase/functions/_shared/vision/{claude,gemini,index}.ts` | Grep cross-codebase confirma zero callers fora do próprio módulo. Factory sempre retorna `OpenRouterVisionProvider`. Sem testes para esses providers. 3 arquivos (2 deletes + 1 edit). |
| **QW-06** | Agente 3 · S-08 | Abortar upload pro Drive se `markdown.length > 1_000_000` em `tryUploadToDrive` | `supabase/functions/process-document/index.ts` | Guard de 3 linhas adicionado no início de `tryUploadToDrive`. Retorna `{ skipped: false, error: ... }` (padrão já existente da função). Sem mudança de assinatura. |
| **QW-07** | Agente 5 · F-13 | Adicionar badge de status do CI no `README.md` | `README.md` | Edit puramente cosmético em documento já existente. Repo público no GitHub (`Theomurah/psp2-ia-universitarios`), workflow nomeado `CI`. |

**Total:** 7 commits estimados, ~40 min de execução.

---

## ⏭️ Itens que pareciam quickwin mas foram rejeitados na triagem

Vão pro próximo planejamento de sprint (input pra Skill `/2-planejar`).

| Item | Origem | Motivo de rejeição |
|------|--------|---------------------|
| **B1 (bugs)** Zod no body de `process-document` | Agente 1 | Adiciona schema novo em `packages/shared/src/schemas.ts` → **contrato público exportado**. |
| **B4 (bugs)** CORS fallback para string vazia | Agente 1 | CORS é contrato público de defesa; regressão difícil de pegar sem teste de integração. |
| **B5 (bugs)** Migrar `parseImage` para `extractWithFallback` | Agente 1 | Mudança de comportamento de falha do pipeline; precisa teste E2E para validar. |
| **C6 (bugs)** `getSession()` antes do upload | Agente 1 | Reordena fluxo de erro; baixo risco mas borderline (afeta UX em sessão expirada). |
| **C7 (bugs)** `recordConsent` com `await` | Agente 1 | Compliance LGPD; decisão de produto envolvida (registrar via trigger DB vs retry). |
| **D2 (banco)** CHECK `progress_percent between 0 and 100` | Agente 6 | **Exige nova migration** — fora do critério de quickwin. |
| **A1 (banco)** Incrementar `attempt_count` no worker | Agente 6 | Toca lógica de retry no pipeline; alta sensibilidade, precisa teste de regressão. |
| **A5/G3/C3/C4/A8 (banco)** Comentários SQL em tabelas/functions | Agente 6 | Todos exigem nova migration. |
| **A4 (cod morto)** Deletar 6 tipos órfãos em `packages/shared/src/types.ts` | Agente 2 | **Contrato público exportado** + decisão arquitetural (manter como tipos canônicos de schema ou mover para `types.internal.ts`). |
| **A5 (cod morto)** `SLO` const com TODO | Agente 2 | Baixo valor isolado; melhor consolidar com plano de observabilidade. |
| **A6 (cod morto)** Deletar branch `feature/sprint1-pipeline` | Agente 2 | **Ação destrutiva em repo remoto** — exige aprovação explícita do Theo. |
| **A7 (cod morto)** Decidir destino do branch `dev` | Agente 2 | Decisão de processo (GitFlow vs trunk-based), não código. |
| **S-01 (segurança)** Cifrar tokens OAuth Google | Agente 3 | Integração nova (pgsodium ou `crypto.subtle`); 4–6 h, fora do escopo. |
| **S-02 (segurança)** Parser JSON do erro no frontend | Agente 3 | Toca UX em múltiplos componentes/toasts; precisa testes. |
| **S-04 (segurança)** Sandbox de prompt injection | Agente 3 | Modifica prompts do pipeline; precisa validação e teste de regressão. |
| **S-06 (segurança)** Wrapper `logError` filtrando `details`/`hint` | Agente 3 | Refactor cross-cutting em 4 Edge Functions. |
| **S-07 (segurança)** Whitelist em `extension` no `buildFilenameFinal` | Agente 3 | `packages/shared/src/schemas.ts` é contrato público. |
| **S-10/S-11/S-12 (segurança)** Aplicar migrations em prod + `verify_jwt` + `ALLOWED_ORIGINS` | Agente 3 | Ações em **infra remota** (Supabase Cloud); fora do escopo de quickwin local. |
| **Críticos do pipeline (A1/A2/A3/A4 bugs)** `started_at`/`needs_review`/`validateJudge`/`compressed_cola` | Agente 1 | Coração do produto; exigem revisão arquitetural e teste manual com LLM real. |
| **A5/A6/A7 (bugs)** Retry com `attempt_count`/RPC transacional/watchdog pg_cron | Agente 1 | Cada um exige nova migration ou nova infra. |
| **D1 (banco)** Proteção contra dupla execução do worker | Agente 6 | Toca pipeline crítico; precisa teste de regressão simulando double-fire. |
| **OBS-A1 (observabilidade)** ErrorBoundary global | Agente 4 | Nova feature de UI; precisa decisão de design da tela de erro + integração com sistema de logging. |
| **OBS-A2 (observabilidade)** `request_id` ponta-a-ponta | Agente 4 | **Exige nova migration** (`0007_add_request_id.sql`) + mudança em todas as Edge Functions e UI. |
| **OBS-A3/A4/A5 (observabilidade)** Logs JSON estruturados / log de entrada / instrumentação OpenRouter | Agente 4 | Cada um é refactor cross-cutting; precisa novo helper `_shared/log.ts`. |
| **F3 (banco)** Documentar backup/restore | Agente 6 | Criar `BACKUP.md` é **arquivo de documentação novo** — instruções do projeto pedem evitar criar `.md` salvo se pedido. Fica pro Theo decidir. |
| **F-01/F-02/F-03 (testes)** Frontend tests / handler tests / pipeline E2E | Agente 5 | Cada um exige novos testes de integração — fora do critério de quickwin. |
| **F-07/F-08 (testes)** Prettier + Husky/lint-staged | Agente 5 | Mudança em DX cross-team; precisa alinhamento. |

---

## 📋 Status final dos quickwins

| ID | Status | Commit | Observação |
|----|--------|--------|-----------|
| QW-01 | ⏭️ pulado | — | Achado **inválido**. O regex `/[̀-ͯ]/g` em `validation.ts:140,156` é literalmente o range UTF-8 `U+0300–U+036F` (combining diacritical marks) — `od -c` mostra bytes `\314\200-\315\257`. O Agente 3 interpretou mal o rendering. Nenhuma alteração necessária. |
| QW-02 | ⏭️ pulado | — | `apps/web/src/hooks/useJobs.ts` tem **modificações locais não commitadas** (WIP do Theo). Quickwin violaria o critério "não toca código em desenvolvimento ativo". Fica pro plano de sprint. |
| QW-03 | ✅ aplicado | `f8f08e4` | `chore(shared): adiciona image/jpg ao MIME_TO_FORMAT` |
| QW-04 | ✅ aplicado | `522c039` | `chore(web): remove devDeps Tailwind/PostCSS/Autoprefixer não utilizadas` |
| QW-05 | ✅ aplicado | `ab9412f` | `chore(vision): remove providers Claude/Gemini e extractWithFallback órfãos` (182 deleções) |
| QW-06 | ⏭️ pulado | — | `supabase/functions/process-document/index.ts` tem **modificações locais não commitadas** (WIP do Theo). Mesma justificativa do QW-02. Fica pro plano. |
| QW-07 | ✅ aplicado | `9ed319d` | `docs: adiciona badge de status do CI no README` |

**Resumo:** 7 candidatos → **4 aplicados, 3 pulados**.
- **Aplicados:** todos passaram `npm test` (140 testes verdes), `npm run typecheck`, `npm run lint` e `npm run build`.
- **Pulados:** 1 por achado inválido (QW-01), 2 por conflito com WIP local (QW-02, QW-06).
- **Push:** **não realizado** — commits ficam locais para revisão do Theo (regra do projeto: PR com 1 review obrigatório antes de mergear na `main`).

### Heads-up para o Theo (revisão antes de push)
O working tree estava bem sujo na hora desta auditoria — vários arquivos modificados (`apps/web/src/hooks/useJobs.ts`, `supabase/functions/process-document/index.ts`, `supabase/functions/_shared/pipeline.ts`, `packages/shared/src/schemas.ts`, etc.) e muitos arquivos novos não rastreados (migrations 0003–0006, tests/, drive/, connect-drive/, generate-system-prompt/). Os 4 quickwins commitados são **independentes** dessa WIP (toquei só arquivos limpos), mas vale conferir antes de empurrar pra `main` — provavelmente você quer commitar a WIP num batch separado primeiro.
