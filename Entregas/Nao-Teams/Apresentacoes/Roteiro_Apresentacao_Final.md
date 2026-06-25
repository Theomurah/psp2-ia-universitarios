# Roteiro da Apresentação Final — PSP2

**Data da apresentação:** 25/06/2026 (deadline do ciclo)
**Contexto:** apresentação de fechamento da disciplina PSP2 (UnB, Eng. de Produção, 2026.1).
**Base:** síntese das 4 apresentações anteriores, ancorada no deck mais recente (`..._2026-06-18`, 11 slides) + números de abertura do kickoff (`PSP2_Apresentacao.pptx`) + features entregues depois (flashcards).

> **Como usar:** cada slide tem **Objetivo**, **Conteúdo** (o que aparece) e **Fala** (o que dizer ao vivo). A coluna *Fonte* aponta qual deck reaproveitar. Tempo-alvo: **~15 min de fala + ~4 min de demo**.

---

## Diferenças vs. `Plano-Apresentacao-2026-06-18.md` (decisões a confirmar)

Já existe um plano para o deck de 18/06 (11 slides). Este roteiro é a **evolução dele para a apresentação FINAL** (com banca/demo). Mudanças conscientes — você decide:

1. **+ Slide do problema (stats de abertura)** — recuperado do kickoff. Uma apresentação final ganha força abrindo pela dor antes da solução.
2. **+ Slide "produto em 5 passos"** — concretiza o pipeline e prepara a demo.
3. **+ Slide de DEMO ao vivo** — a Sprint 4/H12 pede demo; é a peça mais importante de um fechamento. Não existia no plano 06-18.
4. **Dificuldades: re-incluído** — no 06-18 (rev 2) você **removeu** e dobrou os bloqueios no roadmap. Para uma **banca**, que costuma sondar fraquezas, recomendo um slide curto de honestidade. *Se preferir manter a decisão anterior, corte o slide 11 e mantenha os bloqueios no slide 15 (PIBIC).*
5. **+ Flashcards** — entregue **depois** do deck 06-18 (geração por IA com LaTeX + SRS). Entra como destaque na demo e nos extras.

---

## Arco da narrativa

`Problema → Solução → Percurso honesto → Prova (demo) → Rigor → Futuro`

A tese central da apresentação: **"o produto entregue ficou maior que o planejado, e o plano foi reescrito para contar a verdade — com honestidade metodológica, não números inventados."**

---

## ABERTURA — 2 min

### Slide 1 — Capa
- **Objetivo:** abrir com identidade e autoridade.
- **Conteúdo:** "PSP2 — IA para Universitários" · "Apresentação Final — Fechamento do ciclo (Sprints 1–5)" · equipe (Theo, Pedro, Isaac, Guilherme, Luis Felipe) · UnB · Eng. de Produção · 2026.1 · 25/06/2026.
- **Fala:** "Somos o Grupo IA. Em 2026.1 construímos um assistente acadêmico que transforma o material bruto do aluno em material de estudo organizado e personalizado. Hoje contamos o ciclo inteiro — o que prometemos, o que entregamos, onde travamos e pra onde vai."
- **Fonte:** capa do deck 06-18.

### Slide 2 — O problema (por quê)
- **Objetivo:** justificar a existência do projeto com dados.
- **Conteúdo:** 4 números de dor — 85% dos alunos UnB usam IA genérica sem contexto acadêmico · 6–9 disciplinas/semestre em múltiplos formatos · 3–5 h/semana organizando material · transformação manual = perda + retrabalho.
- **Fala:** "O aluno já usa IA — mas joga PDF e foto numa IA que não conhece a matéria dele. E perde de 3 a 5 horas por semana só organizando material. O problema não é falta de IA; é falta de contexto e de organização."
- **Fonte:** `PSP2_Apresentacao.pptx` slide 3 (Justificativa).

---

## O PRODUTO — 3 min

