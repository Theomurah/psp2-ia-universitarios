# PSP2 - Auditoria S1 - Bugs e Lacunas Funcionais

**Data:** 2026-05-28
**Agente:** 1 (Bugs e Lacunas Funcionais)
**Responsável sugerido:** Isaac (backend/pipeline) + Pedro (frontend) + Theo (decisões de produto)

## Objetivo

Levantar bugs e lacunas funcionais ainda presentes em 2026-05-28 — depois dos 29 commits de hardening da auditoria 2026-05-26 e dos achados da auditoria 2026-05-27. Foca em achados **novos** detectados nesta passagem e nos achados de ontem que continuam sem fix em código.

## Critério de Aceitação

- Pipeline nunca silenciosamente descarta `warnings` de `validateClassification` — confiança 0.4-0.7 precisa marcar `jobs.status='needs_review'` (não seguir cego para `synthesize`).
- Modo `compressed_cola` realmente produzido quando aplicável (hoje só `compressed_compact` é salvo).
- Edge Functions `connect-drive` e `generate-system-prompt` consumidas por UI no `apps/web/src/` (zero consumidor hoje).
- Arquivos rejeitados pelo `ingest-document` (rate-limit, validação, schema) são apagados do Storage (sem órfãos no bucket).
- `documents` + `jobs` criados em transação única no `ingest-document` (hoje são 2 inserts independentes, segundo pode falhar deixando `documents` órfão).
- Hooks com `useQuery` críticos (`useJobs`, `useActivity`, `useUserMetrics`, `useAdminMetrics`, `usePromptLibrary`) têm tratamento de erro visível.
- Step `judge` e `synthesize.chunk_*` aparecem rotulados na UI (hoje fallback ao código bruto).

## Achados

### 🔴 Críticos

- **B1-2028 — `needs_review` continua nunca atribuído pelo pipeline** — `supabase/functions/process-document/index.ts:283-287` — dono: Isaac + Guilherme
  - Sintoma: doc com classificação ambígua (conf 0.4-0.7) entra como `completed`/`completed_with_warning` e vai pro Drive como confiável.
  - Causa raiz: `validateClassification` em `_shared/validation.ts:64-66` adiciona warning quando `confianca < TARGETS.classify_confidence_auto`, mas `process-document` só ramifica em `passed === false`. A coluna `STATUS_LABEL` e o enum `jobs.status` já contêm `needs_review`, a UI já tem badge e branch no preview — só o pipeline nunca seta.
  - Fix: depois de `validateClassification`, antes do `synthesize`, checar `clsValidation.warnings.length > 0`. Se sim: `update jobs set status='needs_review', current_step=null, progress_percent=25` + persistir parcial em `documents` (materia_code etc.) + `return`. Reabertura manual pelo aluno fica pra B-D1 (UI de revisão), fora do escopo desta auditoria.
  - **Status:** Achado A2 da auditoria 2026-05-27 — segue aberto, nenhum commit endereçou desde então.

- **B2-2028 — Modo `compressed_cola` declarado, nunca gerado nem salvo** — `supabase/functions/process-document/index.ts:382-399` + `packages/shared/src/types.internal.ts:23` + `packages/shared/src/schemas.ts:46` — dono: Guilherme
  - Sintoma: aluno escolher modo "Cola" (em UI futura) recebe o mesmo conteúdo que `compacta`. Critério de aceitação S1T10 não fecha. `MarkdownPreview` aceita `type='compressed_cola'` no Props mas nunca encontra a linha.
  - Causa raiz: `process-document` chama `compress({modo: 'compacta'})` uma vez e insere `type: 'compressed_compact'`. O segundo branch (`compress({modo: 'cola'})` + `type: 'compressed_cola'`) nunca foi escrito. O modelo `compress_cola` é só lookup em `_shared/models.ts:19`.
  - Fix: depois do COMPRESS atual, se `mode === 'cola'` (ou sempre, decisão de produto — ver PENDENCIAS.md §A) chamar `compress({modo: 'cola'})` + inserir `type: 'compressed_cola'` em `generated_content`. **Custo:** dobra chamada LLM da etapa de compressão — Theo precisa autorizar.
  - **Status:** Achado A4 da auditoria 2026-05-27 — segue aberto. Decisão de produto bloqueia o fix.

