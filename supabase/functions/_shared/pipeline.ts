/**
 * Cadeia de prompts: classify → synthesize → compress (T23).
 *
 * Cada função recebe input, faz uma chamada LLM via OpenRouter,
 * valida o resultado com Zod e retorna o output tipado + métricas de uso.
 */

import {
  callLLMWithRetry,
  type LLMCallOptions,
  type LLMCallResult,
  type OnRetryCallback,
  parseJsonFromLLM,
} from './openrouter.ts';
import {
  SYSTEM_PROMPT_CLASSIFY,
  SYSTEM_PROMPT_SYNTHESIZE,
  SYSTEM_PROMPT_COMPRESS,
  renderPrompt,
  applyPersonalizedSystem,
  // Sandbox anti prompt-injection (S-04) — centralizado em prompts.ts pra
  // reuso no LLM-as-judge (validation.ts) e cobertura de teste.
  sandboxUserInput,
  SANDBOX_INSTRUCTION,
} from './prompts.ts';
import { ClassificationSchema } from '../../../packages/shared/src/schemas.ts';
import { getModelConfig, getModelParams } from './models.ts';
import { chunkDocument, shouldChunk, MAX_DEPTH, CHUNK_THRESHOLD } from './chunking.ts';
import type {
  ClassificationResult,
  SynthesisResult,
  CompressionResult,
  MateriaPerfil,
} from '../../../packages/shared/src/types.ts';

// =============================================================
// Guarda contra truncamento por max_tokens
// =============================================================
// Origem: auditoria 2026-06-10 (SHARED-FUNCTIONS-03): finish_reason nunca era
// checado — síntese cortada no meio por max_tokens subia pro Drive como
// 'completed'. Se a 1ª chamada estourar o orçamento (finish_reason='length'),
// retenta UMA vez com o dobro de max_tokens (cap em MAX_TOKENS_CEILING).
// Se ainda assim truncar, propaga `truncated: true` pro caller rebaixar o
// verdict/registrar warning — nunca falha silenciosamente.
const MAX_TOKENS_CEILING = 16_384;

async function callLLMGuardingTruncation(
  opts: LLMCallOptions,
  onRetry?: OnRetryCallback,
): Promise<LLMCallResult & { truncated: boolean }> {
  const first = await callLLMWithRetry(opts, 3, onRetry);
  if (first.finish_reason !== 'length') return { ...first, truncated: false };

  const biggerBudget = Math.min((opts.max_tokens ?? 4096) * 2, MAX_TOKENS_CEILING);
  const second = await callLLMWithRetry({ ...opts, max_tokens: biggerBudget }, 3, onRetry);

  return {
    ...second,
    // Usage agregado: a 1ª tentativa truncada também custou tokens reais.
    tokens_input: first.tokens_input + second.tokens_input,
    tokens_output: first.tokens_output + second.tokens_output,
    cost_usd: first.cost_usd + second.cost_usd,
    truncated: second.finish_reason === 'length',
  };
}

// =============================================================
// Estágio 1: Classificação
// =============================================================
export interface ClassifyInput {
  texto_bruto: string;
  semestre: string;
  materias: MateriaPerfil[];
}

export async function classify(
  input: ClassifyInput,
  onRetry?: OnRetryCallback,
): Promise<{ result: ClassificationResult; usage: { tokens_input: number; tokens_output: number; cost_usd: number; model: string; duration_ms: number } }> {
  const lista_materias = input.materias
    .map((m) => `${m.code} (${m.nome})${m.profs?.length ? ` — profs: ${m.profs.join(', ')}` : ''}`)
    .join('\n  ');

  const system = renderPrompt(SYSTEM_PROMPT_CLASSIFY, {
    semestre: input.semestre,
    lista_materias,
  });

  // Trunca o input pra 2000 chars (suficiente pra classificação) e
  // envolve em sandbox anti-prompt-injection (S-04 da auditoria).
  const user = sandboxUserInput(input.texto_bruto.slice(0, 2000));

  const t0 = Date.now();
  const res = await callLLMWithRetry({
    model: (await getModelConfig()).classify,
    messages: [
      { role: 'system', content: `${system}\n\n${SANDBOX_INSTRUCTION}` },
      { role: 'user', content: user },
    ],
    temperature: 0,
    max_tokens: 512,
    response_format: { type: 'json_object' },
    params: (await getModelParams()).classify,
  }, 3, onRetry);
  const duration_ms = Date.now() - t0;

  const parsed = parseJsonFromLLM<ClassificationResult>(res.content);
  const validated = ClassificationSchema.parse(parsed);

  return {
    result: validated,
    usage: {
      tokens_input: res.tokens_input,
      tokens_output: res.tokens_output,
      cost_usd: res.cost_usd,
      model: res.model,
      duration_ms,
    },
  };
}