### Slide 3 — A ideia / a solução
- **Objetivo:** explicar o produto em uma frase + o que ele devolve.
- **Conteúdo:** "Um hub que organiza o estudo do aluno UnB." Fluxo em alto nível: (1) aluno envia → (2) IA entende → (3) IA condensa → (4) aluno usa. O que recebe de volta: resumo confiável, tudo nomeado por matéria, biblioteca de prompts, Drive como espelho.
- **Fala:** "O aluno joga o material no PSP2 e recebe de volta: um resumo confiável de cada documento, tudo organizado por matéria automaticamente no Drive dele, e prompts prontos pra usar com qualquer IA. Menos tempo organizando, mais tempo aprendendo."
- **Fonte:** slide 2 do deck 06-18 / Estado do Projeto.

### Slide 4 — O produto em 5 passos
- **Objetivo:** mostrar concretude do pipeline (prepara a demo).
- **Conteúdo:** Upload → Classificação → Síntese → Exportação Drive → Prompts. Requisitos-chave: ≥5 formatos, síntese sem alterar fórmulas/dados, nomenclatura padronizada, <60s/doc.
- **Fala:** "Por dentro são 5 etapas. O documento entra, a IA classifica por matéria, sintetiza sem mexer em fórmula nem tabela, exporta organizado pro Drive e ainda gera um system prompt personalizado. Vou mostrar isso rodando daqui a pouco."
- **Fonte:** `PSP2_Apresentacao.pptx` slide 4 (Produto).

---

## O PERCURSO HONESTO — 4 min

### Slide 5 — Replanejamento: de 4 para 5 sprints
- **Objetivo:** transformar o "fugimos do plano" em força (gestão honesta).
- **Conteúdo:** ANTES (4 sprints) → DEPOIS (5 sprints). S3 virou Hardening, S4 Artigo, S5 Jornada do cliente. Deadline 25/06 mantido.
- **Fala:** "O produto cresceu na prática — segurança, LGPD, jornada do cliente. Em vez de tratar tudo isso como 'extra' e fingir que seguimos o plano, reescrevemos a backlog retroativamente em 5 sprints. Agora plano e produto contam a mesma história."
- **Fonte:** slide 3 do deck 06-18 (Replanejamento).

### Slide 6 — Backlog / escopo completo
- **Objetivo:** mostrar dimensão e status real.
- **Conteúdo:** 19 histórias · 69 tarefas · 5 sprints · 5 integrantes. Por sprint: S1 Fundação (concluída) · S2 Inteligência (concluída) · S3 Hardening (concluída) · S4 Artigo (em finalização) · S5 Jornada (concluída).
- **Fala:** "No total: 19 histórias, 69 tarefas. Quatro das cinco sprints estão fechadas; só o artigo está em finalização. Tudo documentado — docs de tarefa T35–T69, relatório por sprint e relatório geral."
- **Fonte:** slide 4 do deck 06-18 (Backlog).

### Slide 7 — Fluxo das 5 sprints
- **Objetivo:** dar a visão de linha contínua (1 slide, desenho de fluxo).
- **Conteúdo:** 5 cápsulas lado a lado com setas: Fundação → Inteligência → Hardening → Artigo → Jornada, cada uma com 2–3 itens-chave e badge de status.
- **Fala:** "Visto de cima: arquitetura e upload, depois o pipeline de IA, depois robustez e segurança, depois o artigo, e por fim a jornada completa do aluno. Cinco etapas, uma linha só."
- **Fonte:** slide 5 do deck 06-18 (Fluxo).

### Slide 8 — O sistema funcionando de verdade (Hardening)
- **Objetivo:** provar robustez (o diferencial técnico).
- **Conteúdo:** login & auth · conexão Drive (OAuth, refresh, upload idempotente) · estrutura de pastas · fluxo ponta-a-ponta · banco sólido (RLS, anti-escalada). Guiado por **4 rodadas de auditoria, ~200 achados, 1 crítico resolvido**.
- **Fala:** "Na Sprint 3 o sistema deixou de ser peças soltas e virou um fluxo sólido. Fizemos 4 rodadas de auditoria — cerca de 200 achados, incluindo uma falha crítica de escalada de admin que corrigimos. De peças soltas a um produto que funciona de verdade."
- **Fonte:** slide 6 do deck 06-18 (Fluxo Real & Robustez).

