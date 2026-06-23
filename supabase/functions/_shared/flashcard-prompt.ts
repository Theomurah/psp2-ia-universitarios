/**
 * Geração de flashcards por IA — prompt + parsing puros (Fase 6, frente 2.1).
 *
 * Recebe o material do aluno + um contexto e produz cartões frente/verso com
 * LaTeX. O input é sandboxado (<<DOC>>) como em todo prompt que recebe conteúdo
 * do aluno (CLAUDE.md, regra de segurança 4). Sem efeitos colaterais: testável.
 */

import type { LLMMessage } from './openrouter.ts';
import { sandboxUserInput, SANDBOX_INSTRUCTION } from './prompts.ts';

export interface GeneratedCard {
  front: string;
  back: string;
  topico: string | null;
  tags: string[];
}

export const MAX_GEN_CARDS = 50;
export const MAX_INPUT_CHARS = 40_000;

const SYSTEM_PROMPT = `Você é um gerador de flashcards de estudo para universitários, a partir de um material fornecido.

Regras:
- Gere até a quantidade pedida de cartões (menos se o material não comportar). Não invente conteúdo fora do material.
- FRENTE: uma pergunta ou conceito curto e objetivo. VERSO: a resposta completa, correta e suficiente para estudo.
- Use LaTeX para QUALQUER fórmula ou símbolo matemático: $...$ para inline e $$...$$ para bloco. Nada de imagens.
- Markdown simples é permitido (negrito, listas). Não use HTML.
- "topico" é um rótulo curto do assunto do cartão (ex.: "Derivadas"). "tags" é uma lista curta de palavras-chave.
- Responda APENAS com JSON válido, no formato exato: {"cards":[{"front":"...","back":"...","topico":"...","tags":["..."]}]}. Sem texto fora do JSON.

${SANDBOX_INSTRUCTION}`;

/** Monta as mensagens (system + user) pra geração. */
export function buildFlashcardMessages(text: string, context: string, count: number): LLMMessage[] {
  const n = clampCount(count);
  const material = sandboxUserInput(text.slice(0, MAX_INPUT_CHARS));
  const ctx = context.trim() || 'Cartões gerais cobrindo os pontos principais do material.';
  const user = `Contexto/instruções do aluno: ${ctx}\nQuantidade desejada de cartões: ${n}\n\nMaterial de base:\n${material}`;
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}

export function clampCount(count: number): number {
  if (!Number.isFinite(count)) return 10;
  return Math.min(MAX_GEN_CARDS, Math.max(1, Math.floor(count)));
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((t) => asString(t)).filter(Boolean).slice(0, 10);
}

/**
 * Faz o parse e valida a resposta do LLM. Aceita `{cards:[...]}` ou um array
 * cru, tolera cercas de código, descarta cartões sem frente/verso e limita a
 * `max`. Devolve [] se não der pra extrair nada (caller decide o erro).
 */
export function parseFlashcardsResponse(content: string, max = MAX_GEN_CARDS): GeneratedCard[] {
  const cleaned = content.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const rawCards = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { cards?: unknown })?.cards)
      ? (parsed as { cards: unknown[] }).cards
      : [];

  const out: GeneratedCard[] = [];
  for (const item of rawCards) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const front = asString(rec.front);
    const back = asString(rec.back);
    if (!front || !back) continue;
    const topico = asString(rec.topico) || null;
    out.push({ front, back, topico, tags: asTags(rec.tags) });
    if (out.length >= max) break;
  }
  return out;
}