- **B3-2028 — `ingest-document` cria `documents` + `jobs` sem transação** — `supabase/functions/ingest-document/index.ts:79-108` — dono: Isaac
  - Sintoma: se o `insert` de `jobs` falhar (RLS, network, advisor 0011 não aplicada em prod), o `documents` já inserido fica órfão. Frontend recebe 500, retenta upload → novo `documents` duplicado.
  - Causa raiz: dois `INSERT` separados via `service` (PostgREST) — sem `BEGIN/COMMIT`. Não há `delete from documents where id=:doc_id` no path de erro do `jobs`.
  - Fix: criar RPC `create_document_with_job(payload jsonb) returns jsonb` (SECURITY DEFINER) e chamar uma única vez. Padrão já listado em PENDENCIAS.md §D (A6 bugs, 2h). Alternativa cheap: catch do `jobError` faz `service.from('documents').delete().eq('id', doc.id)` antes de retornar 500.
  - **Status:** Novo achado desta auditoria (não estava no relatório de 2026-05-27, mas PENDENCIAS.md §D linha 514 já catalogava).

### 🟡 Médios

- **B4-2028 — Arquivo fica órfão no Storage quando `ingest-document` rejeita** — `apps/web/src/lib/upload.ts:43-65` — dono: Pedro
  - Sintoma: upload de 50 MiB ocupa bucket mesmo quando ingest rejeita por rate-limit (429), payload inválido (400), `forbidden_path` (403). Bucket cresce sem GC.
  - Causa raiz: `uploadDocument` faz `supabase.storage.upload(...)` antes da chamada à Edge Function. Se `res.ok === false`, só joga erro — não chama `storage.remove([storagePath])`.
  - Fix: envolver chamada `fetch('/functions/v1/ingest-document', ...)` em try/finally — se response não é 2xx, chamar `supabase.storage.from('documents').remove([storagePath]).catch(...)` antes do throw.

- **B5-2028 — `connect-drive` permanece sem consumidor no frontend** — `apps/web/src/routes/SettingsPage.tsx` (ausente) + `supabase/functions/connect-drive/index.ts:47` — dono: Pedro
  - Sintoma: T27 marcado como "feito" mas aluno não tem caminho pra conectar Drive na UI. `LoginPage:292-300` tem botão Google desabilitado (`disabled` hardcoded). `SettingsPage` não chama `supabase.functions.invoke('connect-drive', ...)`.
  - Causa raiz: nenhum commit adicionou o botão + handler. `grep -rn "connect-drive\|generate-system-prompt" apps/web/src/` retorna zero matches.
  - Fix: em `SettingsPage`, nova seção "Google Drive" com botão "Conectar Drive" que (1) chama `signInWithOAuth({provider:'google', options:{scopes:'https://www.googleapis.com/auth/drive.file'}})`, (2) no callback captura `session.provider_token`/`provider_refresh_token`, (3) POST `connect-drive`. Indicador "Conectado em DD/MM/AAAA" lendo `profile.drive_connected_at`.
  - **Status:** Achado A1 da auditoria 2026-05-27 — segue aberto.

- **B6-2028 — `generate-system-prompt` sem consumidor no frontend** — `apps/web/src/routes/PromptsPage.tsx` (não chama a função) + `supabase/functions/generate-system-prompt/index.ts:30` — dono: Pedro + Guilherme
  - Sintoma: `PromptsPage` lista só biblioteca oficial (`usePromptLibrary`). Não existe rota nem botão "Gerar meu system prompt". T34 declara feito; consumo end-to-end inexiste.
  - Causa raiz: nenhum hook tipo `useGenerateSystemPrompt` / `useUserSystemPrompt` no diretório `apps/web/src/hooks/`. `PromptsPage` mostra cards estáticos.
  - Fix: criar `useUserSystemPrompt()` (query `user_system_prompts` where `is_active=true`) + `useGenerateSystemPrompt()` (mutation `supabase.functions.invoke('generate-system-prompt', {body:{force:false}})` + invalidate `['user-system-prompt']`). Adicionar seção "Meu system prompt" em `PromptsPage` com botão Regenerar e botão Copiar.
  - **Status:** Achado A3 da auditoria 2026-05-27 — segue aberto.

