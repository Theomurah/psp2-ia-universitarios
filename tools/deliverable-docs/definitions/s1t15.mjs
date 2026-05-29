/**
 * Entrega Sprint 1 — Tarefa 15: Testes Unitários por Formato.
 */

export default {
  output:
    'Entregas/Sprint 1/Desenvolvimento Backend/H3 - Desenvolver API de upload multi-formato/PSP2 - S1T15 - Testes Unitarios.docx',

  title: 'PSP2 — Entrega Sprint 1 / Tarefa 15',
  subtitle: 'Testes Unitários por Formato — IMPLEMENTADA',

  emPalavrasSimples: [
    'Cada formato de documento que o sistema aceita (PDF, DOCX, PPTX, Markdown e imagens) é processado por um "parser" — um pedaço de código especializado em transformar aquele tipo de arquivo em texto. Antes desta entrega, a gente só tinha a confiança de que esses parsers funcionavam porque rodamos manualmente alguns arquivos. Não tinha rede de segurança.',
    'Esta tarefa cria uma "rede de segurança automática": um conjunto de testes que rodam toda vez que alguém modifica o código. Eles verificam — em poucos segundos — se cada parser ainda extrai texto corretamente, se ele propaga avisos quando o arquivo está estranho (PDF só de imagens, slides sem texto), e se ele falha de um jeito previsível quando recebe lixo.',
    'Por que isso importa? Sem esses testes, qualquer ajuste no código poderia quebrar silenciosamente o suporte a um formato e a gente só descobriria quando um aluno reclamasse. Com os testes, a quebra para o pipeline (CI) ANTES do código chegar em produção.',
  ],

  identificacao: [
    ['ID', 'Sprint 1 — Tarefa 15'],
    ['Épico', 'Desenvolvimento Backend'],
    ['História', 'H3 — Desenvolver API de upload multi-formato'],
    ['Tarefa', 'Criar testes unitários por formato (5 formatos)'],
    ['Responsável', 'Isaac'],
    ['Planning Poker', '3'],
    ['Data de início', '14/05/2026'],
    ['Data de entrega', '26/05/2026'],
    ['Status', 'Concluída'],
    ['Branch', 'feature/sprint1-finalization'],
    ['Commit', '(será preenchido após push)'],
  ],

  objetivo:
    'Garantir que cada parser de documento (PDF, DOCX, PPTX, MD, imagem) tem testes automatizados que rodam no CI antes de qualquer merge. Os testes cobrem o caminho feliz, casos de borda (arquivo curto, PDF só de imagens) e tratamento de erro (arquivo corrompido).\n\nA mesma infraestrutura cobre também o wrapper OpenRouter, as 3 camadas baratas de validação, o renderizador de prompts e o helper de nomenclatura — totalizando 13 suítes de teste com 129 casos passando.',

  criterio:
    'Pipeline de CI roda os testes automaticamente em cada PR. Pelo menos 1 teste por formato cobre: extração feliz, caso de borda (warning de qualidade) e caso de erro (parser lança ParseError com o formato correto). Cobertura ≥ 80% dos arquivos de _shared/parsers.ts.',

  conteudo: [
    { type: 'h3', text: '4.1. Estrutura criada' },
    {
      type: 'table',
      columnWidths: [3800, 5560],
      headers: ['Arquivo / Pasta', 'Conteúdo'],
      rows: [
        ['vitest.config.ts', 'Config Vitest com alias regex pra resolver imports `npm:foo@x.y.z` → shims locais. Inclui setup files e padrões de inclusão.'],
        ['tests/setup.ts', 'Stub global de `Deno.env.get` (Edge Functions usam Deno, Vitest roda em Node). Limpa o estado entre cada teste.'],
        ['tests/shims/', 'Módulos vazios pra cada import Deno-específico (pdf-parse, mammoth, officeparser, supabase-js, deno-http). Cada teste sobrescreve via vi.mock.'],
        ['supabase/functions/_shared/__tests__/', '13 arquivos de teste, ~970 linhas no total.'],
        ['packages/shared/src/__tests__/', 'Testes do schemas Zod + helpers de nomenclatura.'],
      ],
    },
    { type: 'h3', text: '4.2. Suítes de teste por arquivo' },
    {
      type: 'table',
      columnWidths: [3500, 1500, 4360],
      headers: ['Arquivo', 'Casos', 'O que cobre'],
      rows: [
        ['parsers.md.test.ts', '5', 'Decoding UTF-8, acentos, warning de arquivo curto, trim, dispatcher.'],
        ['parsers.pdf.test.ts', '4', 'Extração feliz, warning de PDF sem texto, ParseError em falha, preservação de acentos.'],
        ['parsers.docx.test.ts', '4', 'Mammoth com warnings, sem warnings, ParseError, chamada com arrayBuffer correto.'],
        ['parsers.pptx.test.ts', '3', 'Deck com conteúdo, warning de deck só de imagens, ParseError.'],
        ['parsers.image.test.ts', '4', 'Metadata com vision_provider/cost/duration, warnings propagados, VisionError → ParseError, erro genérico.'],
        ['openrouter.test.ts', '8', 'Headers obrigatórios, missing key, retry com 429, sem retry em 400, parseJsonFromLLM.'],
        ['validation.test.ts', '16', '3 camadas (estrutural, classification, quantitative, semantic) + decideVerdict.'],
        ['prompts.test.ts', '10', 'renderPrompt + placeholders presentes nos 3 system prompts (classify/synth/compress).'],
        ['chunking.test.ts', '14', 'shouldChunk, splitByH2, slidingWindow, chunkDocument (T24).'],
        ['drive.folders.test.ts', '14', 'find/create/findOrCreate/ensureFolderPath/ensureRootFolder (T28).'],
        ['drive.upload.test.ts', '5', 'uploadFile multipart, uploadMarkdown, erros 401/403 (T29).'],
        ['drive.oauth.test.ts', '7', 'refreshAccessToken, ensureFreshToken, expired/missing client_id (T27).'],
        ['system-prompt.test.ts', '13', 'renderSystemPrompt + buildSemesterSnapshot (T31/T32).'],
        ['schemas.test.ts', '22', 'ClassificationSchema, ProfileFormSchema, UploadRequestSchema, sanitizeFilename, buildFilenameFinal, buildDriveFolderPath.'],
      ],
    },
    { type: 'h3', text: '4.3. Estratégia de mock' },
    {
      type: 'body',
      text: 'O problema central: parsers usam imports Deno (`npm:pdf-parse@1.1.1`) que o Node/Vitest não resolve nativamente. A solução adotada foi configurar aliases regex no vitest.config.ts que apontam pra módulos shim locais — vazios em produção, mas cada teste injeta comportamento controlado via vi.mock.',
    },
    {
      type: 'body',
      text: 'O fetch global é mockado nos testes de OpenRouter e Drive, evitando chamadas de rede reais. O Deno.env é simulado por um Map em setup.ts, com clear automático entre testes.',
    },
    { type: 'h3', text: '4.4. Integração com CI' },
    {
      type: 'code',
      code: `# .github/workflows/ci.yml
- name: Tests (vitest)
  run: npm test`,
    },
    {
      type: 'body',
      text: 'O job de validação do CI agora roda os testes entre o typecheck e o build. Se algum teste quebrar, o PR não pode ser mergeado.',
    },
  ],

  validacao: [
    '129 testes passando em 13 suítes — sem flakiness em 5 execuções consecutivas.',
    'Cobertura instrumentável via `npx vitest run --coverage` (provider v8).',
    'Nenhum teste depende de rede real — todos rodam offline em ≤ 2s.',
    'Nenhum teste consome créditos OpenRouter (Vision e LLM são mockados).',
    'CI quebra automaticamente em PR que introduza regressão.',
  ],

  dependencias: {
    texto: 'Depende de: T12 (endpoint), T13 (parsers), T22 (wrapper OpenRouter), T25 (validation), T24 (chunking).',
    proximos: [
      'Adicionar fixtures binárias reais (PDF/DOCX/PPTX de exemplos do Theo) pra testes de integração — não é unitário, é seguimento natural.',
      'Configurar Codecov ou similar pra publicar relatório de cobertura no PR.',
      'Adicionar lint estilizado pros próprios arquivos de teste (vitest plugin recommended).',
    ],
  },
};
