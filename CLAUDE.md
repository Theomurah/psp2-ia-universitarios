# CLAUDE.md — Convenções para colaboração humano + IA

Este documento concentra as regras que **todo agente IA (Claude Code, Cursor,
Copilot…) deve seguir** ao mexer no repositório PSP2 — tanto **como o agente
deve trabalhar** (§13 Regras de comportamento, §14 Rigor epistêmico) quanto
**que aparência o código deve ter** (convenções §1–§12, §15–§18). Para visão de
produto, ver `README.md` e `docs/`.

> **CLAUDE.md é código, não documentação.** Revise em PR, pode regra que não
> funciona mais, e teste mudança observando se o comportamento muda de fato.
> Não acumular regra "by the way" sem teste de eficácia.

---

## 1. Visão geral e stack

Mini SaaS que ingere documentos acadêmicos (PDF/DOCX/PPTX/MD/imagens), sintetiza
via LLM, organiza no Google Drive do aluno e gera system prompts + biblioteca de
prompts. Disciplina PSP2 — UnB 2026.1. **Mercado único: Brasil/UnB** (relevante
pra §8 timezone).

| Camada | Tecnologia |
|---|---|
| Frontend | Vite 5 + React 19 + TypeScript 5.6 |
| Roteamento | React Router v6 |
| UI | CSS próprio com design tokens UnB (`apps/web/src/index.css`) — **sem Tailwind/shadcn** |
| Forms / validação | React Hook Form + Zod 3 |
| Estado servidor | TanStack Query (React Query) |
| Backend | Supabase Edge Functions (Deno) |
| Auth / DB / Storage | Supabase (**projeto único** — ver §11) |
| LLM | OpenRouter |
| Deploy | Vercel (front) + Supabase (back); CI em GitHub Actions |

**Monorepo (npm workspaces):**

```
apps/web/        Frontend. src/{components,routes,hooks,lib,config}/ + index.css
packages/shared/ Tipos + Zod schemas + lógica pura (sigaa, srs, import) compartilhados
supabase/
  functions/     Edge Functions (Deno). _shared/ = helpers (cors, log, rate-limit, validation, …)
  migrations/    Schema SQL versionado (NNNN_snake_case.sql)
tools/           Scripts node (geração de docs de entrega, etc.)
docs/            PENDENCIAS.md, EXTRAS.md, schema-db.md, visao-futuro.md
```

Não há `services/`, `context/`, `pages/` ou `utils/`: a lógica de domínio vive em
`hooks/` + `lib/`, e páginas ficam em `routes/`.

---

## 2. Convenções de naming

| Elemento | Convenção | Exemplo |
|---|---|---|
| Variáveis / funções | `camelCase` | `loadJobs`, `activeProviders` |
| Componentes React | `PascalCase` | `JobCard`, `MetricsCards` |
| Tipos / interfaces | `PascalCase` | `JobRecord`, `type JobStatus` |
| Constantes globais | `UPPER_SNAKE_CASE` | `STANDALONE_ROUTES`, `DIAS_SEMANA` |
| Hooks | `use` + `camelCase` | `useJobs`, `useProfile` |
| Arquivo de componente | `PascalCase.tsx` | `JobCard.tsx` |
| Arquivo de hook | `useX.ts(x)` | `useJobs.ts`, `useAdminPrefs.tsx` |
| Arquivo de rota/página | `PascalCasePage.tsx` | `DashboardPage.tsx` |
| Arquivo de lib/util/config | `camelCase.ts` | `format.ts`, `log.ts`, `models.ts` |
| Edge Function (pasta) | `kebab-case` | `ingest-document`, `connect-drive` |
| Helper em `_shared` | `kebab-case.ts` | `rate-limit.ts`, `log.ts` |
| Migration | `NNNN_snake_case.sql` | `0033_document_drive_upload_options.sql` |

---

## 3. Padrão de imports

Ordem observada no código (de cima pra baixo), com linha em branco opcional entre grupos:

