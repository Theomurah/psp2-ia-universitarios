# 🎤 Plano de Apresentação — PSP2 (18/06/2026)

> **Objetivo:** apresentar o estado atual do projeto após a reformulação do backlog
> em 5 sprints, fechando o ciclo (deadline 25/06). Para uso hoje.
>
> **Modelo:** segue a linguagem visual e a estrutura do deck existente
> `Entregas/PSP2_Apresentacao_Estado_do_Projeto.pptx` (o mais recente). Mantém o
> mesmo "DNA" de slides; atualiza o conteúdo para 5 sprints e destaca as 3 novas.

---

## 0. Linguagem visual a manter (do deck atual)

- **Paleta UnB:** verde `#005923` (primary), azul `#003366` (secondary), amarelo `#FFB81C` (accent), fundos claros, texto grafite. **Nunca** sidebar escura nem paleta paralela.
- **Anatomia do slide:** *eyebrow* (rótulo curto em maiúsculas, ex. `BACKLOG`) + *kicker* (`PLANEJAMENTO · ESCOPO COMPLETO`) + **título forte** + corpo em **cards/colunas** com números grandes e microcopy curto.
- **Tom:** direto, frases curtas, um "mantra" de fechamento por slide (ex.: *"Menos tempo organizando. Mais tempo aprendendo."*).
- **Recursos:** cards numerados (1·2·3·4), pílulas de status (`CONCLUÍDA` / `EM ANDAMENTO` / `A INICIAR`), ícones simples (◆ $ ☁ ! +).
- **Densidade:** 1 ideia por slide; números em destaque; nada de parágrafo longo.
- **Formato:** 16:9. Rodapé discreto com `PSP2 · UnB · 2026.1`.

---

## 1. Estrutura proposta (11 slides)

Mapa rápido (deck antigo → novo): mantém Capa, A Ideia, Backlog, Fluxo, Dificuldades,
Extras e Visão de Futuro; **acrescenta** 1 slide de "O que mudou no plano" e 3 slides
de destaque por sprint nova (Hardening, Artigo, Jornada).

| # | Slide | Eyebrow | Papel |
|---|---|---|---|
| 1 | Capa | — | Identidade + contexto |
| 2 | A Ideia | `A IDEIA` | O que o produto resolve |
| 3 | O que mudou no plano | `REPLANEJAMENTO` | Reformulação retroativa do backlog |
| 4 | Backlog atualizado | `BACKLOG` | Escopo em 5 sprints |
| 5 | Fluxo das 5 sprints | `FLUXO` | Linha do tempo + status |
| 6 | Sprint 3 — Hardening | `SEGURANÇA & ROBUSTEZ` | Destaque técnico |
| 7 | Sprint 5 — Jornada do cliente | `EXPERIÊNCIA` | Destaque de produto |
| 8 | Sprint 4 — Artigo | `PESQUISA` | Destaque acadêmico (honestidade) |
| 9 | Dificuldades | `OBSTÁCULOS` | O que travou e por quê |
| 10 | Maturidade & Extras | `ALÉM DO ESCOPO` | Produto entregue > planejado |
| 11 | Visão de Futuro + Próximos passos | `ALÉM DA DISCIPLINA` | Fecho e roadmap |

---

## 2. Roteiro slide a slide

### Slide 1 — Capa
- **Título:** PSP2 — IA para Universitários
- **Subtítulo:** Estado do Projeto — Fechamento do ciclo (Sprints 1–5)
- **Equipe:** Theo Murahovschi · Pedro Henrique · Isaac · Guilherme · Luis Felipe
- **Rodapé:** Universidade de Brasília · Engenharia de Produção · 2026.1 · 18/06/2026
- *Notas:* abrir conectando ao deck anterior ("evoluímos desde a apresentação da Sprint 1").

### Slide 2 — A Ideia (reaproveitar do deck atual)
- **Eyebrow/kicker:** `A IDEIA` · `VISÃO GERAL · O QUE QUEREMOS RESOLVER`
- **Título:** Um hub que organiza o estudo do aluno UnB
- **Corpo:** o problema (material solto em 5 sistemas) → o que entregamos (resumo confiável, organização automática por matéria, biblioteca de prompts, Drive como espelho).
- **Como funciona (4 cards):** 1 O aluno envia · 2 A IA entende · 3 A IA condensa · 4 O aluno usa.
- **Mantra:** *Menos tempo organizando. Mais tempo aprendendo.*

