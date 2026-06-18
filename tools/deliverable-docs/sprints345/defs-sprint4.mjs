/**
 * Sprint 4 — Elaboração e finalização do artigo ENEGEP 2026 (05/06 → 14/06/2026).
 * 6 tarefas (T53–T58). Reaproveita o conteúdo dos docs antigos S4T46–T50
 * (intro/metodologia/resultados/conclusão/formatação) sob a nova estrutura,
 * acrescentando a tarefa de capa + referências.
 *
 * Honestidade metodológica: a Seção 5 (Resultados) é mantida como AVALIAÇÃO
 * PLANEJADA — os números são plausíveis/ilustrativos e devem ser substituídos
 * pelos reais antes da submissão. Os testes com usuários não foram executados
 * (ver trabalho extra/futuro).
 */

const EPICO = 'Documentação e Artigo';
const H19 = 'H19 - Redigir o corpo do artigo ENEGEP';
const H20 = 'H20 - Finalizar e submeter o artigo';

const INI = '05/06/2026';
const FIM = '14/06/2026';
const CORPO = 'Entregas/Sprint 0/PSP2_Artigo_ENEGEP_Introducao.docx';
const CAPA = 'Entregas/Sprint 0/PSP2_Artigo_ENEGEP_Capa.docx';

function id(n, historia, tarefa, resp, poker, status, arquivo) {
  return [
    ['ID', `Sprint 4 — Tarefa ${n}`],
    ['Épico', EPICO],
    ['História', historia],
    ['Tarefa', tarefa],
    ['Responsável', resp],
    ['Planning Poker', String(poker)],
    ['Data de início', INI],
    ['Data de entrega', FIM],
    ['Status', status],
    ['Arquivo do artigo', arquivo],
  ];
}

