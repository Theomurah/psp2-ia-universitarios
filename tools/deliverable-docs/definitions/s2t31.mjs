/**
 * Entrega Sprint 2 — Tarefa 31: Template base de system prompt parametrizável.
 */

export default {
  output:
    'Entregas/Sprint 2/Geração de Prompts/H7 - Desenvolver gerador de system prompt/PSP2 - S2T31 - Template System Prompt.docx',

  title: 'PSP2 — Entrega Sprint 2 / Tarefa 31',
  subtitle: 'Template Base de System Prompt Parametrizável — IMPLEMENTADA',

  emPalavrasSimples: [
    'O "produto final" do PSP2 é um system prompt — um texto que o aluno pode colar no ChatGPT, Claude ou Gemini e a IA passa a responder como se fosse uma tutora pessoal dele: ela sabe quais matérias o aluno tá fazendo, quais professores, e o que ele já estudou.',
    'Esta entrega define o "molde" desse texto — um template com lacunas marcadas tipo {{nome}}, {{materias}}, {{documentos}}. Ainda não tem dados — é só a estrutura. O molde inclui as regras de comportamento que queremos da IA: responder em português técnico, usar LaTeX pra fórmulas, citar os materiais do aluno, marcar quando algo "cai em prova", e nunca inventar bibliografia.',
    'Por que isso importa? Sem um template bem desenhado, a IA responde de forma genérica — qualquer um obteria a mesma coisa do ChatGPT puro. Com o template + dados do aluno, a IA fica realmente personalizada. Esse template é a "alma" do produto.',
  ],

  identificacao: [
    ['ID', 'Sprint 2 — Tarefa 31'],
    ['Épico', 'Geração de Prompts'],
    ['História', 'H7 — Desenvolver gerador de system prompt'],
    ['Tarefa', 'Criar template base de system prompt parametrizável'],
    ['Responsável', 'Guilherme'],
    ['Planning Poker', '2'],
    ['Data de início', '14/05/2026'],
    ['Data de entrega', '26/05/2026'],
    ['Status', 'Concluída'],
    ['Branch', 'feature/sprint1-finalization'],
    ['Commit', '(será preenchido após push)'],
  ],

  objetivo:
    'Definir o template base do system prompt personalizado do aluno, com placeholders {{var}} pra todos os dados que serão preenchidos automaticamente (T32). Implementar o renderizador determinístico — mesma entrada produz mesma saída, sem LLM no caminho.',

  criterio:
    'Função renderSystemPrompt(input) recebe { full_name, curso, semestre, materias, recent_documents, topicos_por_materia } e retorna uma string Markdown coerente. Todos os placeholders preenchidos. Casos extremos (sem matérias, sem docs, sem tópicos) mostram fallback gracioso em vez de "undefined" ou seções vazias.',

  conteudo: [
    { type: 'h3', text: '4.1. Arquivo criado' },
    {
      type: 'body',
      text: 'supabase/functions/_shared/system-prompt.ts — 95 linhas. Exporta SYSTEM_PROMPT_TEMPLATE (string), renderSystemPrompt (função) e buildSemesterSnapshot (helper de invalidação).',
    },
    { type: 'h3', text: '4.2. Placeholders disponíveis' },
    {
      type: 'table',
      columnWidths: [2900, 6460],
      headers: ['Placeholder', 'Fonte / Significado'],
      rows: [
        ['{{nome}}', 'profile.full_name. Fallback: "Aluno(a)".'],
        ['{{curso}}', 'profile.curso. Fallback: "—".'],
        ['{{semestre}}', 'profile.semestre_atual. Ex: "2026.1".'],
        ['{{lista_materias_detalhada}}', 'Linhas tipo "- **FISICA3** (Física 3) — Prof(s): Fábio Lima". Fallback: "(nenhuma matéria cadastrada)".'],
        ['{{lista_documentos_recentes}}', 'Últimos 20 docs processados, formato "- FISICA3 · Aula: 12 — Lei de Coulomb". Fallback: "(ainda sem documentos processados)".'],
        ['{{lista_topicos_por_materia}}', 'Agregado de topicos_extraidos do generated_content, formato "- **FISICA3**: campo, carga, distância". Fallback: "(nenhum tópico identificado ainda)".'],
      ],
    },
    { type: 'h3', text: '4.3. Estrutura do template' },
    {
      type: 'bullets',
      items: [
        'Cabeçalho: "Você é assistente acadêmico personalizado de {{nome}}, aluno(a) de {{curso}} no semestre {{semestre}}."',
        'Seção "Contexto do aluno" — perfil + lista de matérias com profs.',
        'Seção "Documentos já processados" — última atividade do aluno.',
        'Seção "Como você deve responder" — 7 regras (linguagem, LaTeX, estruturação, referências, erros comuns, provas, estilo).',
        'Seção "Tópicos centrais por matéria" — extraído das sínteses já feitas.',
        'Seção "Restrições" — não inventar bibliografia, marcar [verificar com o professor], resolução passo a passo, não substituir aula.',
      ],
    },
    { type: 'h3', text: '4.4. Trecho do template (regras-chave)' },
    {
      type: 'code',
      code: `## Como você deve responder

1. **Linguagem**: português do Brasil, técnica mas didática. Use analogias quando ajudar.
2. **Fórmulas**: sempre em LaTeX ($$F = ma$$ ou inline $\\vec{r}$). Resultados finais em $\\boxed{}$.
3. **Estruturação**: respostas longas em seções com ## e ###. Use tabelas pra dados numéricos.
4. **Referências**: cite o material do aluno quando aplicável ("Você viu isso no documento X").
5. **Erros comuns**: ao explicar conceitos, inclua armadilhas e como evitá-las.
6. **Provas**: quando o aluno mencionar prova/avaliação, foque em pontos cobrados e flag "⚠️ COBRADO NA PROVA" se a fonte indicar.
7. **Estilo**: direto, sem rodeios. Nada de "Claro!", "Ótima pergunta!", "Vou te ajudar!".`,
    },
    { type: 'h3', text: '4.5. buildSemesterSnapshot — invalidação' },
    {
      type: 'body',
      text: 'Função que produz uma string-hash dos inputs relevantes (semestre + matérias ordenadas + docs recentes). Determinística e estável. Salva como semester_snapshot no user_system_prompts; se mudar, o prompt é regerado; se for o mesmo, reusa o ativo (sem nova versão).',
    },
  ],

  validacao: [
    '13 testes unitários cobrem rendering com/sem cada lista, profs opcionais, determinismo, limite de docs, snapshot estável a ordem das matérias.',
    'Mesma entrada → mesma saída (não usa LLM, não usa random).',
    'Fallbacks graciosos: nunca exibe "undefined" nem deixa seção vazia sem aviso.',
    'Reusa o mesmo motor de placeholders {{var}} de prompts.ts (renderPrompt) — uma só verdade.',
  ],

  dependencias: {
    texto: 'Habilita T32 (Edge Function que junta dados e renderiza). Depende de:',
    proximos: [
      'T08 (formato/regras dos prompts originais) — usado como base de estilo.',
      'Iteração com o time: revisar a tonalidade das regras (vs. assistente padrão).',
      'A/B test futuro: prompt original vs. versão simplificada — fora de escopo do MVP.',
    ],
  },
};
