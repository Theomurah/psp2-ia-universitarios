# 🎤 Plano de Apresentação — PSP2 (18/06/2026)

> **Objetivo:** apresentar o estado atual do projeto após a reformulação do backlog
> em 5 sprints, fechando o ciclo (deadline 25/06). Para uso hoje.
>
> **Modelo:** segue a linguagem visual e a estrutura do deck existente
> `Entregas/PSP2_Apresentacao_Estado_do_Projeto.pptx` (o mais recente). Mantém o
> mesmo "DNA" de slides; atualiza o conteúdo para 5 sprints e destaca as 3 novas.
>
> **Rev. 2 (18/06):** ordem Sprint 4 antes de Sprint 5; slide de Dificuldades removido;
> slide final reescrito como Macro/Micro com foco em PIBIC; ênfase da Sprint 3 ajustada.

---

## 0. Linguagem visual a manter (do deck atual)

- **Paleta UnB:** verde `#005923` (primary), azul `#003366` (secondary), amarelo `#FFB81C` (accent), fundos claros, texto grafite. **Nunca** sidebar escura nem paleta paralela.
- **Anatomia do slide:** *eyebrow* (rótulo curto em maiúsculas, ex. `BACKLOG`) + *kicker* (`PLANEJAMENTO · ESCOPO COMPLETO`) + **título forte** + corpo em **cards/colunas** com números grandes e microcopy curto.
- **Tom:** direto, frases curtas, um "mantra" de fechamento por slide.
- **Recursos:** cards numerados (1·2·3·4), pílulas de status (`CONCLUÍDA` / `EM FINALIZAÇÃO`), ícones simples.
- **Densidade:** 1 ideia por slide; números em destaque; nada de parágrafo longo. 16:9. Rodapé `PSP2 · UnB · 2026.1`.

---

## 1. Estrutura proposta (11 slides)

| # | Slide | Eyebrow | Papel |
|---|---|---|---|
| 1 | Capa | — | Identidade + contexto |
| 2 | A Ideia | `A IDEIA` | O que o produto resolve |
| 3 | O que mudou no plano | `REPLANEJAMENTO` | Reformulação retroativa do backlog **+ entregas** |
| 4 | Backlog & Entregas atualizados | `BACKLOG` | Escopo em 5 sprints + artefatos atualizados |
| 5 | Fluxo das 5 sprints | `FLUXO` | Linha do tempo + status |
| 6 | Sprint 3 — Sistema funcionando e sólido | `FLUXO REAL & ROBUSTEZ` | Destaque técnico (ênfase ajustada) |
| 7 | Sprint 4 — Artigo | `PESQUISA` | Passada rápida e geral |
| 8 | Sprint 5 — Jornada do cliente | `EXPERIÊNCIA` | Destaque de produto |
| 9 | Maturidade & Extras | `ALÉM DO ESCOPO` | Produto entregue > planejado |
| 10 | Visão de Futuro | `ALÉM DA DISCIPLINA` | Hub unificado do estudante |
| 11 | Próximos passos — Macro & Micro | `PARA ONDE VAI` | Roadmap + caminho PIBIC |

> Mudanças desta revisão: **Sprint 4 antes de Sprint 5** (slides 7↔8 trocados);
> **slide "Dificuldades" removido** (bloqueios viram parte do roadmap do slide 11);
> ênfase da **Sprint 3** voltada ao sistema funcional/robusto.

---

## 2. Roteiro slide a slide

### Slide 1 — Capa
- **Título:** PSP2 — IA para Universitários · **Subtítulo:** Estado do Projeto — Fechamento do ciclo (Sprints 1–5)
- Equipe (5) · UnB · Engenharia de Produção · 2026.1 · 18/06/2026.
- *Notas:* abrir conectando à apresentação da Sprint 1 ("evoluímos bastante desde então").

### Slide 2 — A Ideia *(reaproveitar do deck atual)*
- `A IDEIA` · `VISÃO GERAL · O QUE QUEREMOS RESOLVER`
- **Título:** Um hub que organiza o estudo do aluno UnB
- Problema (material solto em 5 sistemas) → entregamos (resumo confiável, organização por matéria, biblioteca de prompts, Drive como espelho).
- **4 cards:** 1 O aluno envia · 2 A IA entende · 3 A IA condensa · 4 O aluno usa.
- **Mantra:** *Menos tempo organizando. Mais tempo aprendendo.*

