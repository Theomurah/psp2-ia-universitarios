/**
 * Vision Provider: Claude Vision (anthropic/claude-sonnet-4.6 via OpenRouter).
 *
 * Vantagens:
 * - Excelente OCR de manuscrito (caderno, foto de quadro)
 * - Já é o modelo principal do projeto (consistência)
 * - Boa preservação de LaTeX e estrutura
 *
 * Desvantagens:
 * - Custo maior (~$0.01 por imagem)
 * - Latência maior que Gemini Flash
 */

import { callLLMWithRetry } from '../openrouter.ts';
import {
  VisionProvider,
  VisionExtractionResult,
  VisionError,
  VISION_PROMPT,
  bufferToDataUrl,
} from './types.ts';

export class ClaudeVisionProvider implements VisionProvider {
  readonly name = 'claude';
  private readonly model: string;

  constructor(model = 'anthropic/claude-sonnet-4.6') {
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
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
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
        `ClaudeVision falhou: ${(err as Error).message}`,
        this.name,
        err,
      );
    }
  }
}
