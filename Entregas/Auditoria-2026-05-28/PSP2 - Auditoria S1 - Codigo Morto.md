# PSP2 - Auditoria S1 - Codigo Morto

**Data:** 2026-05-28
**Agente:** 2 (Código Morto e Não Utilizado)
**Responsável sugerido:** Theo (coordenação) / Pedro (frontend) / Isaac (backend)
**Baseline:** `Entregas/Auditoria-2026-05-27/PSP2 - Auditoria S1 - Codigo Morto.md`
**Commits desde a última auditoria:** 25 (entre `f029f61` e `6f8c0ec`)

---

## Objetivo

Re-varrer o repo PSP2 atrás de artefatos órfãos (componentes/hooks sem caller,
Edge Functions não invocadas, migrations sem I/O, deps não importadas, env vars
não consumidas, branches obsoletas, exports sem uso) e separar o que pode ir
embora **hoje** do que está em rota de uso na Sprint 1/2.

Esta passagem confirma vários achados da auditoria de 27/05 e adiciona uma
descoberta importante: `origin/dev` também está sem commits ahead de `main`
(0 commits ahead) e pode ser deletada junto com `origin/feature/sprint1-pipeline`.

---

## Critério de Aceitação

1. ✅ 100% dos componentes React em `apps/web/src/components/` e `apps/web/src/routes/` cobertos por busca de imports
2. ✅ 9 hooks em `apps/web/src/hooks/` verificados (export named e default)
3. ✅ 4 Edge Functions em `supabase/config.toml` cruzadas com invocações reais (client + server-to-server)
4. ✅ 12 migrations escaneadas; tabelas sem I/O sinalizadas com rota de uso
5. ✅ `depcheck` rodado em 3 escopos (root, `apps/web`, `packages/shared`)
6. ✅ 13 variáveis em `.env.example` verificadas
7. ✅ `git branch -r` cruzado com `git log origin/<branch> ^origin/main`
8. ✅ Exports de `packages/shared/src/types.internal.ts` revisados

---

## Achados

### 🔴 Críticos (vazamento de chaves, código sensível)

Nenhum achado crítico. Não há código sensível morto, secrets em código, nem
artefatos que possam vazar credenciais.

---

### 🟡 Médios (poluição de bundle / deploy)

- **[A1]** Edge Function `connect-drive` deployada mas **nunca invocada** —
  `supabase/functions/connect-drive/index.ts:1` (203 linhas, importa zod via npm).
  Nenhum caller em `apps/web/src/` (`grep -rn "connect-drive" apps/web/src` = 0
  resultados), nenhum caller server-to-server em outras Edge Functions.
  CI deploya em `.github/workflows/deploy-functions.yml:linha do "deploy connect-drive"`
  — gasta minuto de runner + slot de Edge Function no projeto Supabase.
  Rota de uso: H6 Sprint 2 (`docs/PENDENCIAS.md:236, 312, 443, 500`). **Dono: Isaac.**

- **[A2]** Edge Function `generate-system-prompt` deployada mas **nunca invocada** —
  `supabase/functions/generate-system-prompt/index.ts:1` (151 linhas).
  Nenhum caller no client, nenhum caller em `ingest-document` ou `process-document`.
  CI deploya. Rota de uso: H7 Sprint 2/3 (`docs/PENDENCIAS.md:97, 313, 501`).
  Escreve em `public.user_system_prompts`, tabela que nenhum SELECT lê hoje. **Dono: Guilherme.**

- **[A3]** Tabela `public.user_system_prompts` sem I/O fora da Edge Function órfã —
  `supabase/migrations/0001_initial_schema.sql:182-193` + policies em `0006_security_hardening.sql:143-159`.
  Apenas `generate-system-prompt` escreve nela; nenhum SELECT no client ou em
  outras funções. Vai ficar dormente até H7 (UI de "meu prompt"). **Dono: Pedro/Guilherme.**

