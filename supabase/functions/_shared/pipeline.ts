/**
 * Cadeia de prompts: classify → synthesize → compress (T23).
 *
 * Cada função recebe input, faz uma chamada LLM via OpenRouter,
 * valida o resultado com Zod e retorna o output tipado + métricas de uso.
 */

import { callLLMWithRetry, parseJsonFromLLM } from './openrouter.ts';
import {
  SYSTEM_PROMPT_CLASSIFY,
  SYSTEM_PROMPT_SYNTHESIZE,
  SYSTEM_PROMPT_COMPRESS,
  renderPrompt,
} from './prompts.ts';
import { ClassificationSchema } from '../../../packages/shared/src/schemas.ts';
import { MODELS } from '../../../packages/shared/src/constants.ts';
import type {
  ClassificationResult,
  SynthesisResult,
  CompressionResult,
  MateriaPerfil,
} from '../../../packages/shared/src/types.ts';

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
): Promise<{ result: ClassificationResult; usage: { tokens_input: number; tokens_output: number; cost_usd: number; model: string; duration_ms: number } }> {
  const lista_materias = input.materias
    .map((m) => `${m.code} (${m.nome})${m.profs?.length ? ` — profs: ${m.profs.join(', ')}` : ''}`)
    .join('\n  ');

  const system = renderPrompt(SYSTEM_PROMPT_CLASSIFY, {
    semestre: input.semestre,
    lista_materias,
  });

  // Trunca o input pra 2000 chars (suficiente pra classificação)
  const user = input.texto_bruto.slice(0, 2000);

  const t0 = Date.now();
  const res = await callLLMWithRetry({
    model: MODELS.classify,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0,
    max_tokens: 512,
    response_format: { type: 'json_object' },
  });
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
  };
}

export async function synthesize(
  input: SynthesizeInput,
): Promise<{ result: SynthesisResult; usage: { tokens_input: number; tokens_output: number; cost_usd: number; model: string; duration_ms: number } }> {
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

  const t0 = Date.now();
  const res = await callLLMWithRetry({
    model: MODELS.synthesize,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: input.texto_bruto },
    ],
    temperature: 0.2,
    max_tokens: 8192,
  });
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
): Promise<{ result: CompressionResult; usage: { tokens_input: number; tokens_output: number; cost_usd: number; model: string; duration_ms: number } }> {
  const system = renderPrompt(SYSTEM_PROMPT_COMPRESS, { modo: input.modo });
  const model = input.modo === 'compacta' ? MODELS.compress_compact : MODELS.compress_cola;
  const formulas_input = countFormulas(input.markdown_sintetizado);

  const t0 = Date.now();
  const res = await callLLMWithRetry({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: input.markdown_sintetizado },
    ],
    temperature: 0.1,
    max_tokens: 8192,
  });
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
