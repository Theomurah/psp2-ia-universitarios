# Google Forms — PSP2 IA Universitários

Formulário único combinando **validação de hipóteses** (pesquisa de problema/solução) + **feedback do MVP** (avaliação pós-teste). A lógica condicional na Seção 6 ramifica o respondente entre "testou o MVP" e "não testou".

- **Público:** universitários (graduação/pós), prioritariamente UnB e parceiros.
- **Tempo estimado:** 6–10 min (sem MVP) / 10–15 min (com MVP).
- **Coleta de email:** opcional, somente para entrevistas qualitativas e sorteio.
- **Total de perguntas:** 38 (5 obrigatórias na S1–S2, restante opcional para reduzir abandono).

---

## Hipóteses validadas pelo formulário

| ID | Hipótese | Seções que testam |
|---|---|---|
| H1 | Universitários têm grande volume de documentos acadêmicos espalhados em múltiplos lugares. | S3 (Q3.1, Q3.2, Q3.3) |
| H2 | Sentem dor real em **encontrar e sintetizar** material das aulas. | S3 (Q3.4), S4 (Q4.1, Q4.2, Q4.4) |
| H3 | Já usam IA generativa, mas de forma **fragmentada e sem contexto** do curso. | S5 (Q5.1, Q5.2, Q5.4) |
| H4 | Querem **system prompts personalizados** para sua realidade acadêmica. | S5 (Q5.5), S6 (Q6.2) |
| H5 | Pagariam por uma solução integrada (price discovery). | S6 (Q6.3) |
| H6 | Integração com **Google Drive** é diferenciador relevante. | S6 (Q6.1), S8 (Q8.5) |

| ID | Feature MVP avaliada | Seção / Pergunta |
|---|---|---|
| F1 | Upload multi-formato (PDF, DOCX, PPTX, MD, imagens) | S8 (Q8.2, Q8.3) |
| F2 | Síntese via LLM | S8 (Q8.4) |
| F3 | System prompt personalizado | S8 (Q8.6) |
| F4 | Biblioteca de prompts acadêmicos | S8 (Q8.7) |
| F5 | Exportação para Google Drive | S8 (Q8.5) |
| F6 | UX (drag-and-drop, dashboard, preview) | S8 (Q8.8, Q8.9) |

---

## Estrutura completa

### Seção 1 — Boas-vindas (sem perguntas)

> **Título:** PSP2 — IA para Universitários: ajude a moldar a ferramenta
>
> Oi! Somos um time da disciplina PSP2 da UnB construindo uma ferramenta que organiza e sintetiza seus materiais de aula com IA, exporta direto pro seu Google Drive e gera prompts personalizados pro seu curso.
>
> Essa pesquisa leva **6 a 15 minutos** (depende se você testou o MVP ou não). Suas respostas são anônimas por padrão — só pedimos email no final, e é opcional.
>
> Obrigado pelo tempo! 🎓
>
> *Conformidade LGPD: dados coletados serão usados apenas para fins acadêmicos da disciplina PSP2 — UnB 2026.1.*

---

### Seção 2 — Perfil acadêmico (5 perguntas — todas obrigatórias)

**Q2.1** — Qual sua idade?
- Tipo: `dropdown`
- Obrigatória: sim
- Opções: `16-18`, `19-21`, `22-24`, `25-28`, `29-34`, `35+`

**Q2.2** — Qual sua universidade?
- Tipo: `short_text`
- Obrigatória: sim
- Validação: mínimo 2 caracteres

**Q2.3** — Qual seu curso?
- Tipo: `short_text`
- Obrigatória: sim

**Q2.4** — Em que semestre você está?
- Tipo: `dropdown`
- Obrigatória: sim
- Opções: `1º-2º`, `3º-4º`, `5º-6º`, `7º-8º`, `9º+`, `Pós-graduação`

**Q2.5** — Modalidade do seu curso:
- Tipo: `multiple_choice`
- Obrigatória: sim
- Opções: `Presencial`, `Híbrido`, `EAD/Remoto`

---

### Seção 3 — Comportamento atual com material de estudo (4 perguntas)

