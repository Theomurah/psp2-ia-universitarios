# ⭐ Extras — PSP2 IA para Universitários

Funcionalidades, decisões e implementações que **não estavam no escopo inicial nem no backlog explicitamente**, mas foram incluídas porque agregam valor ao produto.

**Última atualização:** 14/05/2026

---

## Sobre este documento

Toda Execução Extra deve estar listada aqui. Critério pra entrar:

- Feature, decisão ou solução técnica que não consta nas 12 histórias do backlog original
- Foi implementada (ou planejada) mesmo assim por alta densidade de valor
- O time avaliou e considerou que vale o custo marginal

Mantemos esse registro pra auditoria de sprint, pra clareza no artigo final, e pra justificar caso o avaliador pergunte "isso estava no escopo?".

---

## 1. Estrutura hierárquica de pastas no Google Drive

**Origem:** Caixa "EXECUÇÃO EXTRA" no doc da Tarefa T07 (Regras de nomenclatura).
**Status:** Planejado em T07, implementação real em H6 (Sprint 2).

**O que é:**
O Drive do aluno organiza os documentos automaticamente em estrutura hierárquica:

```
PSP2 - Estudos/
└── 2026.1 (6º semestre)/
    ├── Cálculo 3/
    ├── Física 3/
    │   ├── FISICA3 - Aula - 2026-03-24 Lei de Coulomb Vetorial.md
    │   └── FISICA3 - Lista - 03 Campo Eletrico.md
    └── Inteco/
└── 2026.2 (7º semestre)/
```

**Justificativa:** Sem hierarquia, todos os docs ficariam soltos numa pasta única — UX ruim, principalmente pra alunos com 5+ matérias. Custo: 1 chamada extra ao Drive API por matéria nova (insignificante).

**Impacto no projeto:**
- T17 (onboarding) coleta semestre + matérias — necessário pra estrutura
- T07 (regras) inclui caminho `{Semestre}/{Matéria}/` além do nome do arquivo
- T06 (pipeline) → passo 9 chama `findOrCreateFolder` recursivo
- Schema `profiles.materias` (jsonb) + `documents.drive_folder_path`

---

## 2. Validação em 4 camadas (LLM-as-judge incluído)

**Origem:** T11 — "Definir critérios de validação dos outputs" — backlog dizia "validação automática" sem especificar camadas.
**Status:** Implementado parcialmente (camadas 1-3 ativas, judge implementada mas roda apenas em amostragem).

**O que é:**

| Camada | Tipo | Custo | Backlog explícito? |
|---|---|---|---|
| 1. Estrutural | Zod + regex | grátis | Sim (implícito) |
| 2. Quantitativa | Métricas em código | grátis | Sim (taxa de acerto) |
| **3. Semântica** | Extração de keywords + match | grátis | **Não** ⭐ |
| **4. LLM-as-judge** | Chamada secundária a outro LLM | ~$0.005/job | **Não** ⭐ |

**Justificativa:**
- A camada semântica é o que detecta "a síntese pulou um capítulo importante" — algo que validação estrutural não pega
- O LLM-as-judge dá uma camada de proteção extra antes de mostrar pro aluno
- Combinadas, elas elevam o critério de aceitação ("80% de acerto") de uma medição superficial pra uma garantia robusta

**Decisão:** Manter as 4 camadas; judge fica fail-open (se cair, não bloqueia o job).

---

## 3. Realtime UI updates (sem polling)

**Origem:** Sub-aspecto da H4 (Dashboard de status). Backlog dizia "indicadores de progresso", sem especificar implementação.
**Status:** Implementado.

**O que é:**
O dashboard escuta a tabela `jobs` via Supabase Realtime e atualiza a UI **instantaneamente** quando o status muda. Sem polling de N em N segundos.

**Justificativa:**
- UX melhor (atualização imediata vs delay de polling)
- Custo zero (Realtime free tier do Supabase aguenta muito)
- Sem trabalho extra de backend (alter publication add table já estava na migration)

**Trade-off:** Adiciona dependência de WebSockets — fallback é polling (não implementado, mas trivial de adicionar se necessário).

---

## 4. Vision provider abstrato (T13 escalável)