### Slide 3 — O que mudou no plano
- `REPLANEJAMENTO` · `DO PLANO INICIAL AO PLANO REAL`
- **Título:** O plano agora reflete o que realmente foi feito
- **Antes (4 sprints):** S3 Integração+Testes · S4 Feedback+Artigo+Apresentação.
- **Depois (5 sprints):** **S3 Hardening** · **S4 Artigo** · **S5 Jornada do cliente** (deadline 25/06 mantido).
- **Por quê:** o produto cresceu na prática (segurança, observabilidade, LGPD, jornada); o plano passou a capturar isso em vez de tratar como "extra".
- **Mantra:** *O plano deixou de mentir sobre o trabalho.*

### Slide 4 — Backlog & Entregas atualizados
- `BACKLOG` · `ESCOPO COMPLETO EM 5 SPRINTS`
- **Título:** Backlog do produto — 19 histórias em 5 sprints
- **Números:** **19 histórias · 69 tarefas · 5 sprints · 5 integrantes**
- **5 cards (por sprint):** S1 Fundação `CONCLUÍDA` · S2 Inteligência `CONCLUÍDA` · S3 Hardening `CONCLUÍDA` · S4 Artigo `EM FINALIZAÇÃO` · S5 Jornada `CONCLUÍDA`.
- **Faixa "Entregas também atualizadas":** docs de tarefa (T35–T69) · relatórios por sprint (Sprints 3 e 4 revisados; **Sprint 5 novo**) · relatório geral do projeto · artigo ENEGEP — todos sincronizados à nova estrutura.
- *Notas:* cada tarefa tem `.docx` de entrega rastreado a commits; backlog e cronograma `.xlsx` regenerados.

### Slide 5 — Fluxo das 5 sprints
- `FLUXO` · `DO COMEÇO AO FIM`
- **Título:** As 5 sprints, lado a lado
- **5 colunas (timeline):** S1 Fundação → S2 Inteligência → S3 Hardening → S4 Artigo → S5 Jornada, com 2–3 histórias-chave e status em cada.
- **Mantra:** *Da fundação técnica ao fechamento — em cinco etapas conectadas.*

### Slide 6 — Sprint 3 · Sistema funcionando e sólido *(ênfase ajustada)*
- `FLUXO REAL & ROBUSTEZ` · `SPRINT 3 — HARDENING`
- **Título:** O sistema passou a funcionar de verdade — e a aguentar uso real
- **5 cards (ênfase pedida):**
  - **Login com autenticação** — entrada segura do aluno (Supabase Auth), sessão e proteção de rotas.
  - **Conexão Google Drive** — OAuth funcional, refresh de token e upload idempotente (reprocessar não duplica).
  - **Estruturação de pastas** — hierarquia automática por semestre e matéria no Drive do aluno.
  - **Fluxo ponta-a-ponta funcional** — do upload à exportação, sem intervenção manual.
  - **Banco de dados sólido** — RLS em todas as tabelas, gatilho anti-escalada de privilégio, tokens fora do navegador.
- **Tese:** essa solidez veio do hardening guiado por **4 rodadas de auditoria (~200 achados, 1 crítico resolvido)**.
- **Mantra:** *De peças isoladas para um fluxo único, confiável e seguro.*

### Slide 7 — Sprint 4 · Artigo *(passada rápida e geral)*
- `PESQUISA` · `SPRINT 4`
- **Título:** Artigo ENEGEP 2026 — pronto e honesto
- **3 bullets (rápidos):**
  - Método **Design Science Research**; corpo em 6 seções (ABNT NBR 14724); ~14 páginas.
  - O **artefato é o resultado principal** deste ciclo (Tabela 1: componentes implementados).
  - **Integridade:** avaliação com usuários reportada como **planejada, não executada** — sem números fabricados.
- **Mantra:** *Maturidade acadêmica é dizer o que foi e o que não foi medido.*
- *Notas:* não aprofundar; remeter à análise detalhada e às melhorias do artigo (doc à parte).

### Slide 8 — Sprint 5 · Jornada do cliente
- `EXPERIÊNCIA` · `SPRINT 5`
- **Título:** A jornada completa do aluno, ponta a ponta
- **4 cards:**
  - **Aquisição & Onboarding** — login + magic link, identidade UnB, consentimento LGPD, onboarding em 4 passos.
  - **Perfil acadêmico** — grade visual + import do SIGAA, conexão do Drive.
  - **Uso diário** — dashboard em tempo real, gestão de documentos, transparência (atividade).
  - **Voz do cliente** — biblioteca de prompts + system prompt portátil, feedback, direitos LGPD self-service.
