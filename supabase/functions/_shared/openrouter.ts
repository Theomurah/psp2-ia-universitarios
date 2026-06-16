/**
 * Wrapper de chat completions multi-provider (T22).
 *
 * Roteia por PREFIXO do modelo (estilo gateway). Você cadastra um secret por
 * IA no Supabase e o prefixo decide qual chave + endpoint usar:
 *
 *   openai/gpt-5-mini          → OPENAI_API_KEY      → api.openai.com
 *   anthropic/claude-haiku-4-5 → ANTHROPIC_API_KEY   → api.anthropic.com
 *   google/gemini-2.5-flash    → GEMINI_API_KEY      → generativelanguage (OpenAI-compat)
 *   openrouter/<provider>/<m>  → OPENROUTER_API_KEY  → openrouter.ai
 *
 * Regras de fallback (compatível com o desenho original em OpenRouter):
 *   - Prefixo de provider nativo só é usado SE a chave dele estiver setada;
 *     senão a string completa cai no OpenRouter.
 *   - Sem prefixo conhecido: usa LLM_BASE_URL/LLM_API_KEY (endpoint custom
 *     OpenAI-compatible) se setados, senão OpenRouter com a string completa.
 *
 * ATENÇÃO ao usar provider NATIVO: os IDs de modelo são os nativos do provider,
 * não os do catálogo OpenRouter. Ex: Sonnet 4.6 no OpenRouter é
 * "anthropic/claude-sonnet-4.6", mas direto na Anthropic é
 * "anthropic/claude-sonnet-4-6" (traços, não pontos).
 *
 * Docs: https://openrouter.ai/docs | https://platform.openai.com/docs/api-reference/chat
 *       https://docs.anthropic.com/en/api/messages
 */

/**
 * Content de mensagem multimodal (OpenAI-compatible).
 * - Texto puro: string
 * - Multimodal: array de partes texto/imagem
 */
export type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LLMContentPart[];
}

export interface LLMCallOptions {
  model: string;                       // ex: "openai/gpt-5-mini", "anthropic/claude-haiku-4-5"
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
  stream?: boolean;
}

export interface LLMCallResult {
  content: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  finish_reason: string;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

// =============================================================
// Registry de providers
// =============================================================

interface ProviderConfig {
  id: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'custom';
  baseUrl: string;
  apiKeyEnv: string[];        // tentadas em ordem; primeira com valor ganha
  format: 'openai' | 'anthropic';
}

const PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    id: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: ['OPENAI_API_KEY'],
    format: 'openai',
  },
  anthropic: {
    id: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: ['ANTHROPIC_API_KEY'],
    format: 'anthropic',
  },
  google: {
    // Endpoint OpenAI-compatible do Gemini
    id: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    format: 'openai',
  },
  openrouter: {
    id: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: ['OPENROUTER_API_KEY', 'LLM_API_KEY'],
    format: 'openai',
  },
};

interface ResolvedRoute {
  provider: ProviderConfig;
  model: string;     // ID enviado ao provider (com prefixo de gateway removido)
  apiKey: string;
}

function getKey(envs: string[]): string | undefined {
  for (const e of envs) {
    const v = Deno.env.get(e);
    if (v) return v;
  }
  return undefined;
}

/**
 * Decide qual provider + chave + ID de modelo usar a partir do prefixo.
 * Exporta-se só pra teste/observabilidade; o pipeline usa callLLM.
 */
export function resolveRoute(model: string): ResolvedRoute {
  const slash = model.indexOf('/');
  const prefix = slash > 0 ? model.slice(0, slash) : '';
  const rest = slash > 0 ? model.slice(slash + 1) : model;

  // 1) Prefixo de provider NATIVO (openai/anthropic/google) — só se a chave existir
  const native = PROVIDERS[prefix];
  if (native && native.id !== 'openrouter') {
    const apiKey = getKey(native.apiKeyEnv);
    if (apiKey) return { provider: native, model: rest, apiKey };
    // Sem a chave do provider → cai pro fallback abaixo (não quebra quem usa OpenRouter)
  }

  // 2) Prefixo explícito "openrouter/" → OpenRouter, removendo só o gateway
  if (prefix === 'openrouter') {
    const apiKey = getKey(PROVIDERS.openrouter.apiKeyEnv);
    if (!apiKey) throw new OpenRouterError('OPENROUTER_API_KEY não está configurada', 500);
    return { provider: PROVIDERS.openrouter, model: rest, apiKey };
  }

  // 3) Endpoint custom OpenAI-compatible (LLM_BASE_URL) — provider único legado
  const customBase = Deno.env.get('LLM_BASE_URL');
  const customKey = Deno.env.get('LLM_API_KEY');
  if (customBase && customKey) {
    return {
      provider: {
        id: 'custom',
        baseUrl: customBase.replace(/\/+$/, ''),
        apiKeyEnv: ['LLM_API_KEY'],
        format: 'openai',
      },
      model, // string completa, sem remover prefixo
      apiKey: customKey,
    };
  }

  // 4) Default: OpenRouter com a string completa (comportamento original)
  const apiKey = getKey(PROVIDERS.openrouter.apiKeyEnv);
  if (!apiKey) {
    throw new OpenRouterError(
      'Nenhuma chave de LLM configurada (OPENROUTER_API_KEY ou a chave do provider do modelo)',
      500,
    );
  }
  return { provider: PROVIDERS.openrouter, model, apiKey };
}

