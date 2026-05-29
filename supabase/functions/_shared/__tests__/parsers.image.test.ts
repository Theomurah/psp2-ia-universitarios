/**
 * T15 — testes do parser de imagem (parseImage).
 *
 * O VisionProvider é mockado por completo via vi.mock no módulo vision/index.ts.
 * Nenhuma chamada real a OpenRouter é feita — passa pelo provider falso.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtract = vi.fn();

vi.mock('../vision/index.ts', async () => {
  const actual = await vi.importActual<typeof import('../vision/index.ts')>('../vision/index.ts');
  return {
    ...actual,
    getVisionProvider: () => ({
      name: 'mock-vision',
      extractText: mockExtract,
    }),
  };
});

import { parseImage, ParseError } from '../parsers.ts';
import { VisionError } from '../vision/index.ts';

describe('parseImage', () => {
  beforeEach(() => mockExtract.mockReset());

  it('retorna texto + metadata com vision_provider, cost_usd, duration_ms', async () => {
    mockExtract.mockResolvedValueOnce({
      text: 'Anotação no quadro: F = ma',
      model: 'anthropic/claude-sonnet-4.6',
      warnings: [],
      usage: { tokens_input: 100, tokens_output: 20, cost_usd: 0.012, duration_ms: 2300 },
    });

    const out = await parseImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'image/png');

    expect(out.metadata.formato).toBe('image');
    expect(out.metadata.vision_provider).toBe('mock-vision');
    expect(out.metadata.vision_cost_usd).toBe(0.012);
    expect(out.metadata.vision_duration_ms).toBe(2300);
    expect(out.texto).toBe('Anotação no quadro: F = ma');
    expect(out.metadata.chars).toBe(out.texto.length);
  });

  it('propaga warnings do VisionProvider', async () => {
    mockExtract.mockResolvedValueOnce({
      text: 'texto parcial',
      model: 'mock',
      warnings: ['imagem com baixa nitidez'],
      usage: { tokens_input: 50, tokens_output: 5, cost_usd: 0.001, duration_ms: 800 },
    });

    const out = await parseImage(new Uint8Array(), 'image/jpeg');
    expect(out.metadata.warnings).toContain('imagem com baixa nitidez');
  });

  it('converte VisionError em ParseError com formato="image"', async () => {
    mockExtract.mockRejectedValueOnce(new VisionError('OpenRouter 429', 'mock-vision'));

    await expect(parseImage(new Uint8Array(), 'image/png')).rejects.toThrowError(ParseError);
    await expect(parseImage(new Uint8Array(), 'image/png')).rejects.toMatchObject({
      formato: 'image',
    });
  });

  it('converte erro genérico em ParseError', async () => {
    mockExtract.mockRejectedValueOnce(new Error('rede caiu'));

    await expect(parseImage(new Uint8Array(), 'image/heic')).rejects.toThrowError(ParseError);
  });
});