**Q3.1** — Quantos documentos acadêmicos (PDFs, slides, livros, notas) você costuma acumular **por semestre**?
- Tipo: `multiple_choice`
- Opções: `Menos de 20`, `20–50`, `50–100`, `100–200`, `Mais de 200`, `Não faço ideia`

**Q3.2** — Onde você armazena seu material de estudo? *(marque todos)*
- Tipo: `checkbox` (múltipla)
- Opções: `Google Drive`, `OneDrive`, `Dropbox`, `iCloud`, `Pasta local no computador`, `Pendrive/HD externo`, `Notion/Obsidian/Notion-like`, `WhatsApp (grupos da turma)`, `Email`, `Não organizo / fica espalhado`, `Outro`

**Q3.3** — Como você organiza esse material?
- Tipo: `multiple_choice`
- Opções: `Pastas por disciplina`, `Pastas por semestre`, `Pastas por tipo de arquivo`, `Não organizo, busco quando preciso`, `Tenho um sistema próprio (descreva abaixo)`
- *Follow-up condicional:* se "sistema próprio" → texto curto

**Q3.4** — Numa escala de 1 a 5, quanto você concorda: **"Tenho dificuldade em encontrar um material específico que já salvei."**
- Tipo: `linear_scale` (1 = discordo totalmente, 5 = concordo totalmente)

---

### Seção 4 — Dores e fricções (4 perguntas)

**Q4.1** — Numa escala de 1 a 5: **"Gasto muito tempo resumindo/sintetizando material das aulas."**
- Tipo: `linear_scale` (1–5)

**Q4.2** — Quanto tempo, em média, você gasta por semana **só organizando ou revisando** material?
- Tipo: `multiple_choice`
- Opções: `Menos de 1h`, `1–3h`, `3–6h`, `6–10h`, `Mais de 10h`

**Q4.3** — Você já perdeu prazo de entrega ou foi mal em prova por **desorganização** de material?
- Tipo: `multiple_choice`
- Opções: `Sim, várias vezes`, `Sim, uma ou duas`, `Não, mas chegou perto`, `Nunca`

**Q4.4** — Quais são suas **3 maiores dores** com material acadêmico hoje? *(marque até 3)*
- Tipo: `checkbox` (limite 3)
- Opções:
  - `Volume grande, não consigo absorver tudo`
  - `Material espalhado em várias plataformas`
  - `Slides do professor são ruins / incompletos`
  - `Não consigo resumir bem o que estudo`
  - `Esqueço o que estudei poucos dias depois`
  - `Falta tempo pra revisar`
  - `Difícil cruzar conteúdo entre disciplinas`
  - `Não sei por onde começar quando vou estudar`
  - `Outro`

---

### Seção 5 — Uso atual de IA generativa (5 perguntas)

**Q5.1** — Você usa alguma ferramenta de IA generativa (ChatGPT, Claude, Gemini, Copilot etc.) para estudar?
- Tipo: `multiple_choice`
- Opções: `Sim, diariamente`, `Sim, algumas vezes por semana`, `Sim, esporadicamente`, `Não, mas já testei`, `Nunca usei`
- *Lógica:* se `Não` ou `Nunca` → pular para Q5.4

**Q5.2** — Quais ferramentas você usa? *(marque todos)*
- Tipo: `checkbox`
- Opções: `ChatGPT`, `Claude`, `Gemini / Google AI Studio`, `Copilot (Microsoft)`, `Perplexity`, `NotebookLM`, `Outras`

**Q5.3** — Pra que você usa IA nos estudos? *(marque todos)*
- Tipo: `checkbox`
- Opções:
  - `Resumir textos longos`
  - `Tirar dúvidas sobre conceitos`
  - `Gerar questões de prática / simulado`
  - `Reescrever / revisar trabalhos`
  - `Traduzir material`
  - `Buscar referências bibliográficas`
  - `Criar flashcards`
  - `Brainstorm de ideias`
  - `Programação / código`
  - `Outro`