- **Mantra:** *Da primeira tela ao hábito de estudo.*

### Slide 9 — Maturidade & Extras
- `ALÉM DO ESCOPO` · `O PRODUTO ENTREGUE É MAIOR QUE O PLANEJADO`
- **Título:** O que cresceu durante a execução
- **Mensagem:** **30+ execuções extra** documentadas — boa parte agora **incorporada às Sprints 3 e 5**; o que segue como extra é arquitetura/processo.
- **5 frentes (cards) — checar cobertura:**
  - **Experiência do aluno** — identidade UnB, onboarding, toasts, busca/filtros, arquivar/excluir, 404, tema escuro/responsivo.
  - **Acompanhamento** — página de atividade, métricas pessoais, painel administrativo completo.
  - **Segurança & privacidade** — hardening de acesso, senha forte, sandbox anti-injeção, LGPD (consentimento/export/delete).
  - **Confiabilidade** — ErrorBoundary, logs estruturados sem PII, CI/CD com gate e migrations, auditoria por múltiplas frentes.
  - **Flexibilidade** — troca de modelo sem deploy, multi-provider de LLM, biblioteca de prompts editável.
- **Mantra:** *Crescer no escopo, com o plano acompanhando.*

### Slide 10 — Visão de Futuro *(reaproveitar do deck atual)*
- `ALÉM DA DISCIPLINA` · `PARA ONDE VAI`
- **Título:** Sistema inteligente unificado do estudante
- **2 camadas:** *Tudo em um lugar* (integrações + inbox + painel do semestre) · *IA que conhece o aluno* (plano de estudo, reforço retroativo, tutor por matéria).
- **Mantra:** *Menos abas abertas. Mais foco. Mais tempo pro aluno.*

### Slide 11 — Próximos passos · Macro & Micro *(reescrito)*
- `PARA ONDE VAI` · `DA DISCIPLINA À PESQUISA`
- **Título:** Como seguimos — e por que vira PIBIC
- **MACRO (direção, em paralelo):**
  - Testar a direção do app com **features novas + testes + feedbacks + análise de dados**.
  - **Pesquisa de mercado** em paralelo (quem usa, por que, concorrentes).
  - **Transformar o processo em PIBIC** — dar continuidade científica ao projeto (iniciação científica UnB/ProIC).
- **MICRO (próximas ações concretas):**
  - **Entrar no PIBIC:** ler o edital ProIC 2026-2027, conseguir orientador(a) (professor doutor), montar projeto de pesquisa + plano de trabalho, cadastrar Lattes, conferir prazos.
  - **Deploy** do sistema em ambiente público.
  - **Seleção e acompanhamento** de usuários-teste (primeiros alunos reais).
  - **Hardening contínuo:** segurança, logs e banco de dados.
  - **Estruturação para análise de dados** (instrumentar uso → base para decisão e para o PIBIC).
  - **Novas features para sentir a direção** — ex.: **flashcards** automáticos a partir das sínteses.
- **Mantra:** *A disciplina acaba; a pesquisa começa.*
- *Notas:* este slide responde também aos antigos bloqueios (verba/deploy/avaliação) — eles entram como ações do roadmap, não como lamento.

---

## 3. Notas de produção

- **Reaproveitar** slides 1, 2, 9 (extras) e 10 (visão de futuro) do deck atual, ajustando textos.
- **Recriar** Backlog (4) e Fluxo (5) para 5 sprints (hoje mostram 4 sprints e H8–H12 antigos).
- **Criar do zero** os slides 3 (Replanejamento), 6 (Sprint 3 ênfase nova), 7 (Sprint 4) e 11 (Macro/Micro PIBIC).
- **Status sugeridos:** S1/S2/S3/S5 = `CONCLUÍDA`; S4 = `EM FINALIZAÇÃO`.
- **Removido:** slide de Dificuldades — os bloqueios viram ações no slide 11.
- **Tempo-alvo:** ~10–12 min (≈1 min/slide), com 2 min para futuro/perguntas.
- **Fontes dos números:** `Entregas/Sprint 0/Backlog do Produto (Oficial).xlsx`, relatórios de sprint, `docs/EXTRAS.md`, `docs/visao-futuro.md`, edital ProIC 2026-2027.
