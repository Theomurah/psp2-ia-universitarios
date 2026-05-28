# PSP2 — IA para Universitários

[![CI](https://github.com/Theomurah/psp2-ia-universitarios/actions/workflows/ci.yml/badge.svg)](https://github.com/Theomurah/psp2-ia-universitarios/actions/workflows/ci.yml)

Mini SaaS que ingere documentos acadêmicos (PDF, DOCX, PPTX, MD, imagens), processa via LLM para sintetizar, organiza no Google Drive do aluno, e gera system prompts personalizados + biblioteca de prompts acadêmicos.

**Disciplina:** PSP2 — UnB, semestre 2026.1
**Equipe:** Theo, Pedro, Isaac, Guilherme, Luis Felipe

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + React 19 + TypeScript |
| Routing | React Router v6 |
| UI | Tailwind + shadcn/ui |
| Forms | React Hook Form + Zod |
| Estado servidor | TanStack Query |
| Backend | Supabase Edge Functions (Deno) |
| Auth / DB / Storage | Supabase |
| LLM | OpenRouter |
| Deploy | Vercel (frontend) + Supabase (backend) |

---

## Estrutura

```
psp2-ia-universitarios/
├── apps/
│   └── web/              # Frontend Vite + React (Pedro)
├── packages/
│   └── shared/           # Tipos TypeScript compartilhados
├── supabase/
│   ├── functions/        # Edge Functions (Isaac + Guilherme)
│   └── migrations/       # Schema SQL
└── .github/workflows/    # CI
```

---

## Setup

**Pré-requisitos:** Node 20+, npm 10+, Supabase CLI, conta no Vercel.

```bash
# Clonar e instalar
git clone https://github.com/Theomurah/psp2-ia-universitarios.git
cd psp2-ia-universitarios
npm install

# Variáveis de ambiente
cp .env.example apps/web/.env.local
cp .env.example supabase/functions/.env
# Preencher cada arquivo

# Rodar frontend
npm run dev
```

---

## Scripts (raiz)

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe o frontend (Vite dev server) |
| `npm run build` | Build de todos os workspaces |
| `npm run typecheck` | Type check em todos os workspaces |
| `npm run lint` | Lint em todos os workspaces |

---

## Git flow

- `main` — produção, sempre estável
- `feature/{descrição-curta}` — uma branch por tarefa
- PR de `feature/*` → `main` (1 review mínimo)

**Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).

---

## Documentação

- Decisões arquiteturais e histórico: `../psp2 claude/contexto-projeto.md`
- Backlog consolidado: `../psp2 claude/PSP2 - Consolidado.xlsx`
- Entregas formais por sprint/épico/história: `../psp2 claude/Entregas/`

---

## Licença

Projeto acadêmico — UnB PSP2 2026.1.
