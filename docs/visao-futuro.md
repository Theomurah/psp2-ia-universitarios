# Visão de Futuro — PSP2

> **Norte estratégico:** sair de um app de sintetização de documentos para um
> **sistema unificado de auxílio ao aluno movido por IA** — um hub único onde
> o estudante UnB centraliza material, prazos, comunicação, planejamento e
> tutoria, sem precisar pular entre SIGAA, Aprender, Moodle, Teams, Outlook e
> Drive a cada 10 minutos.

**Estratégia de execução em duas trilhas:**

- **Médio prazo** — primeiro virar a **camada de centralização**: trazer todos
  os sistemas que o aluno já usa pra dentro do PSP2 (integrações + inbox +
  planejamento), com base sólida de acessibilidade, LGPD e modelo de negócio
  sustentável.
- **Longo prazo** — depois aprofundar a **inteligência sobre essa base
  unificada**: evoluir o core de síntese, tutoria personalizada por aluno,
  reforço retroativo do histórico (gap analysis), hábito (gamificação),
  plataforma extensível e métrica de impacto real.

A ordem importa: integrar antes de aprofundar IA evita construir tutor genial
em cima de dados parciais.

---

# Trilha 1 — Médio prazo

## 1. Integrações com sistemas acadêmicos

A dor central: o aluno UnB hoje vive em 5+ sistemas paralelos. PSP2 quer ser
**a camada única** que lê e escreve neles.

### 1.1 SIGAA (sistema acadêmico UnB)
- Importar grade horária do semestre.
- Importar histórico, CR, disciplinas matriculadas.
- Ler notas e frequência (read-only).
- Avisos institucionais (matrícula, ajuste, trancamento).
- **Desafio:** SIGAA não tem API pública. Caminhos possíveis: scraper
  autenticado (frágil, alto risco), parceria institucional via UnB
  (caminho-ouro mas demorado), ou OAuth via Conta UnB se um dia existir.

### 1.2 Aprender / Aprender3 (Moodle UnB)
- Importar materiais postados (PDFs, slides, vídeos) → ingestão automática
  no pipeline de síntese.
- Ler datas de entrega (prazos de atividade, fórum, quiz).
- Espelhar mensagens do fórum no inbox unificado.
- **Caminho técnico:** Moodle tem **Web Services REST** (`mod_assign_*`,
  `core_calendar_*`). Exige token por usuário gerado nas preferências dele.

### 1.3 Moodle genérico (outras instituições / curso livre)
- Mesmo conector do Aprender mas com URL configurável.
- Permite uso por aluno fora da UnB (expansão de mercado futura).

### 1.4 Microsoft Teams
- Importar gravações de aula (canais de equipe) → transcrição + síntese.
- Espelhar mensagens (@menções, DMs) no inbox unificado.
- Calendário de reuniões consolidado.
- **Técnico:** Microsoft Graph API (OAuth2). Já temos o padrão de OAuth do
  Google Drive como referência.

### 1.5 Outlook (e-mail + calendário)
- Inbox de e-mail acadêmico filtrado por relevância (IA classifica
  "importante / informativo / spam acadêmico").
- Eventos de calendário consolidados no calendário unificado.
- Auto-resumo de threads longas com colegas / professores.
- **Técnico:** Microsoft Graph (mesmo SDK do Teams).

### 1.6 Google Workspace
- **Drive:** já existe parcialmente — expandir para watch de mudanças
  (sync delta) em vez de pull manual.
- **Gmail:** classificação + inbox unificado.
- **Calendar:** sync bidirecional com calendário do PSP2.
- **Meet:** transcrição de reuniões gravadas.

---

## 2. Inbox unificado de notificações

A feature-chave que conecta tudo. O aluno abre **uma única tela** e vê:

### 2.1 Agregação
- Mensagens de Teams, Outlook, Aprender (fórum), Moodle, SIGAA (avisos).
- Cada item normalizado num schema único: `{origem, remetente, assunto,
  preview, link_original, urgencia, prazo?, lido}`.

### 2.2 Priorização por IA
- Classificador que ordena por urgência real, não por timestamp.
  - Prazo de entrega hoje > e-mail do prof > aviso institucional > fórum.
- Aprende com o comportamento do aluno (o que ele abre, o que ignora).

### 2.3 Resumo diário / semanal
- Digest matinal: "Hoje você tem entrega de Cálculo às 23h59, aula de POO
  às 14h (sala mudou para PJC BT-070), 3 e-mails pendentes do orientador."
