/**
 * Wrapper para OpenRouter (T22).
 *
 * OpenRouter expõe API compatível com OpenAI Chat Completions, mas permite
 * trocar de modelo (Claude, GPT, Gemini, ...) via 1 parâmetro.
 *
 * Docs: https://openrouter.ai/docs
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
  model: string;                       // ex: "anthropic/claude-sonnet-4.6"
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

/**
 * Faz uma chamada de chat completion via OpenRouter.
 * Lê OPENROUTER_API_KEY do env. Retorna conteúdo + métricas de uso/custo.
 */
export async function callLLM(opts: LLMCallOptions): Promise<LLMCallResult> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new OpenRouterError('OPENROUTER_API_KEY não está configurada', 500);
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.max_tokens ?? 4096,
    stream: opts.stream ?? false,
  };
  if (opts.response_format) body.response_format = opts.response_format;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/Theomurah/psp2-ia-universitarios',
      'X-Title': 'PSP2 IA Universitários',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new OpenRouterError(
      `OpenRouter ${res.status}: ${errBody}`,
      res.status,
      errBody,
    );
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await res.json();
  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new OpenRouterError('Resposta inesperada do OpenRouter', 502, data);
  }

  return {
    content: choice.message.content,
    model: data.model,
    tokens_input: data.usage?.prompt_tokens ?? 0,
    tokens_output: data.usage?.completion_tokens ?? 0,
    // OpenRouter manda total_cost em algumas respostas; senão calcular fora.
    cost_usd: data.usage?.total_cost ?? 0,
    finish_reason: choice.finish_reason ?? 'unknown',
  };
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