- **[A4]** Tabela `public.feedback` + tipo `feedback_topic` sem nenhum I/O —
  `supabase/migrations/0001_initial_schema.sql:43-49, 198-208` + policies em
  `0006_security_hardening.sql:164-184`. Grep por `from..feedback` em
  `apps/web/src` e `supabase/functions/` retorna **zero resultados**
  (única menção é no RPC de export `0006_security_hardening.sql:315`).
  Rota de uso: H10 Sprint 4. **Dono: Pedro (H10).**

- **[A5]** Colunas `google_access_token`, `google_refresh_token`, `google_token_expires_at`, `drive_folder_id`, `drive_connected_at` em `profiles` sem caller efetivo —
  `supabase/migrations/0001_initial_schema.sql` + `0004_drive_oauth.sql:1`.
  Escritas só por `connect-drive` (órfão — ver A1) e lidas por
  `process-document` (`supabase/functions/process-document/index.ts:497-524`)
  com guard `if (!profile.google_refresh_token) return early`. Como nada popula
  os tokens hoje, o ramo Drive de `process-document` nunca executa.
  **Não deletar** — vão entrar em uso quando A1 for desbloqueado. **Dono: Isaac.**

---

### 🟢 Baixos (lint-level / housekeeping)

- **[A6]** Branch remota `origin/feature/sprint1-pipeline` obsoleta — `git log origin/feature/sprint1-pipeline ^origin/main` retorna **vazio** (0 commits ahead). Já flagged em `docs/PENDENCIAS.md:541`. **Dono: Theo.**

- **[A7]** Branch remota `origin/dev` também obsoleta — `git log origin/dev ^origin/main` retorna **vazio** (0 commits ahead). NÃO documentada em `docs/PENDENCIAS.md`. `README.md:81` ainda referencia "PR de `feature/*` → `dev`" — fluxo morto, já estamos PRing direto em `main`. **Dono: Theo.**

- **[A8]** Constante `SLO` em `packages/shared/src/constants.ts:124-131` sem caller — já documentada com `TODO(observabilidade)` no próprio arquivo (`packages/shared/src/constants.ts:119`). Entra em uso quando OBS-6 (painel ops) for implementado. **Manter como está.** **Dono: Guilherme (quando OBS-6).**

- **[A9]** Tipos `GeneratedContent`, `GeneratedContentType`, `UserSystemPrompt`, `Feedback`, `FeedbackTopic` em `packages/shared/src/types.internal.ts:20-70` sem caller — arquivo **não exportado** via `index.ts` (verificado em `packages/shared/src/index.ts:1-3`). Isolamento correto schema-first. **Manter.** **Dono: Pedro/Guilherme.**

- **[A10]** Alias legado `VISION_PROVIDER` em `.env.example:67` + leitura em `supabase/functions/_shared/models.ts:80` e `supabase/functions/_shared/vision/index.ts:49` — duplicação com `VISION_MODEL`. Mantém compatibilidade com env de prod legacy (`anthropic/claude` etc). Pode ser removido quando garantirmos que nenhum deploy ainda usa o alias. **Dono: Isaac (verificar env do Supabase prod antes).**

- **[A11]** Referência a fluxo `feature/* → dev` em `README.md:80-81` — fluxo morto: time PRa direto em `main` desde os commits da Sprint 1 final (ver `git log` recente). Atualizar README junto com A7. **Dono: Theo.**

---

### Resultados negativos (limpo)

