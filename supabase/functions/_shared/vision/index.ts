/**
 * Factory de Vision Provider — totalmente dinâmica.
 *
 * 2 modos de uso (em ordem de prioridade):
 *
 * 1. VISION_MODEL — string do modelo OpenRouter (ANY vision-capable model)
 *    Ex: VISION_MODEL=openai/gpt-4o
 *        VISION_MODEL=qwen/qwen-2-vl-72b-instruct
 *        VISION_MODEL=meta-llama/llama-3.2-90b-vision-instruct
 *
 * 2. VISION_PROVIDER — alias legado pra "claude" | "gemini"
 *    (mantido por compatibilidade, mas VISION_MODEL é o caminho recomendado)
 *
 * Default: "anthropic/claude-sonnet-4.6"
 *
 * Pra adicionar um modelo novo:
 *   apenas setar VISION_MODEL=fornecedor/nome-do-modelo
 *   (sem mudança de código)
 */

import { VisionProvider } from './types.ts';
import { OpenRouterVisionProvider } from './openrouter-vision.ts';
import { createLogger } from '../log.ts';
import type { ModelExtraParams } from '../openrouter.ts';

const log = createLogger('vision');

export * from './types.ts';
export { OpenRouterVisionProvider };

// Aliases legados — convertidos pra model strings
const PROVIDER_ALIASES: Record<string, string> = {
  claude: 'anthropic/claude-sonnet-4.6',
  gemini: 'google/gemini-2.0-flash-exp',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4-vision': 'openai/gpt-4-vision-preview',
  qwen: 'qwen/qwen-2-vl-72b-instruct',
  llama: 'meta-llama/llama-3.2-90b-vision-instruct',
};

export function getVisionProvider(
  overrideModel?: string,
  params?: ModelExtraParams,
): VisionProvider {
  const opts = { params };
  // 1) Override programático tem prioridade
  if (overrideModel) {
    return new OpenRouterVisionProvider(resolveModel(overrideModel), opts);
  }

  // 2) VISION_MODEL — caminho recomendado, aceita qualquer string
  const visionModel = Deno.env.get('VISION_MODEL');
  if (visionModel) {
    return new OpenRouterVisionProvider(resolveModel(visionModel), opts);
  }

  // 3) VISION_PROVIDER — alias legado
  const visionProvider = Deno.env.get('VISION_PROVIDER');
  if (visionProvider) {
    return new OpenRouterVisionProvider(resolveModel(visionProvider), opts);
  }

  // 4) Default
  return new OpenRouterVisionProvider('anthropic/claude-sonnet-4.6', opts);
}

function resolveModel(input: string): string {
  // Se for um alias conhecido, expande
  if (PROVIDER_ALIASES[input]) return PROVIDER_ALIASES[input];
  // Se já parece "fornecedor/modelo" passa direto
  if (input.includes('/')) return input;
  // Senão, assume que o aluno digitou um alias e cai pro default
  log.warn('vision_model_unrecognized', { input, fallback: 'anthropic/claude-sonnet-4.6' });
  return 'anthropic/claude-sonnet-4.6';
}

