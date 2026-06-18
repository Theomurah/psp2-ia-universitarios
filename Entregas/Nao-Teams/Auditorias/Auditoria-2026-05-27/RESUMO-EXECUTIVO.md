# PSP2 — Auditoria 2026-05-27 — Resumo Executivo

**Data:** 2026-05-27
**Escopo:** 6 frentes paralelas (Bugs, Código Morto, Segurança, Observabilidade, Testes, Banco)
**Contexto:** Re-auditoria 1 dia após `Auditoria-2026-05-26` (untracked) — muitos itens já corrigidos via commits recentes. Foco no estado **atual** do código.

---

## Visão por frente

### 🐛 Agente 1 — Bugs e Lacunas Funcionais
10 achados (🔴 2 / 🟡 6 / 🟢 2), ~15h, dominante Isaac (~8h) + Pedro (~6h). Os 2 críticos são **A2 (status `needs_review` nunca atribuído após `validateClassification`)** e **A4 (modo `compressed_cola` declarado em enum mas pipeline nunca gera o segundo nível de compressão)** — ambos comprometem qualidade do output entregue ao aluno. Lacunas funcionais: `connect-drive` e `generate-system-prompt` têm Edge Function pronta mas frontend ainda não consome (S2T27/S2T32 pendentes de wire-up). Demais itens são higiene de React Query (`invalidateQueries`, `onError`) e confirmação de unsubscribe em hooks de realtime.

### 🪦 Agente 2 — Código Morto
Praticamente limpo. 1 item deletável agora (branch `origin/feature/sprint1-pipeline`, 0.25h). 3 Edge Functions (`connect-drive`, `generate-system-prompt`, `process-document`) ainda não totalmente consumidas pelo front, mas estão em rota de uso (H6/H7 da Sprint 2 — manter). Zero componentes React órfãos, zero hooks/utilitários sem caller, zero deps removíveis. Dono: Theo (limpeza de branch).

### 🔒 Agente 3 — Segurança
12 achados (🔴 **0** / 🟡 5 / 🟢 7), ~8h ativas. **Nenhuma vulnerabilidade crítica** — RLS íntegro em todas as 8+ tabelas com `user_id`, CORS strict, chaves server-side só em `Deno.env.get()`, prompt-injection sandbox `<<DOC>>...<</DOC>>` ativo, validação Zod em 3/4 funções críticas. Gaps amarelos: (i) `process-document` sem rate limit, (ii) `ingest-document` sem validação Zod de `format` server-side, (iii) `google_refresh_token` em plain-text, (iv) markdown LLM-gerado sem sanitização estrutural antes do Drive, (v) `user_consents` sem logging do OAuth Google. Dono dominante: Isaac.

### 📊 Agente 4 — Observabilidade
8 achados (🔴 4 / 🟡 1 / 🟢 3), ~20h, dominante Isaac. Convenção e helper (`_shared/log.ts` com `createLogger` + REDACT_KEYS) existem mas **as 4 Edge Functions ainda usam `console.error` direto**. `callLLMWithRetry` tem `onRetry` wired mas falta `llm_start`/`llm_end` (modelo, latência, `usage` tokens). **Não há `request_id` ponta-a-ponta** entre frontend e Edge — correlação de incidentes precária. Faltam scripts de ops em `tools/ops/` pra consultar erros recentes e jobs falhos. ErrorBoundary global no front ✅ ok.

### 🧪 Agente 5 — Testes e Qualidade
8 achados (🔴 3 / 🟡 4 / 🟢 1), ~37h, dominante Pedro + Luis Felipe + Isaac. Backend forte (~163 testes em `_shared/` + `packages/shared/`), **frontend zero**, **`index.ts` das 4 Edge Functions zero**, **integração e2e zero**. CI tem gate validate-then-deploy ✅ mas coverage coletado sem threshold. ESLint instalado sem config (lint = noop), Prettier ausente. TypeScript strict ✅ ok. Smoke test checklist pro QA ausente. Caminho crítico ingest→process→drive não exercitado de ponta a ponta.