**Origem:** T13 — "Desenvolver parsers por formato". Backlog dizia parsers, não exigia abstração de modelo.
**Status:** Implementado, finalizado em commit `e71f0b2`.

**O que é:**
Em vez de hardcodar "use Claude Vision" ou "use Gemini", o parser de imagens usa uma factory que aceita **qualquer modelo vision-capable do OpenRouter** via env var.

```bash
# .env
VISION_MODEL=anthropic/claude-sonnet-4.6     # default
VISION_MODEL=openai/gpt-4o                   # ou GPT-4o
VISION_MODEL=qwen/qwen-2-vl-72b-instruct     # ou Qwen
VISION_MODEL=meta-llama/llama-3.2-90b-vision # ou Llama
```

**Justificativa:**
- A decisão sobre qual provider usar em produção AINDA NÃO foi fechada
- Permite testar diferentes modelos sem mudar código
- Em produção, dá pra fazer A/B test ou rotação dinâmica

**Impacto:** Engenharia extra (~50 linhas de abstração), mas paga sozinha na 1ª vez que precisar trocar de provider.

---

## 5. Modelos LLM dinâmicos via env vars

**Origem:** Não estava no backlog. Solicitado pelo PM (Theo) durante implementação.
**Status:** Implementado em commit `3da1287`.

**O que é:**
Cada estágio do pipeline (classify, synthesize, compress, judge) aceita um modelo específico via env var. Sem env, usa default. Trocar modelo é **zero código**:

```bash
supabase secrets set MODEL_CLASSIFY=openai/gpt-4o-mini
supabase secrets set MODEL_SYNTHESIZE=deepseek/deepseek-chat-v3
supabase secrets set MODEL_COMPRESS_COMPACT=google/gemini-2.0-flash-exp
supabase secrets set MODEL_JUDGE=anthropic/claude-haiku-4.5
```

**Justificativa:**
- Mercado de LLMs muda rápido — modelos novos surgem todo mês
- Permite tunar custo vs qualidade por estágio sem deploy
- Facilita A/B test (rodar 50% do tráfego com Sonnet, 50% com GPT-4o)
- Decisão de qual usar em produção ainda não foi fechada (mesmo motivo que Vision Provider)

**Impacto:** Camada `_shared/models.ts` (1 arquivo, ~30 linhas).

---

## 6. Job events — telemetria granular

**Origem:** Sub-aspecto da T16 (Tratamento de erros). Backlog dizia "tratar erros" — não detalhou logging estruturado.
**Status:** Implementado, integrado em `process-document/index.ts`.

**O que é:**
Tabela dedicada `job_events` com 1 row por passo do pipeline, contendo:

- `step` (parse, classify, synthesize, compress, validate, upload_drive)
- `event_type` (start, success, retry, warning, error)
- `duration_ms`
- `llm_model`, `tokens_input`, `tokens_output`, `cost_usd`
- `message`

**Justificativa:**
- Permite dashboard interno de observabilidade ("qual etapa está mais lenta?", "qual modelo dá mais erro?")
- Custo agregado por aluno fica rastreável (somando `cost_usd` dos events)
- Facilita debug em produção (sequência completa de eventos por job_id)
- Habilita análises futuras de custo por matéria, por tipo de doc, por modelo

**Impacto:** 1 tabela extra + ~10 linhas pra logar em cada step.

---

## 7. Múltiplas versões do mesmo documento (`generated_content`)

**Origem:** Decisão arquitetural durante implementação. Backlog falava em "documento sintetizado" no singular.
**Status:** Implementado no schema (migration 0001) e usado em `process-document`.

**O que é:**
Em vez de salvar o markdown sintetizado direto em `documents`, criamos uma tabela `generated_content` separada que armazena **múltiplas versões** do mesmo doc:

- `synthesized` — versão completa (T08)
- `compressed_compact` — versão 50-70% do tamanho (T10)
- `compressed_cola` — versão 15-25%, ultra-resumo pra prova (T10)

**Justificativa:**
- Backlog dizia "comprimir" e "sintetizar" como atividades separadas — mas o produto pode oferecer múltiplas versões pro aluno (toggle no UI)
- Aluno pode regenerar uma versão sem reprocessar o doc inteiro
- Schema flexível: facilita adicionar futuras versões (ex: "índice", "fichamento") sem migration