- **Componentes React (`apps/web/src/components/`):** todos os 14 (`ErrorBoundary`, `JobCard`, `MarkdownPreview`, `MetricsCards`, `PrivacySection`, `PromptCard`, `RequireAdmin`, `RequireAuth`, `Toast`, `TopbarUser`, `UnbLogo`, `UploadDropzone`) têm ≥1 caller (`grep` confirma imports em `App.tsx`, `main.tsx`, ou routes).
- **Routes admin (`apps/web/src/routes/admin/`):** `Sparkline` e `PipelineFunnel` ambos importados por `AdminDashboard.tsx:16-17`.
- **Hooks (9):** todos com caller. `useDocumentActions` exporta named (`useSetArchived`, `useDeleteDocument`) e é consumido por `DashboardPage.tsx:21` — não dead apesar do default count zero.
- **Libs (`apps/web/src/lib/`):** `consents.ts`, `supabase.ts`, `upload.ts` todos importados em múltiplos lugares.
- **`depcheck`:**
  - `apps/web/package.json` → **0 deps não usadas**. Único missing é `@eslint/js` mencionado em `eslint.config.js` (não bloqueia — vem via peer).
  - `packages/shared/package.json` → **0 deps não usadas**.
  - Root `package.json` → false-positives (`typescript`, `zod`, `@vitest/coverage-v8` aparecem como "unused" porque depcheck do root não inspeciona scripts CI que rodam `--coverage` nem workspaces). **Sem ação.**
- **`.env.example` (13 vars):** todas consumidas. `VITE_SUPABASE_*` em `apps/web/src/lib/supabase.ts`; `OPENROUTER_API_KEY` em `_shared/openrouter.ts`; `GOOGLE_CLIENT_*` em `_shared/drive/oauth.ts:44`; `MODEL_*` em `_shared/models.ts`; `VISION_MODEL`/`VISION_PROVIDER` em `_shared/vision/index.ts:44, 49`.

---

## Plano de Ação

### Batch 1 — Deletar agora (~1h30)

| ID | Ação | Comando / Arquivo | Horas | Dono |
|----|------|-------------------|-------|------|
| B1.1 | Deletar branch remota `feature/sprint1-pipeline` | `git push origin --delete feature/sprint1-pipeline` | 0.1h | Theo |
| B1.2 | Deletar branch remota `dev` (0 commits ahead de main) | `git push origin --delete dev` | 0.1h | Theo |
| B1.3 | Atualizar `README.md:80-81` removendo fluxo `feature/* → dev` (substituir por `feature/* → main`) | `README.md:80-81` | 0.2h | Theo |
| B1.4 | Riscar A6 em `docs/PENDENCIAS.md:541` (vira concluído) | `docs/PENDENCIAS.md:541` | 0.1h | Theo |
| B1.5 | Remover deploy de `connect-drive` e `generate-system-prompt` do CI até H6/H7 entrarem (comentar 2 linhas em `.github/workflows/deploy-functions.yml`) — corta ~1min de runner por PR e evita publicar Edge Functions inertes | `.github/workflows/deploy-functions.yml` | 0.5h | Isaac |
| B1.6 | Adicionar comentário-âncora no topo de `connect-drive/index.ts` e `generate-system-prompt/index.ts` apontando para `docs/PENDENCIAS.md` (sprint alvo + handler client esperado) — facilita reativação | `supabase/functions/{connect-drive,generate-system-prompt}/index.ts:1` | 0.3h | Isaac |

**Total Batch 1: ~1h20.**

---

### Batch 2 — Refatorar / migrar (~2h, condicionalmente)

| ID | Ação | Trigger | Horas | Dono |
|----|------|---------|-------|------|
| B2.1 | Isolar `connect-drive/` + `generate-system-prompt/` em branch `feature/h6-h7-orphan-functions` e remover de `main` (consolida A1 + A2 + A3 + A5) | Decisão: vale a pena manter offline até H6/H7? Se sim, executar agora. Se não, deixar como está com B1.5/B1.6 | 1.5h | Isaac + Guilherme |
| B2.2 | Remover alias legado `VISION_PROVIDER` de `.env.example`, `_shared/models.ts:80`, `_shared/vision/index.ts:11, 49` — depende de Isaac confirmar que nenhum deploy de prod usa o alias | Verificar `supabase secrets list --project-ref ...` antes | 0.5h | Isaac |
| B2.3 | Mover `GeneratedContent`/`UserSystemPrompt`/`Feedback` de `types.internal.ts` de volta pra `types.ts` quando H7/H10 iniciar | Início de H7 ou H10 | 0.3h | Pedro |
| B2.4 | Importar `SLO` em `useAdminMetrics`/`MetricsCards` quando painel ops (OBS-6) entrar | Início de OBS-6 / Sprint 3 | 0.3h | Guilherme |