### 🗄️ Agente 6 — Banco de Dados
7 achados (🔴 **0** / 🟡 4 / 🟢 3), ~15h, dominante Theo (decisões) + Isaac (execução). Schema sólido: todas as 12 migrations idempotentes, FKs com `ON DELETE` explícito, índices cobertos (0011 fechou advisor), RLS habilitado em todas as tabelas com dado de usuário, policies consolidadas (uma permissiva por ação). Gaps amarelos: (i) backup/restore sem documentação, (ii) 0001/0002 sem `COMMENT` SQL, (iii) **status de 0003-0006 em prod ainda ambíguo** (per `MEMORY.md` não aplicadas — 0006 não vigente em prod é silencioso e perigoso), (iv) decisão pgvector pendente.

---

## Top 5 itens críticos globais (ordenados por bloqueio de sprint)

| #  | Item | Frente | Severidade | Bloqueia | Dono |
|----|------|--------|------------|----------|------|
| 1  | **Migrations 0003-0006 não aplicadas em prod** (especialmente 0006 = security hardening) | Banco A3 | 🟡→🔴 em prod | Sprint 2 (Drive depende de 0004), prod inteira (RLS extra em 0006) | Theo |
| 2  | **Status `needs_review` nunca atribuído** | Bugs A2 | 🔴 | Qualidade do output, rubrica acadêmica | Isaac/Guilherme |
| 3  | **Modo `compressed_cola` declarado mas não gerado** | Bugs A4 | 🔴 | Critério S1T10, demo final | Guilherme |
| 4  | **4 Edge Functions com `console.error` direto + sem `request_id` ponta-a-ponta** | Observabilidade A1+A3 | 🔴 | Suporte ao aluno em prod | Isaac |
| 5  | **Zero testes no `index.ts` das 4 Edge Functions e zero no frontend** | Testes A1+A2 | 🔴 | Confiança em deploy de Sprint 3 | Pedro + Isaac |

---

## Conflitos / sobreposições entre planos

- **RLS:** Agente 3 (segurança) e Agente 6 (banco) tocam RLS por ângulos diferentes. **Sem conflito** — A6 garante integridade da migration (idempotência, `enable rls`), A3 garante policy lógica (`auth.uid() = user_id` por op). Cross-check confirma: ambos batem.
- **Edge Functions órfãs:** Agente 1 (A1, A3 — `connect-drive` e `generate-system-prompt` sem consumidor) e Agente 2 (mesma listagem em "rota de uso"). **Sem conflito** — Agente 2 corretamente classifica como "manter" porque a feature está em desenvolvimento (Pedro está com `SettingsPage.tsx` e `PromptsPage.tsx` modificados no WIP atual de 100+ arquivos).
- **Observabilidade vs Segurança:** Agente 4 (logs) e Agente 3 (REDACT_KEYS) tocam o mesmo helper. **Compatível** — A3 sugere adicionar variantes (`gpt_key`, `openai_key`); A4 sugere adoção universal do helper. Devem ser executados juntos (mesmo arquivo).
- **Testes e2e (A5/A3) e Bugs A2/A4:** O teste de integração proposto em A5/A3 (Testes) cobre exatamente os bugs A2/A4 (pipeline) — devem ser implementados na mesma janela (corrige + testa).

---

## Ordem de execução recomendada (alinhada com sprint atual)

A branch atual é `feature/sprint1-finalization`. Sprint 1 finalizando, Sprint 2 (Drive + Prompts) começando. Entrega final do projeto acadêmico: **09/07/2026** (~6 semanas).

**Fase 1 — Inadiável (esta semana, ~10h):**
1. **B-DB1** (Banco): validar/aplicar 0003-0006 em prod (2h) — destrava Sprint 2
2. **B-S1** (Segurança): rate limit em `process-document` + Zod enum em `ingest-document` (2h)
3. **B-B1** (Bugs): `needs_review` + `compressed_cola` (4h) — qualidade do output
4. **B-O1 parcial** (Observabilidade): adoção do `createLogger` em `process-document` apenas (2h) — a função crítica

**Fase 2 — Sprint 2 (próxima semana, ~16h):**
5. **B-B2** (Bugs): wire-up Connect Drive + generate-system-prompt no front (3h)
6. **B-S2 + B-S3** (Segurança): markdown sanitization + pgcrypto pro refresh token (5h)
7. **B-O1 resto + B-O2** (Observabilidade): createLogger nas outras 3 funções + telemetria OpenRouter (8h)

