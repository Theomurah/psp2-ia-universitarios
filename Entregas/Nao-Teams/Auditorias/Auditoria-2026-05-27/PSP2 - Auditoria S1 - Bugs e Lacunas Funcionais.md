# PSP2 — Auditoria S1 — Bugs e Lacunas Funcionais

**Frente:** Bugs e lacunas funcionais
**Responsável sugerido:** Isaac (backend/pipeline) + Pedro (frontend)
**Data:** 2026-05-27

## Objetivo

Fechar bugs ainda presentes no código atual após os fixes commitados desde 2026-05-26, e expor lacunas onde a backlog declara "feito" mas não há código consumidor.

## Critério de aceitação

- Status `needs_review` atribuído quando `validateClassification` retorna warnings (pipeline não pode seguir cego)
- Modo `compressed_cola` realmente gerado (não só declarado em enum)
- Edge Functions órfãs (`connect-drive`, `generate-system-prompt`) consumidas por UI ou marcadas como roadmap futuro com motivo
- Mutations no front com `invalidateQueries` consistente após sucesso
- Realtime channels desinscritos no unmount

## Achados

### A1 — Edge Function `connect-drive` sem consumidor 🟡
- **Arquivos:** `supabase/functions/connect-drive/index.ts` + (ausente) chamada em `apps/web/src/`
- **Dono:** Pedro
- **Descrição:** Função implementada (com Zod, rate limit, redirect OAuth) mas frontend não tem rota `/conectar-drive` nem botão "Conectar Google Drive" em `/configuracao`.
- **Risco:** S2T27 (OAuth Google Drive) marcado como feito sem fluxo end-to-end pro aluno; demo falha.
- **Fix:** UI mínima em `SettingsPage.tsx` — botão "Conectar Drive" → `supabase.functions.invoke('connect-drive')` → seguir redirect.

### A2 — Status `needs_review` nunca atribuído 🔴
- **Arquivo:** `supabase/functions/process-document/index.ts` (após chamada a `validateClassification`)
- **Dono:** Isaac + Guilherme
- **Descrição:** `validateClassification` retorna `warnings[]`. Pipeline ignora e segue para `synthesize`. Não há branch que atualize `jobs.status = 'needs_review'`.
- **Risco:** Documentos com classificação duvidosa entram no Drive como confiáveis; degradação silenciosa de qualidade.
- **Fix:** Após validate: `if (warnings.length > THRESHOLD) { update jobs set status='needs_review' ... ; return; }`.

### A3 — `generate-system-prompt` sem botão no frontend 🟡
- **Arquivo:** `supabase/functions/generate-system-prompt/index.ts` + `apps/web/src/routes/` (ausente)
- **Dono:** Pedro + Guilherme
- **Descrição:** S2T32 declara endpoint feito, S2T34 declara tela de prompts. Endpoint existe; chamada em `apps/web/` ausente (ou semi-implementada na branch atual de WIP — confirmar com `PromptsPage.tsx`).
- **Fix:** Confirmar consumo no `PromptsPage.tsx` (atualmente em WIP no working tree); se ausente, adicionar mutation `useMutation({ mutationFn: () => functions.invoke('generate-system-prompt', ...), onSuccess: () => qc.invalidateQueries(['prompts']) })`.

### A4 — Modo `compressed_cola` declarado mas nunca produzido 🔴
- **Arquivos:** `packages/shared/src/types.ts` (enum/tipo `OutputMode`) + `supabase/functions/_shared/pipeline.ts` ou `process-document/index.ts`
- **Dono:** Guilherme
- **Descrição:** Pipeline atual gera `markdown_compacta` (compressão única). O modo `compressed_cola` (segunda compressão, formato cola) aparece no enum/tipo mas não é gerado em nenhum branch do código.
- **Risco:** Aluno seleciona "Cola" em UI futura → mesmo conteúdo que `compacta`. Frustra critério de aceitação S1T10.
- **Fix:** Adicionar segunda chamada LLM (`compressCola`) após `compacta` quando `mode === 'cola'`; salvar em campo separado de `documents`.

### A5 — Realtime channels: confirmar unsubscribe em todos os hooks 🟡
- **Arquivos:** `apps/web/src/hooks/useJobsRealtime.ts` + outros hooks que usam `supabase.channel(...)`
- **Dono:** Pedro
- **Descrição:** `useJobsRealtime` já tem cap em `lastStatusRef` (commit ead7624). Confirmar que **todos** os hooks de realtime fazem `channel.unsubscribe()` no cleanup do `useEffect`.
- **Fix:** Audit rápido. Adicionar `return () => { channel.unsubscribe(); }` onde faltar.

