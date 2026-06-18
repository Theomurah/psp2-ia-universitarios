# PSP2 — Auditoria S1 — Código Morto e Não Utilizado

**Frente:** Código morto / Exports não consumidos / Dependências órfãs / Branches stale
**Responsável sugerido:** Theo (GP/arquitetura) com apoio do dono de cada módulo (Pedro/Isaac/Guilherme)
**Data:** 2026-05-26
**Auditor:** Agente 2 — Código Morto
**Escopo auditado:**
- `apps/web/src/**` (componentes, hooks, libs, rotas)
- `supabase/functions/**` (Edge Functions + `_shared`)
- `packages/shared/src/**` (tipos, constants, schemas)
- `tools/deliverable-docs/**`
- `supabase/migrations/*.sql` vs leitores/escritores reais
- `supabase/config.toml` vs `client.functions.invoke`/`fetch`
- `apps/web/package.json` e root `package.json` (`npx depcheck`)
- `.env.example` vs `Deno.env.get` / `import.meta.env`
- Branches remotas vs `main`

---

## 1. Objetivo

Mapear código, dependências, migrations, env vars e branches que não são exercitados por nenhum caller no repositório PSP2, separando o que pode ser deletado **agora** do que está em **rota de uso na sprint corrente** (Sprint 2 fechada em código, Sprint 3 em planejamento). Reduzir superfície sem quebrar feature path planejada.

## 2. Critério de aceitação

A frente é considerada **aprovada para entrega de Sprint 1** quando:

1. Nenhum 🔴 (bloqueante) em aberto — código morto que polui caminho crítico ou induz erro de import/build.
2. Todos os 🟡 (alto) com batch atribuído (deletar OU justificar como "uso planejado no Sprint X").
3. `apps/web/package.json` declara somente deps efetivamente carregadas em runtime ou build (sem Tailwind/PostCSS órfãos).
4. Toda Edge Function listada em `supabase/config.toml` tem ao menos 1 caller real (frontend, função interna ou trigger DB) — ou está marcada como "scaffold preparado p/ Sprint N".
5. Toda tabela em `supabase/migrations/*.sql` tem ao menos uma leitura ou escrita no código TS/TSX — ou está marcada como "schema-first p/ história H_N".
6. Branches remotas obsoletas (já mergeadas em `main`) foram deletadas ou listadas para deleção pelo dono.

---

## 3. Conteúdo — Achados

Severidade:
🔴 = bloqueante / quebra entendimento ou induz erro
🟡 = alto / lixo significativo, alto valor de remover
🟢 = baixo / cosmético, remover quando passar por perto

### 3.1 PODE DELETAR AGORA (sem impacto no caminho de uso da Sprint corrente)

#### A1 🟡 `tailwindcss` + `postcss` + `autoprefixer` declarados sem uso real
- **Arquivo:** `apps/web/package.json:25-27` (devDependencies)
- **Evidência:** `npx depcheck` em `apps/web` lista os 3 como `Unused devDependencies`. Não há `tailwind.config.*`, `postcss.config.*` nem `@tailwind`/`@apply` em `apps/web/src/index.css` (1435 linhas de CSS hand-rolled puro — design system manual com variáveis CSS).
- **Impacto:** ~12 MB de `node_modules` por workspace, ruído em PRs de Dependabot, falsa impressão de stack Tailwind para novos devs.
- **Dono sugerido:** Pedro (frontend).
- **Ação:** `npm uninstall -w apps/web tailwindcss postcss autoprefixer`.
- **Estimativa:** 0,2 h.