/**
 * Modelos de raciocínio da OpenAI (gpt-5*, o1/o3/o4*) rejeitam `temperature`
 * custom e usam `max_completion_tokens` no lugar de `max_tokens`. gpt-5-chat
 * é a exceção (não é reasoning). Só vale falando direto com a OpenAI/custom —
 * OpenRouter e o endpoint do Gemini normalizam sozinhos.
 */
function isOpenAIReasoningModel(model: string): boolean {
  if (/^o\d/.test(model)) return true;
  return /^gpt-5/.test(model) && !model.startsWith('gpt-5-chat');
}

// =============================================================
// Adapter: OpenAI-compatible (OpenAI nativo, Gemini, OpenRouter, custom)
// =============================================================

async function callLLMOpenAICompat(
  route: ResolvedRoute,
  opts: LLMCallOptions,
): Promise<LLMCallResult> {
  const isOpenRouter = route.provider.id === 'openrouter';
  const usesReasoningParams =
    (route.provider.id === 'openai' || route.provider.id === 'custom') &&
    isOpenAIReasoningModel(route.model);

  const body: Record<string, unknown> = {
    model: route.model,
    messages: opts.messages,
    stream: opts.stream ?? false,
  };
  if (usesReasoningParams) {
    // Floor de tokens: o raciocínio é cobrado dentro do max_completion_tokens;
    // budgets baixos (ex: classify usa 512) podem zerar a resposta.
    body.max_completion_tokens = Math.max(opts.max_tokens ?? 4096, 2048);
    body.reasoning_effort = 'low';
  } else {
    body.temperature = opts.temperature ?? 0.2;
    body.max_tokens = opts.max_tokens ?? 4096;
  }
  if (opts.response_format) body.response_format = opts.response_format;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${route.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (isOpenRouter) {
    headers['HTTP-Referer'] = 'https://github.com/Theomurah/psp2-ia-universitarios';
    headers['X-Title'] = 'PSP2 IA Universitários';
  }

  const res = await fetch(`${route.provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new OpenRouterError(`LLM API ${res.status}: ${errBody}`, res.status, errBody);
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await res.json();
  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new OpenRouterError('Resposta inesperada da LLM API', 502, data);
  }

  return {
    content: choice.message.content,
    model: data.model ?? route.model,
    tokens_input: data.usage?.prompt_tokens ?? 0,
    tokens_output: data.usage?.completion_tokens ?? 0,
    // OpenRouter manda total_cost; providers nativos não → custo calculado fora.
    cost_usd: data.usage?.total_cost ?? 0,
    finish_reason: choice.finish_reason ?? 'unknown',
  };
}

// =============================================================
// Adapter: Anthropic nativo (/v1/messages — NÃO é OpenAI-compatible)
// =============================================================

type AnthropicSource =
  | { type: 'base64'; media_type: string; data: string }
  | { type: 'url'; url: string };

function imageUrlToAnthropicSource(url: string): AnthropicSource {
  const m = url.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) return { type: 'base64', media_type: m[1], data: m[2] };
  return { type: 'url', url };
}

/** Separa as system messages (top-level na Anthropic) e converte o multimodal. */
function toAnthropicMessages(messages: LLMMessage[]): {
  system?: string;
  // deno-lint-ignore no-explicit-any
  messages: any[];
} {
  const system: string[] = [];
  // deno-lint-ignore no-explicit-any
  const out: any[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      system.push(
        typeof m.content === 'string'
          ? m.content
          : m.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n'),
      );
      continue;
    }
    const content =
      typeof m.content === 'string'
        ? m.content
        : m.content.map((part) =>
            part.type === 'text'
              ? { type: 'text', text: part.text }
              : { type: 'image', source: imageUrlToAnthropicSource(part.image_url.url) },
          );
    out.push({ role: m.role, content });
  }

  return { system: system.length ? system.join('\n\n') : undefined, messages: out };
}

async function callLLMAnthropic(
  route: ResolvedRoute,
  opts: LLMCallOptions,
): Promise<LLMCallResult> {
  const { system, messages } = toAnthropicMessages(opts.messages);

  // Anthropic não tem response_format: json_object — reforçamos via system.
  let finalSystem = system;
  if (opts.response_format?.type === 'json_object') {
    finalSystem =
      `${finalSystem ? finalSystem + '\n\n' : ''}` +
      'Responda APENAS com JSON válido, sem texto fora do JSON e sem cercas de código.';
  }

  const body: Record<string, unknown> = {
    model: route.model,
    messages,
    max_tokens: opts.max_tokens ?? 4096,
  };
  if (finalSystem) body.system = finalSystem;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const res = await fetch(`${route.provider.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': route.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new OpenRouterError(`LLM API ${res.status}: ${errBody}`, res.status, errBody);
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await res.json();
  const textBlock = Array.isArray(data.content)
    ? data.content.find((b: { type: string }) => b.type === 'text')
    : null;
  if (!textBlock?.text) {
    throw new OpenRouterError('Resposta inesperada da Anthropic', 502, data);
  }

  return {
    content: textBlock.text,
    model: data.model ?? route.model,
    tokens_input: data.usage?.input_tokens ?? 0,
    tokens_output: data.usage?.output_tokens ?? 0,
    cost_usd: 0, // Anthropic não devolve custo na resposta
    finish_reason: data.stop_reason ?? 'unknown',
  };
}

/**
 * Teto de tokens de SAÍDA por chamada do pipeline (cost guard).
 * Default 8192 (= maior budget de estágio hoje: synthesize/compress). Ajustável
 * pra baixo via `LLM_MAX_OUTPUT_TOKENS` sem redeploy de código — útil pra cortar
 * custo num provider caro (ex: OpenAI direto). Vale como TETO: nunca eleva o
 * budget que o estágio pediu, só reduz.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

/**
 * Resolve o max_tokens efetivo de uma chamada: min(pedido_do_estágio, teto_env).
 * Exportada pra teste.
 */
export function resolveMaxOutputTokens(requested: number | undefined): number {
  const raw = Deno.env.get('LLM_MAX_OUTPUT_TOKENS');
  const cap = raw ? Number.parseInt(raw, 10) : NaN;
  const ceiling = Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_MAX_OUTPUT_TOKENS;
  if (requested == null) return ceiling;
  return Math.min(requested, ceiling);
}

/**
 * Faz uma chamada de chat completion roteando pelo provider do modelo.
 * Retorna conteúdo + métricas de uso/custo.
 */
export async function callLLM(opts: LLMCallOptions): Promise<LLMCallResult> {
  const route = resolveRoute(opts.model);
  // Cap único pra todas as chamadas do fluxo (classify/synthesize/compress/judge/vision).
  const capped: LLMCallOptions = { ...opts, max_tokens: resolveMaxOutputTokens(opts.max_tokens) };
  return route.provider.format === 'anthropic'
    ? callLLMAnthropic(route, capped)
    : callLLMOpenAICompat(route, capped);
}

/**
 * Helper: garante que a resposta veio como JSON parseável.
 * Útil para chamadas que setam response_format: json_object.
 */
export function parseJsonFromLLM<T = unknown>(content: string): T {
  // Remove cerca de código se vier
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new OpenRouterError(
      `LLM retornou JSON inválido: ${(err as Error).message}\nContent: ${content.slice(0, 200)}`,
      502,
    );
  }
}

/**
 * Callback opcional disparado a cada retry transitório.
 * Permite que o caller registre o evento em job_events (event_type='retry')
 * ou em qualquer outro sink — sem acoplar este módulo ao Supabase.
 * Origem: auditoria 2026-05-26 (Agente 4 — Observabilidade, A11).
 */
export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  status: number;
  delayMs: number;
  message: string;
  model: string;
}
export type OnRetryCallback = (info: RetryInfo) => void | Promise<void>;

/**
 * Retry com backoff exponencial.
 * Tenta callLLM até `maxAttempts` vezes em caso de erros transientes (rate limit, 5xx).
 */
export async function callLLMWithRetry(
  opts: LLMCallOptions,
  maxAttempts = 3,
  onRetry?: OnRetryCallback,
): Promise<LLMCallResult> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callLLM(opts);
    } catch (err) {
      lastError = err as Error;
      const isTransient =
        err instanceof OpenRouterError &&
        (err.status === 429 || err.status >= 500);
      if (!isTransient || attempt === maxAttempts) throw err;
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      if (onRetry) {
        try {
          await onRetry({
            attempt,
            maxAttempts,
            status: (err as OpenRouterError).status,
            delayMs,
            message: (err as Error).message,
            model: opts.model,
          });
        } catch {
          // onRetry não deve quebrar o pipeline — só observabilidade
        }
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError ?? new Error('callLLMWithRetry falhou sem motivo identificado');
}
