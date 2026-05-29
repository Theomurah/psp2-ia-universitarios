/**
 * Validação de qualidade dos outputs LLM (T25, baseado em T11).
 *
 * 4 camadas:
 *   1. Estrutural   — schema válido + cabeçalho fixo presente
 *   2. Quantitativa — ratios de compressão, contagem de fórmulas/seções
 *   3. Semântica    — keywords do original preservadas
 *   4. LLM-as-judge — chamada secundária (Gemini) avaliando 4 dimensões
 *
 * As camadas 1, 2 e 3 rodam SEMPRE (são baratas).
 * A camada 4 roda apenas se 2 ou 3 levantarem warning, OU em 5% dos jobs (amostragem).
 */

import { callLLMWithRetry, parseJsonFromLLM } from './openrouter.ts';
import { TARGETS } from '../../../packages/shared/src/constants.ts';
import { getModelConfig } from './models.ts';
import type { ValidationResult, ClassificationResult } from '../../../packages/shared/src/types.ts';

// =============================================================
// Camada 1: Estrutural
// =============================================================
export function validateStructural(markdown: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Cabeçalho fixo nas primeiras 5 linhas
  const firstLines = markdown.split('\n').slice(0, 8).join('\n');
  if (!/\|\s*\w+\s*\|/.test(firstLines)) errors.push('Cabeçalho fixo ausente (linha "MATERIA | Tipo | ...")');
  if (!firstLines.includes('Fonte:')) warnings.push('Linha "Fonte:" não detectada no cabeçalho');
  if (!firstLines.includes('Semestre:')) warnings.push('Linha "Semestre:" não detectada');

  // Pelo menos 1 H1 e 2 H2
  const h1Count = (markdown.match(/^#\s+/gm) ?? []).length;
  const h2Count = (markdown.match(/^##\s+/gm) ?? []).length;
  if (h1Count < 1) errors.push('Nenhum H1 encontrado');
  if (h2Count < 2) warnings.push(`Apenas ${h2Count} seções H2 (esperado ≥ 2)`);

  // Balanceamento de $...$ e $$...$$
  const dollarSingles = (markdown.match(/(?<!\$)\$(?!\$)/g) ?? []).length;
  if (dollarSingles % 2 !== 0) {
    warnings.push(`Possível $ não balanceado (${dollarSingles} ocorrências)`);
  }

  return {
    passed: errors.length === 0,
    layer: 'structural',
    score: errors.length === 0 ? 1.0 : 0,
    warnings,
    errors,
  };
}

export function validateClassification(c: ClassificationResult): ValidationResult {
  const warnings: string[] = [];
  if (c.confianca < TARGETS.classify_confidence_review) {
    return {
      passed: false,
      layer: 'structural',
      score: c.confianca,
      warnings,
      errors: [`Confiança ${c.confianca.toFixed(2)} < ${TARGETS.classify_confidence_review} (mínima)`],
    };
  }
  if (c.confianca < TARGETS.classify_confidence_auto) {
    warnings.push(`Confiança ${c.confianca.toFixed(2)} — needs_review (limiar auto: ${TARGETS.classify_confidence_auto})`);
  }
  return { passed: true, layer: 'structural', score: c.confianca, warnings, errors: [] };
}

// =============================================================
// Camada 2: Quantitativa
// =============================================================
export interface QuantitativeInput {
  chars_input: number;
  chars_output: number;
  formulas_input?: number;
  formulas_output?: number;
  modo?: 'synthesis' | 'compact' | 'cola';
}

export function validateQuantitative(input: QuantitativeInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ratio = input.chars_output / Math.max(input.chars_input, 1);

  // Verifica ratio dentro do esperado por modo
  let min = 0, max = 1;
  switch (input.modo) {
    case 'synthesis':
      min = TARGETS.synthesis_ratio_min;
      max = TARGETS.synthesis_ratio_max;
      break;
    case 'compact':
      min = TARGETS.compress_compact_ratio_min;
      max = TARGETS.compress_compact_ratio_max;
      break;
    case 'cola':
      min = TARGETS.compress_cola_ratio_min;
      max = TARGETS.compress_cola_ratio_max;
      break;
  }
  if (input.modo && (ratio < min || ratio > max)) {
    warnings.push(`Ratio ${ratio.toFixed(2)} fora da faixa [${min}-${max}] para modo ${input.modo}`);
  }

  // Compressão: fórmulas devem ser 100% preservadas
  if (input.formulas_input != null && input.formulas_output != null) {
    if (input.formulas_output < input.formulas_input) {
      errors.push(`Perdeu ${input.formulas_input - input.formulas_output} fórmula(s)`);
    }
  }

  return {
    passed: errors.length === 0,
    layer: 'quantitative',
    score: errors.length === 0 ? 1.0 : 0.5,
    warnings,
    errors,
  };
}

// =============================================================
// Camada 3: Semântica (extração de keywords + match)
//
// Versão simplificada: extrai palavras-chave por frequência e
// confere quantas estão presentes no output. Não é YAKE/KeyBERT,
// mas dá um sinal forte com zero dependência externa.
// =============================================================
const STOPWORDS_PT = new Set([
  'de','da','do','das','dos','e','a','o','as','os','que','para','com','em','no','na',
  'nos','nas','um','uma','uns','umas','é','por','se','ao','aos','à','às','mais','seu','sua',
  'seus','suas','este','esta','estes','estas','esse','essa','esses','essas','isso','isto',
  'são','foi','foram','ser','estar','tem','ter','não','sim','também','já','mas','ou',
]);

function extractKeywords(text: string, topK = 20): string[] {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS_PT.has(w));

  const freq = new Map<string, number>();
  for (const w of normalized) freq.set(w, (freq.get(w) ?? 0) + 1);

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([w]) => w);
}

export function validateSemantic(original: string, output: string): ValidationResult {
  const keywordsOriginal = extractKeywords(original, 15);
  const outputLower = output.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const found = keywordsOriginal.filter((kw) => outputLower.includes(kw));
  const score = keywordsOriginal.length === 0 ? 1.0 : found.length / keywordsOriginal.length;

  const warnings: string[] = [];
  const errors: string[] = [];
  if (score < TARGETS.semantic_score_warning) {
    errors.push(`Fidelidade semântica baixa: ${(score * 100).toFixed(0)}% das keywords preservadas`);
  } else if (score < TARGETS.semantic_score_pass) {
    warnings.push(`Fidelidade semântica média: ${(score * 100).toFixed(0)}% das keywords (alvo ≥ ${TARGETS.semantic_score_pass * 100}%)`);
  }

  return {
    passed: score >= TARGETS.semantic_score_warning,
    layer: 'semantic',
    score,
    warnings,
    errors,
  };
}

// =============================================================
// Camada 4: LLM-as-judge
// =============================================================
const JUDGE_SYSTEM = `Você é um avaliador imparcial de sínteses acadêmicas.

Compare o ORIGINAL e a SÍNTESE. Atribua notas 0-10 em 4 dimensões:
1. fidelidade   — a síntese mantém o que o original disse?
2. completude   — cobre os pontos principais?
3. didatica     — organização clara, fácil de estudar?
4. formatacao   — segue padrão Markdown + LaTeX corretamente?

Retorne JSON estrito:
{
  "fidelidade": number,
  "completude": number,
  "didatica": number,
  "formatacao": number,
  "comentario": string
}`;

export async function validateJudge(
  original: string,
  output: string,
): Promise<ValidationResult & { breakdown?: Record<string, number>; comment?: string }> {
  const truncOriginal = original.slice(0, 6000);
  const userMsg = `## ORIGINAL\n\n${truncOriginal}\n\n## SÍNTESE\n\n${output}`;

  try {
    const res = await callLLMWithRetry({
      model: (await getModelConfig()).judge,
      messages: [
        { role: 'system', content: JUDGE_SYSTEM },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.0,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });

    const parsed = parseJsonFromLLM<{
      fidelidade: number;
      completude: number;
      didatica: number;
      formatacao: number;
      comentario: string;
    }>(res.content);

    const avg = (parsed.fidelidade + parsed.completude + parsed.didatica + parsed.formatacao) / 4;
    const warnings: string[] = [];
    const errors: string[] = [];

    if (avg < TARGETS.judge_score_warning) {
      errors.push(`Judge avg ${avg.toFixed(1)} < ${TARGETS.judge_score_warning} (mínimo)`);
    } else if (avg < TARGETS.judge_score_pass) {
      warnings.push(`Judge avg ${avg.toFixed(1)} — abaixo do alvo ${TARGETS.judge_score_pass}`);
    }

    return {
      passed: avg >= TARGETS.judge_score_warning,
      layer: 'judge',
      score: avg,
      warnings,
      errors,
      breakdown: parsed,
      comment: parsed.comentario,
    };
  } catch (err) {
    return {
      passed: true, // não bloqueia se judge falhar
      layer: 'judge',
      score: 0,
      warnings: [`Judge indisponível: ${(err as Error).message}`],
      errors: [],
    };
  }
}

// =============================================================
// Decisão final: aceita / warning / rejeita
// =============================================================
export type ValidationVerdict = 'passed' | 'warning' | 'rejected';

export function decideVerdict(results: ValidationResult[]): ValidationVerdict {
  const anyError = results.some((r) => r.errors.length > 0);
  if (anyError) return 'rejected';
  const anyWarning = results.some((r) => r.warnings.length > 0);
  return anyWarning ? 'warning' : 'passed';
}