1. **React e hooks** — `import { useEffect } from 'react'`
2. **Libs externas** — `react-router-dom`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-query`, `@supabase/supabase-js`
3. **Workspace compartilhado** — `import { ProfileFormSchema, type ProfileForm } from '@psp2/shared'`
4. **`lib/` e `hooks/` internos** — `from '../lib/supabase'`, `from '../hooks/useProfile'`
5. **Componentes internos** — `from '../components/Toast'`
6. **Tipos** — `import type { JobRecord } from '@psp2/shared'` (ou `type` inline)

**Regras:**
- Sem path aliases (`@/`) — o projeto usa caminhos relativos.
- Usar `import type` / `type` inline para importações só-de-tipo (convenção do
  código; **`verbatimModuleSyntax` não está ligado** no tsconfig, então não é
  enforced — siga mesmo assim).
- Preferir **named exports** para hooks/lib/utils. Default export é tolerado em
  componentes de página/seção (padrão atual misto) e em lazy-loaded routes.
- Edge Functions (Deno) importam com extensão `.ts`: `from '../_shared/log.ts'`.

---

## 4. Idioma e comentários (JSDoc)

- **Comentários inline e de seção:** português brasileiro (pt-BR).
- **Strings de UI:** pt-BR.
- **Código (identificadores, mensagens de erro técnicas, eventos de log):** inglês.
- **Header de arquivo:** recomendado um bloco JSDoc no topo de arquivos não-triviais
  descrevendo propósito e o **porquê** (ver `lib/log.ts`, `routes/SettingsPage.tsx`
  como gabaritos). Não é obrigatório em todo arquivo, mas todo `lib/`/`hook` com
  lógica não-óbvia deveria ter.

```ts
/**
 * NomeDoArquivo.ts
 *
 * O que faz e por que existe. Detalhes não-óbvios que um dev junior precisaria.
 */
```

A regra de concisão de §14 vale pro **chat**, não pros comentários — esses
explicam o "porquê" pra um dev junior (§13).

---

## 5. Tipagem

Config em `tsconfig.base.json`: `strict: true`, `noUnusedLocals`, `noUnusedParameters`,
`isolatedModules`, `noFallthroughCasesInSwitch`.

- **Evitar `any` explícito.** Se inevitável, justificar com comentário; `Record<string, unknown>`
  (ou `unknown` + type guard) é quase sempre melhor que `any`.
- Variável/parâmetro não usado é **erro** de tsc — prefixar com `_` quando intencional
  (o ESLint ignora `^_`).
- `as Type` com moderação, só quando o TS não consegue inferir.
- Tipos e schemas compartilhados entre front e Edge Functions vivem em
  `@psp2/shared` — não duplicar.

---

## 6. Error handling

**Não há Sentry** neste projeto. O par é: **log estruturado + feedback amigável ao usuário.**

```ts
import { createLogger } from '../lib/log';
import { useToast } from '../components/Toast';
const log = createLogger('upload');

try {
  await uploadDocument(file);
} catch (err) {
  log.error('upload_failed', log.fromError(err));   // fromError já sanitiza (§9)
  toast.error('Não foi possível enviar o arquivo.'); // mensagem amigável, sem detalhe técnico
}
```

**Regras:**
- Nunca silenciar erro sem log (`catch {}` vazio só é tolerado quando documentado).
- Feedback ao usuário **sempre via `useToast`** — `alert()` é proibido (já foi
  removido do código).
- `console.*` cru é desencorajado (use `createLogger`), mas o ESLint tem
  `no-console: off` — as **exceções legítimas** são: `lib/supabase.ts` (guard de
  bootstrap, evita ciclo `log.ts`→`supabase.ts`), `ErrorBoundary.tsx` e scripts
  de `tools/`. Fora disso, use o logger.
- Extrair mensagem com segurança: `err instanceof Error ? err.message : String(err)`.

---

## 7. Padrões por tipo de arquivo

- **`routes/` (páginas):** uma página por arquivo, sufixo `Page`. Header JSDoc.
  Rotas standalone (sem topbar) estão em `STANDALONE_ROUTES` no `App.tsx` — ver §16.
- **`components/`:** funcionais (nunca classe, exceto `ErrorBoundary`). Props via
  interface `XProps`. CSS pelas classes do design system (§16), nunca estilo solto.
- **`hooks/`:** prefixo `use`, um por arquivo, retornam objeto/tupla nomeada.
  Encapsulam React Query + Supabase. `createLogger('<escopo>')` no topo do módulo.
- **`lib/`:** funções utilitárias (`format`, `upload`, `apkg`, `consents`) e o
  cliente `supabase`. Idealmente puras; efeitos colaterais explícitos.
- **`config/`:** catálogos estáticos (`models.ts`, `modelCapabilities.ts`).
- **Edge Functions (`supabase/functions/<nome>/index.ts`):** Deno; helpers em
  `_shared/`; toda função é **frontend-untrusted** (§13, §15).

---

## 8. Datas e timezone (BRT)

O PSP2 é Brasil-only (UnB). **`America/Sao_Paulo` (UTC-3) é o timezone canônico.**

- Em display, fixar o fuso: `toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', … })`.
- Em prompt LLM, rotular a data como `(BRT, UTC-3)` — sem o rótulo o LLM raciocina
  como UTC e erra SQL/datas entre 21h–24h BRT.
- Não usar `getUTCHours()/getUTCDate()` como heurística "tem hora"/"dia 1" — `00:00 BRT`
  = `03:00 UTC` gera falso positivo.