### Slide 3 — O que mudou no plano *(NOVO)*
- **Eyebrow/kicker:** `REPLANEJAMENTO` · `DO PLANO INICIAL AO PLANO REAL`
- **Título:** O plano agora reflete o que realmente foi feito
- **Mensagem central:** a backlog inicial (4 sprints) foi reformulada **retroativamente** em **5 sprints**, mantendo o deadline **25/06**.
- **Antes → Depois (2 colunas):**
  - *Antes (4 sprints):* S3 Integração+Testes · S4 Feedback+Artigo+Apresentação.
  - *Depois (5 sprints):* **S3 Hardening** · **S4 Artigo** · **S5 Jornada do cliente**.
- **Por quê:** o produto cresceu na prática (segurança, observabilidade, LGPD, jornada). O plano oficial passou a capturar isso em vez de tratar como "extra".
- **Mantra:** *O plano deixou de mentir sobre o trabalho.*
- *Notas:* esta é a resposta direta à "dificuldade da backlog rígida" levantada na apresentação anterior — agora resolvida.

### Slide 4 — Backlog atualizado
- **Eyebrow/kicker:** `BACKLOG` · `ESCOPO COMPLETO EM 5 SPRINTS`
- **Título:** Backlog do produto — 19 histórias em 5 sprints
- **Linha de números:** **19 histórias · 69 tarefas · 5 sprints · 5 integrantes**
- **5 cards (um por sprint):**
  - **SPRINT 1 — Fundação** · H1–H4 · 21 tarefas · `CONCLUÍDA`
  - **SPRINT 2 — Inteligência** · H5–H7 · 13 tarefas · `CONCLUÍDA`
  - **SPRINT 3 — Hardening** · H13–H18 · 18 tarefas · `CONCLUÍDA`
  - **SPRINT 4 — Artigo** · H19–H20 · 6 tarefas · `EM FINALIZAÇÃO`
  - **SPRINT 5 — Jornada do cliente** · H21–H24 · 11 tarefas · `CONCLUÍDA`
- *Notas:* mencionar que cada tarefa tem documento de entrega `.docx` rastreado a commits; backlog e cronograma oficiais atualizados.

### Slide 5 — Fluxo das 5 sprints
- **Eyebrow/kicker:** `FLUXO` · `DO COMEÇO AO FIM`
- **Título:** As 5 sprints, lado a lado
- **5 colunas (timeline):**
  - S1 Fundação `CONCLUÍDA` → S2 Inteligência `CONCLUÍDA` → S3 Hardening `CONCLUÍDA` → S4 Artigo `EM FINALIZAÇÃO` → S5 Jornada `CONCLUÍDA`
- Sob cada uma, 2–3 bullets de histórias-chave.
- **Mantra:** *Da fundação técnica ao fechamento acadêmico — em cinco etapas conectadas.*

### Slide 6 — Sprint 3 · Hardening *(destaque NOVO)*
- **Eyebrow/kicker:** `SEGURANÇA & ROBUSTEZ` · `SPRINT 3`
- **Título:** Endurecemos o sistema para o mundo real
- **Gatilho:** **~200 achados** em **4 rodadas de auditoria** → **1 crítico** (escalada de admin) **resolvido**.
- **6 frentes (cards):** Segurança de acesso · Defesa do pipeline LLM · Robustez do pipeline/banco · Observabilidade · Acessibilidade (WCAG AA) · CI/CD & higiene.
- **Provas rápidas:** tokens Google fora do navegador · sandbox anti-injeção · claim atômico de jobs · logs sem PII · tema escuro + responsivo.
- **Mantra:** *De "funciona na demo" para "aguenta usuário real".*