---

## A PROVA — 4 min

### Slide 9 — 🔴 DEMO AO VIVO
- **Objetivo:** mostrar o produto real (peça mais importante de uma apresentação final).
- **Conteúdo:** slide-âncora simples ("Demonstração") + roteiro de demo no rodapé/notas.
- **Roteiro de demo (caminho feliz, ~4 min):**
  1. Login → dashboard.
  2. Upload de 1 documento real → acompanhar status em tempo real.
  3. Abrir o resumo gerado (preview do markdown, fórmulas preservadas).
  4. Mostrar organização por matéria / Drive.
  5. **Flashcards**: gerar deck por IA a partir do material (com LaTeX) + estudo SRS.
  6. Biblioteca de prompts / system prompt personalizado.
- **Fala:** "Em vez de só falar, vou mostrar." (Se a demo ao vivo for arriscada sem deploy/verba LLM → ter um **vídeo gravado** de fallback.)
- **Fonte:** novo (H12/T52 — demo ao vivo). Flashcards entregue após o deck 06-18.

### Slide 10 — Além do escopo: o produto ficou maior que o plano
- **Objetivo:** mostrar densidade de entrega (extras agrupados, não-técnico).
- **Conteúdo:** 6 frentes — Experiência do aluno (identidade UnB, onboarding, tema escuro) · Acompanhamento (atividade, métricas, painel admin) · Segurança & privacidade (hardening, anti-injeção, LGPD) · Inteligência do pipeline (validação 4 camadas, import SIGAA, **flashcards por IA**) · Confiabilidade (logs sem PII, CI/CD, auditoria) · Flexibilidade (troca de modelo sem deploy, multi-provider).
- **Fala:** "Tudo isto não estava no backlog original e entregamos mesmo assim. Inclusive uma funcionalidade nova de flashcards gerados por IA com suporte a LaTeX. O produto entregue é maior que o produto planejado."
- **Fonte:** slide 9 do deck 06-18 (Além do escopo) + flashcards.

---

## O RIGOR — 2 min

### Slide 11 — Dificuldades & honestidade
- **Objetivo:** desarmar a crítica antes que ela venha; mostrar maturidade.
- **Conteúdo:** 3 bloqueios reais — backlog rígida (resolvida pelo replanejamento) · **sem verba pra API de LLM** (validação de 50 docs travada) · **sem verba pra deploy** (sem URL pública → fluxo de testes com alunos travado). Lacunas conhecidas: logs/observabilidade, segurança pós-deploy, infraestrutura (DNS/domínio).
- **Fala:** "Fomos honestos sobre o que travou. Sem verba pra créditos de IA, a validação oficial de 50 documentos ficou em espera. Sem verba pra deploy, não pusemos no ar — e isso travou os testes com alunos reais. Sabemos exatamente o que falta: logs, segurança em produção e infraestrutura."
- **Fonte:** slides 5–6 do deck Estado do Projeto (Dificuldades).

### Slide 12 — Artigo ENEGEP 2026
- **Objetivo:** mostrar o entregável acadêmico + a postura ética.
- **Conteúdo:** artigo completo sob **Design Science Research**, 6 seções em **ABNT NBR 14724** (~14 págs). O artefato (protótipo funcional) é o resultado principal. **A avaliação com usuários (SUS, TAM) é reportada como planejada, não executada — sem dados fabricados.**
- **Fala:** "O artigo está pronto, no método Design Science Research. E aqui um ponto de orgulho: a avaliação com usuários está reportada como planejada, não como executada. Não inventamos número. Honestidade vale mais que métrica fabricada."
- **Fonte:** slide 7 do deck 06-18 (Pesquisa).

---

## O FUTURO — 2 min