// =============================================================
// Estágio 2: Síntese
// =============================================================
export interface SynthesizeInput {
  texto_bruto: string;
  contexto: {
    materia_code: string;
    materia_nome: string;
    tipo: string;
    data: string | null;
    identificador: string | null;
    titulo: string;
    semestre: string;
    fonte: string | null;
    /** System prompt personalizado do aluno (H7). Ausente = síntese padrão. */
    user_system_prompt?: string | null;
  };
}

export async function synthesize(
  input: SynthesizeInput,
  onRetry?: OnRetryCallback,
): Promise<{ result: SynthesisResult; usage: { tokens_input: number; tokens_output: number; cost_usd: number; model: string; duration_ms: number }; truncated: boolean }> {
  const system = renderPrompt(SYSTEM_PROMPT_SYNTHESIZE, {
    semestre: input.contexto.semestre,
    materia_code: input.contexto.materia_code,
    materia_nome: input.contexto.materia_nome,
    tipo: input.contexto.tipo,
    data: input.contexto.data ?? '',
    identificador: input.contexto.identificador ?? '',
    titulo: input.contexto.titulo,
    fonte: input.contexto.fonte ?? 'Material original',
  });

  const systemBase = `${system}\n\n${SANDBOX_INSTRUCTION}`;
  const t0 = Date.now();
  const res = await callLLMGuardingTruncation({
    model: (await getModelConfig()).synthesize,
    messages: [
      { role: 'system', content: applyPersonalizedSystem(systemBase, input.contexto.user_system_prompt) },
      { role: 'user', content: sandboxUserInput(input.texto_bruto) },
    ],
    temperature: 0.2,
    max_tokens: 8192,
    params: (await getModelParams()).synthesize,
  }, onRetry);
  const duration_ms = Date.now() - t0;

  const markdown = res.content.trim();
  const formulas_count = countFormulas(markdown);
  const secoes_count = countSections(markdown);
  const topicos_extraidos = extractTopics(markdown);

  return {
    result: {
      markdown,
      metadata: {
        topicos_extraidos,
        formulas_count,
        secoes_count,
        chars_input: input.texto_bruto.length,
        chars_output: markdown.length,
        ratio_compressao: markdown.length / Math.max(input.texto_bruto.length, 1),
      },
    },
    usage: {
      tokens_input: res.tokens_input,
      tokens_output: res.tokens_output,
      cost_usd: res.cost_usd,
      model: res.model,
      duration_ms,
    },
    truncated: res.truncated,
  };
}

// =============================================================
// Estágio 3: Compressão
// =============================================================
export interface CompressInput {
  markdown_sintetizado: string;
  modo: 'compacta' | 'cola';
}