### Slide 7 — Sprint 5 · Jornada do cliente *(destaque NOVO)*
- **Eyebrow/kicker:** `EXPERIÊNCIA` · `SPRINT 5`
- **Título:** A jornada completa do aluno, ponta a ponta
- **4 etapas (cards):**
  - **Aquisição & Onboarding** — login + magic link, identidade UnB, consentimento LGPD, onboarding em 4 passos.
  - **Perfil acadêmico** — grade visual + import do SIGAA, conexão do Drive.
  - **Uso diário** — dashboard em tempo real, gestão de documentos, transparência (página de atividade).
  - **Voz do cliente** — biblioteca de prompts + system prompt portátil, feedback, direitos LGPD self-service.
- **Mantra:** *Da primeira tela ao hábito de estudo.*

### Slide 8 — Sprint 4 · Artigo *(destaque NOVO)*
- **Eyebrow/kicker:** `PESQUISA` · `SPRINT 4`
- **Título:** Artigo ENEGEP 2026 — pronto, e honesto
- **Bullets:** método **Design Science Research** · corpo em 6 seções (ABNT NBR 14724) · artefato como resultado principal.
- **Destaque de integridade:** a avaliação com usuários é reportada como **planejada, não executada** (sem deploy público) — **sem números fabricados**.
- **Mantra:** *Maturidade acadêmica é dizer o que foi e o que não foi medido.*

### Slide 9 — Dificuldades
- **Eyebrow/kicker:** `OBSTÁCULOS` · `O QUE TRAVOU`
- **Título:** Três bloqueios — e um já resolvido
- **Cards:**
  - ✅ **Backlog rígida** → *resolvido* nesta reformulação (plano agora reflete o real).
  - 💲 **Sem verba para LLM** → teste com 50 docs reais em espera (créditos OpenRouter).
  - ☁ **Sem verba para deploy** → produto pronto, sem URL pública → **avaliação com usuários não executada** (em cascata: SUS/TAM/feedback pendentes).
- **Mantra:** *Os bloqueios restantes são de orçamento, não de engenharia.*

### Slide 10 — Maturidade & Extras
- **Eyebrow/kicker:** `ALÉM DO ESCOPO` · `O PRODUTO ENTREGUE É MAIOR QUE O PLANEJADO`
- **Título:** O que cresceu durante a execução
- **Mensagem:** **30+ execuções extra** documentadas — boa parte agora **incorporada às Sprints 3 e 5** (deixaram de ser "extra"). Permanecem como extra: auditoria multi-agente, arquitetura multi-provider de LLM, visão de futuro.
- **5 frentes (cards):** Experiência do aluno · Acompanhamento · Segurança & privacidade · Confiabilidade · Flexibilidade.
- **Mantra:** *Crescer no escopo, com o plano acompanhando.*

### Slide 11 — Visão de Futuro + Próximos passos
- **Eyebrow/kicker:** `ALÉM DA DISCIPLINA` · `PARA ONDE VAI`
- **Título:** Sistema inteligente unificado do estudante
- **2 camadas (do deck atual):** *Tudo em um lugar* (integrações + inbox + painel do semestre) · *IA que conhece o aluno* (plano de estudo, reforço retroativo, tutor por matéria).
- **Próximos passos concretos (faixa inferior):** 1) deploy público · 2) executar avaliação (50 docs + SUS/TAM) · 3) submeter o artigo ENEGEP · 4) validar a jornada com 10 alunos.
- **Mantra:** *Menos abas abertas. Mais foco. Mais tempo pro aluno.*

---

## 3. Notas de produção

- **Reaproveitar** os slides 1, 2, 7 (extras) e 8 (visão de futuro) do deck atual, ajustando textos.
- **Recriar** os slides de Backlog (3) e Fluxo (4) do deck atual para 5 sprints — eles hoje mostram 4 sprints e a estrutura antiga (H8–H12).
- **Criar do zero** os 4 slides novos (3 Replanejamento, 6 Hardening, 7 Jornada, 8 Artigo) seguindo a anatomia de cards.
- **Status sugeridos:** S1/S2/S3/S5 = `CONCLUÍDA`; S4 = `EM FINALIZAÇÃO` (artigo pronto, falta formatação/submissão).
- **Tempo-alvo:** ~10–12 min (≈1 min/slide), com 2 min para futuro/perguntas.
- **Fontes para os números:** backlog `Entregas/Sprint 0/Backlog do Produto (Oficial).xlsx`, relatórios de sprint, `docs/EXTRAS.md`, `docs/visao-futuro.md`.
