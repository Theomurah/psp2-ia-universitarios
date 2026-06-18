# PSP2 — Auditoria Sprint 1: Bugs e Lacunas Funcionais

| Campo | Valor |
|---|---|
| **Frente** | Bugs e lacunas funcionais (Agente 1) |
| **Responsável sugerido** | Theo (coordenação) — distribuição por dono nos achados |
| **Data** | 2026-05-26 |
| **Escopo** | `apps/web/src/`, `supabase/functions/*/`, `packages/shared/` |
| **Branch auditada** | `feature/sprint1-finalization` |
| **Commits-base** | `991fd90` (fix shared imports) sobre `ea8c46a` (T17 + LLM/Vision) |

---

## 1. Objetivo

Identificar bugs ativos, edge cases não tratados, condições de corrida no pipeline assíncrono (ingest → process → generate) e funcionalidades declaradas como prontas na backlog (S1) mas sem código consumidor — para que tudo crítico vá pro Sprint 2 já corrigido e a equipe não herde dívida silenciosa.

## 2. Critério de aceitação

- Todos os itens **🔴 críticos** endereçados (ou com PR aberto e dono atribuído) antes de fechar o Sprint 1.
- Todo item **🟡 médio** com batch atribuído no plano do Sprint 2.
- Cada achado tem reprodução documentada (arquivo:linha) e validação clara (como testar que está resolvido).

---

## 3. Conteúdo — achados

### 3.1 Pipeline assíncrono (`process-document`, `pipeline.ts`)

#### 🔴 A1. `started_at` é sobrescrito a cada `setStep` — perde o início real do job

- **Descrição:** `setStep()` faz `update({ ..., started_at: new Date().toISOString() })` toda vez que muda de etapa. Resultado: `started_at` no banco fica sempre = momento da **última** transição, não da primeira. Métricas de duração total (`completed_at - started_at`) ficam incorretas.
- **Local:** `supabase/functions/process-document/index.ts:143-150`
- **Severidade:** 🔴 crítico (métrica de SLO inválida)
- **Dono:** Isaac
- **Estimativa:** 1h
- **Fix:** setar `started_at` apenas se ainda for `null` (e.g. ler antes ou usar `coalesce` no SQL via RPC). Alternativa simples: gravar `started_at` uma vez logo no início de `runPipeline`, antes do primeiro `setStep`.

#### 🔴 A2. Status `needs_review` declarado no schema mas nunca atribuído pelo pipeline

- **Descrição:** Enum `job_status` (migration 0001) e a UI (`JobCard.tsx`, `DashboardPage.tsx`, `useJobs.ts:103`) tratam `needs_review`. `TARGETS.classify_confidence_review = 0.4` e `_auto = 0.7` em `constants.ts:100`. Mas `validateClassification` só rejeita (< 0.4) ou retorna warning, e o pipeline nunca seta `status = 'needs_review'` quando 0.4 ≤ confianca < 0.7. Resultado: a UX prometida (jobs caem em "Precisa revisão") não acontece — todos viram `completed_with_warning` ou `completed`.
- **Local:** `supabase/functions/_shared/validation.ts:53-68` + `supabase/functions/process-document/index.ts:219-223` (decisão) + `:368-377` (set final)
- **Severidade:** 🔴 crítico (feature contratada para H4/Sprint 1 ausente)
- **Dono:** Isaac + Guilherme
- **Estimativa:** 2h
- **Fix:** após `validateClassification`, se passou mas warnings indicarem confianca < auto, marcar job como `needs_review` e pausar (não rodar synthesize). Voltar a processar quando o usuário confirmar (precisa Sprint 2 UI).

#### 🔴 A3. `validateJudge` (camada 4) existe mas nunca é chamada — gasto de modelo nulo, qualidade não monitorada