export async function compress(
  input: CompressInput,
  onRetry?: OnRetryCallback,
): Promise<{ result: CompressionResult; usage: { tokens_input: number; tokens_output: number; cost_usd: number; model: string; duration_ms: number }; truncated: boolean }> {
  const system = renderPrompt(SYSTEM_PROMPT_COMPRESS, { modo: input.modo });
  const mc = await getModelConfig();
  const mp = await getModelParams();
  const model = input.modo === 'compacta' ? mc.compress_compact : mc.compress_cola;
  const params = input.modo === 'compacta' ? mp.compress_compact : mp.compress_cola;
  const formulas_input = countFormulas(input.markdown_sintetizado);

  const t0 = Date.now();
  const res = await callLLMGuardingTruncation({
    model,
    messages: [
      { role: 'system', content: `${system}\n\n${SANDBOX_INSTRUCTION}` },
      { role: 'user', content: sandboxUserInput(input.markdown_sintetizado) },
    ],
    temperature: 0.1,
    max_tokens: 8192,
    params,
  }, onRetry);
  const duration_ms = Date.now() - t0;

  const markdown = res.content.trim();
  const formulas_output = countFormulas(markdown);

  return {
    result: {
      markdown,
      metadata: {
        modo: input.modo,
        chars_input: input.markdown_sintetizado.length,
        chars_output: markdown.length,
        ratio_compressao: markdown.length / Math.max(input.markdown_sintetizado.length, 1),
        formulas_preservadas: formulas_output,
        avisos_preservados: /⚠️ COBRADO NA PROVA/.test(markdown) === /⚠️ COBRADO NA PROVA/.test(input.markdown_sintetizado),
      },
    },
    usage: {
      tokens_input: res.tokens_input,
      tokens_output: res.tokens_output,
      cost_usd: res.cost_usd,
      model: res.model,
      duration_ms,
    },
    truncated: res.truncated,
  };
}

// =============================================================
// Helpers de análise estrutural do Markdown
// =============================================================
function countFormulas(md: string): number {
  // Bloco $$...$$ + inline $...$ (mas não inline com letras grudadas tipo "U$10")
  const block = (md.match(/\$\$[\s\S]+?\$\$/g) ?? []).length;
  const inline = (md.match(/(?<![A-Za-z])\$[^\$\n]+?\$(?![A-Za-z])/g) ?? []).length;
  return block + inline;
}

