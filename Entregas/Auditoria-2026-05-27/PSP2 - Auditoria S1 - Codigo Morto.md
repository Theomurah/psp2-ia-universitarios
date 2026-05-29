# PSP2 — Auditoria S1 — Código Morto (2026-05-27)

## Cabeçalho
- **Data:** 2026-05-27
- **Auditor:** Agente 2 (Código Morto e Não Utilizado)
- **Escopo:** React components, hooks, Edge Functions, migrations, deps, env vars, branches, types/constantes compartilhadas
- **Repo:** `psp2-ia-universitarios` (Theo GP, Pedro frontend, Isaac backend, Guilherme IA, Luis Felipe QA)
- **Baseline:** Auditoria anterior em `Entregas/Auditoria-2026-05-26/`

---

## Objetivo
Mapear artefatos não invocados e código morto para remover ruído, reduzir complexidade de manutenção e liberar deps desnecessárias.

---

## Critério de Aceitação
1. ✅ Scan de 100% dos componentes React (`apps/web/src/components/`, `routes/`)
2. ✅ Verificação de hooks (`apps/web/src/hooks/`) e libs (`apps/web/src/lib/`)
3. ✅ Edge Functions declaradas vs. invocações reais
4. ✅ Migrations: tabelas/colunas criadas mas sem I/O correspondente
5. ✅ Dependencies em `package.json` (raiz, web, shared) vs. imports
6. ✅ Variables em `.env.example` vs. consumo no código
7. ✅ Branches obsoletas referenciadas em docs ou README
8. ✅ Constantes/types não exportados ou sem caller em `packages/shared/src/`

---

## Achados

### A1: Edge Functions não invocadas
**Arquivos afetados:**
- `supabase/functions/connect-drive/index.ts:1`
- `supabase/functions/generate-system-prompt/index.ts:1`
- `supabase/functions/process-document/index.ts:1`

**Severidade:** 🟡 (não afeta o build, mas mantém código da H6 não ativo)

**Descrição:** 
Três Edge Functions estão declaradas mas nunca são invocadas pelo client. 
- `connect-drive` — Google Drive OAuth (H6 Sprint 2, não priorizado)
- `generate-system-prompt` — Geração de system prompt (H7 Sprint 3, não implementado)
- `process-document` — Processamento alternativo (não referenciado em nenhuma rota)

Apenas `ingest-document` é invocado de `apps/web/src/lib/upload.ts:27`.

**Impacto:** Ruído no entendimento do pipeline real; código morto checa imports de pacotes pesados (Vision, parsing).

---

### A2: Constante `SLO` não consumida
**Arquivo:** `packages/shared/src/constants.ts:124–131`

**Severidade:** 🟢 (documentada, sem risco)

**Descrição:**
```typescript
export const SLO = {
  small_doc_chars: 5_000,
  medium_doc_chars: 20_000,
  large_doc_chars: 100_000,
  small_p95_seconds: 60,
  medium_p95_seconds: 90,
  large_p95_seconds: 150,
} as const;
```

Definida mas nunca importada ou consumida. Comentário no código já avisa: "TODO(observabilidade)". Destinada ao painel ops (OBS-6 auditoria anterior), mas não integrada ainda.

**Impacto:** Nenhum — constante é privada à spec e será necessária quando observabilidade entrar.

---

### A3: Types internos não exportados
**Arquivo:** `packages/shared/src/types.internal.ts:1–71`

**Severidade:** 🟢 (schema-first, documentado)

**Descrição:**
Tipos `GeneratedContent`, `UserSystemPrompt`, `Feedback`, `FeedbackTopic` movidos de `types.ts` na auditoria anterior porque não tinham caller. Permanecem em arquivo separado, não exportados via `index.ts`.

Mapeiam tabelas do schema (0001) mas interface será consumida em H7/H10 (futura). Sem risco — estão isolados.

**Impacto:** Nenhum; artefato organizado corretamente.

---

### A4: Branch remota obsoleta
**Arquivo:** Git reflog

**Severidade:** 🟡 (ruído, já flagged em docs)

**Descrição:**
Branch remota `origin/feature/sprint1-pipeline` existe mas já foi mergeada em `main`. 

Referência em `docs/PENDENCIAS.md` (A6) solicita:
```
git push origin --delete feature/sprint1-pipeline
```

**Impacto:** Menor — polui `git branch -a`, confunde novo dev sobre branches ativas.

---

### A5: Sem código morto em componentes React
**Resultado:** ✅

Todos 12 componentes (`ErrorBoundary`, `JobCard`, `MarkdownPreview`, `MetricsCards`, `PrivacySection`, `PromptCard`, `RequireAdmin`, `RequireAuth`, `Toast`, `TopbarUser`, `UnbLogo`, `UploadDropzone`) possuem ≥1 callers.

---

### A6: Sem código morto em hooks
**Resultado:** ✅

Todos 9 hooks (`useActivity`, `useAdminMetrics`, `useAppSettings`, `useAuth`, `useDocumentActions`, `useIsAdmin`, `useJobs`, `useProfile`, `usePromptLibrary`) possuem ≥1 uses.

