/**
 * Abstração de Vision Providers (T13 — parser de imagens).
 *
 * Permite trocar entre Claude Vision e Gemini 2.0 (e outros futuros) via
 * variável de ambiente VISION_PROVIDER, sem mudar o código do parser.
 *
 * Decisão de qual provider usar em produção ainda está PENDENTE.
 * O sistema vai entrar em produção com a env var apontando pra um deles;
 * trocar é só mudar a env var (zero código).
 */

export interface VisionExtractionResult {
  /** Texto transcrito da imagem. */
  text: string;

  /** Confiança subjetiva do modelo (0.0–1.0), se conseguir estimar. */
  confidence?: number;

  /** Modelo efetivamente usado (ex: "anthropic/claude-sonnet-4.6"). */
  model: string;

  /** Métricas de uso da chamada. */
  usage: {
    tokens_input: number;
    tokens_output: number;
    cost_usd: number;
    duration_ms: number;
  };

  /** Warnings não-fatais (ex: "imagem com baixa nitidez"). */
  warnings: string[];
}

export interface VisionProvider {
  /** Identificador legível ("claude" | "gemini"). */
  readonly name: string;

  /**
   * Extrai texto de uma imagem.
   * @param imageBuffer Bytes da imagem
   * @param mimeType MIME type detectado pelo browser/SO (image/png, image/jpeg, ...)
   */
  extractText(
    imageBuffer: Uint8Array,
    mimeType: string,
  ): Promise<VisionExtractionResult>;
}

/** Erro específico de OCR multimodal. */
export class VisionError extends Error {
  constructor(
    message: string,
    public provider: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'VisionError';
  }
}

// =============================================================
// Prompt compartilhado entre providers (mantém consistência)
// =============================================================
export const VISION_PROMPT = `Você é um sistema de OCR especializado em materiais acadêmicos universitários (anotações de aula, slides, listas de exercícios, fotos de quadro, esquemas manuscritos).

TAREFA:
Transcrever EXATAMENTE o texto visível na imagem, preservando:
- Fórmulas matemáticas em LaTeX (ex: $$F = ma$$ ou $\\vec{r}$)
- Estrutura de listas, tabelas e seções
- Quebras de linha relevantes
- Notações específicas (setas, símbolos, unidades)

REGRAS:
- NÃO interpretar nem resumir. Só transcrever.
- Se algo estiver ilegível, marcar com "[ilegível]" em vez de inventar.
- Se a imagem não contiver texto, retornar string vazia.
- Manter idioma original (português, inglês, etc.).
- Manter ordem natural de leitura (esquerda → direita, cima → baixo).

OUTPUT:
Retorne APENAS o texto transcrito. Sem prefácio, sem explicação, sem cerca markdown.`;

/**
 * Converte um Uint8Array de imagem em data URL base64.
 * Usado pelos providers pra empacotar no payload OpenRouter.
 */
export function bufferToDataUrl(buffer: Uint8Array, mimeType: string): string {
  // btoa não aceita Uint8Array diretamente — converter via binary string
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunkSize));
  }
  const b64 = btoa(binary);
  return `data:${mimeType};base64,${b64}`;
}