- **Descrição:** `validation.ts:198` implementa LLM-as-judge (Gemini) com toda a infra (timeout, schema JSON, fallback "não bloqueia"). O comentário do módulo diz "roda apenas se 2 ou 3 levantarem warning, OU em 5% dos jobs". Nenhuma dessas condições foi codificada. `validateJudge` tem zero call sites no projeto inteiro (grep confirmou).
- **Local:** `supabase/functions/_shared/validation.ts:198-253` (definida) — `supabase/functions/process-document/index.ts:281-291` (decisão usa só 3 camadas)
- **Severidade:** 🔴 crítico (T25 considerado feito na backlog, sem código no path)
- **Dono:** Guilherme
- **Estimativa:** 3h
- **Fix:** chamar `validateJudge` no `runPipeline` quando `synthVerdict === 'warning'` OU `Math.random() < 0.05`. Adicionar resultado em `decideVerdict([...,judge])` e gravar `validation_score` em `generated_content` com o score do judge (hoje grava só semantic.score).

#### 🔴 A4. Tipo de compressão `compressed_cola` declarado mas nunca gerado

- **Descrição:** Enum `generated_content_type` em `0001:36` tem `compressed_cola`. `MarkdownPreview.tsx:13` aceita `type='compressed_cola'`. `pipeline.ts:160` e `models.ts:23` tratam o modo `cola`. Mas `process-document/index.ts:304-321` só chama `compress({ modo: 'compacta' })`. Resultado: nenhum row de `compressed_cola` jamais existe; UI quebra silenciosa se alguém passar esse type (volta "Sem conteúdo gerado").
- **Local:** `supabase/functions/process-document/index.ts:303-321`
- **Severidade:** 🔴 crítico (T10/T23 incompletos)
- **Dono:** Isaac
- **Estimativa:** 1h
- **Fix:** após o `compress({ modo: 'compacta' })`, fazer 2ª chamada com `modo: 'cola'` e insert do row correspondente. Cuidado para não dobrar custo total — considerar flag por preferência do aluno.

#### 🟡 A5. `attempt_count` no schema, `TARGETS.max_retries=2`, mas zero retry no pipeline

- **Descrição:** A coluna `jobs.attempt_count smallint` existe (`0001:106`) e `TARGETS.max_retries=2` (`constants.ts:112`), mas `runPipeline` nem incrementa nem relê em retry. Qualquer falha transiente (rede, OpenRouter 500, Drive 429) cai direto em `failed`. T16 "tratamento de erros + retry" está marcado feito no backlog.
- **Local:** `supabase/functions/process-document/index.ts:139-386`
- **Severidade:** 🟡 médio (UX ruim em falha transiente; não trava prod imediatamente)
- **Dono:** Isaac
- **Estimativa:** 4h (precisa de re-trigger via cron ou tabela `pending_retry`)
- **Fix:** envolver cada estágio em try/catch que incrementa attempt_count; se < max_retries e erro for transiente, recoloca job em `pending` para reprocessamento. Idealmente integrar com pg_cron já mencionado no roadmap.

#### 🟡 A6. `ingest-document` insere documento e job em duas operações separadas — sem transação

- **Descrição:** Se o `insert documents` (`ingest-document/index.ts:79-89`) passar mas o `insert jobs` (`:95-108`) falhar, fica `document` órfão sem `job`, e o frontend nunca recebe feedback. Como ambos usam service role, a janela é pequena mas existe (falha de conexão entre as duas chamadas).
- **Local:** `supabase/functions/ingest-document/index.ts:77-108`
- **Severidade:** 🟡 médio (raro; deixa lixo no DB)
- **Dono:** Isaac
- **Estimativa:** 2h
- **Fix:** criar RPC `public.create_document_with_job(...)` que faz INSERT…INSERT em transação e retorna ambos os IDs. Sem isso, ao menos rollback manual do document quando jobError.

#### 🟡 A7. `runPipeline` em background — sem persistência se Edge Function crashar/reiniciar

- **Descrição:** `EdgeRuntime.waitUntil(runPipeline(jobId))` em `process-document/index.ts:82` é "best effort". Se o worker reiniciar (deploy, OOM, timeout do edge runtime), o job fica eternamente em `processing` sem ninguém retomar. Não existe rotina que detecte "jobs presos > N minutos".
- **Local:** `supabase/functions/process-document/index.ts:50-89`
- **Severidade:** 🟡 médio (pipeline async não tem watchdog)
- **Dono:** Isaac + Theo (arquitetura)
- **Estimativa:** 4h
- **Fix:** trigger pg_cron a cada 5min: jobs em `processing` há > 10min com `attempt_count < max_retries` → volta a `pending` e re-invoca `process-document`.

