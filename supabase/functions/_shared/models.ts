/**
 * Configuração de modelos LLM por estágio do pipeline.
 *
 * Resolução em cascata (primeiro que tiver valor ganha):
 *   1. Tabela `public.app_settings` (editável via painel /admin, runtime)
 *   2. Env var `MODEL_<STAGE>` (legacy — `supabase secrets set`)
 *   3. Default em `packages/shared/constants.ts`
 *
 * Params avançados (effort/verbosity/thinking) vivem em chaves paralelas
 * `model_<stage>_params` (jsonb objeto) e são lidos por getModelParams().
 *
 * Cache em memória com TTL de 60s — um único fetch popula config + params.
 * Edge Functions de longa vida reaproveitam; cold start sempre busca do banco.
 */

import { MODELS as DEFAULTS } from '../../../packages/shared/src/constants.ts';
import { createLogger } from './log.ts';
import type { ModelExtraParams } from './openrouter.ts';

const log = createLogger('models');

export interface ModelConfig {
  classify: string;
  synthesize: string;
  compress_compact: string;
  compress_cola: string;
  judge: string;
  vision: string;
}

export interface ModelParamsConfig {
  classify?: ModelExtraParams;
  synthesize?: ModelExtraParams;
  compress_compact?: ModelExtraParams;
  compress_cola?: ModelExtraParams;
  judge?: ModelExtraParams;
  vision?: ModelExtraParams;
}

const TTL_MS = 60_000;
let cachedConfig: ModelConfig | null = null;
let cachedParams: ModelParamsConfig | null = null;
let cachedAt = 0;

const KEY_MAP: Record<string, keyof ModelConfig> = {
  model_classify: 'classify',
  model_synthesize: 'synthesize',
  model_compress_compact: 'compress_compact',
  model_compress_cola: 'compress_cola',
  model_judge: 'judge',
  model_vision: 'vision',
};

const PARAMS_KEY_MAP: Record<string, keyof ModelParamsConfig> = {
  model_classify_params: 'classify',
  model_synthesize_params: 'synthesize',
  model_compress_compact_params: 'compress_compact',
  model_compress_cola_params: 'compress_cola',
  model_judge_params: 'judge',
  model_vision_params: 'vision',
};

async function fetchAppSettings(): Promise<{
  models: Partial<ModelConfig>;
  params: Partial<ModelParamsConfig>;
}> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return { models: {}, params: {} };

  try {
    const res = await fetch(
      `${url}/rest/v1/app_settings?select=key,value&key=like.model_*`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (!res.ok) {
      log.warn('app_settings_fetch_non_200', { http_status: res.status });
      return { models: {}, params: {} };
    }
    const rows = await res.json() as Array<{ key: string; value: unknown }>;
    const models: Partial<ModelConfig> = {};
    const params: Partial<ModelParamsConfig> = {};
    for (const row of rows) {
      const mField = KEY_MAP[row.key];
      if (mField && typeof row.value === 'string' && row.value.trim().length > 0) {
        models[mField] = row.value;
        continue;
      }
      const pField = PARAMS_KEY_MAP[row.key];
      if (pField && row.value && typeof row.value === 'object') {
        params[pField] = row.value as ModelExtraParams;
      }
    }
    return { models, params };
  } catch (err) {
    log.warn('app_settings_fetch_failed', log.fromError(err));
    return { models: {}, params: {} };
  }
}

/** Carrega config + params do banco e popula ambos os caches num fetch só. */
async function load(): Promise<void> {
  const { models, params } = await fetchAppSettings();

  cachedConfig = {
    classify:         models.classify         ?? Deno.env.get('MODEL_CLASSIFY')         ?? DEFAULTS.classify,
    synthesize:       models.synthesize       ?? Deno.env.get('MODEL_SYNTHESIZE')       ?? DEFAULTS.synthesize,
    compress_compact: models.compress_compact ?? Deno.env.get('MODEL_COMPRESS_COMPACT') ?? DEFAULTS.compress_compact,
    compress_cola:    models.compress_cola    ?? Deno.env.get('MODEL_COMPRESS_COLA')    ?? DEFAULTS.compress_cola,
    judge:            models.judge            ?? Deno.env.get('MODEL_JUDGE')            ?? DEFAULTS.judge,
    vision:           models.vision           ?? Deno.env.get('VISION_MODEL') ?? Deno.env.get('VISION_PROVIDER') ?? 'openai/gpt-4o-mini',
  };
  cachedParams = params;
  cachedAt = Date.now();
}

export async function getModelConfig(): Promise<ModelConfig> {
  if (cachedConfig && Date.now() - cachedAt < TTL_MS) return cachedConfig;
  await load();
  return cachedConfig!;
}

/** Params avançados por estágio (vazio se nada configurado). */
export async function getModelParams(): Promise<ModelParamsConfig> {
  if (cachedParams && Date.now() - cachedAt < TTL_MS) return cachedParams;
  await load();
  return cachedParams!;
}

export function resetModelConfig(): void {
  cachedConfig = null;
  cachedParams = null;
  cachedAt = 0;
}
