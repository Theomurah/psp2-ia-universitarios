/**
 * Entrega Sprint 2 — Tarefa 24: Chunking pra documentos grandes (AGORA IMPLEMENTADA).
 *
 * NOTA: o doc S2T24 original já existe ("PLANEJAMENTO"). Este arquivo gera
 * um NOVO doc atualizado refletindo a implementação. O original fica como
 * histórico do planejamento.
 */

export default {
  output:
    'Entregas/Sprint 2/Desenvolvimento Backend/H5 - Implementar pipeline de síntese via LLM/PSP2 - S2T24 - Chunking para Documentos Grandes - IMPLEMENTADO.docx',

  title: 'PSP2 — Entrega Sprint 2 / Tarefa 24',
  subtitle: 'Lógica de Chunking para Documentos Grandes — IMPLEMENTADA',

  emPalavrasSimples: [
    'A IA tem um limite de quanto texto consegue olhar de uma vez (janela de contexto). Documentos curtos cabem inteiros. Documentos grandes (livro, apostila completa, slide de 100 páginas) não cabem — e se a gente tentar mandar tudo de uma vez, a IA recusa ou perde qualidade.',
    'A solução é "chunking": cortar o documento em pedaços (chunks) com sobreposição (pra não cortar uma fórmula no meio), sintetizar cada pedaço separadamente, e depois costurar os resultados num resumo coerente. Pensa como ler um livro: você lê capítulo por capítulo, faz nota de cada um, e no fim tem um resumo do livro inteiro.',
    'Esta entrega implementa essa estratégia: o pipeline agora detecta automaticamente quando um documento passa de 50 mil caracteres e ativa o modo chunked, transparente pro frontend. Cada chunk gera um job_event próprio (pra debug), e o custo/duração total agrega corretamente. Documentos de qualquer tamanho passam a ser processáveis.',
  ],

  identificacao: [
    ['ID', 'Sprint 2 — Tarefa 24'],
    ['Épico', 'Desenvolvimento Backend'],
    ['História', 'H5 — Implementar pipeline de síntese, organização e redução via LLM'],
    ['Tarefa', 'Desenvolver lógica de chunking para docs grandes'],
    ['Responsável', 'Isaac'],
    ['Planning Poker', '8'],
    ['Data de início', '20/04/2026'],
    ['Data de entrega', '26/05/2026'],
    ['Status', 'Concluída'],
    ['Branch', 'feature/sprint1-finalization'],
    ['Commit', '(será preenchido após push)'],
  ],

  objetivo:
    'Permitir que o pipeline de síntese processe documentos arbitrariamente grandes (livros, apostilas completas, decks longos), quebrando o input em pedaços (chunks), sintetizando cada um, e combinando os resultados de forma coerente.\n\nSem essa lógica, o pipeline anterior falhava em documentos > ~50 mil caracteres de texto extraído. Com ela, o limite efetivo passa a ser quanto memória/tempo o aluno aceita esperar — não mais o tamanho do contexto do modelo.',

  criterio:
    'Documentos sintetizados, renomeados e comprimidos com taxa de acerto de mais de 80% em 50 docs de teste (compartilhado com a história). Critério específico do chunking: doc de ≥ 100k chars produz síntese coerente sem erro, com cada chunk gerando job_event próprio.',

  conteudo: [
    { type: 'h3', text: '4.1. Arquivos criados/modificados' },
    {
      type: 'table',
      columnWidths: [4500, 4860],
      headers: ['Arquivo', 'O que faz'],
      rows: [
        ['_shared/chunking.ts (novo)', 'Define Chunk, splitByH2, slidingWindow, chunkDocument, shouldChunk + constantes (CHUNK_THRESHOLD=50_000, CHUNK_MAX_CHARS=30_000, CHUNK_OVERLAP=2_000, MAX_DEPTH=3).'],
        ['_shared/pipeline.ts (atualizado)', 'Adiciona synthesizeChunked com map/reduce + recursão limitada. Aceita callback onChunkEvent pra logar progresso.'],
        ['process-document/index.ts (atualizado)', 'Step "synthesize" agora usa synthesizeChunked. Cada chunk vira um job_event com nome "synthesize.chunk_N_of_M".'],
        ['_shared/__tests__/chunking.test.ts (novo)', '14 testes cobrindo todas as estratégias.'],
      ],
    },
    { type: 'h3', text: '4.2. Estratégia híbrida implementada' },
    {
      type: 'table',
      columnWidths: [2400, 3000, 3960],
      headers: ['Estratégia', 'Quando ativa', 'Comportamento'],
      rows: [
        ['Split por seções (##)', 'Doc tem ## headings e cada seção cabe em maxChars', '1 chunk por seção, com source_section anotado.'],
        ['Híbrida', 'Tem seções mas alguma é grande demais', 'Seções pequenas viram chunk único; grandes aplicam janela só nelas.'],
        ['Janela direta', 'Doc sem ## headings detectáveis', 'slidingWindow com overlap aplicada do início ao fim.'],
      ],
    },
    { type: 'h3', text: '4.3. Map / Reduce no pipeline' },
    {
      type: 'code',
      code: `// pipeline.ts (resumido)
export async function synthesizeChunked(input, opts = {}) {
  if (!shouldChunk(input.texto_bruto)) return synthesize(input);  // fluxo normal

  const chunks = chunkDocument(input.texto_bruto);
  const partials = [];
  // MAP — sintetiza cada chunk
  for (const chunk of chunks) {
    const partial = await synthesize({
      texto_bruto: chunk.content,
      contexto: { ...input.contexto, titulo: \`\${input.contexto.titulo} (parte \${chunk.index+1}/\${chunks.length})\` },
    });
    partials.push(partial.result.markdown);
  }
  // REDUCE — síntese final das parciais (recursivo se ainda for grande)
  const combined = partials.join('\\n\\n---\\n\\n');
  if (shouldChunk(combined)) {
    return synthesizeChunked({ ...input, texto_bruto: combined }, { depth: depth + 1 });
  }
  return synthesize({ ...input, texto_bruto: combined });
}`,
    },
    { type: 'h3', text: '4.4. Telemetria: job_events por chunk' },
    {
      type: 'body',
      text: 'Cada chunk emite eventos no job_events com nome "synthesize.chunk_N_of_M" e tipo start/success. O reduce também emite "synthesize.reduce". O aluno vê progresso granular no dashboard quando o doc é grande.',
    },
    {
      type: 'code',
      code: `// process-document/index.ts (wire-up)
const synth = await synthesizeChunked(synthInput, {
  onChunkEvent: async (e) => {
    const stepName = e.kind.startsWith('chunk')
      ? \`synthesize.chunk_\${(e.chunk_index ?? 0) + 1}_of_\${e.chunk_total ?? '?'}\`
      : 'synthesize.reduce';
    await logEvent(stepName, e.kind.endsWith('_success') ? 'success' : 'start', {
      duration_ms: e.duration_ms,
      llm_model: e.model,
      tokens_input: e.tokens_input,
      cost_usd: e.cost_usd,
      message: e.source_section ? \`seção: \${e.source_section}\` : undefined,
    });
  },
});`,
    },
    { type: 'h3', text: '4.5. Guarda contra recursão infinita' },
    {
      type: 'body',
      text: 'MAX_DEPTH=3 limita a recursão do reduce. Se mesmo após 3 níveis a síntese combinada ainda não couber em 1 chamada, o pipeline trunca pro threshold e roda síntese final — pra evitar loop e custo descontrolado. Cenário extremo: doc de 1 milhão de chars + LLM produzindo sínteses pouco compressivas.',
    },
  ],

  validacao: [
    '14 testes unitários cobrem shouldChunk, splitByH2, slidingWindow, chunkDocument (caminhos: vazio, sem ##, várias seções, seção grande disparando janela, índice/total consistentes).',
    'Pipeline mantém compatibilidade: docs ≤ 50k chars continuam usando synthesize direto (sem overhead).',
    'Agregação de tokens/custo somada de todos os chunks + reduce — métrica final em cost_usd_total.',
    'job_events granulares permitem reprodução exata de execuções grandes pelo time interno.',
    'Constantes (threshold, max_chars, overlap, max_depth) calibráveis sem mudança de código.',
  ],

  dependencias: {
    texto: 'Depende de: T22 (callLLM), T23 (synthesize). Habilita:',
    proximos: [
      'Processamento de livros-texto inteiros (Mankiw, apostilas completas, decks de 100 slides).',
      'Calibração das constantes com base em dados reais (50 docs do T26).',
      'Validação semântica adaptada pra modo chunked — keywords podem estar em chunks diferentes (próxima iteração).',
      'Possibilidade de paralelizar MAP com concorrência limitada (atualmente serial pra preservar ordem de eventos).',
    ],
  },
};