---

### 3.2 Edge Functions — validação e erros

#### 🟡 B1. `process-document` aceita body sem Zod, valida só `typeof === 'string'`

- **Descrição:** As outras Edge Functions (`ingest-document`, `connect-drive`) usam `Zod.safeParse(body)` para validação estrita. `process-document/index.ts:66-71` faz apenas `typeof body?.job_id === 'string'`. Permite enviar UUIDs malformados que depois quebram em `.eq('id', jobId)` com erro 22P02 do Postgres no `authorize`, mas o erro vaza pelo `console.error` e devolve `internal_error` (não `invalid_body`).
- **Local:** `supabase/functions/process-document/index.ts:66-71`
- **Severidade:** 🟡 médio
- **Dono:** Isaac
- **Estimativa:** 0.5h
- **Fix:** criar `ProcessDocumentSchema = z.object({ job_id: z.string().uuid() })` em `packages/shared/src/schemas.ts` e usar `safeParse`.

#### 🟡 B2. `connect-drive` chamada apenas em comentário — frontend nunca a invoca

- **Descrição:** A Edge Function `connect-drive` está implementada (`supabase/functions/connect-drive/index.ts`, completo com OAuth, Zod, rate-limit, fallback de migration). Mas `grep -r "connect-drive" apps/web/src` retorna ZERO ocorrências. Resultado: `profile.google_refresh_token` nunca é populado pela UI → `tryUploadToDrive` no pipeline sempre retorna `{ skipped: true, reason: 'Drive não conectado' }` → toda H6 (upload no Drive) é dead code.
- **Local:** `supabase/functions/connect-drive/index.ts:47-143` (implementação) — `apps/web/src/` (chamada ausente)
- **Severidade:** 🟡 médio (Drive marcado "feito sem código consumidor")
- **Dono:** Pedro (frontend)
- **Estimativa:** 6h (signInWithOAuth Google + captura de `provider_token`/`provider_refresh_token` + POST pra `connect-drive` + tela em Settings)
- **Fix:** botão "Conectar Google Drive" em Settings que faz `supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes: 'https://www.googleapis.com/auth/drive.file', queryParams: { access_type: 'offline', prompt: 'consent' } } })`, captura tokens no callback e chama `connect-drive` Edge Function.

#### 🟡 B3. `generate-system-prompt` órfã — frontend nunca dispara, nada exibe a saída

- **Descrição:** Análogo a B2: Edge Function (`generate-system-prompt/index.ts`) e tabela (`user_system_prompts`) implementadas e com RLS. UI nunca chama — tabela permanece vazia mesmo após N documentos processados. T31/T32 marcados como feitos sem caminho de saída para o aluno.
- **Local:** `supabase/functions/generate-system-prompt/index.ts:30-154` — `apps/web/src/` (sem call site)
- **Severidade:** 🟡 médio (próximo Sprint coloca isso como front-page do produto)
- **Dono:** Pedro + Theo
- **Estimativa:** 6h (hook + página "Meu Prompt Pessoal" + botão Regenerar + botão Copiar)
- **Fix:** rota `/meu-prompt` que: (a) lê `user_system_prompts` via `useQuery`; (b) se vazio ou stale, chama Edge Function via `supabase.functions.invoke('generate-system-prompt')`; (c) exibe prompt + botão Copiar.

#### 🟢 B4. `cors.ts` faz fallback para o primeiro origin permitido em vez de rejeitar

- **Descrição:** `corsHeadersFor` em `_shared/cors.ts:28-39` ecoa `Origin` se na whitelist, mas se não estiver, devolve `allowed[0]`. O comentário diz "browser bloqueia" — verdade, mas é gambiarra. Logs ficam confusos (origin reportado ≠ origin real).
- **Local:** `supabase/functions/_shared/cors.ts:28-39`
- **Severidade:** 🟢 baixo
- **Dono:** Isaac
- **Estimativa:** 0.5h
- **Fix:** retornar string vazia (ou não setar o header) quando origin não estiver na whitelist.

