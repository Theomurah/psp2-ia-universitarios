/**
 * Configuração de modelos LLM por estágio do pipeline.
 *
 * Resolução em cascata (primeiro que tiver valor ganha):
 *   1. Tabela `public.app_settings` (editável via painel /admin, runtime)
 *   2. Env var `MODEL_<STAGE>` (legacy — `supabase secrets set`)
 *   3. Default em `packages/shared/constants.ts`
 *
 * Cache em memória com TTL de 60s. Edge Functions de longa vida reaproveitam;
 * cold start sempre busca do banco.
 */

import { MODELS as DEFAULTS } from '../../../packages/shared/src/constants.ts';
import { createLogger } from './log.ts';

const log = createLogger('models');

export interface ModelConfig {
  classify: string;
  synthesize: string;
  compress_compact: string;
  compress_cola: string;
  judge: string;
  vision: string;
}

const TTL_MS = 60_000;
let cached: ModelConfig | null = null;
let cachedAt = 0;

const KEY_MAP: Record<string, keyof ModelConfig> = {
  model_classify: 'classify',
  model_synthesize: 'synthesize',
  model_compress_compact: 'compress_compact',
  model_compress_cola: 'compress_cola',
  model_judge: 'judge',
  model_vision: 'vision',
};

async function fetchAppSettings(): Promise<Partial<ModelConfig>> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return {};

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
      return {};
    }
    const rows = await res.json() as Array<{ key: string; value: unknown }>;
    const out: Partial<ModelConfig> = {};
    for (const row of rows) {
      const field = KEY_MAP[row.key];
      if (field && typeof row.value === 'string' && row.value.trim().length > 0) {
        out[field] = row.value;
      }
    }
    return out;
  } catch (err) {
    log.warn('app_settings_fetch_failed', log.fromError(err));
    return {};
  }
}

export async function getModelConfig(): Promise<ModelConfig> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;

  const db = await fetchAppSettings();

  cached = {
    classify:         db.classify         ?? Deno.env.get('MODEL_CLASSIFY')         ?? DEFAULTS.classify,
    synthesize:       db.synthesize       ?? Deno.env.get('MODEL_SYNTHESIZE')       ?? DEFAULTS.synthesize,
    compress_compact: db.compress_compact ?? Deno.env.get('MODEL_COMPRESS_COMPACT') ?? DEFAULTS.compress_compact,
    compress_cola:    db.compress_cola    ?? Deno.env.get('MODEL_COMPRESS_COLA')    ?? DEFAULTS.compress_cola,
    judge:            db.judge            ?? Deno.env.get('MODEL_JUDGE')            ?? DEFAULTS.judge,
    vision:           db.vision           ?? Deno.env.get('VISION_MODEL') ?? Deno.env.get('VISION_PROVIDER') ?? 'anthropic/claude-sonnet-4.6',
  };
  cachedAt = Date.now();
  return cached;
}

export function resetModelConfig(): void {
  cached = null;
  cachedAt = 0;
}