#### A2 🟡 Reexports `ClaudeVisionProvider` e `GeminiVisionProvider` órfãos
- **Arquivos:** `supabase/functions/_shared/vision/claude.ts` (80 linhas), `supabase/functions/_shared/vision/gemini.ts` (80 linhas), reexport em `supabase/functions/_shared/vision/index.ts:23-24,27`.
- **Evidência:** a factory `getVisionProvider()` em `vision/index.ts:39-59` **sempre** retorna `OpenRouterVisionProvider`. Nenhum caller (`grep ClaudeVisionProvider`, `grep GeminiVisionProvider` fora do próprio módulo e dos `__tests__`) usa as duas classes. Aliases legados foram redirecionados pra OpenRouter em `PROVIDER_ALIASES` (linhas 30-37).
- **Impacto:** 160 linhas mortas + 2 testes (`vision/__tests__/...` se houver) carregando providers que nunca rodam em produção.
- **Dono sugerido:** Guilherme (IA).
- **Ação:** deletar `vision/claude.ts` e `vision/gemini.ts`; remover linhas 23-24 e 27 de `vision/index.ts` (mantendo só `OpenRouterVisionProvider`).
- **Estimativa:** 0,5 h.

#### A3 🟡 `extractWithFallback` em `vision/index.ts` sem nenhum caller
- **Arquivo:** `supabase/functions/_shared/vision/index.ts:75-89`.
- **Evidência:** `grep -rn extractWithFallback supabase/ apps/` retorna apenas a própria declaração (zero callers). O pipeline (`pipeline.ts`, `process-document/index.ts`) usa direto `getVisionProvider().extractText`.
- **Impacto:** 15 linhas de helper que sugerem fallback ativo, mas não há rotação de modelos real.
- **Dono sugerido:** Guilherme (IA).
- **Ação:** deletar a função; se rotação for desejada na Sprint 3, reimplementar com retry/backoff próprio.
- **Estimativa:** 0,1 h.

#### A4 🟡 Tipos não consumidos em `packages/shared/src/types.ts`
- **Arquivos/símbolos:**
  - `GeneratedContent` — `types.ts:120` (zero callers em `apps/`, `supabase/`, `tools/`).
  - `UserSystemPrompt` — `types.ts:155` (zero callers; o código real usa o shape inline na função `generate-system-prompt`).
  - `Feedback` — `types.ts:171` (zero callers; ver A8).
  - `FeedbackTopic` — `types.ts:169` (zero callers).
  - `HorarioAula` — `types.ts:16` (zero callers; web usa `Horario` z-infer do schema).
  - `JobEventType` — `types.ts:96` (zero callers; o código usa string literal).
- **Evidência:** `grep -rEn "\\b<sym>\\b" apps/web/src supabase/functions tools tests` retorna 0 ou só a declaração para cada um.
- **Impacto:** 6 tipos exportados sem uso — leva a divergência silenciosa entre tipo e shape real do DB.
- **Dono sugerido:** Theo (arquitetura) — decidir se mantém como "tipos canônicos de schema" ou deleta.
- **Ação:** ou (a) deletar; ou (b) anotar `/** @internal — não exportar até H_N consumir */` e mover pra `types.internal.ts`.
- **Estimativa:** 0,5 h.

#### A5 🟢 Const `SLO` em `packages/shared/src/constants.ts:118-125` sem callers
- **Arquivo:** `packages/shared/src/constants.ts:118`.
- **Evidência:** `grep -rEn "\\bSLO\\b"` em `apps/`, `supabase/`, `tools/` → 0 hits (só a declaração).
- **Impacto:** sinaliza SLO documental que ninguém afere. Risco de drift entre número aqui e SLO real escrito em docs.
- **Dono sugerido:** Theo.
- **Ação:** mover para `docs/` (como tabela markdown) ou usar em alerts/métricas. Por ora, manter mas adicionar comentário `// TODO(T_obs): consumir em painel de observabilidade`.
- **Estimativa:** 0,2 h.

#### A6 🟡 Branch remota `origin/feature/sprint1-pipeline` totalmente mergeada
- **Evidência:** `git rev-list --count main..origin/feature/sprint1-pipeline` → `0`. Branch está atrás de `main` (commits já merged via PRs anteriores).
- **Impacto:** ruído no `git branch -a`, devs novos podem confundir como branch ativa.
- **Dono sugerido:** Theo.
- **Ação:** `git push origin --delete feature/sprint1-pipeline`.
- **Estimativa:** 0,1 h.