function countSections(md: string): number {
  return (md.match(/^##\s+/gm) ?? []).length;
}

function extractTopics(md: string): string[] {
  // Tenta extrair a linha "Tópicos: ..." do cabeçalho fixo
  const m = md.match(/^Tópicos:\s*(.+)$/m);
  if (!m) return [];
  return m[1].split(/[,;]/).map((t) => t.trim()).filter(Boolean).slice(0, 15);
}

// =============================================================
// Síntese chunked (T24) — map/reduce pra documentos grandes
// =============================================================

/**
 * Síntese de documentos arbitrariamente grandes via chunking.
 *
 * Fluxo:
 *   1. Se chars ≤ threshold → fluxo normal (synthesize).
 *   2. Senão, parte em chunks, sintetiza cada um (MAP).
 *   3. Concatena as sínteses parciais e roda síntese final (REDUCE).
 *   4. Se o resultado da redução ainda for grande, recorre (até MAX_DEPTH).
 *
 * Retorna o markdown final + usage agregado (soma de tokens/custo de todas as chamadas).
 *
 * @param onChunkEvent callback opcional pra logar progresso de cada chunk (job_events).
 */
export async function synthesizeChunked(
  input: SynthesizeInput,
  opts: {
    threshold?: number;
    depth?: number;
    /**
     * Hook de retry repassado a TODAS as chamadas internas de synthesize.
     * Sem ele, backoffs 429/5xx do estágio mais caro eram invisíveis em
     * job_events (auditoria 2026-06-10, SHARED-FUNCTIONS-07).
     */
    onRetry?: OnRetryCallback;
    onChunkEvent?: (e: {
      kind: 'chunk_start' | 'chunk_success' | 'reduce_start' | 'reduce_success';
      chunk_index?: number;
      chunk_total?: number;
      source_section?: string;
      duration_ms?: number;
      tokens_input?: number;
      tokens_output?: number;
      cost_usd?: number;
      model?: string;
    }) => Promise<void>;
  } = {},
): Promise<{
  result: SynthesisResult;
  usage: {
    tokens_input: number;
    tokens_output: number;
    cost_usd: number;
    model: string;
    duration_ms: number;
  };
  chunked: boolean;
  chunk_count: number;
  /** true se alguma chamada interna estourou max_tokens mesmo após retry com orçamento maior. */
  truncated: boolean;
}> {
  const threshold = opts.threshold ?? CHUNK_THRESHOLD;
  const depth = opts.depth ?? 0;

  // Caso simples: doc cabe → fluxo normal
  if (!shouldChunk(input.texto_bruto, threshold)) {
    const r = await synthesize(input, opts.onRetry);
    return { result: r.result, usage: r.usage, chunked: false, chunk_count: 1, truncated: r.truncated };
  }

  // Guarda contra recursão infinita
  if (depth >= MAX_DEPTH) {
    // Trunca pra caber e roda síntese final
    const truncatedInput = input.texto_bruto.slice(0, threshold);
    const r = await synthesize({ ...input, texto_bruto: truncatedInput }, opts.onRetry);
    return { result: r.result, usage: r.usage, chunked: true, chunk_count: 1, truncated: r.truncated };
  }

  // 1) Divide em chunks
  const chunks = chunkDocument(input.texto_bruto);

  // 2) MAP — sintetiza cada chunk em paralelo limitado (concorrência 2)
  const partials: string[] = [];
  let totalIn = 0,
    totalOut = 0,
    totalCost = 0,
    totalMs = 0;
  let lastModel = '';
  let anyTruncated = false;

  for (const chunk of chunks) {
    await opts.onChunkEvent?.({
      kind: 'chunk_start',
      chunk_index: chunk.index,
      chunk_total: chunks.length,
      source_section: chunk.source_section,
    });

    const partial = await synthesize({
      texto_bruto: chunk.content,
      contexto: {
        ...input.contexto,
        titulo: `${input.contexto.titulo} (parte ${chunk.index + 1}/${chunks.length})`,
      },
    }, opts.onRetry);

    anyTruncated = anyTruncated || partial.truncated;
    partials.push(partial.result.markdown);
    totalIn += partial.usage.tokens_input;
    totalOut += partial.usage.tokens_output;
    totalCost += partial.usage.cost_usd;
    totalMs += partial.usage.duration_ms;
    lastModel = partial.usage.model;

    await opts.onChunkEvent?.({
      kind: 'chunk_success',
      chunk_index: chunk.index,
      chunk_total: chunks.length,
      source_section: chunk.source_section,
      duration_ms: partial.usage.duration_ms,
      tokens_input: partial.usage.tokens_input,
      tokens_output: partial.usage.tokens_output,
      cost_usd: partial.usage.cost_usd,
      model: partial.usage.model,
    });
  }

  // 3) REDUCE — combina parciais
  const combined = partials.join('\n\n---\n\n');

  // Recursão se o combined ainda for grande
  if (shouldChunk(combined, threshold)) {
    await opts.onChunkEvent?.({ kind: 'reduce_start' });
    const sub = await synthesizeChunked(
      { ...input, texto_bruto: combined },
      { threshold, depth: depth + 1, onRetry: opts.onRetry, onChunkEvent: opts.onChunkEvent },
    );
    return {
      result: sub.result,
      usage: {
        tokens_input: totalIn + sub.usage.tokens_input,
        tokens_output: totalOut + sub.usage.tokens_output,
        cost_usd: totalCost + sub.usage.cost_usd,
        model: sub.usage.model || lastModel,
        duration_ms: totalMs + sub.usage.duration_ms,
      },
      chunked: true,
      chunk_count: chunks.length + sub.chunk_count,
      truncated: anyTruncated || sub.truncated,
    };
  }

  await opts.onChunkEvent?.({ kind: 'reduce_start' });
  const final = await synthesize({ ...input, texto_bruto: combined }, opts.onRetry);
  await opts.onChunkEvent?.({
    kind: 'reduce_success',
    duration_ms: final.usage.duration_ms,
    tokens_input: final.usage.tokens_input,
    tokens_output: final.usage.tokens_output,
    cost_usd: final.usage.cost_usd,
    model: final.usage.model,
  });

  return {
    result: final.result,
    usage: {
      tokens_input: totalIn + final.usage.tokens_input,
      tokens_output: totalOut + final.usage.tokens_output,
      cost_usd: totalCost + final.usage.cost_usd,
      model: final.usage.model,
      duration_ms: totalMs + final.usage.duration_ms,
    },
    chunked: true,
    chunk_count: chunks.length,
    truncated: anyTruncated || final.truncated,
  };
}
