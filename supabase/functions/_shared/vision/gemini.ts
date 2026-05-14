/**
 * Vision Provider: Gemini 2.0 (google/gemini-2.0-flash-exp via OpenRouter).
 *
 * Vantagens:
 * - Custo baixo (~$0.001 por imagem)
 * - Latência menor que Claude
 * - Janela de contexto enorme (bom pra múltiplas imagens em sequência)
 *
 * Desvantagens:
 * - OCR de manuscrito é levemente inferior ao Claude
 * - Adiciona dependência de mais um provider no caminho crítico
 */

import { callLLMWithRetry } from '../openrouter.ts';
import {
  VisionProvider,
  VisionExtractionResult,
  VisionError,
  VISION_PROMPT,
  bufferToDataUrl,
} from './types.ts';

export class GeminiVisionProvider implements VisionProvider {
  readonly name = 'gemini';
  private readonly model: string;

  constructor(model = 'google/gemini-2.0-flash-exp') {
    this.model = model;
  }

  async extractText(
    imageBuffer: Uint8Array,
    mimeType: string,
  ): Promise<VisionExtractionResult> {
    const dataUrl = bufferToDataUrl(imageBuffer, mimeType);
    const t0 = Date.now();

    try {
      const res = await callLLMWithRetry({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 4096,
      });

      const duration_ms = Date.now() - t0;
      const text = res.content.trim();

      const warnings: string[] = [];
      if (text.length < 20) warnings.push('Pouco texto extraído (imagem pode estar vazia ou ilegível).');
      if (text.includes('[ilegível]')) warnings.push('Modelo marcou trechos como ilegíveis.');

      return {
        text,
        model: res.model,
        usage: {
          tokens_input: res.tokens_input,
          tokens_output: res.tokens_output,
          cost_usd: res.cost_usd,
          duration_ms,
        },
        warnings,
      };
    } catch (err) {
      throw new VisionError(
        `GeminiVision falhou: ${(err as Error).message}`,
        this.name,
        err,
      );
    }
  }
}
