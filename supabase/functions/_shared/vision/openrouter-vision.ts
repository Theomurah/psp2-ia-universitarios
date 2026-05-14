/**
 * Vision Provider GENÉRICO — funciona com qualquer modelo vision-capable do OpenRouter.
 *
 * Em vez de ter uma classe por modelo, esta classe recebe o nome do modelo
 * no construtor. Permite usar:
 *   - "anthropic/claude-sonnet-4.6"        (Claude)
 *   - "google/gemini-2.0-flash-exp"        (Gemini)
 *   - "openai/gpt-4o"                       (GPT-4o)
 *   - "qwen/qwen-2-vl-72b-instruct"        (Qwen-VL)
 *   - "meta-llama/llama-3.2-90b-vision"    (Llama Vision)
 *   - ... qualquer modelo vision-capable do catálogo OpenRouter
 *
 * Lista completa: https://openrouter.ai/models?modality=image
 */

import { callLLMWithRetry } from '../openrouter.ts';
import {
  VisionProvider,
  VisionExtractionResult,
  VisionError,
  VISION_PROMPT,
  bufferToDataUrl,
} from './types.ts';

export class OpenRouterVisionProvider implements VisionProvider {
  readonly name: string;
  private readonly model: string;
  private readonly detail: 'low' | 'high' | 'auto';

  constructor(model: string, options: { detail?: 'low' | 'high' | 'auto' } = {}) {
    this.model = model;
    this.detail = options.detail ?? 'high';
    // Nome legível derivado do modelo (ex: "openai/gpt-4o" → "gpt-4o")
    this.name = model.split('/').pop() ?? model;
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
              { type: 'image_url', image_url: { url: dataUrl, detail: this.detail } },
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
        `Vision (${this.name}) falhou: ${(err as Error).message}`,
        this.name,
        err,
      );
    }
  }
}