**Fase 3 — Sprint 3 (deploy prep, ~30h):**
8. **B-T1 + B-T2 + B-T3** (Testes): frontend setup + edge tests + e2e pipeline (30h)
9. **B-O3** (Observabilidade): `request_id` ponta-a-ponta (6h)
10. **B-B3 + B-B4** (Bugs): React Query hygiene + memory leaks (5h)

**Fase 4 — Entrega final (~12h):**
11. **B-DB2 + B-DB3** (Banco): backup/restore docs + COMMENT retroativo (7h)
12. **B-T5** (Testes): smoke test docs pro Luis Felipe (3h)
13. **B-B5** (Bugs): reconciliação de backlog Sprint 1/2 (2h)

**Total estimado:** ~68h ao longo de 6 semanas, distribuídas pelo time (Isaac ~35h, Pedro ~18h, Guilherme ~6h, Luis Felipe ~6h, Theo ~3h).

---

## Riscos pro projeto acadêmico (entrega 09/07/2026)

1. **🔴 Bugs A2/A4 (needs_review + compressed_cola)** comprometem a rubrica "qualidade do output" do artigo ENEGEP. Sem fix, a demo mostra pipeline incompleto. **Mitigação:** Fase 1, esta semana.
2. **🔴 Migrations 0003-0006 não em prod** = produção roda RLS pre-hardening. Se aplicar em cima da hora antes da demo, risco alto de quebra. **Mitigação:** Aplicar em staging primeiro, durante Fase 1.
3. **🟡 Zero testes de frontend** dificulta refatorações de UI da Fase 3. Cada mudança vira teste manual. **Mitigação:** B-T1 antes de qualquer redesign agressivo.
4. **🟡 Ausência de `request_id` ponta-a-ponta** complica suporte no dia da demo (não dá pra mapear "deu erro" ↔ trace específico). **Mitigação:** B-O3 antes do deploy de Sprint 3.
5. **🟢 Documentação técnica fraca** (backup/restore, COMMENT SQL, smoke test). Rubrica pesa. **Mitigação:** Fase 4 cobre.
6. **🟢 100+ arquivos em WIP no working tree atual** (3800+ linhas insertions). Risco de WIP perder contexto entre membros do time. **Mitigação:** review e commit das mudanças em PRs pequenos esta semana.

---

## Estado dos artefatos desta auditoria

Localização: `Entregas/Auditoria-2026-05-27/`

- ✅ `PSP2 - Auditoria S1 - Bugs e Lacunas Funcionais.md`
- ✅ `PSP2 - Auditoria S1 - Codigo Morto.md`
- ✅ `PSP2 - Auditoria S1 - Seguranca.md`
- ✅ `PSP2 - Auditoria S1 - Observabilidade.md`
- ✅ `PSP2 - Auditoria S1 - Testes e Qualidade.md`
- ✅ `PSP2 - Auditoria S1 - Banco de Dados.md`
- ✅ `RESUMO-EXECUTIVO.md` (este arquivo)
- ✅ `QUICKWINS.md`

---

## Quickwins aplicados

**Status: NÃO aplicados nesta execução** — decisão autônoma documentada abaixo.

**Motivo:** No momento desta auditoria (2026-05-27 05:54), o working tree continha **100+ arquivos modificados não-commitados (3800+ linhas insertions / 514 deletions)** em arquivos centrais do frontend e pipeline (`apps/web/src/App.tsx`, `JobCard.tsx`, `RequireAuth.tsx`, `UploadDropzone.tsx`, `useJobs.ts`, `useProfile.ts`, `DashboardPage.tsx`, `LoginPage.tsx`, `SettingsPage.tsx`, `ingest-document/index.ts`, `_shared/models.ts`, etc.). Vários quickwins candidatos atravessam diretamente esses arquivos.

**Critério da task:** "Não toca código que outra pessoa do time está claramente desenvolvendo agora — cheque `git log --since='3 days ago' --name-only` antes". Nesse caso, **o próprio Theo está com WIP nesses arquivos no momento** — auto-aplicar e commitar arriscaria entrelaçar com a refatoração em curso e perder contexto de revisão.

**Itens triados estão listados em `QUICKWINS.md`** com status `⏭️ pulado (working tree dirty — review manual após Theo organizar PRs do WIP atual)`. Theo pode aplicá-los um a um após split do WIP em PRs revisáveis.

**Hash de commits criados nesta execução:** nenhum.