#### A7 🟡 Branch `origin/dev` referenciada no CI mas divergente do `main`
- **Arquivo:** `.github/workflows/ci.yml:5,7` — gatilho `branches: [main, dev]`.
- **Evidência:** `git rev-list --count main..origin/dev` → `2` (2 commits a frente). Esses commits são `50fd35e Merge branch 'feat/unb-logo'` e `d9f8e65 feat(frontend): adiciona logo UnB`, que **não estão em `main`**. O fluxo atual usa PRs `feature/* → main` (último merge `ab9e70a`/`991fd90`), não `dev`.
- **Impacto:** se algum dev empurrar pra `dev`, CI roda mas o código nunca chega na `main`. Configuração de Vercel/Supabase Functions só conhece `main`.
- **Dono sugerido:** Theo.
- **Ação:** decidir formalmente entre (a) descontinuar `dev` (deletar branch + remover de `ci.yml`) ou (b) reativar GitFlow com `dev` como integração. Como o fluxo atual é trunk-based com feature branches → `main`, recomendo (a). Cherry-pickar commit do logo se estiver perdido.
- **Estimativa:** 0,5 h.

#### A8 🟢 Tabela `feedback` criada mas sem nenhum read/write em código
- **Arquivos:** `supabase/migrations/0001_initial_schema.sql` (DDL `create table public.feedback`), `0006_security_hardening.sql` (4 policies RLS), índice `idx_feedback_user`.
- **Evidência:** `grep -rEn feedback apps/web/src supabase/functions --include='*.ts*'` retorna apenas comentários em `TopbarUser.tsx:5`. Nenhum `.from('feedback')`.
- **Status:** **uso planejado** — `docs/PENDENCIAS.md:233` lista H10 (Sprint 3 — "Consolidação de feedbacks").
- **Dono sugerido:** Luis Felipe (QA) + Isaac (backend).
- **Ação:** **NÃO deletar.** Documentar na auditoria que é schema-first para H10. Adicionar comentário SQL `-- consumido por H10 (Sprint 3)` na migration 0001 quando passar lá.
- **Estimativa:** 0,1 h (só comentar).

---

### 3.2 ESTÁ EM ROTA DE USO NA SPRINT CORRENTE (não deletar — confirmar e/ou completar integração)

#### B1 🟡 Edge Function `connect-drive` deployada sem caller no frontend
- **Arquivos:** `supabase/functions/connect-drive/index.ts` (~140 linhas), `_shared/drive/*` (4 arquivos: types, oauth, folders, upload).
- **Evidência:** `grep -rEn "connect-drive" apps/web/src` → 0. Frontend nunca chama `POST /connect-drive`. Função existe, está rateada (5 req/min) e tem 7 testes verdes.
- **Status:** **planejada** — `docs/PENDENCIAS.md:190,397` lista como tarefa frontend pendente: "Habilitar botão Google no LoginPage + handler de `connect-drive` (~2h)" + GCP OAuth config.
- **Risco real:** se a Sprint 2 fechou backend mas não integrou no front, o usuário **não consegue conectar Drive** mesmo com a função no ar.
- **Dono sugerido:** Pedro (frontend) — integração; Theo — config GCP.
- **Ação:** **NÃO deletar.** Marcar como "scaffold backend H6 — integração frontend pendente" e priorizar no início da Sprint 3. Se decidir descopar H6, deletar `connect-drive/`, `_shared/drive/*` e migration `0004_drive_oauth.sql` em batch único.
- **Estimativa:** 2 h (integração) ou 0,5 h (descope).

#### B2 🟡 Edge Function `generate-system-prompt` deployada sem caller
- **Arquivo:** `supabase/functions/generate-system-prompt/index.ts` (~155 linhas) + helper `_shared/system-prompt.ts` (`renderSystemPrompt`).
- **Evidência:** `grep -rEn "generate-system-prompt" apps/web/src` → 0. `grep functions.invoke apps/web/src` → 0.
- **Status:** **planejada** — `docs/PENDENCIAS.md:97` confirma implementação T32 sem caller frontend ainda.
- **Risco real:** prompt do aluno nunca é (re)gerado a partir do dashboard.
- **Dono sugerido:** Pedro (frontend) + Guilherme (IA).
- **Ação:** **NÃO deletar.** Adicionar botão "Atualizar meu System Prompt" em `SettingsPage` ou trigger automático no fim do `process-document` (via `EdgeRuntime.waitUntil`). Tabela `user_system_prompts` (mig 0001) também só é escrita por essa função.
- **Estimativa:** 1,5 h.