> **Pendência honesta:** hoje `apps/web/src/lib/format.ts` (e alguns `routes/`)
> usam `toLocaleString('pt-BR')` **sem** `timeZone`. É um débito conhecido — ao
> tocar nesses pontos, fixar o fuso (idealmente centralizando numa util
> `dateBRT.ts`, que ainda não existe).

---

## 9. Logging

> Origem: auditoria 2026-05-26 (Agente 4 — Observabilidade, achado A8).

### Níveis

| Nível            | Quando usar                                                                 |
|------------------|------------------------------------------------------------------------------|
| `console.error`  | Falha real — exception capturada em `catch`, erro de DB, erro de provider.   |
| `console.warn`   | Degradação graceful — fallback acionado, schema antigo, retry transitório.   |
| `console.log`    | Apenas em scripts de `tools/` para progresso (`✓`, `→`). **Não** em produção.|
| `console.info`/`debug` | Evitar — não temos coletor que diferencie.                            |

### Edge Functions

Use o helper `_shared/log.ts`:

```ts
import { createLogger } from '../_shared/log.ts';
const log = createLogger('ingest-document');

log.info('received', { user_id, format, size_bytes });
log.warn('rate_limited', { user_id });
log.error('insert_failed', log.fromError(err));
```

O helper emite JSON 1-linha-por-evento (`{ ts, level, fn, evt, ...fields }`),
filtrável no Supabase Studio via `jq '.evt'`.

**Separação dev/prod:** o nível mínimo emitido é controlado pela env var
`LOG_LEVEL` (`debug | info | warn | error`, default `info`). `debug` é
suprimido em produção:

```bash
supabase secrets set LOG_LEVEL=info    # produção
supabase secrets set LOG_LEVEL=debug   # branch de desenvolvimento
```

### Frontend

**Sempre** use o helper `apps/web/src/lib/log.ts` (espelho do `_shared/log.ts`,
com a mesma whitelist de redação). Não use `console.*` cru — vaza
`details`/`hint` de `PostgrestError`.

```ts
import { createLogger, emailDomain } from '../lib/log';
const log = createLogger('upload');

log.info('upload_started', { user_id, format, size_bytes });
log.warn('rate_limited', { user_id });
log.error('upload_failed', log.fromError(err));   // fromError já sanitiza
```

Separação dev/prod é **build-time** via Vite: `vite dev` → nível `debug` (loga
tudo); `vite build` → nível `warn` (só warn + error; `info`/`debug` viram
no-op). Override pontual em prod sem redeploy:
`localStorage.setItem('psp2:log_level', 'debug')` e recarregue. Para email,
logue só `emailDomain(email)` — nunca o endereço completo.

**Persistência durável:** além do console, eventos `info+` são gravados de forma
não-bloqueante na tabela `activity_logs` (migration 0018), com um `request_id`
de correlação por sessão. O threshold de persistência é **independente** do de
console — em prod o console mostra só `warn+`, mas `info` (ex: auditoria de
admin, scope `admin`) continua sendo persistido. RLS: cada um lê os próprios
logs; admin lê todos via `is_admin()`. Exceção à regra "sem console cru":
`lib/supabase.ts` usa `console.error` no guard de bootstrap de propósito — se
importasse o logger criaria ciclo (`log.ts` → `supabase.ts`).

### O que **nunca** logar

| Categoria                | Exemplos                                                         |
|--------------------------|------------------------------------------------------------------|
| Tokens                   | `access_token`, `refresh_token`, `google_refresh_token`, `provider_token` |
| Credenciais              | `Authorization` header, `cookie`, `password`                     |
| Conteúdo do aluno        | `markdown`, `texto`, `texto_bruto`, prompt do usuário, `messages` do LLM |
| PII                      | Email, nome completo, nome do arquivo (apenas extensão é OK)     |
| Detalhe do banco         | `details`/`hint` do `PostgrestError` (podem conter valor da linha) |

A whitelist canônica de chaves sensíveis vive em `supabase/functions/_shared/log.ts`
(`REDACT_KEYS`). Para adicionar algo novo, edite lá.

---

## 10. Git — branches, commits, PR

- **`main`** — produção, sempre estável. **Nunca** commitar/pushar direto;
  exige PR + 1 review.
- **`dev`** — branch de integração (hoje à frente de `main`). Destino dos merges
  de feature; é onde o código estável de dev vive. CI roda em `main` **e** `dev`.
- **`feature/<descrição>`** ou **`fix/<descrição>`** — uma branch por tarefa,
  criada a partir de `dev`. **Tarefa substancial** (feature, fix multi-arquivo,
  refactor) roda numa branch própria, idealmente num **worktree isolado**
  (`git worktree add ../psp2-<desc> -b feature/<desc> dev`, ou a isolação de
  worktree do Claude Code). **Mudança trivial** (1 arquivo, typo, tweak em
  doc/CLAUDE.md) vai direto no `dev` — o overhead de branch+worktree não compensa.