### A6 — Mutations sem `invalidateQueries` consistente 🟡
- **Arquivos:** `apps/web/src/hooks/useJobs.ts`, `useProfile.ts`, etc
- **Dono:** Pedro
- **Descrição:** Algumas mutations atualizam estado mas não invalidam cache do React Query — UI fica desatualizada até refresh manual.
- **Fix:** Em cada `useMutation`, adicionar `onSuccess: () => queryClient.invalidateQueries({ queryKey: [...] })`. Padronizar.

### A7 — `onError` ausente em queries críticas 🟡
- **Arquivos:** `apps/web/src/hooks/useProfile.ts`, `useJobs.ts`, `useAdminMetrics.ts`
- **Dono:** Pedro
- **Descrição:** Algumas `useQuery` não têm `onError` (ou `meta.errorMessage`) — falhas silenciosas, usuário não vê erro.
- **Fix:** Configurar handler global no `QueryClient` (`defaultOptions.queries.meta`) OU `onError` por query crítica.

### A8 — Validação Zod ausente em `connect-drive` callback 🟡
- **Arquivo:** `supabase/functions/connect-drive/index.ts` (handler do redirect OAuth)
- **Dono:** Isaac
- **Descrição:** Confirmar que o callback do Google (com `code` query param) valida estrutura via Zod antes de trocar por token.
- **Fix:** `z.object({ code: z.string().min(1), state: z.string().optional() }).parse(searchParams)`.

### A9 — Sprint 1/Sprint 2: alguns critérios "feito" sem teste 🟢
- **Arquivos:** `Entregas/Sprint 1/`, `Entregas/Sprint 2/` (docx)
- **Dono:** Luis Felipe + Theo
- **Descrição:** Tarefas S1T15 (testes unitários), S1T19 (dashboard status), S2T25 (validação de qualidade) marcadas como entregues. Cruzar com testes existentes (Agente 5 conta 0 testes de frontend) → algumas entregas estão parciais.
- **Fix:** Atualizar status nos `.docx` ou abrir tarefa de fechamento.

### A10 — `JobCard.tsx` em WIP no working tree 🟢
- **Arquivos:** `apps/web/src/components/JobCard.tsx` (modificado, não commitado — 118 linhas alteradas)
- **Dono:** Pedro
- **Descrição:** Não é bug por enquanto — sinal de que o componente está sendo retrabalhado. Acompanhar.

## Plano de ação (batches)

### Batch B-B1 — Pipeline correctness (4h)
- A2 (needs_review) — 2h
- A4 (compressed_cola) — 2h

### Batch B-B2 — Frontend wire-up Drive (3h)
- A1 (botão Conectar Drive em Settings) — 2h
- A3 (PromptsPage consumir generate-system-prompt) — 1h (se ainda não wired no WIP)

### Batch B-B3 — React Query hygiene (3h)
- A6 (invalidateQueries) — 2h
- A7 (onError global) — 1h

### Batch B-B4 — Memory & validation (2h)
- A5 (unsubscribe realtime) — 1h
- A8 (Zod callback OAuth) — 1h

### Batch B-B5 — Reconciliação de backlog (3h)
- A9 (atualizar docx ou abrir issues)
- A10 (acompanhar JobCard WIP, sem ação agora)

**Total:** ~15h. 🔴 dominante: A2 + A4 (pipeline correctness — bloqueante de qualidade do output).

## Validação

- A1: aluno em `/configuracao` consegue conectar Drive e ver `drive_credentials` populado
- A2: payload mock com classificação ambígua → `jobs.status == 'needs_review'`
- A3: aluno em `/prompts` consegue gerar system prompt e vê o resultado renderizado
- A4: payload com `mode: 'cola'` → 2 campos diferentes em `documents.markdown_compacta` vs `documents.markdown_cola`
- A5: navegar entre rotas várias vezes; `supabase.channel` count estável
- A6/A7: rodar testes manuais smoke; toast de erro aparece quando mutation falha; UI invalida após sucesso

## Dependências

- B-B1 (A2, A4) é pré-requisito pra rubrica de qualidade do projeto acadêmico (artigo precisa demonstrar pipeline funcional)
- B-B2 destrava Sprint 2 (Google Drive demo)
- B-B3 + B-B4 destravam confiança em produção real

---
**Resumo numérico:** 10 achados | 🔴 2 / 🟡 6 / 🟢 2 | ~15h | Dono predominante: Isaac (~8h) + Pedro (~6h).
