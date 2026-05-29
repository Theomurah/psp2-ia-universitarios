/**
 * PSP2 — IA para Universitários
 * Apps Script que gera o Google Form de validação de hipóteses + feedback do MVP.
 *
 * COMO USAR:
 *   1. Acesse https://script.google.com e crie um novo projeto.
 *   2. Cole TODO o conteúdo deste arquivo em Code.gs (substitua o existente).
 *   3. Salve (Ctrl+S) e execute a função `createPSP2Form` uma vez.
 *   4. Autorize o acesso quando o Google pedir.
 *   5. O link de edição e o link público aparecem no log de execução (Ver > Logs).
 *
 * REGENERAR: cada execução cria um NOVO formulário. Para atualizar um existente,
 * abra o form criado e edite manualmente, ou apague-o antes de rodar de novo.
 */

function createPSP2Form() {
  const form = FormApp.create('PSP2 — IA para Universitários: pesquisa de validação + MVP')
    .setDescription(
      'Oi! Somos um time da disciplina PSP2 da UnB construindo uma ferramenta que organiza ' +
      'e sintetiza seus materiais de aula com IA, exporta direto pro seu Google Drive e gera ' +
      'prompts personalizados pro seu curso.\n\n' +
      'Essa pesquisa leva 6 a 15 minutos (depende se você testou o MVP ou não). ' +
      'Suas respostas são anônimas por padrão — só pedimos email no final, e é opcional.\n\n' +
      'Obrigado pelo tempo! 🎓\n\n' +
      'Conformidade LGPD: dados coletados serão usados apenas para fins acadêmicos da disciplina PSP2 — UnB 2026.1.'
    )
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setAllowResponseEdits(true)
    .setProgressBar(true)
    .setShuffleQuestions(false)
    .setConfirmationMessage(
      'Valeu demais! 🙌\n\nSua resposta foi registrada e vai ajudar diretamente o time do PSP2 ' +
      'a priorizar o que construir nas próximas sprints.\n\n' +
      'Se deixou email e topou entrevista, te chamamos em breve. ' +
      'Qualquer dúvida: theo.murah@gmail.com.\n\n' +
      '— Theo, Pedro, Isaac, Guilherme e Luis Felipe'
    );

  // ============================================================
  // SEÇÃO 1 — Perfil acadêmico
  // ============================================================
  form.addSectionHeaderItem()
    .setTitle('1. Perfil acadêmico')
    .setHelpText('Cinco perguntas rápidas pra entender quem você é.');

  form.addListItem()
    .setTitle('Qual sua idade?')
    .setRequired(true)
    .setChoiceValues(['16-18', '19-21', '22-24', '25-28', '29-34', '35+']);

  form.addTextItem()
    .setTitle('Qual sua universidade?')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Qual seu curso?')
    .setRequired(true);

  form.addListItem()
    .setTitle('Em que semestre você está?')
    .setRequired(true)
    .setChoiceValues(['1º-2º', '3º-4º', '5º-6º', '7º-8º', '9º+', 'Pós-graduação']);

  form.addMultipleChoiceItem()
    .setTitle('Modalidade do seu curso:')
    .setRequired(true)
    .setChoiceValues(['Presencial', 'Híbrido', 'EAD/Remoto']);

  // ============================================================
  // SEÇÃO 2 — Comportamento atual com material de estudo
  // ============================================================
  form.addPageBreakItem()
    .setTitle('2. Como você lida com material de estudo hoje');

  form.addMultipleChoiceItem()
    .setTitle('Quantos documentos acadêmicos (PDFs, slides, livros, notas) você costuma acumular por semestre?')
    .setChoiceValues(['Menos de 20', '20–50', '50–100', '100–200', 'Mais de 200', 'Não faço ideia']);

  form.addCheckboxItem()
    .setTitle('Onde você armazena seu material de estudo? (marque todos)')
    .setChoiceValues([
      'Google Drive',
      'OneDrive',
      'Dropbox',
      'iCloud',
      'Pasta local no computador',
      'Pendrive/HD externo',
      'Notion/Obsidian/similares',
      'WhatsApp (grupos da turma)',
      'Email',
      'Não organizo / fica espalhado',
      'Outro'
    ]);

  form.addMultipleChoiceItem()
    .setTitle('Como você organiza esse material?')
    .setChoiceValues([
      'Pastas por disciplina',
      'Pastas por semestre',
      'Pastas por tipo de arquivo',
      'Não organizo, busco quando preciso',
      'Tenho um sistema próprio'
    ]);

  form.addTextItem()
    .setTitle('Se respondeu "sistema próprio" acima, descreva brevemente:')
    .setRequired(false);

  form.addScaleItem()
    .setTitle('"Tenho dificuldade em encontrar um material específico que já salvei."')
    .setBounds(1, 5)
    .setLabels('Discordo totalmente', 'Concordo totalmente');

  // ============================================================
  // SEÇÃO 3 — Dores e fricções
  // ============================================================
  form.addPageBreakItem()
    .setTitle('3. Dores e fricções no dia a dia acadêmico');

  form.addScaleItem()
    .setTitle('"Gasto muito tempo resumindo/sintetizando material das aulas."')
    .setBounds(1, 5)
    .setLabels('Discordo totalmente', 'Concordo totalmente');

  form.addMultipleChoiceItem()
    .setTitle('Quanto tempo, em média, você gasta por semana só organizando ou revisando material?')
    .setChoiceValues(['Menos de 1h', '1–3h', '3–6h', '6–10h', 'Mais de 10h']);

  form.addMultipleChoiceItem()
    .setTitle('Você já perdeu prazo de entrega ou foi mal em prova por desorganização de material?')
    .setChoiceValues(['Sim, várias vezes', 'Sim, uma ou duas', 'Não, mas chegou perto', 'Nunca']);

  form.addCheckboxItem()
    .setTitle('Quais são suas 3 maiores dores com material acadêmico hoje? (marque até 3)')
    .setHelpText('Marque no máximo 3 opções.')
    .setChoiceValues([
      'Volume grande, não consigo absorver tudo',
      'Material espalhado em várias plataformas',
      'Slides do professor são ruins / incompletos',
      'Não consigo resumir bem o que estudo',
      'Esqueço o que estudei poucos dias depois',
      'Falta tempo pra revisar',
      'Difícil cruzar conteúdo entre disciplinas',
      'Não sei por onde começar quando vou estudar',
      'Outro'
    ]);

  // ============================================================
  // SEÇÃO 4 — Uso atual de IA generativa
  // ============================================================
  form.addPageBreakItem()
    .setTitle('4. Como você usa IA generativa nos estudos');

  form.addMultipleChoiceItem()
    .setTitle('Você usa alguma ferramenta de IA generativa (ChatGPT, Claude, Gemini, Copilot etc.) para estudar?')
    .setChoiceValues([
      'Sim, diariamente',
      'Sim, algumas vezes por semana',
      'Sim, esporadicamente',
      'Não, mas já testei',
      'Nunca usei'
    ]);

  form.addCheckboxItem()
    .setTitle('Quais ferramentas você usa? (marque todas)')
    .setHelpText('Se respondeu "Não" ou "Nunca usei" na pergunta anterior, pule esta.')
    .setChoiceValues([
      'ChatGPT',
      'Claude',
      'Gemini / Google AI Studio',
      'Copilot (Microsoft)',
      'Perplexity',
      'NotebookLM',
      'Outras'
    ]);

  form.addCheckboxItem()
    .setTitle('Pra que você usa IA nos estudos? (marque todos)')
    .setChoiceValues([
      'Resumir textos longos',
      'Tirar dúvidas sobre conceitos',
      'Gerar questões de prática / simulado',
      'Reescrever / revisar trabalhos',
      'Traduzir material',
      'Buscar referências bibliográficas',
      'Criar flashcards',
      'Brainstorm de ideias',
      'Programação / código',
      'Outro'
    ]);

  form.addScaleItem()
    .setTitle('"A IA dá respostas genéricas, sem conhecer meu curso / disciplina / professor."')
    .setBounds(1, 5)
    .setLabels('Discordo totalmente', 'Concordo totalmente');

  form.addMultipleChoiceItem()
    .setTitle('Você já criou ou usou prompts personalizados / GPTs customizados para o seu contexto acadêmico?')
    .setChoiceValues([
      'Sim, criei do zero',
      'Sim, usei prontos',
      'Já tentei mas desisti',
      'Não, nem sabia que dava',
      'Não, não vi necessidade'
    ]);

  // ============================================================
  // SEÇÃO 5 — Disposição à solução + bifurcação MVP
  // ============================================================
  form.addPageBreakItem()
    .setTitle('5. Sobre a solução que estamos construindo');

  form.addScaleItem()
    .setTitle(
      'Imagina uma ferramenta que organiza e sintetiza todo o seu material acadêmico via IA, ' +
      'exporta direto pro seu Google Drive e gera prompts personalizados pro seu curso. ' +
      'Quanto isso te interessa?'
    )
    .setBounds(1, 5)
    .setLabels('Nada', 'Muito');

  form.addCheckboxItem()
    .setTitle('Das features abaixo, quais seriam mais valiosas pra você? (marque até 4)')
    .setHelpText('Marque no máximo 4 opções.')
    .setChoiceValues([
      'Upload em lote de PDFs, slides, livros',
      'Síntese automática por disciplina',
      'Geração de resumos em formatos diversos (flashcard, mapa mental, etc.)',
      'System prompt customizado pro meu curso/professor',
      'Biblioteca de prompts acadêmicos prontos',
      'Exportação automática pro Google Drive',
      'Cruzamento de conteúdo entre disciplinas',
      'Geração de questões de prática',
      'Plano de estudos personalizado'
    ]);

  form.addMultipleChoiceItem()
    .setTitle('Se essa ferramenta existisse e funcionasse bem, quanto você pagaria por mês?')
    .setChoiceValues([
      'Nada — só uso se for grátis',
      'Até R$ 10',
      'R$ 11–25',
      'R$ 26–50',
      'R$ 51–100',
      'Mais de R$ 100'
    ]);

  // Pergunta de bifurcação — criada agora SEM choices.
  // As choices serão definidas no final, depois que todas as páginas existirem.
  const ramificacao = form.addMultipleChoiceItem()
    .setTitle('Você já testou o MVP do PSP2 (a versão atual da ferramenta)?')
    .setRequired(true);

  // ============================================================
  // SEÇÃO 6 — Contexto do teste do MVP (condicional)
  // ============================================================
  const pageContextoMVP = form.addPageBreakItem()
    .setTitle('6. Contexto do seu teste no MVP')
    .setHelpText('Perguntas rápidas sobre como você experimentou a ferramenta.');

  form.addMultipleChoiceItem()
    .setTitle('Quanto tempo você gastou testando o MVP?')
    .setChoiceValues(['Menos de 5 min', '5–15 min', '15–30 min', '30–60 min', 'Mais de 1h']);

  form.addCheckboxItem()
    .setTitle('Quais features você chegou a testar? (marque todas)')
    .setChoiceValues([
      'Login (Google ou email)',
      'Upload de documentos (drag-and-drop)',
      'Dashboard de status do processamento',
      'Preview de documento',
      'Tela de configuração',
      'Geração de síntese via LLM',
      'Exportação para Google Drive',
      'Geração de system prompt personalizado',
      'Biblioteca de prompts acadêmicos'
    ]);

  form.addMultipleChoiceItem()
    .setTitle('Em que dispositivo você testou?')
    .setChoiceValues(['Notebook/Desktop', 'Tablet', 'Celular']);

  // ============================================================
  // SEÇÃO 7 — Feedback do MVP (condicional, vem logo após contexto)
  // ============================================================
  form.addPageBreakItem()
    .setTitle('7. Feedback detalhado do MVP');

  form.addScaleItem()
    .setTitle('"Foi fácil entender o que a ferramenta faz logo que abri."')
    .setBounds(1, 5)
    .setLabels('Discordo totalmente', 'Concordo totalmente');

  form.addMultipleChoiceItem()
    .setTitle('O upload de arquivos funcionou bem?')
    .setChoiceValues(['Não testei', '1 — não funcionou', '2', '3', '4', '5 — funcionou perfeitamente']);

  form.addCheckboxItem()
    .setTitle('Quais formatos você tentou subir? (marque todos)')
    .setChoiceValues(['PDF', 'DOCX', 'PPTX', 'Markdown (.md)', 'TXT', 'Imagens (JPG/PNG)', 'Outro', 'Não fiz upload']);

  form.addMultipleChoiceItem()
    .setTitle('As sínteses / resumos gerados pela IA foram úteis?')
    .setChoiceValues(['Não testei', '1 — nada útil', '2', '3', '4', '5 — muito útil']);

  form.addMultipleChoiceItem()
    .setTitle('A exportação para Google Drive funcionou e organizou bem o conteúdo?')
    .setChoiceValues(['Não testei', '1 — não funcionou', '2', '3', '4', '5 — funcionou perfeitamente']);

  form.addMultipleChoiceItem()
    .setTitle('O system prompt personalizado que a ferramenta gerou fez sentido pro seu contexto?')
    .setChoiceValues(['Não testei', '1 — nada a ver', '2', '3', '4', '5 — fez muito sentido']);

  form.addMultipleChoiceItem()
    .setTitle('A biblioteca de prompts acadêmicos foi útil?')
    .setChoiceValues(['Não testei', '1 — nada útil', '2', '3', '4', '5 — muito útil']);

  form.addParagraphTextItem()
    .setTitle('Bugs ou problemas que você encontrou:')
    .setHelpText('Descreva o que aconteceu, em qual feature, e se conseguiu reproduzir.')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('O que mais te impressionou positivamente no MVP?')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('O que mais te frustrou ou decepcionou?')
    .setRequired(false);

  form.addScaleItem()
    .setTitle('Qual a chance de você recomendar o PSP2 IA Universitários pra um colega?')
    .setHelpText('0 = não recomendaria. 10 = recomendaria com certeza.')
    .setBounds(0, 10)
    .setLabels('Não recomendaria', 'Recomendaria com certeza');

  form.addParagraphTextItem()
    .setTitle('Por que você deu essa nota? (justifique)')
    .setRequired(false);

  // ============================================================
  // SEÇÃO 8 — Encerramento (para todos)
  // ============================================================
  const pageEncerramento = form.addPageBreakItem()
    .setTitle('8. Encerramento');

  form.addMultipleChoiceItem()
    .setTitle('Você toparia participar de uma entrevista qualitativa de ~20 minutos com nosso time?')
    .setChoiceValues(['Sim, podem me chamar', 'Talvez, depende do horário', 'Não, obrigado(a)']);

  form.addTextItem()
    .setTitle('Email (opcional — só pra entrevista e/ou avisos do lançamento)')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('Quer compartilhar mais alguma coisa que esse questionário não cobriu?')
    .setRequired(false);

  // ============================================================
  // CONFIGURAR RAMIFICAÇÃO CONDICIONAL
  // Agora que todas as páginas existem, conectamos as choices da Q6.4.
  // ============================================================
  ramificacao.setChoices([
    ramificacao.createChoice('Sim, testei', pageContextoMVP),
    ramificacao.createChoice('Não, ainda não testei', pageEncerramento)
  ]);

  // ============================================================
  // LOGS FINAIS
  // ============================================================
  const editUrl = form.getEditUrl();
  const publicUrl = form.getPublishedUrl();
  Logger.log('Formulário criado com sucesso!');
  Logger.log('Editar (privado): ' + editUrl);
  Logger.log('Compartilhar (público): ' + publicUrl);
  Logger.log('ID do form: ' + form.getId());
}