- Já temos uma skill `/resumo-diário-unb` — evolução natural.

### 2.4 Ações in-loco
- Responder e-mail do Outlook sem sair do PSP2.
- Marcar entrega como concluída no Aprender.
- Confirmar presença em evento do calendário.

### 2.5 Notificações push reais
- Web Push API + PWA installable.
- Configurável: "só me avise se prazo < 24h" ou "só @menções diretas".

---

## 3. Painel acadêmico visual moderno

O SIGAA é funcional mas visualmente datado e fragmentado — informação
crítica (CR, créditos, horário, conteúdos) está espalhada em telas lentas
e pouco legíveis. Esta seção é a **camada de apresentação** sobre os dados
que §1 trouxe: um painel moderno, visual e responsivo, com identidade UnB
([[CLAUDE.md]] §UI), que faz o aluno **sentir** o semestre num relance.

### 3.1 Dashboard do semestre atual
- Tela inicial: matérias do semestre como cards visuais (cor por
  disciplina, foto/ícone do prof, próxima aula, próximo prazo).
- Indicadores no topo: CR atual, CR projetado, créditos cursados /
  totais do curso, % do curso concluído.
- "Pulse" do dia: o que tem hoje + o que tem amanhã, sem ruído.

### 3.2 Horário visual (grade semanal)
- Grade segunda–sábado com blocos coloridos por matéria.
- Hover/click mostra: sala, prof, último conteúdo dado, próximo
  conteúdo previsto.
- Detecta mudanças de sala em tempo real (via §1.1 SIGAA / §1.2 Aprender).
- Modo "hoje" colapsado: só as aulas do dia, em timeline vertical.

### 3.3 Painel de notas
- Por matéria: avaliações já feitas, peso de cada uma, nota necessária
  na próxima pra fechar com X.
- Histórico do semestre: gráfico de evolução das notas.
- Projeção do CR ao final do semestre com base nas notas atuais +
  pesos restantes.
- Visual claro de "zona de aprovação / recuperação / reprovação".

### 3.4 Página por matéria
- Capa com identidade (cor, ícone, prof, ementa).
- Conteúdos: lista do que já foi dado, com link pra síntese
  correspondente (cross-link com §7 Estudos e Síntese).
- Avaliações: notas, pesos, datas.
- Materiais: PDFs/slides do Aprender, vídeos, links.
- Prazos próximos da matéria.
- Frequência: faltas / limite, com alerta visual de proximidade.

### 3.5 Linha do tempo do semestre
- Visualização horizontal do semestre com marcos: provas, entregas,
  feriados, semana de recesso, período de menção final.
- Zoom: semestre inteiro → mês → semana.
- Densidade visual mostra "semanas-furacão" pra planejar antes (entra
  como input do §4.2 Cronograma por IA).

### 3.6 Progresso no curso (fluxograma)
- Visualização do currículo do curso como grafo: matérias obrigatórias
  vs. optativas, pré-requisitos como setas.
- Estado de cada matéria: cursada (verde), em curso (amarelo UnB),
  pendente (cinza), trancada (riscado).
- Click numa matéria mostra: ementa, professores que dão, semestres
  recomendados.

### 3.7 Comparativo (opcional, opt-in)
- Notas vs. média da turma (se a integração SIGAA expuser).
- "Você está no top X% da disciplina" — útil pra autoavaliação,
  perigoso pra ansiedade. Default desligado, aluno escolhe ativar.

### 3.8 Modo "capa do semestre"
- Tela de boas-vindas semanal: resumo visual da semana que vem,
  recomendado pra abrir segunda de manhã.
- Tipo "Spotify Wrapped" mas do semestre acadêmico: principais
  conquistas, matérias-foco, gráfico de horas estudadas.

### 3.9 Design e identidade
- Respeita o design system UnB existente ([[CLAUDE.md]] §UI): verde
  `--primary`, azul `--secondary`, amarelo `--accent`, classes
  `.metric-card`, `.atividade-table`, etc.
- **Nunca** sidebar escura ou paleta paralela — o painel é seção do
  app, não outro app.
- Dark mode como peça de primeira classe (não só inversão de cores).
- Animações sutis (transições de estado, não decoração).
- Mobile-first: o aluno consulta horário/nota no celular entre aulas.