#### B3 🟢 `MODEL_JUDGE` / `MODEL_COMPRESS_COLA` em `.env.example` consumidos só pra default
- **Arquivos:** `.env.example:45-50` (declarados); `supabase/functions/_shared/models.ts:37-38` (lidos).
- **Evidência:** `grep -rEn MODEL_JUDGE` → 1 leitura (`models.ts`). Sem caller de fato fora do mapa de defaults — depende se `pipeline.ts` ativa o judge step.
- **Status:** **rota de uso atual** — pipeline `validation.ts` tem 4 camadas (`structural/quantitative/semantic/judge`); a camada `judge` é executada quando habilitada.
- **Dono sugerido:** Guilherme (IA).
- **Ação:** verificar se o step "judge" é executado no `process-document` por default. Se não estiver (feature flag desativada), documentar no `.env.example` que `MODEL_JUDGE` só vale quando `ENABLE_JUDGE=true`.
- **Estimativa:** 0,3 h (verificação).

---

### 3.3 SUSPEITAS DESCARTADAS APÓS VERIFICAÇÃO (NÃO são código morto)

Listo só para deixar trilha auditiva:

- ✅ `apps/web/src/components/*.tsx` — **todos** importados em pelo menos uma rota. `JobCard`, `MarkdownPreview`, `MetricsCards`, `PrivacySection`, `PromptCard`, `RequireAuth`, `Toast`, `TopbarUser`, `UnbLogo`, `UploadDropzone` → todos com callers verificados.
- ✅ `apps/web/src/hooks/*` — todos consumidos. `useUserMetrics` por `MetricsCards`, `useJobsRealtime` por `DashboardPage`, `useIncrementPromptUsage` por `PromptCard`, `MissingCursoColumnError` por `Settings`/`Onboarding`.
- ✅ `apps/web/src/lib/{consents,upload,supabase}.ts` — todos com callers.
- ✅ Funções de auth (`signInWithPassword`, `signUpWithPassword`, `signInWithMagicLink`, `signOut`) — todas usadas em `LoginPage` / `TopbarUser`.
- ✅ Tabela `user_consents` — consumida em `apps/web/src/lib/consents.ts:34`.
- ✅ Tabela `user_system_prompts` — escrita por `generate-system-prompt/index.ts` (ver B2).
- ✅ Tabela `generated_content` — lida por `MarkdownPreview.tsx:27`, `generate-system-prompt:163`; escrita por `process-document:294,316`.
- ✅ Edge Functions `ingest-document` e `process-document` — em uso (`apps/web/src/lib/upload.ts:44` chama ingest, ingest chama process internamente).
- ✅ `_shared/drive/*` (types, oauth, folders, upload) — usados por `connect-drive` E `process-document`. Não deletar (mesmo que B1 indique caller frontend pendente — `process-document` usa `ensureFolderPath`/`uploadMarkdown`/`ensureFreshToken`).
- ✅ `_shared/{chunking,http,cors,rate-limit,supabase-client,validation,prompts,openrouter,models,parsers,pipeline,system-prompt}.ts` — todos com callers de produção.
- ✅ Schemas em `packages/shared/src/schemas.ts` — todos consumidos (`ClassificationSchema` em `pipeline.ts:63`, `ProfileFormSchema` em web, `UploadRequestSchema` deixado como contrato — usar em `ingest-document` é melhoria recomendada mas não é dead code). `SynthesisInputSchema` e `CompressionInputSchema` **só** são exportados — não há `.parse()` em runtime. **Candidatos a 🟢** se ficar sem uso até o fim da Sprint 3.
- ✅ Root `package.json` devDeps `typescript` e `zod` — `depcheck` flagou, mas TS é exigido pelos scripts de workspace e Zod é transitivamente importado em testes. Falsos positivos.
- ✅ Branch local `feature/sprint1-finalization` — branch de trabalho atual (HEAD).
- ✅ `tools/deliverable-docs/definitions/*.mjs` — todos consumidos pelo loader dinâmico em `build.mjs:363` (`fs.readdir(DEFS_DIR)`).