#### 🟢 B5. `parseImage` chama `getVisionProvider()` sem fallback no pipeline real

- **Descrição:** `extractWithFallback` em `_shared/vision/index.ts:75-89` existe mas `parsers.ts:135` usa só `getVisionProvider()` (sem fallback). OCR de imagem que falhar no provider primário aborta o documento todo, em vez de tentar Gemini → Claude.
- **Local:** `supabase/functions/_shared/parsers.ts:133-155`
- **Severidade:** 🟢 baixo
- **Dono:** Guilherme
- **Estimativa:** 1h
- **Fix:** trocar `getVisionProvider().extractText(...)` por `extractWithFallback(buffer, mimeType, primary, secondary)` controlado por env var.

---

### 3.3 Frontend — TanStack Query, Realtime, hooks

#### 🟡 C1. `useJobs`, `useProfile`, `usePromptLibrary` sem `staleTime`, sem `onError`

- **Descrição:** O default global em `App.tsx:18-23` define `staleTime: 30_000` para TODAS as queries — porém o `useJobs` esperado teria `staleTime` mais alto (jobs são atualizados via Realtime, refetch automático é desperdício de recursos) ou mais baixo (na ausência de Realtime, devia refetch). Nenhum dos hooks de query tem `onError` específico → erros aparecem só como `error` no caller que precisa lembrar de renderizar. `useProfile` é particularmente sensível: se falhar, `RequireAuth` redireciona ao `/onboarding` mesmo quando o profile existe (bug latente em sessão recém-criada).
- **Local:** `apps/web/src/hooks/useJobs.ts:10-23`, `useProfile.ts:6-21`, `usePromptLibrary.ts:12-26`
- **Severidade:** 🟡 médio (UX degradada em falha de rede)
- **Dono:** Pedro
- **Estimativa:** 2h
- **Fix:** definir `staleTime` por hook + tratar erro do `useProfile` em `RequireAuth.tsx:21` (se `error && !profile` mostrar "tente novamente" em vez de mandar pra onboarding).

#### 🟡 C2. `useJobsRealtime` escuta `event: '*'` em `table: 'jobs'` sem filtro por user_id

- **Descrição:** `useJobs.ts:43-46` faz `.on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, ...)`. Depende 100% de a Realtime estar com RLS habilitada no projeto Supabase. Se a configuração do projeto desligar RLS no Realtime (default antigo), o aluno A recebe notificação de jobs do aluno B — falha de privacidade.
- **Local:** `apps/web/src/hooks/useJobs.ts:40-77`
- **Severidade:** 🟡 médio (depende da config externa do projeto Supabase)
- **Dono:** Pedro + Theo
- **Estimativa:** 1h
- **Fix:** adicionar `filter: \`user_id=eq.${user.id}\`` no `.on(...)` como defesa em profundidade (precisa do user.id, então depender de `useAuth`).

#### 🟡 C3. `useIncrementPromptUsage` quebra silenciosa em prompts oficiais

- **Descrição:** Hook em `usePromptLibrary.ts:28-49` faz read-then-update no `prompt_library`. Em prompts oficiais (`user_id IS NULL`), a RLS policy `prompts_update_own` (migration `0006:129-133`) exige `auth.uid() = user_id AND is_official = false`. Logo, o UPDATE volta `error` mas o hook ignora (não há check de error). O contador exibido na UI (`PromptCard.tsx:99`) nunca incrementa para prompts oficiais, sem feedback ao usuário ou ao time.
- **Local:** `apps/web/src/hooks/usePromptLibrary.ts:28-49`
- **Severidade:** 🟡 médio (telemetria de uso enganosa)
- **Dono:** Pedro + Isaac (RPC)
- **Estimativa:** 2h
- **Fix:** criar RPC `public.increment_prompt_usage(prompt_id uuid)` com SECURITY DEFINER que permite UPDATE em qualquer prompt (oficial ou próprio) com check de existência. Hook passa a chamar `supabase.rpc('increment_prompt_usage', { prompt_id })`.