**Relação com outras seções:**
- Consome dados de §1 (Integrações).
- Diferente de §4 (Planejamento): §3 é **visualização** do estado
  acadêmico; §4 é **ação** sobre ele (cronograma, alertas, pomodoro).
- Materiais por matéria (§3.4) fazem cross-link com §8 (Estudos e
  Síntese) — onde a IA aprofunda o conteúdo.

---

## 4. Planejamento e produtividade

### 4.1 Calendário unificado
- Aulas (do SIGAA) + prazos (Aprender + Moodle) + eventos (Outlook +
  Google Calendar) num só lugar.
- Detecção de conflitos.
- Camada complementar à grade visual de §3.2: aqui o foco é
  **agendamento ativo** (criar bloco de estudo, mover compromisso),
  não só visualização.

### 4.2 Cronograma de estudos por IA
- Input: prazos + carga semanal disponível + estilo de estudo.
- Output: plano de revisão espaçada, blocos de pomodoro, marcos
  semanais.

### 4.3 Pomodoro integrado
- Timer dentro do app, com tracking por disciplina.
- "Você estudou 12h de Cálculo essa semana, 0h de Filosofia."

### 4.4 Detecção de sobrecarga
- Alerta quando a carga semanal projetada > horas disponíveis.
- Sugere repriorização.

### 4.5 Revisão espaçada (curva do esquecimento)
- Notifica "está na hora de revisar derivadas — você viu há 7 dias".

---

## 5. Acessibilidade

### 5.1 TTS (text-to-speech)
- Ouvir as sínteses no caminho pra UnB.

### 5.2 Modo dislexia / TDAH
- Fonte OpenDyslexic, espaçamento maior, modo foco (esconde tudo menos
  o conteúdo atual).

### 5.3 Síntese em múltiplos níveis
- Mesmo conteúdo em 3 versões: simplificada, padrão, técnica.

### 5.4 Tradução
- Material em inglês traduzido para pt-BR (e vice-versa para alunos
  estrangeiros / intercambistas).

### 5.5 Libras
- Avatar 3D ou vídeo de tradutor para conteúdo principal.

---

## 6. Privacidade, LGPD e IA responsável

A base já existe ([[project_lgpd_baseline]]) — futuro precisa endurecer.

### 6.1 Controle granular de permissões
- Aluno define exatamente o que cada integração pode ler/escrever.
- "Outlook só lê e-mails de domínio @unb.br" etc.

### 6.2 E2E encryption opcional
- Para sínteses sensíveis (TCC, pesquisa em andamento), chave derivada
  da senha do usuário — servidor não consegue ler.

### 6.3 Transparência da IA
- Toda síntese mostra: modelo usado, custo estimado, fontes usadas.
- Aluno pode ver o prompt completo enviado ao LLM.

### 6.4 Modo "zero retention"
- Conversa com tutor IA não é armazenada — útil para dúvidas pessoais
  ou conteúdo sensível.

### 6.5 Auditoria de acesso
- Log de quando cada integração leu o quê. Visível ao aluno.

---

## 7. Monetização sustentável

### 7.1 Freemium
- Free: X sínteses/mês, integrações básicas (Drive, Calendar).
- Pro: ilimitado, todas integrações, tutor IA.

### 7.2 Plano institucional
- UnB / departamento contrata licença para todos os alunos.
- Caminho longo mas alto impacto.

### 7.3 Bolsa social
- Aluno com Auxílio Permanência tem Pro gratuito.
- Marketing positivo + alinha com missão.

---

# Trilha 2 — Longo prazo

## 8. Estudos e síntese (evolução do core atual)

O que o PSP2 já faz, mas mais profundo e contextual.

### 8.1 Transcrição de aula
- Upload de áudio/vídeo da aula → transcrição (Whisper ou similar) →
  síntese com contexto da disciplina.
- Versão "vivo": gravação direta no PSP2 (PWA com `getUserMedia`).

### 8.2 Q&A sobre material da disciplina
- Chat por disciplina onde o aluno pergunta e a IA responde citando
  trechos do material já ingerido (RAG sobre a vector store da matéria).
- "Onde o professor falou sobre derivada parcial?" → link pro slide/aula.

### 8.3 Flashcards automáticos
- A partir de cada síntese, gerar deck de flashcards (Anki-compatible).
- Revisão espaçada integrada (SRS algorithm).

### 8.4 Quizzes e simulados
- Gerar prova de treino a partir do material da disciplina.
- Corrigir e identificar gaps de conhecimento.