---

## 4. Plano de ação em batches priorizados

| Batch | Itens | Severidade | Dono | Estimativa |
|---|---|---|---|---|
| **B-DEAD-1** (quick wins) | A1 (uninstall tailwind/postcss/autoprefixer) + A6 (delete branch `feature/sprint1-pipeline`) | 🟡🟡 | Pedro + Theo | 0,3 h |
| **B-DEAD-2** (vision cleanup) | A2 (delete claude.ts/gemini.ts) + A3 (delete extractWithFallback) | 🟡 | Guilherme | 0,6 h |
| **B-DEAD-3** (shared types hygiene) | A4 (6 tipos órfãos) + A5 (SLO TODO) | 🟡🟢 | Theo | 0,7 h |
| **B-DEAD-4** (CI/branch policy) | A7 (decidir destino do branch `dev` + ajustar `ci.yml`) | 🟡 | Theo | 0,5 h |
| **B-INT-1** (Sprint 3 integração) | B1 (handler connect-drive no LoginPage) + B2 (botão regenerar system prompt) | 🟡 | Pedro + Guilherme | 3,5 h |
| **B-DOC-1** (anotar uso futuro) | A8 (comentário SQL feedback = H10) + B3 (clarificar MODEL_JUDGE) | 🟢 | Isaac + Guilherme | 0,4 h |
| **Total deleções (B-DEAD-1..4)** | — | — | — | **2,1 h** |
| **Total geral** | — | — | — | **~6 h** |

Recomendação de execução: rodar B-DEAD-1 a B-DEAD-4 num único PR `chore: dead code cleanup` antes do início da Sprint 3 (limpa o terreno para B-INT-1 não ser confundido com lixo).

---

## 5. Validação

A frente é considerada **resolvida** quando:

1. `npx depcheck` em `apps/web` retorna `No depcheck issue` (ou só falsos positivos justificados).
2. `grep -rEn "ClaudeVisionProvider|GeminiVisionProvider|extractWithFallback" supabase/` retorna 0.
3. `git branch -r --merged main | grep feature/` → não lista `feature/sprint1-pipeline`.
4. `.github/workflows/ci.yml` reflete a política real de branches (sem `dev` fantasma).
5. Para cada Edge Function em `supabase/config.toml` (implícito — todas as 4 são auto-discovered de `supabase/functions/*/index.ts`), existe (a) um caller real **ou** (b) um TODO datado apontando para sprint planejada.
6. Para cada tabela em `0001_initial_schema.sql`, ou existe leitura/escrita no código, ou existe comentário SQL `-- consumido por H<N> (Sprint <N>)`.
7. `npm run build && npm run typecheck && npm test` continuam verdes após as remoções.

---

## 6. Dependências

- **Para A4 / A5:** alinhar com Auditoria S1 — Banco de Dados (consistência tipo TS ↔ schema SQL).
- **Para A7:** alinhar com Auditoria S1 — DevOps/CI (se houver) sobre estratégia de branching.
- **Para B1 / B2:** depende de migrations `0004_drive_oauth.sql` e `0005_seed_prompt_library.sql` estarem aplicadas em prod (`MEMORY.md` → `project_migrations_pendentes` indica pendência).
- **Para B-INT-1:** depende de config OAuth GCP (Theo) — sem isso, `connect-drive` retorna 401 mesmo com handler frontend pronto.
- **Bloqueia:** nada crítico. Limpeza é higiene — pode rodar em paralelo a qualquer outra frente da Sprint 3.

---

**Resumo executivo:** 9 itens (6 acionáveis agora + 3 anotações de uso futuro). Severidade dominante 🟡 (alto, mas não bloqueante). Maior risco real **não é** lixo — são as 2 Edge Functions backend-only sem caller frontend (B1/B2), que indicam Sprint 2 fechada pelo backend mas não fechada pelo frontend.