#### 🟡 C4. `MarkdownPreview` usa `.then()` em vez de `await` + sem AbortController

- **Descrição:** `MarkdownPreview.tsx:21-44` usa pattern legado `supabase.from(...).then(...)` dentro de `useEffect`, com flag `cancelled`. Funciona, mas: (a) sem `AbortSignal`, a chamada HTTP continua; (b) toda mudança de `documentId` re-cria a Promise mesmo se a anterior ainda está pendente, sem deduplicação; (c) deveria usar `useQuery` (já tem TanStack Query no projeto).
- **Local:** `apps/web/src/components/MarkdownPreview.tsx:21-44`
- **Severidade:** 🟡 médio (memory leak menor em troca rápida de preview)
- **Dono:** Pedro
- **Estimativa:** 1h
- **Fix:** migrar para `useQuery(['generated_content', documentId, type], ...)`.

#### 🟢 C5. `lastStatusRef` em `useJobsRealtime` cresce indefinidamente

- **Descrição:** `useJobs.ts:36` instancia `useRef(new Map<string, JobStatus>())` que adiciona uma entry por job único visto. Em sessão longa com muitos jobs, vira leak (centenas de KB). Sem GC.
- **Local:** `apps/web/src/hooks/useJobs.ts:36`, `:53-62`
- **Severidade:** 🟢 baixo
- **Dono:** Pedro
- **Estimativa:** 0.5h
- **Fix:** limitar a últimos N (e.g. 200 entries) ou limpar em status terminal (completed/failed) — entrada não precisa ficar viva depois.

#### 🟢 C6. `uploadDocument` faz upload no Storage antes de validar `session.access_token`

- **Descrição:** `lib/upload.ts:33-39` faz `supabase.storage.from('documents').upload(...)` antes de buscar `session` (`:42`). Se o token estiver expirado (sessão morta), o upload do arquivo de 50MiB sobe pro Storage, depois a chamada à Edge Function falha por unauth — arquivo fica órfão no bucket. Idealmente, ler `session` antes para falhar rápido.
- **Local:** `apps/web/src/lib/upload.ts:21-64`
- **Severidade:** 🟢 baixo (raro; storage policies cobrem o caso de auth ausente)
- **Dono:** Pedro
- **Estimativa:** 0.5h
- **Fix:** mover o `getSession()` para o início e abortar se `!session`.

#### 🟢 C7. `recordConsent` em LoginPage chamado sem `await`, sem rollback

- **Descrição:** `routes/LoginPage.tsx:106-110` faz `recordConsent(...).catch(...)` (fire-and-forget). Se falhar (RLS rejeitou, rede), nunca há retry — usuário fica sem registro de consentimento LGPD apesar de ter aceitado. Comentário admite "best-effort" mas para LGPD isso é arriscado em auditoria.
- **Local:** `apps/web/src/routes/LoginPage.tsx:104-110`, `lib/consents.ts:24-37`
- **Severidade:** 🟢 baixo / 🟡 borderline (compliance)
- **Dono:** Pedro + Theo
- **Estimativa:** 1h
- **Fix:** registrar consentimento via trigger no DB (in `handle_new_user`) baseado em colunas de metadata, ou retry com backoff em caso de falha.

---

### 3.4 Schemas e tipos compartilhados (`packages/shared`)

#### 🟡 D1. `ProfileFormSchema.curso` opcional, mas Onboarding bloqueia step 2 só pelo semestre

- **Descrição:** `schemas.ts:75-81` define `curso: z.string().min(2).max(80).optional().or(z.literal(''))` — aceita vazio. `OnboardingPage.tsx:50-55` (step 2) só valida `semestre_atual`. Resultado: usuário pode terminar onboarding sem curso (que depois aparece "—" no system prompt). Inconsistência com o copy "Vamos configurar seu curso e semestre".
- **Local:** `packages/shared/src/schemas.ts:77` + `apps/web/src/routes/OnboardingPage.tsx:50-55`
- **Severidade:** 🟡 médio (UX confusa; system prompt fica pobre)
- **Dono:** Theo (decisão de produto) + Pedro
- **Estimativa:** 1h
- **Fix:** ou tornar `curso` obrigatório (mudar schema + blockReason do step 2), ou explicitar "(opcional)" no label do onboarding/settings.