### 8.5 Mapas mentais / diagramas
- A partir do material, gerar Mermaid / Excalidraw diagram automático.
- Útil pra disciplinas conceituais (Filosofia da Ciência, EDA).

### 8.6 Resumo cumulativo por disciplina
- "Resumo do semestre de Cálculo 2" — agrega todas as sínteses do
  semestre em um único documento de revisão pré-prova.

### 8.7 Comparação cruzada
- "O que esse autor (do PDF de Sociologia) diria sobre o argumento dos
  slides de Filosofia Política?" — RAG cross-disciplina.

---

## 9. Tutoria IA personalizada

O salto qualitativo: a IA conhece **esse aluno específico**.

### 9.1 Tutor por matéria
- Persona ajustada à didática do professor + nível atual do aluno.
- Mantém memória de quais conceitos o aluno já dominou / errou.

### 9.2 Explicação adaptativa
- Mesmo conceito explicado em 3 níveis: ELI5, intuitivo, formal.
- Aluno escolhe ou IA detecta pelo histórico.

### 9.3 Geração de exercícios extras
- "Quero mais 5 exercícios desse tipo, mais difíceis."
- Solver mostra passo a passo.

### 9.4 Correção de exercícios e provas antigas
- Upload de prova respondida → IA corrige + explica erros.
- Banco de provas antigas dos professores UnB (compartilhado, com
  consentimento).

### 9.5 Identificação de lacunas
- A partir de quizzes + flashcards errados, IA mapeia conceitos fracos.
- Sugere material de reforço (vídeos do YouTube, capítulos do PDF).

---

## 10. Reforço retroativo e gap analysis

Matérias passadas viraram crédito no histórico, mas o conhecimento nem
sempre acompanhou. Aluno que tirou 5,1 em Cálculo 1 três semestres atrás
carrega a lacuna pra Cálculo 2, EDO, Sinais e Sistemas — e o sistema
acadêmico atual ignora isso. PSP2 quer cruzar histórico + ementas +
material já ingerido pra detectar **proativamente** onde reforçar, antes
do gap virar problema na matéria atual.

### 10.1 Mapeamento conceitual por matéria cursada
- A partir da ementa oficial (via §1.1 SIGAA) + materiais já ingeridos
  (§1.2 Aprender, Drive), extrair um grafo de conceitos cobertos em
  cada matéria do histórico do aluno.
- Estado por conceito: data da última exposição, fonte (qual matéria
  cobriu), desempenho aproximado (nota da matéria, acertos em
  quiz/flashcard quando existirem).

### 10.2 Gap analysis automática
- Para cada matéria do semestre atual: olhar pré-requisitos formais
  e informais, cruzar com o mapeamento conceitual (§10.1), sinalizar
  conceitos fracos.
- Sinais de gap usados: nota < média na matéria de origem, muito
  tempo desde a última exposição (curva do esquecimento aplicada a
  semestres), ausência de revisão posterior.

### 10.3 Pré-requisito vivo (alerta proativo)
- Antes de cada novo tópico da matéria atual, IA avisa: "semana que
  vem o prof entra em Transformada de Laplace — você viu EDO há 2
  semestres com nota 6,2. Sugiro revisar X, Y, Z antes."
- Aparece na página da matéria (§3.4) e no digest matinal (§2.3),
  não como popup intrusivo.

### 10.4 Plano de reforço personalizado
- Bloco curto de revisão (15–30 min) gerado a partir dos gaps
  detectados, encaixado no cronograma do aluno (§4.2).
- Flashcards retroativos (§8.3) priorizados pelos conceitos mais
  frágeis e mais necessários no semestre atual.
- Micro-síntese sob demanda: "me explica derivada parcial assumindo
  que esqueci tudo desde Cálculo 2" — formato adaptativo (§9.2).

### 10.5 Modo "preparação para prova externa"
- ENADE, concursos públicos, OAB, residência médica, processo
  seletivo de mestrado: aluno escolhe o alvo, IA varre o histórico
  inteiro identificando conteúdos que caem na prova + nível atual
  de domínio por tema.
- Gera plano de retomada cobrindo só o que importa, com peso por
  recorrência na prova-alvo.

### 10.6 Linha do tempo conceitual
- Visualização sobreposta ao fluxograma do curso (§3.6): cada
  conceito do currículo com cor por "frescor" — verde (recente e
  dominado), amarelo (precisa revisar), vermelho (gap crítico).
