# PSP2 — Auditoria 2026-05-27 — Quickwins

**Data:** 2026-05-27
**Branch:** `feature/sprint1-finalization`
**Decisão autônoma:** **NÃO aplicar nenhum quickwin nesta execução.** Working tree tem 100+ arquivos modificados não-commitados (3800+ linhas) em arquivos centrais que se sobrepõem aos candidatos. Aplicar agora arrisca entrelaçar com WIP do Theo e quebrar a rastreabilidade de revisão (1 commit por quickwin exige working tree limpa).

Theo deve revisar e aplicar manualmente após split do WIP atual em PRs revisáveis.

---

## Critério de triagem (do prompt da auditoria)

Item entra como quickwin **se cumprir TODAS** as condições:
- Certeza ≥ 95% que o fix está correto (sem decisão pendente)
- ≤ 30 LOC alteradas, ≤ 3 arquivos
- Sem mudar contrato público (API, type exportado, schema de banco)
- Reversível em 1 commit
- Sem migration nova
- Sem novo teste de integração (ajuste em unit teste OK)
- ≤ 20 min de execução
- Não toca código que outra pessoa do time está editando agora

---

## Candidatos triados

### Q1 — `process-document` sem rate limit
- **Frente:** Segurança (A1)
- **Arquivo:** `supabase/functions/process-document/index.ts:115`
- **Fix:** 1 linha — `await checkRateLimit('process:' + fingerprint, { max: 30, windowSec: 60 })`
- **Justificativa quickwin:** ≤ 5 LOC, sem mudança de contrato, helper já existe em `_shared/rate-limit.ts`.
- **Status:** ⏭️ **pulado — working tree dirty.** `process-document/index.ts` não está no diff WIP, mas `_shared/models.ts` (importação) sim. Risco baixo, mas o critério exige zero overlap.
- **Tempo:** 5 min

### Q2 — `ingest-document` aceita `format` sem enum Zod
- **Frente:** Segurança (A2)
- **Arquivo:** `supabase/functions/ingest-document/index.ts` (Zod schema do body)
- **Fix:** Trocar `format: z.string()` por `format: z.enum(['pdf','docx','pptx','md','image'])`
- **Justificativa quickwin:** 1 linha, schema lifecycle estável.
- **Status:** ⏭️ **pulado — `ingest-document/index.ts` tem 85 linhas modificadas no working tree atual** do Theo. Overlap direto, não aplicar.
- **Tempo:** 3 min

### Q3 — REDACT_KEYS extra (`gpt_key`, `openai_key`)
- **Frente:** Segurança (A5)
- **Arquivo:** `supabase/functions/_shared/log.ts:28-43`
- **Fix:** Adicionar 2-3 strings na constante `REDACT_KEYS`
- **Justificativa quickwin:** Defensivo, sem risco.
- **Status:** ⏭️ **pulado — working tree dirty (regra geral).** Item de baixo retorno; pode ser aplicado em PR dedicado sem urgência.
- **Tempo:** 2 min

### Q4 — Deletar branch obsoleta `origin/feature/sprint1-pipeline`
- **Frente:** Código Morto
- **Comando:** `git push origin --delete feature/sprint1-pipeline`
- **Justificativa quickwin:** 0 LOC, só housekeeping.
- **Status:** ⏭️ **pulado — push remoto.** Conforme regras de segurança da CLI, **não fazemos push autônomo**. Theo executa manualmente.
- **Tempo:** 1 min (manual)

### Q5 — `unhandledrejection` handler já existe? (Observabilidade)
- **Frente:** Observabilidade (A8)
- **Status:** ⏭️ **não é fix — confirmação positiva.** Agente 4 confirmou que existe.

### Q6 — Sanitização de `PostgrestError` em hooks do front
- **Frente:** Observabilidade (A4)
- **Arquivos:** ~2 pontos em `apps/web/src/hooks/`
- **Fix:** Trocar `console.error('msg:', err)` por `console.error('msg:', { message: err.message, code: err.code })`
- **Justificativa quickwin:** ≤ 4 LOC, padrão documentado em `CLAUDE.md`.
- **Status:** ⏭️ **pulado — `apps/web/src/hooks/useJobs.ts` (21 linhas modificadas) e `useProfile.ts` (71 linhas modificadas)** estão no WIP atual. Overlap direto.
- **Tempo:** 5 min

---

## Itens que NÃO entraram em quickwin (escopo maior, planejar)

Estes ficaram nos planos das 6 frentes — exigem discussão arquitetural ou refatoração:

- ❌ `needs_review` no pipeline (Bugs A2) — exige decisão sobre threshold de warnings + UI pra revisão
- ❌ `compressed_cola` gerar segunda compressão (Bugs A4) — nova chamada LLM, custo, prompt novo
- ❌ Adoção universal de `createLogger` nas 4 Edge Functions (Obs A1) — 4 arquivos × ~50 LOC cada
- ❌ Encryption-at-rest do `google_refresh_token` (Segurança A3) — exige migration + wrapper
- ❌ `request_id` ponta-a-ponta (Obs A3) — 3 camadas, mudança de contrato
- ❌ Aplicar 0003-0006 em prod (Banco A3) — operação de devops, fora de scope quickwin
- ❌ Criar testes de frontend / e2e (Testes A1/A3) — semanas de trabalho

---

## Sumário

- **Candidatos triados:** 6
- **Aplicados:** 0
- **Pulados:** 6 (todos por overlap com WIP atual do Theo OU regra de segurança)
- **Commits criados:** nenhum
- **Hash:** N/A

**Ação recomendada pro Theo:**
1. Quebrar o WIP atual em PRs por escopo (front auth/UI, edge ingest, _shared models, etc.) e commitar
2. Working tree limpo após isso → aplicar Q1, Q2, Q3, Q6 em commits separados (4 commits, ~15 min total)
3. Q4 (delete branch remota) via `git push --delete` manual