#### 🟢 D2. `MIME_TO_FORMAT` não inclui `image/jpg` (variante comum de extensão)

- **Descrição:** `constants.ts:41-44` mapeia `image/jpeg` mas não `image/jpg`. Alguns browsers/sistemas reportam `image/jpg`. `detectFormat` em `upload.ts:11` tem fallback por extensão, então funciona — mas o mapping fica meio-feito.
- **Local:** `packages/shared/src/constants.ts:41-44`
- **Severidade:** 🟢 baixo
- **Dono:** Pedro
- **Estimativa:** 0.1h

---

### 3.5 Funcionalidades declaradas feitas, sem código consumidor (fluxos órfãos)

| Item | Tabela / Função | Onde está | Onde NÃO é consumido | Severidade |
|---|---|---|---|---|
| **`feedback`** | tabela em `0001:198-206` | criada com RLS | nenhuma UI (`grep "feedback" apps/web/src` → só comment) | 🟡 |
| **`user_system_prompts`** | tabela em `0001:182-191` | criada + Edge Function ativa | UI nunca lê nem dispara `generate-system-prompt` | 🟡 (cobre B3) |
| **`connect-drive`** | Edge Function 143 linhas | implementada | UI nunca chama (cobre B2) | 🟡 |
| **`validate_judge`** | função em `validation.ts:198` | implementada | pipeline nunca invoca (cobre A3) | 🔴 |
| **`compressed_cola`** | tipo + ratios | enum + targets | pipeline só roda `compacta` (cobre A4) | 🔴 |
| **`needs_review`** | status enum | criado + UI espera | pipeline nunca seta (cobre A2) | 🔴 |
| **`attempt_count` / `max_retries`** | coluna + constante | criadas | pipeline nunca incrementa (cobre A5) | 🟡 |

**🟡 E1 — Tabela `feedback` 100% morta.**
- **Local:** `supabase/migrations/0001_initial_schema.sql:198-206`
- **Dono:** Pedro
- **Estimativa:** 4h
- **Fix:** widget "Avaliar este job" no `JobCard` (estrelas + tópico + comentário), `useMutation` que insere em `feedback`.

---

## 4. Plano de ação — batches priorizados

### Batch 1 — 🔴 Críticos do pipeline (Sprint 1 finalizando ou Sprint 2 D1)

**Dono coordenador: Isaac**  
**Estimativa: 7h** (sem A3, ele em paralelo com Guilherme)

1. **A1** — fixar `started_at` (1h)
2. **A2** — implementar `needs_review` (2h)
3. **A4** — gerar `compressed_cola` (1h)
4. **A3** — wirar `validateJudge` (3h, Guilherme em paralelo)

**Validação batch 1:**
- Subir um job onde a classificação retorne confianca = 0.55 → status deve ficar `needs_review`.
- Verificar `completed_at - started_at` ≈ tempo total real (não apenas última etapa).
- Após processamento de um doc grande, deve haver 2 rows em `generated_content` para o mesmo `document_id` (`compressed_compact` + `compressed_cola`).
- Em jobs com warnings, deve aparecer evento `judge` em `job_events`.

### Batch 2 — 🟡 Resiliência do pipeline

**Dono: Isaac + Theo (arquitetura)**  
**Estimativa: 10h**

1. **A5** — retry com `attempt_count` (4h)
2. **A6** — RPC transacional `create_document_with_job` (2h)
3. **A7** — watchdog pg_cron para jobs presos (4h)

**Validação:** simular OpenRouter 500 transiente → job retry até 2x antes de `failed`. Matar a Edge Function no meio do processamento → cron detecta e re-roda em ≤ 10min.