- Permite ao aluno enxergar o currículo não como caixas de matéria
  isoladas, mas como uma rede viva de conhecimento que envelhece.

**Pré-requisitos para funcionar bem:**
- §1.1 (SIGAA com histórico + ementas) — sem isso, não há base de
  comparação.
- §8 (Estudos e síntese) — material ingerido alimenta o mapeamento
  conceitual.
- §9 (Tutoria IA) — entrega final da explicação de reforço.
- Idealmente §3.6 (fluxograma do curso) — substrato visual da §10.6.

---

## 11. Gamificação (com moderação)

⚠️ **Cuidado:** gamificação mal feita aumenta ansiedade. Aplicar só onde gera
hábito positivo, nunca como pressão social.

### 11.1 Streak de estudos
- Dias consecutivos com pelo menos 1 sessão. Pausa programada (férias)
  não quebra streak.

### 11.2 Conquistas
- "Sintetizou 10 PDFs", "Manteve revisão espaçada por 30 dias".

### 11.3 Ranking
- **Opcional e opt-in.** Default desligado. Restrito a grupo de amigos
  escolhido pelo próprio aluno. Nunca público.

---

## 12. Plataforma e infraestrutura

Não é feature de usuário, mas viabiliza tudo acima.

### 12.1 PWA installable
- Web Push, ícone na home, modo offline básico.

### 12.2 App mobile nativo
- iOS/Android — só depois que PWA validar demanda.

### 12.3 Modo offline
- Cache local das últimas sínteses, calendário, inbox.
- Sync diferencial quando voltar online.

### 12.4 Export universal
- Markdown, PDF, Notion, Obsidian, Anki.
- Já temos export LGPD — estender para formatos de produtividade.

### 12.5 API pública
- Permitir que alunos/devs construam integrações próprias.

### 12.6 Plugins / extensões
- SDK para terceiros adicionarem conectores (ex: aluno cria conector
  para a plataforma X que a universidade Y usa).

---

## 13. Métricas de sucesso (norte da feature)

Quando avaliar uma proposta nova, perguntar:

1. **Diminui número de abas abertas do aluno?** (Hipótese central: menos
   troca de contexto = mais foco.)
2. **Encaixa no fluxo de "10 min entre aulas"?** Latência total < 5s.
3. **Resolve dor real medida** (pesquisa, NPS, churn) — não dor
   imaginada por nós.
4. **Tem caminho LGPD claro?** Se não, descartar até resolver.
5. **Diferencial vs. Notion / Obsidian / ChatGPT?** Se a resposta é só
   "está integrado com UnB", o diferencial é frágil — precisa ser mais.

---

## Próximos passos sugeridos

**Antes de atacar a Trilha 1:**

1. **Validar com 10 alunos UnB** o ranking dentro das 7 seções aprovadas
   no médio prazo — qual integração / qual peça do inbox / qual ângulo
   do painel acadêmico é "must have".
2. **Spike técnico** dos conectores Moodle/Aprender (Web Services REST
   é a aposta mais barata para validar inbox unificado — começa por
   ela antes de Teams/Outlook).
3. **Definir métricas-base atuais** (DAU, sínteses/aluno, retenção D30)
   — sem isso, a Trilha 2 não consegue provar impacto depois.
4. **Reservar 1 sprint para débito técnico** ([[project_migrations_pendentes]])
   antes de expandir superfície do produto.

**Ordem sugerida dentro da Trilha 1:**

Acessibilidade (§5) e LGPD/transparência (§6) são transversais — devem
ser checklist em cada feature nova, não fase separada. Já o caminho
linear faz sentido como:

1. Integrações §1 (sem dado, nada do resto funciona)
2. Painel acadêmico §3 (primeira tela que prova "vale a pena conectar"
   — entrega valor com SIGAA/Aprender mesmo antes de Teams/Outlook)
3. Inbox unificado §2 (depois que o aluno já está no app diariamente)
4. Planejamento §4 (em cima de calendário/prazos/notas que §1+§3 trouxeram)
5. Monetização §7 (só faz sentido com 1–4 entregando valor real)

Inversão deliberada: §3 antes de §2 porque o painel acadêmico tem
retorno visual imediato e dá motivo pro aluno abrir o app todo dia,
mesmo que só Drive + SIGAA estejam conectados. Inbox unificado precisa
de Teams/Outlook conectados pra brilhar — vem em segundo momento.

---

_Última atualização: 2026-05-28_
