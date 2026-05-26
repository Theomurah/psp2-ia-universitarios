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