---

### A7: Sem código morto em libs frontend
**Resultado:** ✅

Três libs (`consents.ts`, `supabase.ts`, `upload.ts`) todas importadas.

---

### A8: Sem deps não utilizadas
**Resultado:** ✅

Todas as dependencies em `package.json` (raiz, `apps/web/`, `packages/shared/`) aparecem em imports (verificado `react-dropzone`, etc.).

---

### A9: Sem variáveis `.env.example` orphans
**Resultado:** ✅

Todas as 13 vars (`VITE_SUPABASE_URL`, `OPENROUTER_API_KEY`, `GOOGLE_CLIENT_*`, `MODEL_*`, `VISION_*`) consumidas.

---

### A10: Sem tipos não usados em shared/src/types.ts
**Resultado:** ✅

Todos os interfaces/types públicos (`Profile`, `DocumentRecord`, `JobRecord`, `JobEvent`, `PromptLibraryItem`, `ClassificationResult`, etc.) são importados ou consumidos.

---

## Plano de Ação

### (a) Deletar agora (sem risco)
**PRA-01:** Remover branch remota obsoleta
- **Arquivo(s):** Git reflog
- **Ação:** `git push origin --delete feature/sprint1-pipeline`
- **Horas:** 0.25 h
- **Responsável:** Theo (GP) ou Pedro (pode rodar)
- **Validação:** `git branch -a` não mostra `feature/sprint1-pipeline`

---

### (b) Em rota de uso (manter)
**PRA-02:** Isolar Edge Functions H6/H7 em branch feature
- **Arquivo(s):** `supabase/functions/connect-drive/`, `generate-system-prompt/`, `process-document/`
- **Ação:** Criar branch `feature/h6-drive-h7-systemPrompt` com essas 3 functions; deletar de main até que forem invocadas
- **Horas:** 1.5 h
- **Responsável:** Isaac (backend) com Guilherme (IA)
- **Validação:** `git diff main...feature/h6-drive-h7-systemPrompt` mostra só os 3 functions
- **Nota:** Reduz ruído de build/deploy de functions não ativas; pronto pra merge quando H6/H7 entrar

---

**PRA-03:** Integrar `SLO` quando painel ops entrar (OBS-6)
- **Arquivo:** `packages/shared/src/constants.ts:124–131`
- **Ação:** Quando H11 (observabilidade) é priorizada, importar e consumir em dashboard admin
- **Horas:** Diferido (sprint 3+)
- **Responsável:** Guilherme (quando OBS-6 iniciar)
- **Validação:** `grep -r SLO apps/web/src supabase/functions` retorna imports ativos

---

**PRA-04:** Mover types internos quando H7/H10 iniciarem
- **Arquivo:** `packages/shared/src/types.internal.ts`
- **Ação:** Quando UI de feedback + system prompt entrar, mover tipos de volta pra `types.ts` e exportar
- **Horas:** Diferido (sprint 3–4)
- **Responsável:** Pedro (frontend) + Guilherme (IA)
- **Validação:** `npm run typecheck` passa com types importados em `routes/`

---

## Resumo de Métricas

| Métrica | Valor |
|---------|-------|
| Componentes não usados | 0 |
| Hooks não usados | 0 |
| Edge Functions não invocadas | 3 (em rota H6/H7) |
| Deps removíveis imediatamente | 0 |
| Branches obsoletas | 1 |
| Constantes sem caller | 1 (SLO, documentada) |
| Types orphans | 0 (isolados em .internal.ts) |
| **Total de achados com ação imediata** | **1 (branch)** |
| **Total em rota de uso** | **3 (functions H6/H7)** |
| **Horas para limpeza prioritária** | **0.25 h** |
| **Horas para refactor (futuro)** | **1.5 h** |

---

## Validação

1. ✅ Scan verificou 100% de: componentes, hooks, libs, env vars, types
2. ✅ Edge Functions não invocadas documentadas com rota de uso clara (H6/H7)
3. ✅ Branch obsoleta flagged em docs e pronta pra delete
4. ✅ Nenhuma mudança quebra build (todos itens são aditivos ou isolados)
5. ✅ SLO e types.internal.ts apropriadamente documentados como schema-first

---

## Dependências

- **PRA-01** (delete branch): Nenhuma
- **PRA-02** (isolar functions): Depende de Isaac confirmar que functions não são acionadas em H5
- **PRA-03, PRA-04**: Diferidas até H7/H11; documentadas em CLAUDE.md

---

## Próximas etapas

1. Rodar PRA-01 esta sprint (0.25 h)
2. Decidir com Isaac/Guilherme se PRA-02 vale a pena antes de H6 (1.5 h trade-off)
3. Anotar PRA-03 em backlog de observabilidade
4. Anotar PRA-04 em backlog de H7/H10

---

**Status:** ✅ **APROVADO PARA AÇÃO**

Auditoria completa. Código está limpo; apenas housekeeping recomendado.
