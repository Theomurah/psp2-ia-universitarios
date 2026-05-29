/**
 * Entrega Sprint 2 — Tarefa 34: Tela /prompts no frontend.
 */

export default {
  output:
    'Entregas/Sprint 2/Geração de Prompts/H7 - Desenvolver gerador de system prompt/PSP2 - S2T34 - Tela de Prompts.docx',

  title: 'PSP2 — Entrega Sprint 2 / Tarefa 34',
  subtitle: 'Tela /prompts com Cards Copiáveis — IMPLEMENTADA',

  emPalavrasSimples: [
    'Esta entrega é a interface no app onde o aluno vê os 8 prompts oficiais (T33), filtra por categoria, preenche os campos personalizados ({{materia}}, {{topico}}, etc.), e copia com 1 clique. O texto copiado já está pronto pra colar em ChatGPT/Claude/Gemini.',
    'A página inclui: barra de busca (filtra por título, descrição ou conteúdo do template), tabs de filtro por categoria (todas/estudo/exercício/redação/revisão), e cards organizados em grid responsivo. Cada card mostra o preview do prompt; se tiver placeholders, mostra um expansível "Personalizar" com inputs.',
    'Importante: clicar "Copiar" também incrementa o contador de uso (usage_count) — telemetria pro time saber quais prompts os alunos realmente usam. Esse contador é melhor que NPS pra refinar a curadoria.',
  ],

  identificacao: [
    ['ID', 'Sprint 2 — Tarefa 34'],
    ['Épico', 'Geração de Prompts'],
    ['História', 'H7 — Desenvolver gerador de system prompt'],
    ['Tarefa', 'Tela de visualização e cópia dos prompts'],
    ['Responsável', 'Pedro'],
    ['Planning Poker', '3'],
    ['Data de início', '14/05/2026'],
    ['Data de entrega', '26/05/2026'],
    ['Status', 'Concluída'],
    ['Branch', 'feature/sprint1-finalization'],
    ['Commit', '(será preenchido após push)'],
  ],

  objetivo:
    'Criar a página /prompts no frontend que (1) lista prompts oficiais + próprios do usuário (via RLS), (2) permite filtrar por categoria ou buscar por texto, (3) renderiza cada prompt em card com inputs editáveis pros placeholders, (4) copia pro clipboard o prompt final com placeholders substituídos, (5) incrementa o contador de uso.',

  criterio:
    'Aluno autenticado acessa /prompts e vê os 8 prompts oficiais agrupados por categoria. Pode buscar por título ou conteúdo. Pode preencher placeholders num card e clicar "Copiar" — recebe toast de confirmação. usage_count incrementa após cópia.',

  conteudo: [
    { type: 'h3', text: '4.1. Arquivos criados' },
    {
      type: 'table',
      columnWidths: [4500, 4860],
      headers: ['Arquivo', 'Responsabilidade'],
      rows: [
        ['apps/web/src/routes/PromptsPage.tsx', 'Página principal com toolbar (busca + filtros) + grid de cards agrupado por categoria.'],
        ['apps/web/src/components/PromptCard.tsx', 'Card individual com header (título + selo Oficial + tag de categoria), descrição, expansível "Personalizar" (inputs por placeholder), preview e botão Copiar.'],
        ['apps/web/src/hooks/usePromptLibrary.ts', 'Hook React Query: usePromptLibrary (read) e useIncrementPromptUsage (write).'],
        ['apps/web/src/App.tsx (atualizado)', 'Adiciona rota /prompts + link no topbar.'],
        ['apps/web/src/index.css (atualizado)', 'Estilos da página + cards (+150 linhas).'],
      ],
    },
    { type: 'h3', text: '4.2. UX em palavras' },
    {
      type: 'bullets',
      items: [
        'Topo: título "Biblioteca de Prompts" + frase de contexto.',
        'Toolbar: input de busca (full-text) + tabs de categoria.',
        'Body: seções por categoria (Estudo, Exercício, Redação, Revisão) com grid 1-3 colunas responsivo.',
        'Card: header com título + tags coloridas (categoria + Oficial em azul-UnB).',
        'Card: <details> "Personalizar (N variáveis)" — quando aberto, inputs por placeholder em mini-grid.',
        'Card: preview em monospaced truncado a 280 chars.',
        'Card footer: contador de usos (se > 0) à esquerda; botão primário "Copiar" à direita.',
        'Pós-cópia: toast verde "Prompt copiado — Cole em qualquer IA".',
      ],
    },
    { type: 'h3', text: '4.3. Extração de placeholders' },
    {
      type: 'body',
      text: 'O componente PromptCard escaneia o template com regex /\\{\\{(\\w+)\\}\\}/g e produz a lista de placeholders únicos. Se o template não tem placeholders, o expansível "Personalizar" não aparece — só o preview e o botão Copiar.',
    },
    {
      type: 'code',
      code: `function extractPlaceholders(template) {
  const re = /\\{\\{(\\w+)\\}\\}/g;
  const found = new Set();
  let m;
  while ((m = re.exec(template)) !== null) found.add(m[1]);
  return Array.from(found);
}

function renderPromptTemplate(template, values) {
  return template.replace(/\\{\\{(\\w+)\\}\\}/g, (_, key) => {
    const v = values[key];
    return v ? v : \`{{\${key}}}\`;  // mantém placeholder vazio (visível na cópia)
  });
}`,
    },
    { type: 'h3', text: '4.4. Cópia e telemetria' },
    {
      type: 'body',
      text: 'O handler de Copiar chama navigator.clipboard.writeText e em paralelo dispara useIncrementPromptUsage que faz select + update do usage_count. Não dá erro fatal se o update falhar (prompts oficiais não permitem update por aluno via RLS — comportamento esperado, silencioso).',
    },
    { type: 'h3', text: '4.5. Acessibilidade' },
    {
      type: 'bullets',
      items: [
        'Filtros são <button role="tab" aria-selected> — keyboard navigation.',
        'Busca tem <input type="search" aria-label>.',
        'Cards têm <article> semantic.',
        'Toast usa role="status" pra screen reader.',
      ],
    },
    { type: 'h3', text: '4.6. Estilos' },
    {
      type: 'body',
      text: '~150 linhas de CSS adicionadas em index.css. Usa as CSS vars já definidas (--primary, --bg-muted, --border, --text-muted). Cores das tags por categoria: estudo=azul (#3B82F6), exercício=verde (#10B981), redação=roxo (#A855F7), revisão=âmbar (#F59E0B). Selo "Oficial" usa azul-UnB (#1F3864).',
    },
  ],

  validacao: [
    'npm run build conclui sem erros TypeScript.',
    'Página acessível só após login + onboarding (RequireAuth requireOnboarding).',
    'Filtro por categoria atualiza a grid instantaneamente.',
    'Busca filtra por título + descrição + conteúdo do template.',
    'Estado vazio mostrado quando filtros não encontram nada ("Nenhum prompt encontrado…").',
    'Botão "Copiar" abre toast verde de confirmação.',
    'usage_count incrementa para prompts que o usuário pode atualizar (próprios); para oficiais, falha silenciosa (esperado por RLS).',
  ],

  dependencias: {
    texto: 'Depende de: T33 (biblioteca populada), schema prompt_library (migration 0001). Habilita:',
    proximos: [
      'Tela "Criar meu prompt" pra alunos adicionarem templates próprios — próxima iteração.',
      'Ranking "Mais usados" usando usage_count.',
      'Compartilhamento social de prompt customizado (gera URL com query string).',
      'Histórico de cópias por aluno (audit trail) — opcional.',
    ],
  },
};