### Batch 3 — 🟡 Edge Functions + validação

**Dono: Isaac + Pedro**  
**Estimativa: 13h**

1. **B1** — Zod em `process-document` (0.5h)
2. **B2** — UI Google Drive Connect (6h, Pedro)
3. **B3** — UI System Prompt (6h, Pedro)
4. **B4** — CORS rejection (0.5h)
5. **B5** — vision fallback (1h, Guilherme)

**Validação:** usuário consegue conectar Drive em Settings → próximo upload aparece em `meu-drive/PSP2 - Estudos/2026.1/Materia/`. Página `/meu-prompt` renderiza prompt personalizado, botão Regenerar funciona, botão Copiar coloca no clipboard.

### Batch 4 — 🟡 Frontend hooks

**Dono: Pedro**  
**Estimativa: 6h**

1. **C1** — staleTime + onError (2h)
2. **C2** — filter user_id no Realtime (1h)
3. **C3** — RPC `increment_prompt_usage` (2h, Isaac faz a RPC; Pedro consome)
4. **C4** — migrar `MarkdownPreview` para `useQuery` (1h)

**Validação:** desconectar wifi → `useProfile` mostra erro sem mandar pra onboarding. Realtime com filter explícito não recebe eventos de outros user_id (testar com 2 contas). Contador de uso incrementa em prompts oficiais.

### Batch 5 — 🟢 Polimento (não bloqueia Sprint 2)

**Dono: Pedro + Theo**  
**Estimativa: 7h**

1. C5, C6, C7 — leak/uploads/consent (2h)
2. D1, D2 — schemas (1.2h)
3. **E1** — UI feedback (4h)

---

## 5. Validação geral (smoke-test pós-correções)

Para considerar a auditoria fechada:

1. **Fluxo feliz end-to-end:** signup → onboarding → upload PDF de 5 páginas → ver job sair de `pending` → `processing` (com `started_at` correto) → `completed` (com 2 rows em `generated_content`).
2. **Fluxo de baixa confiança:** upload de imagem rabiscada → classify retorna confianca 0.5 → job vira `needs_review` (não `completed_with_warning`).
3. **Fluxo de falha transiente:** mockar OpenRouter 500 → ver `job_events` com 2-3 entries de `retry` antes de `success` ou `failed`.
4. **Fluxo Drive:** conectar Drive em Settings → fazer upload → conferir arquivo em `PSP2 - Estudos/2026.1/MATERIA/`.
5. **Fluxo System Prompt:** ver `/meu-prompt` populado → regenerar → versão incrementa em `user_system_prompts`.
6. **Fluxo Feedback:** avaliar um job → row em `feedback`.
7. **Privacidade Realtime:** logar com 2 contas em 2 abas → ações em A não geram toast em B.

## 6. Dependências para sprints seguintes

- **Sprint 2 (H5 — Pipeline LLM + Validações):** depende de A1, A2, A3, A4 (sem isso o "pipeline completo" tá mentindo).
- **Sprint 2 (H6 — Integração Drive):** depende de B2 + A2 (não faz sentido subir doc com classify ruim pro Drive).
- **Sprint 3 (H7 — System Prompt UX):** depende de B3 estar em produção.
- **Sprint 3 (H8 — Métricas e analytics):** depende de A1 (durações corretas).
- **Sprint 4 (H10 — Feedback loop):** depende de E1.

---

### Resumo numérico

| Severidade | Quantidade |
|---|---|
| 🔴 Crítico | 4 |
| 🟡 Médio | 14 |
| 🟢 Baixo | 7 |
| **Total** | **25** |

| Frente | Itens |
|---|---|
| Pipeline async | 7 |
| Edge Functions | 5 |
| Frontend hooks | 7 |
| Schemas | 2 |
| Órfãos | 4 (cruzam com outras frentes) |

**Tempo total estimado:** ~43h efetivas (Batch 1: 7h · Batch 2: 10h · Batch 3: 13h · Batch 4: 6h · Batch 5: 7h).

**Dono predominante:** Isaac (backend / pipeline / Edge Functions) — ~22h.