- **Merge no final (automático após validação passar):** ao concluir a tarefa
  com o pipeline de §17 passando (`npm test` + `npm run typecheck` + `npm run build`),
  mergear a branch de volta no `dev` via merge commit (`--no-ff`, nunca squash) e
  remover branch + worktree — **sem pedir confirmação**. Se a validação falhar,
  **não** mergear: reportar e corrigir primeiro. `dev` → `main` só via PR revisado.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`,
  `refactor:`, `test:`, `perf:`). Descrição em inglês ou pt-BR curta, imperativo.
  Mensagens como `teste`, `ajustes`, `wip` são inválidas.
- **Staging granular:** `git add <arquivo>` por nome. **Nunca** `git add .`/`-A`
  quando o working tree tiver mudança não-relacionada — cada commit = uma intenção.

---

## 11. Acesso ao Supabase

**Projeto único:** `psp2-ia-universitarios` (ref `bthwkwgdbtrkixajvddi`) — não há
dois projetos.

Claude Code tem acesso direto via `supabase` CLI e via MCP. Use isso para
verificar dados/tabelas/RLS/migrations e diagnosticar **contra o banco real**, em
vez de inferir só pelo código.

**Ordem de prioridade (fonte da verdade):**
1. **Banco real** — `supabase` CLI ou MCP (`execute_sql`, `list_tables`,
   `get_edge_function`, `get_logs`, `get_advisors`). Preferir **CLI** por economia
   de tokens (§13); MCP quando o CLI não estiver autenticado.
2. Código-fonte — para intenção e contexto.
3. Documentação — último recurso, nunca substitui verificação real.

**Operações que exigem confirmação explícita** (afetam produção):
- Deploy de Edge Function.
- Schema que muda comportamento (`DROP`, `ALTER`, rename de coluna/tabela).
- Mudança de RLS que altera o que o usuário vê/faz.
- `UPDATE`/`DELETE` em tabela de config lida em runtime.
- Qualquer migration irreversível.

Leitura (`SELECT`, list, get, logs) **não** precisa de confirmação.

**Regras de banco:**
- Toda mudança de schema vai por **migration versionada** (`supabase/migrations/`,
  hoje em `0033`) — nunca pelo dashboard.
- Ao criar/alterar função `SECURITY DEFINER`, rodar `get_advisors security` antes
  do push, e **revogar `EXECUTE` da trigger function no schema `public`** (lição
  das migrations 0024→0030: trigger `SECURITY DEFINER` não deve ser chamável
  diretamente — vira RPC com guard).

---

## 12. Comandos de desenvolvimento

```bash
npm run dev          # Frontend (Vite). Porta 5173 (ou 5175 via .claude/launch.json)
npm run build        # Build de todos os workspaces (tsc -b && vite build)
npm run typecheck    # tsc -b --noEmit em todos os workspaces
npm run lint         # ESLint (flat config) em apps/web/src
npm test             # vitest run
deno check supabase/functions/<nome>/index.ts   # type check de Edge Function