**Q5.4** — Numa escala de 1 a 5: **"A IA dá respostas genéricas, sem conhecer meu curso / disciplina / professor."**
- Tipo: `linear_scale` (1–5)

**Q5.5** — Você já criou ou usou **prompts personalizados / GPTs customizados** para o seu contexto acadêmico?
- Tipo: `multiple_choice`
- Opções: `Sim, criei do zero`, `Sim, usei prontos`, `Já tentei mas desisti`, `Não, nem sabia que dava`, `Não, não vi necessidade`

---

### Seção 6 — Disposição à solução + bifurcação MVP (4 perguntas)

**Q6.1** — Imagina uma ferramenta que **organiza e sintetiza** todo o seu material acadêmico via IA, **exporta direto pro seu Google Drive** e gera **prompts personalizados** pro seu curso. Numa escala de 1 a 5, quanto isso te interessa?
- Tipo: `linear_scale` (1 = nada, 5 = muito)

**Q6.2** — Das features abaixo, quais seriam **mais valiosas** pra você? *(marque até 4)*
- Tipo: `checkbox` (limite 4)
- Opções:
  - `Upload em lote de PDFs, slides, livros`
  - `Síntese automática por disciplina`
  - `Geração de resumos em formatos diversos (flashcard, mapa mental, etc.)`
  - `System prompt customizado pro meu curso/professor`
  - `Biblioteca de prompts acadêmicos prontos`
  - `Exportação automática pro Google Drive`
  - `Cruzamento de conteúdo entre disciplinas`
  - `Geração de questões de prática`
  - `Plano de estudos personalizado`

**Q6.3** — Se essa ferramenta existisse e funcionasse bem, **quanto você pagaria por mês**?
- Tipo: `multiple_choice`
- Opções: `Nada — só uso se for grátis`, `Até R$ 10`, `R$ 11–25`, `R$ 26–50`, `R$ 51–100`, `Mais de R$ 100`

**Q6.4** — Você **já testou** o MVP do PSP2 (a versão atual da ferramenta)?
- Tipo: `multiple_choice`
- Obrigatória: sim
- Opções:
  - `Sim, testei` → vai para **Seção 7**
  - `Não, ainda não testei` → vai para **Seção 9**
- **Lógica condicional:** ramifica seções 7–8 vs. 9.

---

### Seção 7 — Contexto do teste do MVP *(condicional: Q6.4 = "Sim")* — 3 perguntas

**Q7.1** — Quanto tempo você gastou testando o MVP?
- Tipo: `multiple_choice`
- Opções: `Menos de 5 min`, `5–15 min`, `15–30 min`, `30–60 min`, `Mais de 1h`

**Q7.2** — Quais features você chegou a testar? *(marque todas)*
- Tipo: `checkbox`
- Opções:
  - `Login (Google ou email)`
  - `Upload de documentos (drag-and-drop)`
  - `Dashboard de status do processamento`
  - `Preview de documento`
  - `Tela de configuração`
  - `Geração de síntese via LLM`
  - `Exportação para Google Drive`
  - `Geração de system prompt personalizado`
  - `Biblioteca de prompts acadêmicos`

**Q7.3** — Em que **dispositivo** você testou?
- Tipo: `multiple_choice`
- Opções: `Notebook/Desktop`, `Tablet`, `Celular`

---

### Seção 8 — Feedback do MVP *(condicional: Q6.4 = "Sim")* — 10 perguntas

**Q8.1** — Numa escala de 1 a 5: **"Foi fácil entender o que a ferramenta faz logo que abri."**
- Tipo: `linear_scale` (1–5)

**Q8.2** — O **upload de arquivos** funcionou bem? *(considere se testou)*
- Tipo: `linear_scale` (1 = não funcionou, 5 = funcionou perfeitamente, N/A se não testou)
- Opções: `Não testei`, `1`, `2`, `3`, `4`, `5`

**Q8.3** — Quais formatos você tentou subir? *(marque todos)*
- Tipo: `checkbox`
- Opções: `PDF`, `DOCX`, `PPTX`, `Markdown (.md)`, `TXT`, `Imagens (JPG/PNG)`, `Outro`, `Não fiz upload`