**Total Batch 2: ~2.5h (não-bloqueante).**

---

## Validação

1. **Pós-B1.1 e B1.2:** `git fetch -p && git branch -r` não mostra `origin/dev` nem `origin/feature/sprint1-pipeline`.
2. **Pós-B1.3 e B1.4:** `grep -rn "feature/sprint1-pipeline\|→ dev" README.md docs/` retorna 0 ocorrências.
3. **Pós-B1.5:** próximo push em `supabase/functions/**` aciona deploy apenas de `ingest-document` + `process-document`; checar logs do GH Actions.
4. **Pós-B1.6:** `head -20` de cada arquivo mostra cabeçalho com link pra PENDENCIAS.
5. **Pós-B2.1 (se executado):** `npm run build --workspace=apps/web` + `deno check supabase/functions/ingest-document/index.ts supabase/functions/process-document/index.ts` passam limpos; CI fica verde.
6. **Pós-B2.2 (se executado):** `grep -rn "VISION_PROVIDER" supabase/ apps/ .env.example` retorna 0.
7. **Regressão:** rodar `npm test` (140+ testes, ~1.7s) — deve passar sem alteração porque achados são todos código órfão (não há teste apontando pra eles).

---

## Dependências

- **B1.1, B1.2, B1.3, B1.4:** Nenhuma. Pode rodar agora.
- **B1.5:** Depende de Isaac confirmar que `connect-drive` e `generate-system-prompt` realmente não precisam estar deployados na sprint atual (mesmo que inertes). Custo de não fazer: ~1min/PR de runtime CI desnecessário.
- **B1.6:** Independente. Pode rodar em paralelo com B1.5.
- **B2.1:** Depende da decisão estratégica (Theo/Isaac): deletar de main ou só comentar deploy. Recomendação: começar com B1.5/B1.6 e revisitar B2.1 se H6/H7 escorregarem pra Sprint 3.
- **B2.2:** Depende de Isaac verificar Supabase Secrets prod (`supabase secrets list`). Risco médio se houver deploy antigo com `VISION_PROVIDER` setado.
- **B2.3, B2.4:** Diferidas até features alvo — sem ação imediata.

---

## Métricas resumidas

| Métrica | Valor |
|---------|-------|
| Achados críticos (🔴) | 0 |
| Achados médios (🟡) | 5 (A1–A5) |
| Achados baixos (🟢) | 6 (A6–A11) |
| Linhas potencialmente removíveis (B1.5 + comentários CI) | ~5 linhas de YAML |
| Edge Functions inertes em deploy | 2 (`connect-drive` 203 linhas, `generate-system-prompt` 151 linhas) — **354 linhas totais inativas em prod** |
| Branches remotas para deletar (B1.1 + B1.2) | 2 |
| Deps removíveis | 0 |
| Variáveis `.env.example` órfãs | 0 |
| Tabelas DB sem I/O direto no código | 2 (`feedback`, `user_system_prompts`) |
| Horas Batch 1 (housekeeping imediato) | ~1h20 |
| Horas Batch 2 (refactor condicional) | ~2h30 |

---

## Notas finais

- A diferença chave vs. auditoria 27/05: confirmamos que `process-document` **é** invocado server-to-server por `ingest-document` (`ingest-document/index.ts:111-120`) — não está morto. A auditoria anterior listava as 3 funções (incluindo process-document) como "não invocadas", o que era impreciso.
- `origin/dev` é achado novo (não listado em 27/05).
- A1+A2 já existem na auditoria anterior como PRA-02, mas o batch foi adiado. B1.5 traz uma alternativa mais leve (só desligar do deploy) que tira pressão de prod sem mexer em código.
- **Não criar** nenhuma migration para deletar `feedback` ou `user_system_prompts` — schema-first é a postura correta porque o time já confirmou H7/H10 no roadmap.
