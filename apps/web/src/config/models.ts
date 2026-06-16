/**
 * Catálogo de modelos LLM disponíveis no painel /admin/modelos.
 *
 * Single source of truth dos IDs oferecidos no dropdown de seleção. O backend
 * (Edge Functions, `_shared/openrouter.ts`) roteia pelo PREFIXO do ID:
 *
 *   openai/...      → OPENAI_API_KEY    (API nativa da OpenAI)
 *   anthropic/...   → ANTHROPIC_API_KEY (API nativa da Anthropic — IDs com traço!)
 *   google/...      → GEMINI_API_KEY    (Gemini OpenAI-compat)
 *   openrouter/...  → OPENROUTER_API_KEY (gateway — strip do prefixo "openrouter/")
 *
 * Cada grupo é "destravado" pela chave do provider (ver useActiveProviders).
 * Modelos do grupo OpenRouter levam o prefixo explícito `openrouter/` pra
 * NUNCA colidir com o roteamento nativo (ex: `openrouter/anthropic/claude-...`
 * vai sempre pro OpenRouter, mesmo com ANTHROPIC_API_KEY setada).
 */

export type ProviderId = 'openai' | 'anthropic' | 'google' | 'openrouter';

export interface CatalogModel {
  /** ID enviado ao backend (formato de roteamento) */
  id: string;
  /** Nome de exibição */
  name: string;
  /** Provider/grupo — define qual chave destrava o modelo */
  provider: ProviderId;
  /** Tier pra badge na UI */
  tier: 'fast' | 'standard' | 'premium';
  /** Suporta visão (OCR de imagem)? Filtra o estágio de visão. */
  vision?: boolean;
  /** Dica curta (ex: "raciocínio", "mais barato") */
  note?: string;
}

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** Nome do secret no Supabase que destrava este provider */
  keyEnv: string;
}

export const PROVIDERS_META: ProviderMeta[] = [
  { id: 'openai',     label: 'OpenAI',                 keyEnv: 'OPENAI_API_KEY' },
  { id: 'anthropic',  label: 'Anthropic (Claude)',     keyEnv: 'ANTHROPIC_API_KEY' },
  { id: 'google',     label: 'Google (Gemini)',        keyEnv: 'GEMINI_API_KEY' },
  { id: 'openrouter', label: 'OpenRouter (catálogo)',  keyEnv: 'OPENROUTER_API_KEY' },
];

/**
 * Catálogo curado. Ampliar é só adicionar uma linha aqui — sem mudança no
 * backend nem migration (o valor escolhido vira app_settings via RPC).
 */
export const MODEL_CATALOG: CatalogModel[] = [
  // ---- OpenAI (nativo — OPENAI_API_KEY) ----
  { id: 'openai/gpt-5-mini',   name: 'GPT-5 mini',   provider: 'openai', tier: 'standard', vision: true, note: 'raciocínio, ótimo custo' },
  { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 mini', provider: 'openai', tier: 'standard', vision: true, note: 'geração mais recente' },
  { id: 'openai/gpt-5-nano',   name: 'GPT-5 nano',   provider: 'openai', tier: 'fast',     vision: true, note: 'mais barato' },
  { id: 'openai/gpt-4o-mini',  name: 'GPT-4o mini',  provider: 'openai', tier: 'fast',     vision: true },
  { id: 'openai/gpt-4o',       name: 'GPT-4o',       provider: 'openai', tier: 'standard', vision: true },

  // ---- Anthropic (nativo — ANTHROPIC_API_KEY — IDs com traço, não ponto) ----
  { id: 'anthropic/claude-haiku-4-5',  name: 'Claude Haiku 4.5',  provider: 'anthropic', tier: 'fast',     vision: true, note: 'rápido e barato' },
  { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', tier: 'standard', vision: true, note: 'melhor pra manuscrito' },
  { id: 'anthropic/claude-opus-4-8',   name: 'Claude Opus 4.8',   provider: 'anthropic', tier: 'premium',  vision: true },

  // ---- Google (nativo — GEMINI_API_KEY) ----
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', tier: 'fast',    vision: true, note: 'rápido e barato' },
  { id: 'google/gemini-2.5-pro',   name: 'Gemini 2.5 Pro',   provider: 'google', tier: 'premium', vision: true },

  // ---- OpenRouter (catálogo — OPENROUTER_API_KEY — prefixo explícito) ----
  { id: 'openrouter/anthropic/claude-haiku-4.5',        name: 'Claude Haiku 4.5 (OpenRouter)', provider: 'openrouter', tier: 'fast',     vision: true },
  { id: 'openrouter/openai/gpt-4o-mini',                name: 'GPT-4o mini (OpenRouter)',      provider: 'openrouter', tier: 'fast',     vision: true },
  { id: 'openrouter/google/gemini-2.0-flash-exp',       name: 'Gemini 2.0 Flash (OpenRouter)', provider: 'openrouter', tier: 'fast',     vision: true },
  { id: 'openrouter/deepseek/deepseek-chat-v3',         name: 'DeepSeek V3',                   provider: 'openrouter', tier: 'standard', note: 'barato' },
  { id: 'openrouter/meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B',                 provider: 'openrouter', tier: 'standard' },
  { id: 'openrouter/qwen/qwen-2.5-72b-instruct',        name: 'Qwen 2.5 72B',                  provider: 'openrouter', tier: 'standard' },
];

const BY_ID = new Map(MODEL_CATALOG.map((m) => [m.id, m]));

export function getCatalogModel(id: string): CatalogModel | undefined {
  return BY_ID.get(id);
}

/** Deriva o provider de um ID arbitrário (inclusive valores legados/custom). */
export function providerOf(id: string): ProviderId {
  if (id.startsWith('openrouter/')) return 'openrouter';
  const prefix = id.split('/')[0];
  if (prefix === 'openai' || prefix === 'anthropic' || prefix === 'google') return prefix;
  // Sem prefixo nativo conhecido → cai no OpenRouter (default do backend)
  return 'openrouter';
}
