/**
 * Factory de Vision Provider.
 *
 * Lê a variável de ambiente VISION_PROVIDER e devolve a implementação.
 * Default: claude (escolha conservadora — melhor qualidade pra MVP).
 *
 * Decisão pendente: qual será o provider definitivo em produção,
 * ou se haverá rotação dinâmica (ex: Gemini pra alto volume, Claude
 * pra casos onde a primeira tentativa falhou).
 */

import { VisionProvider } from './types.ts';
import { ClaudeVisionProvider } from './claude.ts';
import { GeminiVisionProvider } from './gemini.ts';

export * from './types.ts';
export { ClaudeVisionProvider, GeminiVisionProvider };

export type VisionProviderName = 'claude' | 'gemini';

export function getVisionProvider(
  override?: VisionProviderName,
): VisionProvider {
  const choice = override ?? (Deno.env.get('VISION_PROVIDER') as VisionProviderName) ?? 'claude';

  switch (choice) {
    case 'claude':
      return new ClaudeVisionProvider();
    case 'gemini':
      return new GeminiVisionProvider();
    default:
      throw new Error(
        `VISION_PROVIDER desconhecido: "${choice}". Aceito: "claude" | "gemini".`,
      );
  }
}

/**
 * Helper de fallback: tenta o provider primário; se falhar, tenta o secundário.
 * Não está sendo usado por padrão (mantém comportamento simples), mas fica
 * pronto pra ativar quando o time decidir a estratégia.
 */
export async function extractWithFallback(
  imageBuffer: Uint8Array,
  mimeType: string,
  primary: VisionProviderName = 'claude',
  secondary: VisionProviderName = 'gemini',
) {
  const p = getVisionProvider(primary);
  try {
    return { result: await p.extractText(imageBuffer, mimeType), providerUsed: primary };
  } catch (errPrimary) {
    console.warn(`Vision primary (${primary}) falhou:`, errPrimary);
    const s = getVisionProvider(secondary);
    return { result: await s.extractText(imageBuffer, mimeType), providerUsed: secondary };
  }
}