- **B7-2028 — Hooks críticos sem `onError` (regressão silenciosa)** — `apps/web/src/hooks/useJobs.ts:14`, `useActivity.ts:37`, `useActivity.ts:78` (useUserMetrics), `useAdminMetrics.ts`, `usePromptLibrary.ts`, `useIsAdmin.ts`, `useAppSettings.ts` — dono: Pedro
  - Sintoma: `select` retorna erro (RLS, 5xx do PostgREST, token expirado) → query fica em `error` mas nenhum toast aparece. UI mostra "empty state" ou loader infinito sem feedback.
  - Causa raiz: `grep -n "onError" apps/web/src/hooks/` só acha `useProfile.ts:91`. As outras seguem sem.
  - Fix opção A (preferida): centralizar em `App.tsx` no `QueryClient` — `defaultOptions: { queries: { meta: { onErrorToast: true } } }` + `QueryCache({ onError: (err, query) => { if (query.meta?.onErrorToast) toast.error(...) } })`. Opção B: `onError` por query.
  - **Status:** Achado A7 da auditoria 2026-05-27 — segue aberto.

- **B8-2028 — Mensagem do `judge` quebra quando warnings/errors estão vazios** — `supabase/functions/process-document/index.ts:367` — dono: Isaac
  - Sintoma: quando o judge devolve `passed: true` sem warnings e sem errors (caminho feliz), o `logEvent('judge', 'success', { message: undefined })` é OK. **Mas** quando `passed: false` com errors mas sem warnings, `judge.warnings.join('; ')` retorna `''` (string vazia) — `??` não cai pra `errors` porque `''` é não-nullish. Resultado: evento de erro fica com `message: ''` em vez do erro real.
  - Causa raiz: `judge.comment ?? judge.warnings.join('; ') ?? judge.errors.join('; ')` — `??` testa null/undefined, não falsy. `[].join('; ') === ''` que é não-nullish.
  - Fix: trocar pra ternários explícitos ou `[judge.comment, judge.warnings.join('; ') || null, judge.errors.join('; ') || null].find(Boolean)`. Trivial.

- **B9-2028 — Token Drive: rotação de `refresh_token` ignorada + erro de update silenciado** — `supabase/functions/process-document/index.ts:521-527` — dono: Isaac
  - Sintoma: Google rotaciona `refresh_token` em alguns cenários (revogação manual + reautenticação). O código compara apenas `token.access_token !== profile.google_access_token`. Se só o refresh rotacionou, o update não dispara e o aluno vira "Drive desconectado" no próximo refresh.
  - Causa raiz adicional: `.catch(() => {/* silencia */})` mascara erros de UPDATE mesmo quando a migration 0004 já está aplicada (todas as migrations estão aplicadas em prod conforme PENDENCIAS.md §Migrations). O comentário "migration 0004 pode não estar aplicada" está obsoleto.
  - Fix: comparar `access_token`, `refresh_token` E `expires_at`; remover o `.catch()` silencioso e usar `log.warn('drive_token_persist_failed', ...)` via helper `_shared/log.ts`.

### 🟢 Baixos

- **B10-2028 — Steps `judge` e `synthesize.chunk_N_of_M` sem rótulo na UI** — `apps/web/src/components/JobCard.tsx:13-21` + `apps/web/src/routes/DashboardPage.tsx:34-42` — dono: Pedro
  - Sintoma: enquanto chunking roda, badge mostra string crua tipo `synthesize.chunk_2_of_4`. Step `judge` (raro — 5% sampling) também não tem entrada no `STEP_LABEL`.
  - Causa raiz: `STEP_LABEL` mapeia só os 7 steps "principais"; eventos derivados não estão na tabela.
  - Fix: adicionar `judge: 'Validação cruzada'` + fallback que detecta prefixo `synthesize.chunk_` e formata como "Sintetizando (chunk N/M)". Bonus: extrair `STEP_LABEL` pra `packages/shared/src/constants.ts` e importar nos dois lados (hoje está duplicado em `JobCard.tsx:13` e `DashboardPage.tsx:34`).

