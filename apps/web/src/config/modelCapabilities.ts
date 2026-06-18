/**
 * Detecção de capabilities por modelo — decide quais params avançados o editor
 * deve mostrar (effort, verbosity, thinking) conforme o que cada modelo aceita.
 *
 * Espelho do backend `_shared/openrouter.ts` (isOpenAIReasoningModel,
 * anthropicRejectsSampling + aplicação de params). Mantenha em sync.
 *
 * IMPORTANTE: params avançados só são oferecidos para modelos roteados
 * NATIVAMENTE (prefixo openai/ anthropic/ google/). Modelos via `openrouter/`
 * ou IDs legados caem em family=null — o backend não aplicaria thinking nesse
 * caminho, então não adianta expor o controle.
 */

export type ModelFamily =
  | 'openai-reasoning'
  | 'anthropic-adaptive'
  | 'anthropic-extended'
  | 'gemini-reasoning'
  | null;

export interface ModelCaps {
  family: ModelFamily;
  /** verbosity é exclusiva da família gpt-5. */
  supportsVerbosity: boolean;
}

const NO_CAPS: ModelCaps = { family: null, supportsVerbosity: false };

/**
 * @param catalogId ID no formato de roteamento (ex: 'openai/gpt-5-mini',
 *   'anthropic/claude-haiku-4-5', 'openrouter/...').
 */
export function getModelCaps(catalogId: string): ModelCaps {
  const slash = catalogId.indexOf('/');
  const prefix = slash > 0 ? catalogId.slice(0, slash) : '';
  const bare = slash > 0 ? catalogId.slice(slash + 1) : catalogId;

  // Só providers nativos expõem params avançados (ver doc acima).
  if (prefix !== 'openai' && prefix !== 'anthropic' && prefix !== 'google') {
    return NO_CAPS;
  }

  // OpenAI reasoning (gpt-5*, o1/o3/o4*) — exceto variantes -chat
  if (/^o[1-9]/.test(bare) || (/^gpt-5/.test(bare) && !/-chat/.test(bare))) {
    return { family: 'openai-reasoning', supportsVerbosity: /^gpt-5/.test(bare) };
  }

  // Anthropic adaptive (Sonnet 4.6+, Opus 4.6+, Fable) — effort
  if (/^claude-(opus-4-[6-9]|sonnet-4-[6-9]|fable)/.test(bare)) {
    return { family: 'anthropic-adaptive', supportsVerbosity: false };
  }
  // Anthropic extended legacy (Haiku 4.5, Sonnet 4.5, Haiku 3.5) — budget_tokens
  if (/^claude-(haiku-4-[5-9]|sonnet-4-[0-5]|haiku-3-5)/.test(bare)) {
    return { family: 'anthropic-extended', supportsVerbosity: false };
  }

  // Gemini 2.5 (OpenAI-compat) — reasoning_effort por passthrough
  if (/^gemini-2\.5/.test(bare)) {
    return { family: 'gemini-reasoning', supportsVerbosity: false };
  }

  return NO_CAPS;
}