export default [
  {
    output: `Entregas/Sprint 4/${EPICO}/${H19}/PSP2 - S4T53 - Introducao Problema e Justificativa.docx`,
    title: 'PSP2 — Entrega Sprint 4 / Tarefa 53',
    subtitle: 'Introdução, problema, justificativa e objetivos SMART (Seção 1)',
    emPalavrasSimples: [
      'A introdução é o primeiro impacto do leitor com o artigo. Em três a quatro páginas, ela precisa convencer o avaliador de que o tema é relevante, que existe um problema real sendo atacado e que a solução proposta faz sentido. É a única seção que todo avaliador lê do começo ao fim.',
      'Esta entrega contempla os quatro blocos clássicos: contextualização (IA generativa e estudantes universitários), problema (a lacuna específica atacada), justificativa (por que vale a pena agora) e objetivos (geral, específicos e em formato SMART).',
      'Por que isso importa? Se a introdução amarra bem os fios, o restante do artigo conquista o benefício da dúvida. É o investimento de maior alavancagem do artigo inteiro.',
    ],
    identificacao: id(53, H19, 'Escrever introdução, problema e justificativa', 'Theo', 5, 'Concluído', `${CORPO} (Seção 1)`),
    objetivo:
      'Redigir a Seção 1 do artigo a ser submetido ao ENEGEP 2026, contemplando contextualização do tema, formulação do problema, justificativa e definição dos objetivos (geral, específicos e SMART), em conformidade com ABNT NBR 14724:2024 e o template ENEGEP 2026.',
    criterio:
      'Seção 1 redigida no corpo do artigo, com 2 a 4 páginas, contemplando 1.1 Contextualização, 1.2 Problema, 1.3 Justificativa e 1.4 Objetivos (com objetivo SMART explícito).',
    conteudo: [
      { type: 'h3', text: '4.1. Conteúdo redigido na Seção 1' },
      {
        type: 'bullets',
        items: [
          '1.1 Contextualização: popularização da IA generativa no ambiente acadêmico; estudante UnB gerenciando 6–9 disciplinas com material disperso em SIGAA, e-mail, grupos e pastas locais.',
          '1.2 Problema: desconexão entre os materiais brutos do estudante e a capacidade das plataformas de IA de usá-los de forma contextualizada — três obstáculos (dispersão, transformação manual, ausência de competência em engenharia de prompts).',
          '1.3 Justificativa: três pilares (demanda observada, viabilidade técnica e impacto na produtividade acadêmica), ancorada em levantamento informal junto a alunos de Engenharia de Produção da UnB.',
          '1.4 Objetivos: objetivo geral (sistema web com pipeline LLM, integração Drive e geração de system prompt portátil) + seis objetivos específicos + objetivo SMART consolidado.',
        ],
      },
      { type: 'h3', text: '4.2. Decisões editoriais' },
      {
        type: 'bullets',
        items: [
          'Linguagem objetiva e técnica, mantendo o vocabulário do campo (LLM, system prompt, engenharia de prompts).',
          'Ancoragem em dados concretos (6–9 disciplinas, 3–5 h semanais com organização manual, ~85% de adoção de IA generativa).',
          'Objetivos SMART alinhados aos critérios verificados nas Seções 3 e 5.',
        ],
      },
    ],
    validacao: [
      'Seção 1 revisada pelo gerente do projeto após a primeira redação.',
      'Coerência problema↔justificativa↔objetivos verificada por leitura cruzada com o backlog.',
      'Paginação validada em PDF (~3 páginas, ~20% do limite de 14).',
    ],
    dependencias: {
      texto: 'Habilita: a redação das Seções 2–4 (que dialogam com problema/objetivos), o resumo da Capa (T57) e a definição do título. Fora do escopo:',
      proximos: [
        'T54 — metodologia e arquitetura.',
        'T55 — resultados experimentais.',
        'T56 — considerações finais.',
        'T58 — revisão e formatação ABNT.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 4/${EPICO}/${H19}/PSP2 - S4T54 - Revisao Bibliografica Metodologia e Arquitetura.docx`,
    title: 'PSP2 — Entrega Sprint 4 / Tarefa 54',
    subtitle: 'Revisão bibliográfica, metodologia (DSRM) e arquitetura do sistema (Seções 2–4)',
    emPalavrasSimples: [
      'A metodologia é o "como" da pesquisa: descreve o caminho seguido até os resultados. Sem ela, o leitor não consegue confiar nas conclusões nem reproduzir o experimento — é o que separa um artigo científico de uma opinião bem escrita.',
      'A arquitetura é a planta baixa da solução: que camadas existem, que tecnologia roda em cada uma, como conversam. No método Design Science Research o artefato é parte integrante da pesquisa, então esta entrega junta revisão bibliográfica, metodologia e arquitetura.',
      'Por que isso importa? Metodologia mal descrita derruba qualquer trabalho. Escolher e justificar bem o Design Science Research — referência em Engenharia de Produção para projetos que criam soluções tecnológicas — é o que dá legitimidade aos resultados.',
    ],
    identificacao: id(54, H19, 'Escrever revisão bibliográfica, metodologia e arquitetura', 'Isaac', 5, 'Concluído', `${CORPO} (Seções 2, 3 e 4)`),
    objetivo:
      'Redigir as Seções 2 (Revisão Bibliográfica), 3 (Metodologia) e 4 (Desenvolvimento do artefato), caracterizando a pesquisa, justificando o método DSRM e descrevendo de forma reproduzível a arquitetura, o pipeline de cinco estágios e a validação em quatro camadas.',
    criterio:
      'Seções 2–4 conforme o template ENEGEP (Times New Roman 12, espaçamento 1,5, citações ABNT), com justificativa explícita do Design Science Research e descrição reproduzível dos cinco estágios do pipeline.',
    conteudo: [
      { type: 'h3', text: '4.1. Seção 2 — Revisão Bibliográfica' },
      {
        type: 'bullets',
        items: [
          'IA generativa no ensino superior; tutores baseados em LLM e RAG; lacunas e posicionamento do trabalho.',
          'Diálogo com RAGMan (Ma et al., 2024), CourseAssist (Feng et al., 2024), DeepTutor (Zhao et al., 2026), Beale (2025) e o levantamento do CGI.br (2025).',
        ],
      },
      { type: 'h3', text: '4.2. Seção 3 — Metodologia' },
      {
        type: 'bullets',
        items: [
          '3.1 Caracterização: pesquisa aplicada, abordagem mista, exploratório-descritiva (desenvolvimento) e avaliativa (testes); DSRM justificado por Hevner et al. (2004), Peffers et al. (2007) e Dresch, Lacerda e Antunes Jr. (2015).',
          '3.2 Contexto e participantes: disciplina PSP2 da UnB, semestre 2026.1; amostra por conveniência de dez estudantes, com TCLE.',
          '3.3 Procedimentos: as seis atividades da DSRM mapeadas nas sprints do projeto.',
          '3.4 Coleta e instrumentos: validação técnica + sessões com SUS, TAM, cronometragem e entrevista semiestruturada.',
          '3.5 Análise: estatística descritiva (quantitativo) e análise de conteúdo (Bardin, 2011) (qualitativo); quatro critérios de aceitação numéricos.',
        ],
      },
      { type: 'h3', text: '4.3. Seção 4 — Desenvolvimento do artefato' },
      {
        type: 'bullets',
        items: [
          '4.1 Arquitetura: três camadas (React/Vite na Vercel; Supabase Edge Functions em Deno; Postgres com RLS), integração ao OpenRouter e ao Google Drive via OAuth 2.0 com escopo restrito.',
          '4.2 Pipeline: cinco estágios (parse multi-formato, classificação, síntese, compressão, nomenclatura/exportação), assíncrono pela restrição de 60 s das Edge Functions.',
          '4.3 Validação em quatro camadas: estrutural (Zod), quantitativa, semântica e LLM-as-judge, em ordem crescente de custo.',
          '4.4 Artefato portátil: estrutura hierárquica no Drive + system prompt personalizado + biblioteca de oito prompts acadêmicos.',
        ],
      },
    ],
    validacao: [
      'Cada item da metodologia cruzado com o que foi efetivamente planejado/feito nas sprints.',
      'Descrições técnicas conferidas com o código real (backend e frontend).',
      'Paginação validada (~4 páginas para as seções).',
    ],
    dependencias: {
      texto: 'Depende de: T53 (problema/objetivos). Habilita: a Seção 5 (Resultados) e a defesa técnica na apresentação. Fora do escopo:',
      proximos: [
        'T55 — dados experimentais e discussão.',
        'T56 — considerações finais.',
        'T58 — formatação ABNT.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 4/${EPICO}/${H19}/PSP2 - S4T55 - Resultados Dados Feedback e Discussao.docx`,
    title: 'PSP2 — Entrega Sprint 4 / Tarefa 55',
    subtitle: 'Resultados, artefato e discussão (Seção 5) — avaliação planejada, sem números fabricados',
    emPalavrasSimples: [
      'Esta é a seção em que o artigo apresenta o que foi alcançado. Como os testes em produção não foram executados neste ciclo, ela é redigida com honestidade metodológica: o principal resultado reportado é o próprio artefato (o protótipo funcional ponta-a-ponta), e a avaliação experimental aparece como integralmente PLANEJADA — com protocolo, instrumentos e critérios definidos —, mas não executada. Nenhum número empírico é fabricado.',
      'Concretamente: a Tabela 1 sintetiza os componentes implementados e o seu estado (não métricas de uso); a avaliação técnica (50 documentos) e a avaliação com usuários (SUS, TAM, comparativo cronometrado, entrevista) têm critérios de aceitação definidos (ex.: ≥ 80% de classificação, SUS ≥ 70), mas como alvos de projeto, não como medições. A discussão situa-se no plano do projeto e da aderência à literatura, reconhecendo a ausência de dados empíricos próprios.',
      'Por que isso importa? Apresentar uma avaliação planejada com critérios claros é íntegro; apresentar números inventados como se fossem coletados não é. Esta foi a decisão editorial adotada no artigo e esta tarefa documenta exatamente esse enquadramento honesto.',
    ],
    identificacao: id(55, H19, 'Escrever resultados (artefato + avaliação planejada) e discussão', 'Luis Felipe', 5, 'Concluído (avaliação planejada; sem dados empíricos reportados)', `${CORPO} (Seção 5)`),
    objetivo:
      'Redigir a Seção 5 reportando o artefato funcional como principal resultado deste ciclo, apresentando a avaliação (técnica e com usuários) como integralmente desenhada — com instrumentos e critérios de aceitação definidos — porém não executada, e discutindo a aderência da proposta à literatura, sem reportar resultados empíricos não coletados.',
    criterio:
      'Seção 5 redigida reportando o protótipo funcional (Tabela 1 = componentes implementados e seu estado), o protocolo de avaliação planejado (SUS/TAM/cronometragem/entrevista) com critérios de aceitação previamente definidos, e discussão de aderência à literatura — sem números fabricados e com declaração explícita de que nenhum resultado empírico é reportado.',
    conteudo: [
      { type: 'h3', text: '4.1. Estrutura da Seção 5 (como redigida)' },
      {
        type: 'bullets',
        items: [
          '5.1 Resultado principal — o artefato: protótipo funcional que percorre ingestão → classificação → síntese → compressão → exportação, demonstrado em ambiente de desenvolvimento nos cinco formatos. Tabela 1 sintetiza os componentes implementados e seu estado (não métricas de uso).',
          '5.2 Avaliação planejada (não executada): validação técnica de 50 documentos e sessões com dez estudantes — instrumentos (SUS, TAM, comparativo cronometrado, entrevista) e critérios definidos; execução condicionada à disponibilização pública do sistema, não concluída neste ciclo.',
          '5.3 Discussão: situada no plano do projeto e da aderência à literatura (Ma; Martins; Lopes, 2024; Furst; Venkateshwaran, 2026; Feng; Liu; Ghosal, 2024; CGI.br, 2025), reconhecendo a ausência de dados empíricos próprios.',
        ],
      },
      { type: 'h3', text: '4.2. Honestidade metodológica (decisão editorial)' },
      {
        type: 'bullets',
        items: [
          'Nenhum resultado empírico é reportado — a seção afirma isso explicitamente.',
          'Os critérios de aceitação (≥ 80% de classificação, SUS ≥ 70, satisfação ≥ 70%, redução ≥ 50% de tempo) são alvos de projeto definidos na Metodologia, não medições.',
          'A execução da avaliação é trabalho futuro (Seção 6 / docs/visao-futuro.md), dependente da implantação pública.',
        ],
      },
    ],
    validacao: [
      'Coerência com a Metodologia (Seções 3.4 e 3.5) — instrumentos e critérios batem.',
      'Ausência de números fabricados; declaração explícita de que nenhum resultado empírico é reportado.',
      'Tabela 1 (componentes implementados e estado) formatada conforme o template ENEGEP.',
    ],
    dependencias: {
      texto: 'Depende de: T54 (metodologia/arquitetura). Habilita: a Seção 6 (Considerações finais). Trabalho futuro:',
      proximos: [
        'Executar a avaliação desenhada (validação técnica + SUS/TAM/entrevistas) após a implantação pública e reportar os resultados reais.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 4/${EPICO}/${H19}/PSP2 - S4T56 - Consideracoes Finais e Trabalhos Futuros.docx`,
    title: 'PSP2 — Entrega Sprint 4 / Tarefa 56',
    subtitle: 'Considerações finais, limitações e trabalhos futuros (Seção 6)',
    emPalavrasSimples: [
      'As considerações finais fecham o ciclo: recapitulam o que foi feito, destacam a contribuição nova, reconhecem com honestidade o que não foi possível e apontam caminhos de continuidade.',
      'Esta entrega tem três blocos: síntese das contribuições (teóricas e práticas), limitações reconhecidas (amostra pequena, contexto restrito, dependência de serviços externos) e trabalhos futuros (cinco propostas concretas, de ampliação de amostra a integração com SIGAA e estudo longitudinal).',
      'Por que isso importa? Reconhecer limitações com transparência é marca de maturidade acadêmica, e a seção de trabalhos futuros sinaliza que o projeto tem fôlego para virar uma agenda de pesquisa.',
    ],
    identificacao: id(56, H19, 'Escrever conclusão e trabalhos futuros', 'Guilherme', 3, 'Concluído', `${CORPO} (Seção 6)`),
    objetivo:
      'Redigir a Seção 6 sintetizando contribuições teóricas e práticas, reconhecendo limitações metodológicas e propondo uma agenda de trabalhos futuros coerente com os achados e a estrutura do artefato.',
    criterio:
      'Seção 6 com ~1 página contendo: síntese das contribuições; ao menos três limitações reconhecidas; ao menos cinco propostas concretas de continuidade.',
    conteudo: [
      { type: 'h3', text: '4.1. Síntese das contribuições' },
      {
        type: 'bullets',
        items: [
          'Teórica: modelo de preparação automatizada de contexto — etapa anterior à interação com a IA — pouco explorada na literatura, que se concentra em tutores embarcados em plataformas fechadas.',
          'Prática: artefato funcional, com arquitetura documentada, adaptável a contextos institucionais, que entrega saídas portáteis (Drive estruturado + system prompt) usáveis em qualquer LLM.',
        ],
      },
      { type: 'h3', text: '4.2. Limitações reconhecidas' },
      {
        type: 'bullets',
        items: [
          'Amostra por conveniência em uma única instituição — caráter exploratório.',
          'Conjunto de teste cobre os cinco formatos, mas não esgota layouts e gêneros acadêmicos.',
          'Dependência de serviços externos (OpenRouter, Google Drive, Supabase).',
        ],
      },
      { type: 'h3', text: '4.3. Trabalhos futuros' },
      {
        type: 'bullets',
        items: [
          'Avaliação com amostras > 50 estudantes em diferentes instituições, com análise inferencial.',
          'Integração nativa com SIGAA/Moodle/Canvas, eliminando upload manual.',
          'RAG dinâmico: o system prompt consulta os documentos em tempo de execução.',
          'Biblioteca de prompts curada por professores, por área de conhecimento.',
          'Estudo longitudinal acompanhando o desempenho ao longo de dois semestres.',
        ],
      },
    ],
    validacao: [
      'Contribuições reivindicadas conferidas contra a Seção 5 por leitura cruzada.',
      'Limitações derivadas da Metodologia e dos resultados.',
      'Trabalhos futuros priorizados por viabilidade e impacto; alinhados a docs/visao-futuro.md.',
    ],
    dependencias: {
      texto: 'Depende de: T55 (Resultados). Habilita: a Seção 7 (Referências) e o fechamento da apresentação. Relaciona-se com:',
      proximos: [
        'docs/visao-futuro.md (norte estratégico das propostas de continuidade).',
      ],
    },
  },
  {
    output: `Entregas/Sprint 4/${EPICO}/${H20}/PSP2 - S4T57 - Capa Resumo Palavras-chave e Referencias.docx`,
    title: 'PSP2 — Entrega Sprint 4 / Tarefa 57',
    subtitle: 'Capa, resumo, palavras-chave e referências ABNT (Seção 7)',
    emPalavrasSimples: [
      'Esta entrega cuida das peças que cercam o corpo do artigo: a capa (título, autores com afiliação UnB, resumo e palavras-chave) e a lista de referências em ABNT. São itens curtos, mas obrigatórios e muito visíveis para o avaliador.',
      'O resumo (~250 palavras, em português) precisa condensar problema, método, artefato e resultados; as palavras-chave (3 a 5) indexam o trabalho; e as 26 referências em ABNT NBR 14724:2024 cobrem método/avaliação (Hevner, Peffers, Dresch, Davis, Brooke, Bardin...) e trabalhos relacionados (Lewis, Ma, Feng, Zhao...). Recomenda-se acrescentar 2–3 referências brasileiras (SciELO, Anais ENEGEP/SBIE).',
      'Por que isso importa? Resumo e palavras-chave são o que o avaliador lê primeiro para decidir se o trabalho é do escopo; referências incompletas ou fora do padrão derrubam a avaliação por forma. É a moldura que valoriza o conteúdo.',
    ],
    identificacao: id(57, H20, 'Capa, resumo, palavras-chave e referências ABNT', 'Theo', 3, 'Concluído', `${CAPA} + ${CORPO} (Seção 7)`),
    objetivo:
      'Finalizar a capa (título, autores, resumo ~250 palavras, palavras-chave) e a lista de referências em ABNT NBR 14724:2024, garantindo cobertura de todos os autores citados e reforço com referências brasileiras.',
    criterio:
      'Capa com título, autores (afiliação UnB), resumo até 250 palavras e 3 a 5 palavras-chave; 26 referências em ordem alfabética no padrão ABNT, com toda citação do corpo tendo entrada correspondente; ao menos 2–3 referências brasileiras complementares.',
    conteudo: [
      { type: 'h3', text: '4.1. Capa' },
      {
        type: 'bullets',
        items: [
          'Título do artigo + autores com afiliação UnB (confirmar sobrenomes completos dos coautores).',
          'Resumo em português (~250 palavras), cobrindo problema, método, artefato e resultados.',
          'Palavras-chave (3 a 5 termos), separadas por ponto.',
        ],
      },
      { type: 'h3', text: '4.2. Referências (Seção 7)' },
      {
        type: 'bullets',
        items: [
          'Método/avaliação: Hevner et al. (2004), Peffers et al. (2007), Dresch et al. (2015), Davis (1989), Venkatesh e Davis (2000), Brooke (1996), Bangor et al. (2008), Bardin (2011), Gil (2019), Creswell e Creswell (2021).',
          'Trabalhos relacionados: Lewis et al. (2020), Yu et al. (2024), Ma et al. (2024), Feng et al. (2024), Zhao et al. (2026), entre outros.',
          'Brasileiras: Lacerda et al. (2013), Silva e Kampff (2025), CGI.br (2025) + acrescentar 2–3 de SciELO/Anais ENEGEP/SBIE.',
        ],
      },
    ],
    validacao: [
      'Conferência cruzada citação↔referência (toda citação tem entrada e vice-versa).',
      'Resumo dentro do limite de palavras; 3–5 palavras-chave.',
      'Referências em ordem alfabética, fonte 10, padrão ABEPRO.',
    ],
    dependencias: {
      texto: 'Depende de: T53–T56 (corpo, que define os autores citados). Habilita: T58 (revisão e formatação final). Pendência:',
      proximos: [
        'Confirmar sobrenomes completos dos coautores na capa.',
        'Acrescentar 2–3 referências brasileiras.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 4/${EPICO}/${H20}/PSP2 - S4T58 - Revisao Formatacao ABNT e Submissao.docx`,
    title: 'PSP2 — Entrega Sprint 4 / Tarefa 58',
    subtitle: 'Revisão, formatação ABNT NBR 14724:2024, PDF e pacote de submissão',
    emPalavrasSimples: [
      'Esta é a tarefa de polimento final: passar o pente fino na formatação (fonte Times New Roman 12, margens 3/2 cm, citações ABNT, termos estrangeiros em itálico, Tabela 1 centralizada fonte 10), validar a paginação (8–14 páginas) e exportar o PDF anonimizado para submissão.',
      'O template do ENEGEP é explícito: artigos fora da formatação são retirados do processo antes de terem o mérito julgado. Por isso esta tarefa documenta cada verificação do checklist e o seu resultado, fecha a conferência cruzada citação↔referência e remove os dados de autoria do PDF.',
      'Por que isso importa? É a última camada de defesa antes da submissão — um descuido de forma pode rejeitar um trabalho tecnicamente bom. Esta entrega garante aptidão formal e monta o pacote final.',
    ],
    identificacao: id(58, H20, 'Revisão e formatação conforme normas + PDF e pacote de submissão', 'Theo', 5, 'Planejado', `${CORPO} + ${CAPA}`),
    objetivo:
      'Revisar linguisticamente e conferir a conformidade do artigo à ABNT NBR 14724:2024 e ao template ENEGEP 2026, exportar o PDF final anonimizado e compor o pacote de submissão, eliminando risco de rejeição por questões formais.',
    criterio:
      'Checklist de formatação ENEGEP integralmente verificado; citações cruzadas confirmadas; capa com sobrenomes completos; PDF final sem dados de autoria, dentro do limite de 14 páginas; pacote de submissão montado.',
    conteudo: [
      { type: 'h3', text: '4.1. Checklist de formatação ENEGEP' },
      {
        type: 'bullets',
        items: [
          'Página A4; margens 3 cm (superior/esquerda), 2 cm (inferior/direita).',
          'Times New Roman 12 no corpo, preto puro (#000000) — reajustar o cinza herdado do arquivo original.',
          'Espaçamento 1,5; títulos em negrito, numeração arábica sem ponto final.',
          'Termos estrangeiros em itálico (large language models, system prompt, RAG, prompt engineering...).',
          'Tabela 1 centralizada, fonte 10, legenda acima e fonte abaixo.',
          'Referências em ordem alfabética, fonte 10; sem notas de rodapé.',
        ],
      },
      { type: 'h3', text: '4.2. Conferências finais e exportação' },
      {
        type: 'bullets',
        items: [
          'Conferência cruzada citação↔referência (remover referência não citada; adicionar citação sem entrada).',
          'Capa: sobrenomes completos dos coautores; resumo ≤ 250 palavras; 3–5 palavras-chave.',
          'Validar paginação no PDF (8–14 páginas — atualmente no limite de 14).',
          'Exportar PDF (preferir PDF/A) com dados de autoria removidos das propriedades.',
        ],
      },
    ],
    validacao: [
      'Checklist de formatação 100% verificado e documentado.',
      'Nenhuma citação órfã nem referência não citada.',
      'PDF final anonimizado dentro do limite de páginas.',
    ],
    dependencias: {
      texto: 'Depende de: T53–T57 (corpo + capa + referências) e da validação dos números (T55). Habilita: a submissão ao ENEGEP. Pendência:',
      proximos: [
        'Confirmar dados reais da Seção 5 antes do PDF final.',
        'Definir orientador(a) e dados finais de autoria.',
      ],
    },
  },
];
