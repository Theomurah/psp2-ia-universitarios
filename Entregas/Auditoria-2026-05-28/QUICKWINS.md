# PSP2 — Auditoria 2026-05-28 — Quickwins

Triagem dos achados das 6 frentes contra os critérios de quickwin:

- Certeza ≥ 95% de que o fix está correto
- Escopo cirúrgico: ≤ 30 LOC, ≤ 3 arquivos
- Sem mudança de contrato público (Edge Function API, tipo exportado em shared, schema DB)
- Sem nova migration
- Sem novo teste de integração
- Reversível em 1 commit
- ≤ 20 min de execução
- Não toca código em desenvolvimento ativo nas últimas 72h (cheque `git log --since="3 days ago" --name-only`)

Cada item vira **um commit separado** (Conventional Commits). Sem push.

---

## Candidatos aprovados (8)

| # | Item | Origem | Arquivo(s) | LOC | Justificativa | Status |
|---|------|--------|-----------|-----|----------------|--------|
| QW-1 | Corrige cabeçalho de `0012_archive_documents.sql` ("Migration 0007" → "0012") + entrada errada em `PENDENCIAS.md:121` (`admin_audit_log` não existe; `0009` cria `app_settings`) | BD A2 + A3 | `supabase/migrations/0012_archive_documents.sql`, `docs/PENDENCIAS.md` | ~3 | Doc-only, 100% certeza, reversível, ~5min | ⏭️ pulado — `PENDENCIAS.md` tem WIP local +68/−23 do Theo; `0012_archive_documents.sql` está **untracked** (commitá-lo aqui ataria 0012 inteiro ao meu commit). Não é seguro misturar. |
| QW-2 | Remove referência a `max_retries` na prosa do roadmap pg_cron do CLAUDE.md — coluna não existe em `jobs` (só `attempt_count`); o exemplo SQL na seção já usa literal `2` | BD A9 | `CLAUDE.md` | ~2 | Doc-only, alinhamento com schema real, ~3min | ⏭️ pulado — CLAUDE.md tem WIP local +94 do Theo. Misturaria WIP no commit do fix. |
| QW-3 | Atualiza fluxo git no `README.md:78-82` — branch `dev` é morta (0 commits ahead de `main`), PRs vão direto pra `main` há vários commits | CÓD MORTO A11 | `README.md` | ~3 | Doc-only, alinha com prática real, ~3min | ✅ aplicado (commit `7fb45d7`) |
| QW-4 | Amplia `REDACT_KEYS` em `_shared/log.ts` com variantes históricas de chaves LLM (`api_key`, `openai_key`, `anthropic_key`, `gpt_key`, `id_token`) | SEG A6 | `supabase/functions/_shared/log.ts` | ~5 | Defesa em profundidade no helper (zero uso real ainda — sem risco regressão), ~3min | ✅ aplicado (commit `25a2eaf`) — também adicionei `openrouter_api_key` por simetria |
| QW-5 | Troca `??` por `\|\|` na message do judge em `process-document/index.ts:367` — `??` testa null/undefined, mas `[].join(';')` devolve `''` (não-nullish), zerando o erro real | BUG B8 | `supabase/functions/process-document/index.ts` | 1 | Bug óbvio de semântica `??`, fix trivial, ~2min | ✅ aplicado (commit `914e6c0`) — adicionado `\|\| null` no fim pra garantir null em vez de string vazia |
| QW-6 | Sanitiza 3 `console.error/warn` que passam objeto `Error`/`PostgrestError` cru no frontend (vaza `details`/`hint` em DevTools/Sentry futuro) | OBS A4 | `apps/web/src/components/UploadDropzone.tsx:42`, `apps/web/src/hooks/useProfile.ts:76`, `apps/web/src/routes/LoginPage.tsx:109` | ~6 | Convenção CLAUDE.md §Frontend, 3 arquivos no limite, ~10min | ⏭️ pulado — todos os 3 arquivos têm WIP local substancial do Theo (UploadDropzone +36/−10, useProfile +64/−7, LoginPage +230/−85). Misturaria centenas de linhas de WIP no commit. |
| QW-7 | Move `setUploading(true)/(false)` pra fora do `for` em `UploadDropzone.onDrop` — hoje libera o dropzone entre arquivos por 1 tick, dando janela pra arrastar terceiro arquivo no meio do batch | BUG B11 | `apps/web/src/components/UploadDropzone.tsx` | ~5 | Bug observável, fix estrutural simples, ~5min | ⏭️ pulado — mesmo motivo de QW-6 (UploadDropzone com WIP local). |
| QW-8 | Troca dep `selected` → `selected?.id` no `useEffect` de `DashboardPage:65-69` — evita re-render extra quando o efeito recria referência | BUG B12 | `apps/web/src/routes/DashboardPage.tsx` | 1 | Hint de eslint-react-hooks, sem mudança comportamental, ~2min | ⏭️ pulado — DashboardPage tem WIP local +347/−24 do Theo. |