- **B11-2028 — `UploadDropzone` processa arquivos em série mas habilita dropzone entre eles** — `apps/web/src/components/UploadDropzone.tsx:30-47` — dono: Pedro
  - Sintoma: loop `for (const file of acceptedFiles)` sequencial faz `setUploading(true)` → await → `setUploading(false)` (finally) para CADA arquivo. Entre arquivos, `disabled: uploading` libera o dropzone por 1 tick → user pode arrastar terceiro arquivo e gerar concorrência confusa.
  - Causa raiz: estado `uploading` toggle por arquivo, não pra batch inteiro. Variável `tag` declarada mas usada só em `console.error`.
  - Fix: mover `setUploading(true)` pra antes do `for` e `setUploading(false)` pra depois (em try/finally externo). Ou processar com `Promise.all(acceptedFiles.map(uploadDocument))` se quiser paralelismo.

- **B12-2028 — `DashboardPage` deps de `useEffect` linha 65-69 podem causar re-render extra** — `apps/web/src/routes/DashboardPage.tsx:65-69` — dono: Pedro
  - Sintoma: efeito que zera `selected` quando o job some lista `[jobs, selected]` como deps. `setSelected(null)` dispara rerender → `selectedLive` recalcula → `selected` referencialmente igual mas o efeito vai rodar de novo na próxima atualização. Não loop infinito (guarda com `.some`), mas trabalho desnecessário.
  - Fix: usar `selected?.id` como dep em vez de `selected` (já que só o ID importa pra checar presença).

- **B13-2028 — Tarefas Sprint 1/Sprint 2 marcadas "feitas" sem fluxo end-to-end** — `Entregas/Sprint 2/.../PSP2 - S2T34 - Tela de Prompts.docx` e similares — dono: Luis Felipe + Theo
  - Sintoma: T34 (Tela /prompts) está como entregue mas só renderiza biblioteca oficial — não consome a Edge Function `generate-system-prompt` (T32 também marcada feita). Aluno final não tem como exercer a feature.
  - Causa raiz: a coluna "consumido por UI" não faz parte do critério de aceitação documentado em cada `.docx`.
  - Fix: ajustar critério de aceitação dos `.docx` de T27/T32/T34 pra incluir "wired no frontend"; ou abrir issue de fechamento.
  - **Status:** Achado A9 da auditoria 2026-05-27 — sem mudança.

## Plano de Ação (Batches priorizados)

### Batch B-D1 — Correção semântica do pipeline (4h)
- [ ] B1-2028 — branch `needs_review` em `process-document` quando warnings != 0 (2h, Isaac)
- [ ] B2-2028 — gerar `compressed_cola` opcional + decisão de produto sobre custo (2h, Guilherme + Theo)

### Batch B-D2 — Transacionalidade + cleanup de Storage (3h)
- [ ] B3-2028 — RPC `create_document_with_job` ou rollback explícito do `documents` (2h, Isaac)
- [ ] B4-2028 — `uploadDocument` apaga arquivo do Storage quando ingest rejeita (1h, Pedro)

### Batch B-D3 — Wire-up das Edge Functions órfãs (4h)
- [ ] B5-2028 — botão "Conectar Drive" + handler `connect-drive` em `SettingsPage` (3h, Pedro)
- [ ] B6-2028 — `useUserSystemPrompt` + `useGenerateSystemPrompt` + seção "Meu prompt" em `PromptsPage` (1h, Pedro)

### Batch B-D4 — Higiene de React Query + Drive token (2h)
- [ ] B7-2028 — `QueryCache.onError` global via meta flag (1h, Pedro)
- [ ] B9-2028 — comparar refresh_token + expires_at; tirar `.catch()` silencioso (1h, Isaac)

### Batch B-D5 — Limpeza UI e edge cases (1h30)
- [ ] B8-2028 — fallback `Boolean` no message do judge (15min, Isaac)
- [ ] B10-2028 — STEP_LABEL com `judge` e prefixo `synthesize.chunk_*` extraído pra shared (30min, Pedro)
- [ ] B11-2028 — `setUploading` pra batch inteiro no UploadDropzone (15min, Pedro)
- [ ] B12-2028 — dep `selected?.id` no DashboardPage (5min, Pedro)
- [ ] B13-2028 — atualizar critério de aceitação dos `.docx` T27/T32/T34 (25min, Luis Felipe)

**Total:** ~14h30. Dominante: Pedro (~6h30) + Isaac (~5h) + Guilherme (~2h) + Luis Felipe (~25min) + Theo (decisão de produto em B2).

## Validação

