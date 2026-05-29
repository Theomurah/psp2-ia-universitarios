# CLAUDE.md — Convenções para colaboração humano + IA

Este documento concentra regras curtas de estilo, log e segurança que **todo
agente IA (Claude Code, Cursor, Copilot…) deve seguir** ao mexer no repositório
PSP2. Para visão de produto e arquitetura, ver `README.md` e `docs/`.

---

## Convenção de logging

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

### Frontend

`console.error`/`warn` direto, mas **sempre** sanitize objetos de erro antes:

```ts
// ❌ ruim — pode vazar details/hint do PostgrestError
console.error('falha:', err);

// ✅ bom
console.error('falha:', { message: (err as Error).message, code: (err as any).code });
```

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

## Segurança — regras de bolso

1. **Chave OpenRouter, Google Client Secret, Service Role Key** nunca em `apps/web/`.
   Só em Edge Function ou `.env*` (não trackeado).
2. **Toda tabela com `user_id`** precisa de RLS habilitado e policy
   `(select auth.uid()) = user_id` por operação. Veja `0006_security_hardening.sql`
   como gabarito.
3. **CORS:** whitelist explícita por env (`ALLOWED_ORIGINS`), nunca `*`.
4. **Input do aluno em prompt LLM:** sandboxar com delimitadores
   `<<DOC>>...<</DOC>>` e remover marcadores antes de concatenar.
5. **Storage path:** sempre prefixado por `user.id/` e checado no servidor antes
   de gerar signed URL.

---

## Estilo de código

- **Linguagem da documentação e comentários:** pt-BR.
- **Linguagem do código (identificadores, mensagens de erro técnicas):** inglês.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- **PR:** 1 review obrigatório antes de mergear na `main`. Não pushar em main direto.
- **TypeScript:** `strict: true` (mantido em `tsconfig.base.json`); evitar `as any`.

---

## Estilo de UI / Design System

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

- `*:focus-visible` já tem outline amarelo UnB — não sobrescrever.
- Inputs herdam `--primary` no focus + `box-shadow: 0 0 0 3px var(--primary-soft)`.
- Tabelas com `<th>` sticky no scroll vertical (já no `.atividade-table`).
- Botões icon-only sempre com `aria-label`.

---

## Pipeline de testes mínimo antes de PR

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

## Roadmap operacional (pg_cron)

> Origem: auditoria 2026-05-26 (Agente 6 — Banco, achado F2).

O projeto ainda não usa `pg_cron`. Casos planejados que vão entrar em
migrations futuras (não mexer no dashboard do Supabase — sempre via
migration versionada):

| Job                                              | Frequência    | Sprint alvo |
|--------------------------------------------------|---------------|-------------|
| **Watchdog de jobs presos** — jobs em `processing` há > 10min com `attempt_count < max_retries` voltam para `pending` (cobre achado A7 da auditoria) | a cada 5 min  | Sprint 2    |
| **Refresh proativo de `google_access_token`** — antes do expires_at vencer (hoje refresh é on-demand em `connect-drive`) | a cada 30 min | Sprint 3    |
| **Limpeza de `job_events` antigos** — eventos > 90 dias (tabela cresce indefinidamente, ver A7 obs) | diário 03:00  | Sprint 4    |
| **Snapshot de métricas** — agregação diária pra `MetricsCards` em vez de COUNT(*) em tempo real | diário 04:00  | Sprint 4    |

Padrão de migration esperado:

```sql
create extension if not exists pg_cron with schema extensions;

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
