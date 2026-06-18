/**
 * T15 — testes do wrapper OpenRouter (sem rede real).
 *
 * fetch é mockado globalmente. Cobrimos: chamada feliz, missing key,
 * 429 transiente com retry, JSON parser helper, parsing de resposta.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  callLLM,
  callLLMWithRetry,
  parseJsonFromLLM,
  resolveMaxOutputTokens,
  DEFAULT_MAX_OUTPUT_TOKENS,
  OpenRouterError,
} from '../openrouter.ts';

const okBody = {
  choices: [
    { message: { content: 'olá mundo' }, finish_reason: 'stop' },
  ],
  model: 'anthropic/claude-haiku-4.5',
  // Usage accounting do OpenRouter: o custo vem em `usage.cost`
  // (o antigo mock `total_cost` perpetuava um campo que não existe na API).
  usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.0001 },
};

beforeEach(() => {
  Deno.env.set('OPENROUTER_API_KEY', 'sk-test');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(okBody), { status: 200 }),
  );
});

afterEach(() => {
  Deno.env.delete('OPENROUTER_API_KEY');
  Deno.env.delete('OPENAI_API_KEY');
  Deno.env.delete('ANTHROPIC_API_KEY');
  Deno.env.delete('GEMINI_API_KEY');
  Deno.env.delete('LLM_BASE_URL');
  Deno.env.delete('LLM_API_KEY');
  Deno.env.delete('LLM_MAX_OUTPUT_TOKENS');
});

describe('resolveMaxOutputTokens (cost guard)', () => {
  it('sem env → usa o default como teto, preservando pedidos menores', () => {
    expect(resolveMaxOutputTokens(512)).toBe(512);
    expect(resolveMaxOutputTokens(8192)).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(resolveMaxOutputTokens(undefined)).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
  });

  it('clampa o pedido do estágio ao teto do env', () => {
    Deno.env.set('LLM_MAX_OUTPUT_TOKENS', '1000');
    expect(resolveMaxOutputTokens(8192)).toBe(1000); // synthesize cortado
    expect(resolveMaxOutputTokens(512)).toBe(512);   // classify intacto
    expect(resolveMaxOutputTokens(undefined)).toBe(1000);
  });

  it('env inválido/zero/negativo → ignora e cai no default', () => {
    for (const bad of ['abc', '0', '-5', '']) {
      Deno.env.set('LLM_MAX_OUTPUT_TOKENS', bad);
      expect(resolveMaxOutputTokens(8192)).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    }
  });

  it('callLLM aplica o teto no body enviado ao provider', async () => {
    Deno.env.set('LLM_MAX_OUTPUT_TOKENS', '256');
    await callLLM({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: 'oi' }],
      max_tokens: 8192,
    });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.max_tokens).toBe(256);
  });
});

describe('callLLM', () => {
  it('chama OpenRouter com headers obrigatórios + retorna content/usage', async () => {
    const res = await callLLM({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: 'oi' }],
    });

    expect(res.content).toBe('olá mundo');
    expect(res.tokens_input).toBe(10);
    expect(res.tokens_output).toBe(5);
    expect(res.cost_usd).toBe(0.0001);

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');
    expect(headers['HTTP-Referer']).toMatch(/github\.com/);
    expect(headers['X-Title']).toMatch(/PSP2/);
  });

  it('pede usage accounting ({ include: true }) e anexa AbortSignal de timeout', async () => {
    await callLLM({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: 'oi' }],
    });

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.usage).toEqual({ include: true });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('converte TimeoutError do fetch em OpenRouterError 408', async () => {
    const timeoutErr = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
    vi.mocked(fetch).mockRejectedValueOnce(timeoutErr);
    await expect(
      callLLM({ model: 'x', messages: [{ role: 'user', content: 'oi' }] }),
    ).rejects.toMatchObject({ status: 408, name: 'OpenRouterError' });
  });

  it('lança OpenRouterError com status quando key ausente', async () => {
    Deno.env.delete('OPENROUTER_API_KEY');
    await expect(
      callLLM({ model: 'x', messages: [{ role: 'user', content: 'oi' }] }),
    ).rejects.toThrowError(OpenRouterError);
  });

  it('lança OpenRouterError quando HTTP não-ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('rate limited', { status: 429 }),
    );
    await expect(
      callLLM({ model: 'x', messages: [{ role: 'user', content: 'oi' }] }),
    ).rejects.toMatchObject({ status: 429 });
  });
});

describe('roteamento por provider', () => {
  function lastCall() {
    const calls = vi.mocked(fetch).mock.calls;
    const call = calls[calls.length - 1];
    return {
      url: call[0] as string,
      init: call[1] as RequestInit,
      headers: (call[1] as RequestInit).headers as Record<string, string>,
      body: JSON.parse((call[1] as RequestInit).body as string),
    };
  }

  it('openai/ com OPENAI_API_KEY → API nativa da OpenAI, sem prefixo', async () => {
    Deno.env.set('OPENAI_API_KEY', 'sk-openai');
    await callLLM({ model: 'openai/gpt-4o-mini', messages: [{ role: 'user', content: 'oi' }] });

    const c = lastCall();
    expect(c.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(c.headers.Authorization).toBe('Bearer sk-openai');
    expect(c.headers['HTTP-Referer']).toBeUndefined();
    expect(c.body.model).toBe('gpt-4o-mini'); // prefixo removido
    expect(c.body.temperature).toBe(0.2);
  });

  it('modelo de raciocínio (gpt-5*) usa max_completion_tokens + reasoning_effort, sem temperature', async () => {
    Deno.env.set('OPENAI_API_KEY', 'sk-openai');
    await callLLM({
      model: 'openai/gpt-5-mini',
      messages: [{ role: 'user', content: 'oi' }],
      max_tokens: 512,
    });

    const c = lastCall();
    expect(c.body.max_completion_tokens).toBe(2048); // floor aplicado
    expect(c.body.reasoning_effort).toBe('low');
    expect(c.body.temperature).toBeUndefined();
    expect(c.body.max_tokens).toBeUndefined();
  });

  // Modelos novos do catálogo: versões pontuadas (gpt-5.4-nano, gpt-5.1, …) também
  // são reasoning e precisam do mesmo tratamento que o gpt-5-mini.
  it.each([
    'openai/gpt-5.4-nano',
    'openai/gpt-5.4-mini',
    'openai/gpt-5.1',
    'openai/gpt-5.4',
    'openai/gpt-5',
    'openai/gpt-5-nano',
  ])('%s (reasoning) → max_completion_tokens + reasoning_effort, sem temperature', async (model) => {
    Deno.env.set('OPENAI_API_KEY', 'sk-openai');
    await callLLM({ model, messages: [{ role: 'user', content: 'oi' }], max_tokens: 512 });

    const c = lastCall();
    expect(c.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(c.body.model).toBe(model.replace('openai/', ''));
    expect(c.body.max_completion_tokens).toBe(2048);
    expect(c.body.reasoning_effort).toBe('low');
    expect(c.body.temperature).toBeUndefined();
    expect(c.body.max_tokens).toBeUndefined();
  });

  // Modelos não-reasoning do catálogo (família gpt-4.x / gpt-4o) usam o caminho
  // clássico: temperature + max_tokens.
  it.each([
    'openai/gpt-4.1-nano',
    'openai/gpt-4.1-mini',
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
  ])('%s (não-reasoning) → temperature + max_tokens', async (model) => {
    Deno.env.set('OPENAI_API_KEY', 'sk-openai');
    await callLLM({ model, messages: [{ role: 'user', content: 'oi' }], temperature: 0.1, max_tokens: 4096 });

    const c = lastCall();
    expect(c.body.model).toBe(model.replace('openai/', ''));
    expect(c.body.temperature).toBe(0.1);
    expect(c.body.max_tokens).toBe(4096);
    expect(c.body.max_completion_tokens).toBeUndefined();
    expect(c.body.reasoning_effort).toBeUndefined();
  });

  // Variantes "-chat" NÃO são reasoning, mesmo nas versões pontuadas.
  it.each(['openai/gpt-5-chat', 'openai/gpt-5.1-chat'])(
    '%s (variante chat) NÃO é tratado como reasoning',
    async (model) => {
      Deno.env.set('OPENAI_API_KEY', 'sk-openai');
      await callLLM({ model, messages: [{ role: 'user', content: 'oi' }], max_tokens: 4096 });

      const c = lastCall();
      expect(c.body.temperature).toBe(0.2);
      expect(c.body.max_tokens).toBe(4096);
      expect(c.body.reasoning_effort).toBeUndefined();
      expect(c.body.max_completion_tokens).toBeUndefined();
    },
  );

  it('openai/ SEM OPENAI_API_KEY → cai no OpenRouter com a string completa', async () => {
    // só OPENROUTER_API_KEY está setado (beforeEach)
    await callLLM({ model: 'openai/gpt-4o-mini', messages: [{ role: 'user', content: 'oi' }] });

    const c = lastCall();
    expect(c.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(c.body.model).toBe('openai/gpt-4o-mini'); // prefixo preservado
    expect(c.headers['X-Title']).toMatch(/PSP2/);
  });

  it('anthropic/ com ANTHROPIC_API_KEY → /v1/messages, x-api-key, system extraído', async () => {
    Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'resposta claude' }],
          model: 'claude-haiku-4-5',
          usage: { input_tokens: 7, output_tokens: 3 },
          stop_reason: 'end_turn',
        }),
        { status: 200 },
      ),
    );

    const res = await callLLM({
      model: 'anthropic/claude-haiku-4-5',
      messages: [
        { role: 'system', content: 'Você é um assistente.' },
        { role: 'user', content: 'oi' },
      ],
      response_format: { type: 'json_object' },
    });

    expect(res.content).toBe('resposta claude');
    expect(res.tokens_input).toBe(7);
    expect(res.tokens_output).toBe(3);

    const c = lastCall();
    expect(c.url).toBe('https://api.anthropic.com/v1/messages');
    expect(c.headers['x-api-key']).toBe('sk-ant');
    expect(c.headers['anthropic-version']).toBe('2023-06-01');
    expect(c.body.model).toBe('claude-haiku-4-5');
    expect(c.body.messages).toEqual([{ role: 'user', content: 'oi' }]); // system saiu
    expect(c.body.system).toContain('Você é um assistente.');
    expect(c.body.system).toContain('JSON válido'); // reforço do json_object
  });

  it('google/ com GEMINI_API_KEY → endpoint OpenAI-compat do Gemini', async () => {
    Deno.env.set('GEMINI_API_KEY', 'sk-gem');
    await callLLM({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: 'oi' }] });

    const c = lastCall();
    expect(c.url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(c.headers.Authorization).toBe('Bearer sk-gem');
    expect(c.body.model).toBe('gemini-2.5-flash');
  });

  it('LLM_BASE_URL custom → endpoint próprio com a string completa', async () => {
    Deno.env.delete('OPENROUTER_API_KEY');
    Deno.env.set('LLM_BASE_URL', 'https://api.openai.com/v1/');
    Deno.env.set('LLM_API_KEY', 'sk-custom');
    await callLLM({ model: 'gpt-5-mini', messages: [{ role: 'user', content: 'oi' }], max_tokens: 256 });

    const c = lastCall();
    expect(c.url).toBe('https://api.openai.com/v1/chat/completions'); // barra final normalizada
    expect(c.headers.Authorization).toBe('Bearer sk-custom');
    expect(c.body.max_completion_tokens).toBe(2048); // reasoning detectado no custom (floor)
  });
});

describe('callLLMWithRetry', () => {
  it('reexecuta após 429 e converge no 2º attempt', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('rate limit', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okBody), { status: 200 }));

    // Não esperamos backoff real nos testes — o setTimeout interno usa
    // o relógio real (Math.min(1000 * 2^(n-1), 8000)). Pulamos via fake timers.
    vi.useFakeTimers();
    const promise = callLLMWithRetry({
      model: 'x',
      messages: [{ role: 'user', content: 'oi' }],
    });
    await vi.runAllTimersAsync();
    const res = await promise;
    vi.useRealTimers();

    expect(res.content).toBe('olá mundo');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('não reexecuta em erro permanente (400)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('bad request', { status: 400 }),
    );

    await expect(
      callLLMWithRetry({ model: 'x', messages: [{ role: 'user', content: 'oi' }] }),
    ).rejects.toMatchObject({ status: 400 });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('trata timeout (408) como transitório e reexecuta', async () => {
    const timeoutErr = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
    vi.mocked(fetch)
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce(new Response(JSON.stringify(okBody), { status: 200 }));

    vi.useFakeTimers();
    const promise = callLLMWithRetry({
      model: 'x',
      messages: [{ role: 'user', content: 'oi' }],
    });
    await vi.runAllTimersAsync();
    const res = await promise;
    vi.useRealTimers();

    expect(res.content).toBe('olá mundo');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});

describe('parseJsonFromLLM', () => {
  it('parseia JSON limpo', () => {
    expect(parseJsonFromLLM<{ x: number }>('{"x": 1}')).toEqual({ x: 1 });
  });

  it('remove cerca markdown ```json', () => {
    const wrapped = '```json\n{"materia_code":"FISICA3"}\n```';
    expect(parseJsonFromLLM<{ materia_code: string }>(wrapped)).toEqual({
      materia_code: 'FISICA3',
    });
  });

  it('lança OpenRouterError quando JSON inválido', () => {
    expect(() => parseJsonFromLLM('not json')).toThrowError(OpenRouterError);
  });

  it('não vaza o content do LLM na message do erro (vai pra logs/error_reason)', () => {
    const studentContent = 'TRECHO-SENSIVEL-DO-ALUNO sem json válido';
    try {
      parseJsonFromLLM(studentContent);
      expect.unreachable('deveria ter lançado');
    } catch (err) {
      const e = err as OpenRouterError;
      expect(e).toBeInstanceOf(OpenRouterError);
      // message só carrega o tamanho — o trecho fica em `body`,
      // que fromError() nunca serializa pra log.
      expect(e.message).not.toContain('TRECHO-SENSIVEL-DO-ALUNO');
      expect(e.message).toContain(`content_length=${studentContent.length}`);
      expect((e.body as { content_snippet: string }).content_snippet).toContain('TRECHO-SENSIVEL-DO-ALUNO');
    }
  });
});

describe('params avançados por modelo', () => {
  function lastBody() {
    const calls = vi.mocked(fetch).mock.calls;
    return JSON.parse((calls[calls.length - 1][1] as RequestInit).body as string);
  }
  const anthropicOk = () =>
    new Response(
      JSON.stringify({
        content: [{ type: 'text', text: 'ok' }],
        model: 'm',
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
      }),
      { status: 200 },
    );

  it('OpenAI reasoning: reasoning_effort + verbosity configuráveis', async () => {
    Deno.env.set('OPENAI_API_KEY', 'sk-openai');
    await callLLM({
      model: 'openai/gpt-5-mini',
      messages: [{ role: 'user', content: 'oi' }],
      max_tokens: 4096,
      params: { reasoning_effort: 'high', verbosity: 'low' },
    });
    const b = lastBody();
    expect(b.reasoning_effort).toBe('high'); // sobrescreve o default 'low'
    expect(b.verbosity).toBe('low');
  });

  it('verbosity é ignorada fora da família gpt-5', async () => {
    Deno.env.set('OPENAI_API_KEY', 'sk-openai');
    await callLLM({
      model: 'openai/o3-mini',
      messages: [{ role: 'user', content: 'oi' }],
      params: { verbosity: 'high' },
    });
    expect(lastBody().verbosity).toBeUndefined();
  });

  it('Gemini (OpenAI-compat) recebe reasoning_effort por passthrough', async () => {
    Deno.env.set('GEMINI_API_KEY', 'sk-gem');
    await callLLM({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: 'oi' }],
      params: { reasoning_effort: 'medium' },
    });
    expect(lastBody().reasoning_effort).toBe('medium');
  });

  it('Anthropic adaptive: effort vira thinking.adaptive + output_config.effort, sem temperature', async () => {
    Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant');
    vi.mocked(fetch).mockResolvedValueOnce(anthropicOk());
    await callLLM({
      model: 'anthropic/claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'oi' }],
      temperature: 0.2,
      params: { thinking: { enabled: true, effort: 'high' } },
    });
    const b = lastBody();
    expect(b.thinking).toEqual({ type: 'adaptive' });
    expect(b.output_config).toEqual({ effort: 'high' });
    expect(b.temperature).toBeUndefined();
  });

  it('Anthropic extended: budget_tokens → thinking.enabled + temperature=1 + bump max_tokens', async () => {
    Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant');
    vi.mocked(fetch).mockResolvedValueOnce(anthropicOk());
    await callLLM({
      model: 'anthropic/claude-haiku-4-5',
      messages: [{ role: 'user', content: 'oi' }],
      max_tokens: 512,
      temperature: 0,
      params: { thinking: { enabled: true, budget_tokens: 4000 } },
    });
    const b = lastBody();
    expect(b.thinking).toEqual({ type: 'enabled', budget_tokens: 4000 });
    expect(b.temperature).toBe(1);
    expect(b.max_tokens).toBe(5024); // 4000 + 1024, pois 512 <= budget
  });

  it('Anthropic Opus 4.8 NÃO envia temperature (rejeita sampling)', async () => {
    Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant');
    vi.mocked(fetch).mockResolvedValueOnce(anthropicOk());
    await callLLM({
      model: 'anthropic/claude-opus-4-8',
      messages: [{ role: 'user', content: 'oi' }],
      temperature: 0.2,
    });
    expect(lastBody().temperature).toBeUndefined();
  });
});