- **B1**: payload mock com `confianca: 0.55` no parser de teste → após `validateClassification`, job termina com `status='needs_review'`, `progress_percent=25`, `current_step=null`. Documento parcial em `documents` (materia_code etc.) preservado. Sem chamadas LLM posteriores.
- **B2**: enviar doc com flag `mode='cola'` (ou config global) → `generated_content` tem **duas** linhas pro `document_id`: `type='compressed_compact'` e `type='compressed_cola'`. MarkdownPreview com `type='compressed_cola'` renderiza markdown distinto.
- **B3**: simular falha de `jobs.insert` (drop policy temporário) → `documents` é deletado também; HTTP 500 retornado; bucket continua com o arquivo (cleanup é responsabilidade do B4).
- **B4**: forçar `ingest-document` a retornar 429 (rate limit hit) → arquivo some do bucket. `select count(*) from storage.objects where bucket_id='documents'` não cresce em loop de testes.
- **B5**: aluno em `/settings` clica "Conectar Drive" → fluxo OAuth Google completa → `profiles.drive_connected_at IS NOT NULL` + `drive_root_folder_id` populado + indicador na UI.
- **B6**: aluno em `/prompts` clica "Gerar meu prompt" → `user_system_prompts` ganha row com `is_active=true`, `version=1` (ou +1) → seção mostra texto renderizado.
- **B7**: derrubar Postgres mid-query (offline mode) → toast vermelho aparece em todas as telas, não só Settings.
- **B8**: criar teste unit com `judge = { passed: false, score: 0, warnings: [], errors: ['LLM timeout'], comment: null }` → `logEvent` recebe `message: 'LLM timeout'` (não `''`).
- **B9**: girar refresh_token no Google manualmente (revogar + reautenticar) → `profiles.google_refresh_token` é atualizado no próximo `ensureFreshToken`.
- **B10–B12**: smoke visual + linter.

## Dependências

- **B-D1** destrava artigo ENEGEP — pipeline precisa demonstrar 3 status (completed/needs_review/failed) na Tabela 1 de resultados. Hoje só 2 são geráveis em produção.
- **B-D2** destrava T26 (teste com 50 docs) — sem rollback transacional, qualquer falha durante o batch cria documentos órfãos que poluem métricas.
- **B-D3** destrava T30 (teste fluxo Drive real) — sem botão na UI, o aluno-teste não consegue chegar no fluxo.
- **B-D4 + B-D5** destravam confiança em produção real e Sprint 3 (H8 — Integração end-to-end).

## Comparação com 2026-05-27

| ID 2027 | Estado em 2028 | Novo ID |
|---|---|---|
| A1 (Conectar Drive sem UI) | Inalterado | B5-2028 |
| A2 (`needs_review` nunca setado) | Inalterado | B1-2028 |
| A3 (`generate-system-prompt` sem UI) | Inalterado | B6-2028 |
| A4 (`compressed_cola` só declarado) | Inalterado | B2-2028 |
| A5 (Realtime unsubscribe) | Auditado e OK — único `supabase.channel` é em `useJobs.ts:64`, com `supabase.removeChannel(channel)` no cleanup linha 109. `useAuth.ts:41` faz `subscription.unsubscribe()`. Sem leak. | (fechado) |
| A6 (invalidateQueries) | Auditado: `useDocumentActions`, `useProfile`, `useAppSettings`, `useAdminPrompts`, `usePromptLibrary` mutations todas invalidam. Sem regressão. | (fechado) |
| A7 (`onError` em queries) | Inalterado | B7-2028 |
| A8 (Zod no callback OAuth) | `connect-drive` já valida com Zod estrito (`index.ts:41-45`). | (fechado) |
| A9 (.docx feito sem teste) | Inalterado | B13-2028 |
| A10 (JobCard WIP) | Continua modificado mas só superficialmente (menu de arquivar/excluir). Não bloqueia. | (acompanhar) |

**Novos achados desta auditoria:** B3-2028 (transação documents+jobs), B4-2028 (órfão Storage no upload reject), B8-2028 (`??` em string vazia do judge), B9-2028 (rotação refresh_token + catch silenciado), B10-2028 (STEP_LABEL incompleto), B11-2028 (UploadDropzone batch), B12-2028 (dep de useEffect).

---

**Resumo numérico:** 13 achados | 🔴 3 / 🟡 6 / 🟢 4 | ~14h30 | Dono predominante: Pedro (~6h30) + Isaac (~5h).