**Aplicados:** 3 de 8 (QW-3, QW-4, QW-5). **Pulados:** 5 por WIP local (commits ⏭️).
**Tempo real:** ~10min de execução + validation gates (test, typecheck, lint, todos ✅).
**Validation:** `npm test` 163/163 ✅, `npm run typecheck` ✅ (3 workspaces strict), `npm run lint` ✅.

> **Observação para o Theo:** os 5 quickwins pulados continuam válidos. Quando o WIP atual for commitado (ou stashado), basta rodar os edits descritos acima — todos têm `arquivo:linha` exato. Alternativamente, posso reaplicar no próximo ciclo após o WIP ser resolvido.

---

## Rejeitados na triagem (com motivo)

| Achado | Frente | Motivo de rejeição |
|--------|--------|---------------------|
| BUG B1 (`needs_review` attribution) | Bugs | Não cirúrgico — muda ramificação do pipeline, requer carry-over de estado parcial. Vai pra Batch B-D1 do plano. |
| BUG B2 (`compressed_cola` geração) | Bugs | Bloqueado por decisão de produto (custo LLM dobra). Precisa Theo + Guilherme. |
| BUG B3 (transação `ingest-document`) | Bugs | Requer RPC nova (SECURITY DEFINER) ou rollback explícito; > 30 LOC. Plano. |
| BUG B4 (Storage órfão no upload reject) | Bugs | Mexe em `lib/upload.ts` que tem refactor recente (`c1e552e`) — coupling risk. Plano. |
| BUG B5 / B6 (Drive UI / system prompt UI) | Bugs | Novos componentes + handlers + hooks. Múltiplos arquivos. Plano (B-D3). |
| BUG B7 (`QueryCache.onError` global) | Bugs | Decisão arquitetural (meta flag vs por-query). Plano. |
| BUG B9 (rotação `refresh_token`) | Bugs | Toca `process-document` recém-modificado (vários commits dos últimos 3 dias). Coupling risk + decisão sobre erro vs warning. Plano. |
| BUG B10 (`STEP_LABEL` em shared) | Bugs | Borderline — requer extrair pra `packages/shared/src/constants.ts` e refatorar 2 consumidores. 30min estimado. Plano. |
| BUG B13 (.docx critério aceitação) | Bugs | Edita binários `.docx` (entregas). Não é código. Plano (Luis Felipe). |
| CÓD MORTO A6 / A7 (deletar branches remotas) | Código morto | **Destrutivo remoto** (`git push --delete`). Precisa aprovação explícita do Theo. Não-quickwin. |
| CÓD MORTO B1.5 (desativar deploy de Edge Functions órfãs) | Código morto | Conflito com BUG B5/B6 — as funções vão ser wiradas na UI essa semana. Não desativar. |
| CÓD MORTO B1.6 (comment-âncora nas Edge Functions órfãs) | Código morto | 30min para 2 funções + alinhar com plano de wire-up. Plano. |
| CÓD MORTO B2.2 (alias `VISION_PROVIDER`) | Código morto | Requer verificar Supabase Secrets em prod antes de remover. Não-quickwin. |
| SEG A1 (rate limit em `process-document`) | Segurança | Função recém-modificada em vários commits dos últimos 3 dias. Coupling risk. Plano. |
| SEG A2 (format × extensão cross-check) | Segurança | Mexe em `ingest-document` (caminho compartilhado com BUG B3/B4). Aguarda batch transacional. Plano. |
| SEG A3 (encryption `google_refresh_token`) | Segurança | Requer migration 0013 + wrapper. ~3h. Plano. |
| SEG A4 (`createLogger` nas 4 Edge Functions) | Segurança / Obs | ~8h. Plano Fase 1 (Batch B-O1 consolidado). |
| SEG A5 (sanitização markdown LLM) | Segurança | 2h. Plano. |
| SEG A7 (front parsea `{ error, message }`) | Segurança | Multi-arquivo (upload + hooks), ≥4 arquivos. Plano. |
| SEG A10 / A11 (config Supabase Dashboard / secrets) | Segurança | Configuração externa, não código local. Theo executa no dashboard. |
| SEG A12 (`0008_admin_role.sql` raise notice) | Segurança | **Edita migration já aplicada** — não-quickwin por regra. Plano (criar 0013+ override ou aceitar). |
| OBS A1 / A10 (`createLogger` universal) | Observabilidade | ~8h. Plano Fase 1 (consolidado com SEG A4). |
| OBS A2 (`llm_start`/`llm_end` no OpenRouter) | Observabilidade | Mexe em helper compartilhado (`_shared/openrouter.ts`); decisão sobre DI do logger. Plano. |
| OBS A3 (`request_id` ponta-a-ponta) | Observabilidade | Requer migration + mudança em front + 4 funções. ~6h. Plano. |
| OBS A5 (`tools/ops/*.sql`) | Observabilidade | Cria diretório + 3 SQL files; requer alinhamento com Theo sobre queries canônicas. Plano. |
| OBS A9 (`_shared/models.ts` log helper) | Observabilidade | Importar `createLogger` em `_shared/models.ts` muda o caráter neutro do shared — decisão de DI. Plano. |
| TESTES A1 / A2 / A3 / A6 / A7 / A9 / A10 | Testes | Todos requerem novos arquivos de teste / config de CI / threshold. ≥1h cada. Plano. |
| TESTES A5 (Prettier) | Testes | Adicionar `.prettierrc` + script + CI step. ≥30min. Plano. |
| DB A1 (`status='success'` → `('completed', ...)`) | Banco | **Requer migration 0013** (regra de quickwin diz não). Top prioridade do plano Fase 1. |
| DB A4 / A5 (índices) | Banco | Migration. Plano. |
| DB A6 (`source_documents` schema) | Banco | Decisão Theo + Guilherme + migration. Plano. |
| DB A7 (CHECK ranges) | Banco | Migration. Consolidar em 0013 com DB A1. Plano. |
| DB A11 (`docs/backup-restore.md`) | Banco | Criar doc novo requer input do Theo sobre cadência DR e procedimento de teste. Plano. |

---

## Validação após cada commit

Após cada quickwin (ou após o último de cada workspace):

```bash
npm test           # 163 testes, ~11s — deve continuar verde
npm run typecheck  # 3 workspaces strict
npm run lint       # apps/web flat ESLint v9
npm run build --workspace=apps/web
```

Para mudanças que toquem Edge Functions (QW-4, QW-5):

```bash
deno check supabase/functions/process-document/index.ts
deno check supabase/functions/_shared/log.ts
```

---

## Atualização final

Esta seção é preenchida ao final, marcando cada item como `✅ aplicado (commit <hash>)` ou `⏭️ pulado (motivo)`. Hashes coletados via `git log --oneline -n <N>`.