supabase functions deploy <nome>   # deploy (exige confirmação — §11)
```

**Conta de testes:** ainda **não há** uma conta dedicada documentada para o Claude
usar em verificações. Quando for criada, registrar aqui (email + senha + role).
Por ora, testes que precisam de sessão devem ser combinados com o usuário.

---

## 13. ⭐ Regras de comportamento do Claude

> A camada mais importante deste arquivo. Define **como o agente trabalha**, não
> só como o código fica.

### Como executar

- **Trabalhar direto com as ferramentas — sem subagentes.** Neste projeto, **não**
  usar `Agent`/`Task`/`Workflow` para paralelizar. Paralelizar via **múltiplos
  tool calls numa única mensagem** (Read/Grep/Bash juntos) — mais rápido e barato.
  (Preferência explícita e recorrente do usuário.)
- **Read before write:** antes de modificar função/hook/serviço, buscar **todas**
  as call sites via `grep`/Glob. Mudar assinatura sem checar quem chama = bug
  latente. Vale também para remoção: ao limpar arquivo/função, achar todas as
  referências e avaliar como remover sem quebrar — só então executar.
- **Verify before claiming success:** não declarar tarefa concluída sem a
  verificação cabível — mudança de tipo → `npm run typecheck`; UI visível → abrir
  preview do Vite; SQL/RPC/migration → executar contra o banco (§11); lógica pura
  → `npm test`. "Funcionar na minha cabeça" não conta.
- **Hard attempt limit:** após **2 tentativas** falhas no mesmo erro, parar e
  pedir contexto ao usuário em vez de continuar iterando. Loop autônomo queima
  tokens e gera diff inútil.
- **CLI antes de MCP:** quando dá pra fazer por CLI (`gh`, `git`, `npm`, `supabase`)
  ou por MCP equivalente, preferir o CLI — output mais enxuto, menos tokens.
  MCP só quando o CLI não está disponível/autenticado.
- **Consultar memórias automáticas antes de assumir contexto:** o sistema injeta
  só os *títulos* das memórias. Ao começar tarefa de um tópico coberto (flashcards,
  auditoria, LGPD, edge functions, etc.), **ler o arquivo de memória completo**
  antes de propor solução — memórias documentam decisões já tomadas.

### Git autônomo (commit + push)

- **Commit automático:** após concluir uma alteração de arquivo do projeto
  (código, CLAUDE.md, docs, config), commitar automaticamente — sem pedir
  confirmação nem esperar o usuário pedir. Conventional Commits; **staging
  granular obrigatório** (`git add <arquivo>` por nome; quando houver mudança
  órfã/não-relacionada no working tree, usar `git add -p` ou `git stash` pra
  isolar — nunca varrer o que não é da tarefa atual). Reportar após o commit:
  linhas +X/−Y, branch, hash.
- **Push automático no `dev`:** todo commit ou merge no `dev` é pushado pro
  remoto na sequência (`git push origin dev`), pra manter local e remoto
  sincronizados (`dev` é compartilhado). Antes do push, `git fetch origin` +
  integrar `origin/dev` (merge ou rebase) pra evitar non-fast-forward.
- **Exceção (escopo do automático):** commit+push automáticos valem pro `dev` e
  branches de tarefa (`feature/*`/`fix/*`). **Qualquer operação na `main`** —
  commit, merge ou push — **exige confirmação explícita** do usuário (§10).

### Como decidir e codar

- **Convention over novelty:** se o codebase já tem um padrão (error handling,
  fetching, naming, componentização), usar esse. Não introduzir lib/padrão novo
  sem justificativa e aprovação. Achou duas convenções? Escolher uma das
  existentes — nunca criar uma terceira variação híbrida.
- **Simplicity first (regra do 3):** o mínimo de código que resolve. Sem feature
  especulativa, abstração genérica para um único uso, ou flag "pro futuro". Não
  criar abstração até ter 3 chamadas idênticas.
- **Solução geral > fix hiper-específico:** identificar a *classe* do bug antes
  de patchar o caso pontual; `grep` por casos similares e resolver na causa raiz.
  Sinais de fix mal-feito: `if x === 'casoX'` espalhado, regra que cita nome
  próprio de tabela/coluna/usuário, patch que não cobre nem o caso vizinho óbvio.
- **Don't use LLM for deterministic work:** retry, validação de schema, parsing,
  sanitização → código TypeScript, não prompt LLM. Reservar LLM pra linguagem
  natural / raciocínio. Toda chamada LLM evitável é custo + latência + não-determinismo.
- **Edge Functions são frontend-untrusted:** validar input (Zod via `_shared/validation.ts`),
  checar ownership via JWT, nunca confiar em dado do front — mesmo com RLS ativa (§15).
- **Comentar o "porquê":** ao adicionar código, incluir comentário suficiente pra
  um dev junior entender a lógica e o contexto — não só o "quê".

### Observar fora do escopo

- Durante qualquer execução, observar o código ao redor em busca de bug, lacuna
  ou risco — mesmo fora do escopo. Se achar algo relevante, reportar ao final numa
  seção curta **"⚠️ Observado fora do escopo"**, sem interromper a tarefa principal.

### Manter o CLAUDE.md vivo

- Ao final de execução, avaliar se vale adicionar regra. **Adicionar quando:** (a)
  o usuário corrigiu explicitamente um comportamento; (b) descoberta de padrão
  arquitetural não-óbvio que afeta próximas sessões; (c) bug cuja causa raiz foi
  convenção não-óbvia. **Não adicionar:** preferência trivial, observação pontual,
  regra que cobre 1 caso isolado.

### Comunicação

- **Síntese inteligente:** comprimir ao máximo sem perder informação crucial.
  Começar pela resposta direta — sem preâmbulo ("Boa pergunta!"), sem closer
  ("Espero ter ajudado"), sem repetir o pedido. Detalhe secundário vira menção de
  1 linha com oferta de aprofundar, não seção inteira. Respostas no chat em **pt-BR**.
- **Sempre fechar com próximos passos:** ao concluir/avançar uma tarefa, indicar o
  que falta ou a decisão pendente do usuário (1 linha ou 2-3 bullets). Se não há
  nada pendente, dizer "nada pendente".
- **Se não conseguir fazer algo** (quebra, limitação técnica, qualquer motivo),
  avisar honestamente — não fingir sucesso.

---

## 14. ⭐ Postura e rigor epistêmico

- **Zero invenção:** nunca chutar nome de função, assinatura, coluna de tabela,
  RPC, hook, tipo ou comportamento de lib. Não souber? **Verificar antes** —
  código-fonte, Supabase (§11), ou perguntar. Agente que inventa API gera bug que
  vaza pra produção.
- **Calibração de confiança explícita:** diferenciar fato verificado (li no
  código/banco), dedução lógica (segue de X), e especulação (acho que). Não fingir
  autoridade sem base.
- **Ambiguidade = perguntar antes de executar.** Pedido confuso, contraditório ou
  com mais de uma interpretação plausível: alinhar antes, não escolher em silêncio.
- **Discordar com fundamento:** antes de discordar de uma decisão do usuário
  (arquitetura, stack, padrão), reconstruir o argumento dele na forma mais forte
  (steel-manning) e só então apresentar o contraponto, com trade-offs concretos —
  não opinião genérica. Não aceitar a primeira ideia se houver alternativa melhor,
  mas justificar em 1-2 linhas.
- **Postura:** par técnico do desenvolvedor, não assistente subserviente. Direto,
  sem validação emocional decorativa.

---

## 15. Critérios de segurança (checklist antes de PR)

> Regras de bolso. Cada item fechou (ou previne) um vetor real — ignorar =
> reintroduzir vulnerabilidade. Detalhe de padrões em `0006_security_hardening.sql`
> (gabarito de RLS) e na auditoria 2026-06-10 (`Entregas/Auditoria-2026-06-10/`).

- **Toca tabela com `user_id`?** → RLS habilitado + policy `(select auth.uid()) = user_id`
  por operação. Filtro client-side **não conta**.
- **Toca coluna privilegiada** (`profiles.role`, limites, flags)? → além da RLS,
  **trigger `BEFORE UPDATE`** bloqueando a coluna. (Achado **crítico** da auditoria
  2026-06-10: escalada a admin via `UPDATE` direto em `profiles` — não repetir.)
- **Nova RPC `SECURITY DEFINER`?** → guard no início do body
  (`IF auth.uid() <> p_target AND NOT is_admin() THEN RAISE EXCEPTION`), `get_advisors
  security` antes do push, e revogar `EXECUTE` se for trigger function (§11).
- **Nova Edge Function?** → nesta ordem: CORS por whitelist (`_shared/cors.ts` +
  env `ALLOWED_ORIGINS`, **nunca `*`**) → JWT/Bearer → `Zod.parse(body)`
  (`_shared/validation.ts`) → rate-limit (`_shared/rate-limit.ts`) → lógica.
- **Aceita upload?** → checar tipo real (não confiar em `file.type`), storage path
  sempre prefixado por `user.id/` e validado no servidor antes de gerar signed URL.
- **Input do aluno em prompt LLM?** → sandboxar com delimitadores `<<DOC>>…<</DOC>>`
  e remover os marcadores do input antes de concatenar.
- **Segredos** (chave OpenRouter, Google Client Secret, Service Role Key) → **nunca**
  em `apps/web/`. Só em Edge Function ou `.env*` não-trackeado.

---

## 16. Estilo de UI / Design System

> Origem: incidente 2026-05-27 — primeira versão do `/admin` foi feita com
> sidebar escura, paleta indigo (`#4f46e5`) e classes próprias (`admin-table`,
> `admin-card`, `admin-layout`). Resultado: visualmente desconectado do resto
> do app — "feio, bagunçado, fugindo do estilo". Regras abaixo evitam reincidência.

### Paleta — sempre via CSS vars

O app é tematizado com a identidade visual UnB. **Cores hard-coded são proibidas**
em componentes/CSS novos. Os tokens vivem em `apps/web/src/index.css` no `:root`.

| Token                    | Cor       | Uso                                       |
|--------------------------|-----------|--------------------------------------------|
| `--primary`              | `#005923` | Verde UnB. Botões primary, links, hover.   |
| `--primary-soft`         | `#e6f4ec` | Fundo de NavLink ativo, hover em tabs.     |
| `--secondary`            | `#003366` | Azul UnB. Apenas em destaques.             |
| `--accent`               | `#FFB81C` | Amarelo do escudo UnB (focus, accent).     |
| `--success` `--error`    | `#1F8A4C` / `#B91C1C` | Feedback.                        |
| `--warn`                 | `#B85C00` | Avisos (tom laranja escuro).               |
| `--bg`                   | `#f5f7f6` | Fundo da página.                           |
| `--bg-elevated`          | `#ffffff` | Cards, inputs, header de tabela.           |
| `--bg-muted`             | `#f0f2f0` | Sparkline cards, tabs container.           |
| `--border` `--border-strong` | `#d9e0db` / `#b9c4bc` | Linhas, separadores.        |
| `--text` `--text-muted`  | `#0f1f15` / `#5a6b60` | Tipografia.                      |

**Layout:** `--radius-sm: 6px`, `--radius: 10px`, `--radius-lg: 16px`.
**Sombras:** `--shadow-sm / --shadow / --shadow-lg`.
**Topbar height:** `--topbar-height: 64px`.

### Classes reutilizáveis — use ESTAS, não invente novas

| Classe                          | Para que serve                                          |
|---------------------------------|----------------------------------------------------------|
| `.container`                    | Wrapper de página (`max-width: 1080px` + padding).       |
| `.dashboard-header`             | Header: `<h1>` à esquerda, ações/badges à direita.       |
| `.metric-card` / `.metrics-cards` | Cards de KPI com label/value/foot.                    |
| `.metric-bars` (`.metric-bar-label/track/fill/count`) | Barras horizontais.            |
| `.atividade-table` / `.atividade-table-wrapper` | Tabela padrão (hover, sticky thead). |
| `.cell-mono` `.cell-filename` `.cell-materia` `.cell-truncate` `.cell-message` | Variantes de célula. |
| `.badge` + `.tone-success/warn/error/info` | Pills de status.                          |
| `.empty`                        | Estado vazio (dashed border, italic).                    |
| `.full-page-loader` + `.spinner` | Loader centralizado.                                    |
| `.card`                         | Container neutro (white + border + radius + shadow-sm).  |
| `.field` / `.field > span`      | Form field com label.                                    |
| `.prompts-toolbar`              | Barra: search + select + filtros.                        |
| `.prompts-filter`               | Grupo de botões filtro (com `.active`).                  |
| `.view-toggle` / `.tabs` / `.admin-subnav` | Sub-navegação dentro de uma página.           |
| `button.primary` / `button.ghost` / `button.danger` / `button.link` / `button.icon-only` | Variantes de botão. |
| `.realtime-pill` + `.dot`       | Pill animada de status conectado.                        |
| `.hint` / `.muted`              | Texto secundário (`color: var(--text-muted)`).           |

### Regras de UI (proibições e padrões)

1. **Nunca criar sidebar escura** nem paleta paralela (indigo, slate puro, etc).
   O `/admin` é seção normal: mesma topbar, mesma paleta UnB.
2. **Nunca esconder a topbar** em rota autenticada. Lista de rotas standalone
   está em `STANDALONE_ROUTES` no `App.tsx` (`/login`, `/onboarding`,
   `/privacidade`, `/termos`). Adicionar a essa lista exige justificativa.
3. **Sempre usar `.container`** como wrapper externo de uma página.
4. **Sempre usar `<header className="dashboard-header"><h1>...</h1><p className="hint">...</p></header>`** no topo de cada página.
5. **Sub-navegação dentro de uma seção:** use `.view-toggle`, `.tabs` ou
   `.admin-subnav`. **NÃO** criar sidebar nova.
6. **Tabelas:** sempre `.atividade-table` dentro de `.atividade-table-wrapper`.
   Não definir tabelas com estilo próprio (`admin-table` foi anti-padrão).
7. **Botões primários:** `<button className="primary">`. Outros: `ghost`, `danger`,
   `link`, ou sem classe (default outline).
8. **Cores em SVG/charts:** use `var(--primary)`, `var(--success)`, etc — **nunca
   hex direto**. Strings `'#4f46e5'` em `style={{ color: ... }}` são proibidas.
9. **Cards de seção:** `.card` (com `padding: 1.5rem`). Para tabelas, o wrapper
   `.atividade-table-wrapper` já tem visual de card.
10. **Estado loading:** `<div className="full-page-loader"><span className="spinner"/>...</div>` — nunca um spinner solto sem container.
11. **Empty state:** `<div className="empty">texto</div>` — não um `<p>vazio</p>` solto.

### Guards de rota — gotchas

- **`RequireAuth`**: espera `useAuth().loading=false`; sem session redireciona
  pra `/login`; com `requireOnboarding=true` checa profile completo.
- **`RequireAdmin`**: compõe sobre `RequireAuth`. Consulta `public.is_admin()` via
  React Query. **Não usar `isLoading` do React Query como gate** — com
  `enabled: false` ele retorna `false` (não `true`), e o `data` fica `undefined`.
  Tratar undefined como false dá redirect prematuro → bug "só entra no double
  click" (incidente 2026-05-27). Sempre checar `data === undefined` pra
  distinguir "ainda não sei" de "sei que é não-admin".

### Acessibilidade

- **Foco global (`*:focus-visible`):** outline azul UnB `var(--secondary)` (2px,
  offset 2px) + halo amarelo `var(--accent)` (`box-shadow: 0 0 0 4px`). Racional
  WCAG 1.4.11 (Non-text Contrast): o indicador de foco precisa de contraste
  ≥ 3:1 contra os fundos adjacentes — o amarelo `#FFB81C` sozinho não atinge
  isso sobre os fundos claros do app (`--bg`/`--bg-elevated`), o azul `#003366`
  atinge com folga; o halo amarelo mantém a identidade UnB e serve de segundo
  indicador sobre superfícies escuras (ex: botão primary verde). Não trocar o
  par por uma cor só sem reavaliar o contraste.
- Inputs herdam `--primary` no focus + `box-shadow: 0 0 0 3px var(--primary-soft)`.
- Tabelas com `<th>` sticky no scroll vertical (já no `.atividade-table`).
- Botões icon-only sempre com `aria-label`.
- **`prefers-reduced-motion`**: há um bloco global no `index.css` que zera
  animações/transições. Não criar animação que dependa de movimento pra
  comunicar estado sem um fallback estático.

### Responsividade (mobile-first nas correções)

> Origem: 2026-06-11 — UI tornada reativa pra todas as telas.

1. **Topbar mobile (≤ 768px):** os links viram um dropdown sob o botão
   hambúrguer (`.topbar-burger`); em desktop seguem inline. A topbar **nunca**
   é escondida (regra acima continua valendo) — só os links colapsam. Ao
   adicionar um link novo na topbar, ele entra automaticamente no menu mobile.
2. **Grids fluidos:** use `repeat(auto-fill/fit, minmax(min(Npx, 100%), 1fr))`,
   **nunca** `minmax(Npx, 1fr)` puro — sem o `min()`, telas mais estreitas que
   `N` forçam scroll horizontal.
3. **Tabelas largas:** o wrapper (`.atividade-table-wrapper`) usa
   `overflow-x: auto` pra rolar no mobile em vez de cortar colunas.
4. Grupos de pills/ações que podem estourar (`.prompts-filter`, `.privacy-action`,
   `.admin-subnav`) levam `flex-wrap: wrap`.

### Tema claro / escuro

> Origem: 2026-06-11.

- Tokens do dark vivem em `[data-theme="dark"]` no `index.css` — sobrescrevem só
  superfície/texto/borda/feedback. A identidade UnB é mantida (verde/azul ganham
  versões mais claras pra contraste; `--accent` amarelo fica igual). **Não**
  hard-codar cor que dependa de tema; use os tokens.
- O atributo `data-theme` é setado por um **script inline no `index.html`** que
  roda antes do paint (evita flash). Fonte da verdade: `localStorage['psp2:theme']`;
  default segue o `prefers-color-scheme` do SO. O toggle é o `ThemeToggle.tsx` na topbar.
- Use `var(--surface)` (alias de `--bg-elevated`) onde antes havia `var(--surface, #fff)`.

---

## 17. Pipeline de testes mínimo antes de PR

```bash
npm test          # 140+ testes, ~1.7s
npm run typecheck # 3 workspaces, deve passar limpo
npm run lint      # eslint sem warning bloqueante
npm run build --workspace=apps/web  # build do front
```

Para Edge Functions sob desenvolvimento ativo, considere também:

```bash
deno check supabase/functions/<nome>/index.ts
```

---

## 18. Roadmap operacional (pg_cron)

> Origem: auditoria 2026-05-26 (Agente 6 — Banco, achado F2).

O primeiro uso de `pg_cron` entrou na migration `0028_activity_logs_retention`
(limpeza de `activity_logs`). Demais casos planejados vão entrar em migrations
futuras (não mexer no dashboard do Supabase — sempre via migration versionada):

| Job                                              | Frequência    | Sprint alvo |
|--------------------------------------------------|---------------|-------------|
| **Watchdog de jobs presos** — jobs em `processing` há > 10min com `attempt_count < max_retries` voltam para `pending` (cobre achado A7 da auditoria) | a cada 5 min  | Sprint 2    |
| **Refresh proativo de `google_access_token`** — antes do expires_at vencer (hoje refresh é on-demand em `connect-drive`) | a cada 30 min | Sprint 3    |
| **Limpeza de `job_events` antigos** — eventos > 90 dias (tabela cresce indefinidamente, ver A7 obs) | diário 03:00  | Sprint 4    |
| **Limpeza de `activity_logs` antigos** — registros > 90 dias (prometido no comentário da 0018; cada page-load gera eventos) | diário 03:00  | ✅ entregue (migration `0028`) |
| **Snapshot de métricas** — agregação diária pra `MetricsCards` em vez de COUNT(*) em tempo real | diário 04:00  | Sprint 4    |

Padrão de migration esperado:

```sql
-- pg_cron não é relocatable (cria o schema `cron` próprio) — sem `with schema`.
create extension if not exists pg_cron;

select cron.schedule(
  'watchdog-stuck-jobs',
  '*/5 * * * *',
  $$ update public.jobs
       set status = 'pending', current_step = null
     where status = 'processing'
       and started_at < now() - interval '10 minutes'
       and attempt_count < 2; $$
);
```