**Impacto:** Schema mais limpo, 1 query a mais pra preview (`type='synthesized'` por padrão).

---

## 8. Modos "compacta" e "cola" no T10

**Origem:** Backlog dizia "compressão/redução de tamanho" — não especificava modos.
**Status:** Implementado, prompt parametrizado.

**O que é:**
- **Modo "compacta"** (50-70% do original) — pra revisão rápida
- **Modo "cola"** (15-25%) — só bullets, fórmulas e tabelas, pra consulta em prova

**Justificativa:**
- "Cola" foi inspirado nos arquivos do Theo: `TCM/ColaFinal.pdf` — modo natural do aluno
- 2 modos cobrem dois casos de uso distintos sem complicar a implementação (mesmo prompt com placeholder `{{modo}}`)

**Impacto:** 1 parâmetro extra no prompt, validação T11 calibrada pra ambos os modos.

---

## 9. Magic link no login (T17)

**Origem:** Backlog T17 dizia "tela de cadastro/login" sem especificar método.
**Status:** Implementado.

**O que é:**
Além de email+senha, o login oferece um terceiro modo: **link mágico** — usuário digita email, recebe um link de acesso. Não precisa de senha.

**Justificativa:**
- Recuperação de senha sem fluxo separado ("esqueci a senha")
- Conveniência pra testes rápidos com usuários reais (Sprint 3)
- Funciona out-of-the-box com Supabase Auth (`signInWithOtp`)

**Impacto:** 1 tab a mais no LoginPage, código já no Supabase SDK.

---

## 10. GitHub Actions para deploy automático

**Origem:** Não estava no backlog. Solicitado pelo PM pra reduzir trabalho manual.
**Status:** Workflow criado em `.github/workflows/deploy-functions.yml`.

**O que é:**
Push em `main` que afete `supabase/functions/` → CI roda `supabase functions deploy` automaticamente.

**Justificativa:**
- T04 incluía "configurar CI" mas no escopo de typecheck + build, não de deploy
- Deploy manual via CLI é fricção desnecessária
- Garante que main = produção (sem drift entre git e Supabase)

**Impacto:** 1 arquivo YAML, 2 GitHub secrets a configurar.

---

## 11. Biblioteca de prompts oficiais (`prompt_library` com `is_official=true`)

**Origem:** T33 dizia "biblioteca de ≥ 8 prompts para tarefas comuns". Backlog não especificou que seriam **mantidos pelo time** vs criados pelo aluno.
**Status:** Schema preparado (migration 0001), implementação efetiva pendente (Sprint 2).

**O que é:**
A tabela `prompt_library` aceita:
- **Prompts oficiais** (`user_id = NULL`, `is_official = true`) — mantidos pela equipe, visíveis pra todos os alunos
- **Prompts customizados** (`user_id = <aluno>`, `is_official = false`) — cada aluno pode criar os seus

**Justificativa:**
- Backlog implicava "mostrar 8 prompts" — mas o produto fica melhor se o aluno também puder criar/salvar os próprios
- Schema único cobre os 2 casos com RLS dual (`is_official=true OR user_id=auth.uid()`)

**Impacto:** Schema flexível, sem complexidade extra na implementação.

---

## 📊 Resumo do que entrou como extra

| Categoria | Itens |
|---|---|
| Features de produto | Estrutura hierárquica Drive, Magic Link, Modos cola/compacta, Prompts customizados |
| Arquitetura técnica | Vision abstrato, Modelos dinâmicos, generated_content multi-versão, job_events |
| Qualidade | LLM-as-judge, Validação semântica, Realtime updates |
| DevEx | GitHub Actions CI/CD |

**Total: 11 extras documentados.**

---

## 🎯 Por que isso importa pro artigo

Quando for redigir o artigo final (H11), considerar:

1. **Mencionar explicitamente** que essas decisões foram feitas pelo time, justificando trade-offs
2. **Não tentar esconder** que o escopo final foi maior que o inicial — isso mostra maturidade técnica
3. **Quantificar valor**: ex: "abstração de vision permite trocar provider em 1 env var, vs ~50 linhas de código se feito de outra forma"
4. **Reconhecer custos**: extras adicionam complexidade — discutir trade-off de quanto vale a pena vs entregar antes
