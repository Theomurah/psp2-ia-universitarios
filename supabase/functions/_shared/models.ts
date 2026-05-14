/**
 * Configuração de modelos LLM por estágio do pipeline.
 *
 * Cada estágio pode ser sobreescrito por env var. Sem env, usa o default
 * de packages/shared/constants.ts. Trocar modelo é zero código:
 *
 *   supabase secrets set MODEL_CLASSIFY=openai/gpt-4o-mini
 *   supabase secrets set MODEL_SYNTHESIZE=deepseek/deepseek-chat-v3
 *   supabase secrets set MODEL_COMPRESS_COMPACT=google/gemini-2.0-flash-exp
 *
 * Lista completa de modelos OpenRouter: https://openrouter.ai/models
 *
 * Esta camada existe SÓ no backend (Edge Functions) — frontend não precisa
 * saber qual modelo está sendo usado.
 */

import { MODELS as DEFAULTS } from '../../../packages/shared/src/constants.ts';

export interface ModelConfig {
  classify: string;
  synthesize: string;
  compress_compact: string;
  compress_cola: string;
  judge: string;
  vision: string;
}

let cached: ModelConfig | null = null;

export function getModelConfig(): ModelConfig {
  if (cached) return cached;

  cached = {
    classify:         Deno.env.get('MODEL_CLASSIFY')         ?? DEFAULTS.classify,
    synthesize:       Deno.env.get('MODEL_SYNTHESIZE')       ?? DEFAULTS.synthesize,
    compress_compact: Deno.env.get('MODEL_COMPRESS_COMPACT') ?? DEFAULTS.compress_compact,
    compress_cola:    Deno.env.get('MODEL_COMPRESS_COLA')    ?? DEFAULTS.compress_cola,
    judge:            Deno.env.get('MODEL_JUDGE')            ?? DEFAULTS.judge,
    // VISION_MODEL é lido pela factory em _shared/vision/index.ts
    // exposto aqui só pra debug
    vision:           Deno.env.get('VISION_MODEL') ?? Deno.env.get('VISION_PROVIDER') ?? 'anthropic/claude-sonnet-4.6',
  };

  return cached;
}

/**
 * Reseta o cache. Útil em testes ou se precisar recarregar config sem reiniciar.
 */
export function resetModelConfig(): void {
  cached = null;
}