### Slide 13 — Jornada do cliente (Sprint 5) *(opcional / comprimível)*
- **Objetivo:** mostrar visão de produto além do código.
- **Conteúdo:** Aquisição & onboarding → Perfil acadêmico (grade + SIGAA + Drive) → Uso diário (dashboard, gestão de docs) → Voz do cliente (prompts, feedback, direitos LGPD).
- **Fala:** "Mapeamos a jornada inteira do aluno, da primeira tela ao hábito de estudo — pra guiar as próximas decisões de produto."
- **Fonte:** slide 8 do deck 06-18 (Experiência). *Cortar se o tempo apertar — pode virar 2 frases no slide 10.*

### Slide 14 — Visão de futuro: sistema unificado do estudante
- **Objetivo:** elevar o olhar — de app de síntese a plataforma.
- **Conteúdo:** duas camadas — **tudo num lugar só** (plataformas acadêmicas, inbox único, painel do semestre) e **IA que conhece o aluno** (plano de estudo, reforço retroativo, tutor por matéria).
- **Fala:** "A visão é virar o hub único do aluno UnB: SIGAA, Aprender, Drive, e-mail, calendário num lugar só — com uma IA que conhece o histórico dele e reforça as lacunas antes da prova. Menos abas abertas, mais foco."
- **Fonte:** slide 10 do deck 06-18 (Além da disciplina).

### Slide 15 — Para onde vai → PIBIC + fechamento
- **Objetivo:** dar destino e fechar com gancho forte.
- **Conteúdo:** MACRO (rodar validação técnica → números reais; deploy público; testes com usuários; **transformar em PIBIC/ProIC**) · MICRO (hardening contínuo, novas features). Frase de fecho: *"A disciplina acaba; a pesquisa começa."* + agradecimento + equipe.
- **Fala:** "A disciplina acaba aqui, mas o projeto não. O próximo passo é rodar a validação real, colocar no ar e levar isso pro PIBIC como pesquisa científica continuada. Obrigado." 
- **Fonte:** slide 11 do deck 06-18 (Para onde vai).

---

## Tabela-resumo (cola de palco)

| # | Slide | Tempo | Mensagem em 1 linha |
|---|---|---|---|
| 1 | Capa | 0:30 | Quem somos, o que é |
| 2 | O problema | 1:30 | 3–5 h/semana perdidas; IA sem contexto |
| 3 | A ideia | 1:00 | Hub que organiza; o que devolve |
| 4 | Produto em 5 passos | 1:30 | Upload→classifica→sintetiza→Drive→prompts |
| 5 | Replanejamento 4→5 | 1:30 | Plano agora conta a verdade |
| 6 | Backlog 19h/69t | 1:00 | 4 de 5 sprints fechadas |
| 7 | Fluxo das 5 sprints | 1:00 | Uma linha contínua |
| 8 | Hardening | 1:30 | ~200 achados; 1 crítico resolvido |
| 9 | 🔴 DEMO | 4:00 | Mostrar funcionando + flashcards |
| 10 | Além do escopo | 1:30 | Produto > plano (6 frentes) |
| 11 | Dificuldades | 1:30 | Sem verba LLM/deploy; honesto |
| 12 | Artigo ENEGEP | 1:00 | DSR + ABNT; sem dado fabricado |
| 13 | Jornada *(opc.)* | 0:45 | Da descoberta ao hábito |
| 14 | Visão de futuro | 1:00 | Hub unificado do estudante |
| 15 | PIBIC + fecho | 1:00 | "A disciplina acaba; a pesquisa começa" |

**Total:** ~15 min fala + 4 min demo ≈ **19 min**. Para compactar a ~12 min: cortar slide 13 e enxugar 4 e 7.

---

## Decisões abertas (resolver antes de apresentar)

1. **Demo ao vivo vs. vídeo gravado** — sem deploy/verba, a demo roda local. Ter um **vídeo de fallback** elimina o risco de falhar no palco.
2. **Flashcards entra na demo?** — entregue depois do deck 06-18; é o item mais novo e impressiona. Recomendo sim.
3. **Tempo total disponível** — ajustar cortes conforme o limite da banca (10 / 15 / 20 min).
4. **Números reais** — se a validação de 50 docs rodar até hoje, trocar o discurso de "planejada" por dados reais no slide 12.
