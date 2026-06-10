/**
 * T15 — testes do wrapper OpenRouter (sem rede real).
 *
 * fetch é mockado globalmente. Cobrimos: chamada feliz, missing key,
 * 429 transiente com retry, JSON parser helper, parsing de resposta.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callLLM, callLLMWithRetry, parseJsonFromLLM, OpenRouterError } from '../openrouter.ts';

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