**Q8.4** — As **sínteses / resumos gerados pela IA** foram úteis?
- Tipo: `linear_scale` (1–5, com opção `Não testei`)

**Q8.5** — A **exportação para Google Drive** funcionou e organizou bem o conteúdo?
- Tipo: `linear_scale` (1–5, com opção `Não testei`)

**Q8.6** — O **system prompt personalizado** que a ferramenta gerou fez sentido pro seu contexto?
- Tipo: `linear_scale` (1–5, com opção `Não testei`)

**Q8.7** — A **biblioteca de prompts acadêmicos** foi útil?
- Tipo: `linear_scale` (1–5, com opção `Não testei`)

**Q8.8** — Bugs ou problemas que você encontrou: *(descreva)*
- Tipo: `long_text`
- Obrigatória: não

**Q8.9** — O que **mais te impressionou positivamente** no MVP?
- Tipo: `long_text`

**Q8.10** — O que **mais te frustrou ou decepcionou**?
- Tipo: `long_text`

---

### Seção 9 — NPS, intenção e encerramento (5 perguntas — para todos)

**Q9.1** *(condicional: Q6.4 = "Sim")* — Numa escala de 0 a 10, **qual a chance de você recomendar o PSP2 IA Universitários pra um colega**?
- Tipo: `linear_scale` (0–10) — pergunta de NPS clássica
- Legenda: 0 = não recomendaria, 10 = recomendaria com certeza

**Q9.2** *(condicional: Q6.4 = "Sim")* — **Por quê?** (justifique a nota acima)
- Tipo: `long_text`

**Q9.3** — Você toparia participar de uma **entrevista qualitativa de ~20 minutos** com nosso time?
- Tipo: `multiple_choice`
- Opções: `Sim, podem me chamar`, `Talvez, depende do horário`, `Não, obrigado(a)`

**Q9.4** — **Email** (opcional, só pra entrevista e/ou avisos do lançamento)
- Tipo: `short_text`
- Validação: regex de email
- Obrigatória: não

**Q9.5** — Quer compartilhar mais alguma coisa que esse questionário não cobriu?
- Tipo: `long_text`
- Obrigatória: não

---

### Seção 10 — Agradecimento (sem perguntas)

> **Título:** Valeu demais! 🙌
>
> Sua resposta foi registrada e vai ajudar diretamente o time do PSP2 a priorizar o que construir nas próximas sprints.
>
> Se deixou email e topou entrevista, te chamamos em breve. Qualquer dúvida: **theo.murah@gmail.com**.
>
> — Theo, Pedro, Isaac, Guilherme e Luis Felipe

---

## Resumo de tipos de pergunta usados

| Tipo Google Forms | Quantas |
|---|---|
| Múltipla escolha (radio) | 12 |
| Caixa de seleção (checkbox) | 6 |
| Lista suspensa (dropdown) | 2 |
| Escala linear | 12 |
| Resposta curta | 4 |
| Parágrafo (texto longo) | 5 |
| **Total** | **41 campos** |

## Lógica condicional (resumo)

- **Q3.3** "sistema próprio" → mostra follow-up de texto curto.
- **Q5.1** = `Não, mas já testei` ou `Nunca usei` → pula Q5.2 e Q5.3.
- **Q6.4** = `Sim, testei` → Seções 7 e 8 visíveis, e Q9.1/Q9.2 (NPS) visíveis.
- **Q6.4** = `Não, ainda não testei` → pula direto pra Seção 9, oculta Q9.1 e Q9.2.

## Configurações recomendadas do Form

- ✅ Coletar emails: **desligado** (perguntar manualmente em Q9.4)
- ✅ Limitar a 1 resposta por pessoa: **desligado** (não exigir login)
- ✅ Permitir editar resposta após enviar: **ligado**
- ✅ Mostrar barra de progresso: **ligado**
- ✅ Embaralhar ordem das perguntas: **desligado**
- ✅ Mensagem de confirmação: customizada (ver Seção 10)
- ✅ Tema: verde/azul (alinhado com identidade visual a definir)
