/**
 * Parsers de documentos por formato (T13 — completo).
 *
 * Cobre os 5 formatos do MVP:
 * - PDF (pdf-parse via npm:)
 * - DOCX (mammoth via npm:)
 * - PPTX (officeparser via npm:, com polyfill node:buffer)
 * - MD (leitura nativa)
 * - Imagens (OCR multimodal via VisionProvider — Claude ou Gemini)
 */

import pdfParse from 'npm:pdf-parse@1.1.1';
import mammoth from 'npm:mammoth@1.8.0';
import officeparser from 'npm:officeparser@4.0.5';
import { Buffer } from 'node:buffer';

import type { FormatoDocumento } from '../../../packages/shared/src/constants.ts';
import { getVisionProvider, VisionError } from './vision/index.ts';

export interface ParseResult {
  texto: string;
  metadata: {
    chars: number;
    paginas?: number;
    formato: FormatoDocumento;
    warnings: string[];
    /** Para imagens: qual provider foi usado, custo, tokens. */
    vision_provider?: string;
    vision_cost_usd?: number;
    vision_duration_ms?: number;
  };
}

export class ParseError extends Error {
  constructor(message: string, public formato: FormatoDocumento, public cause?: unknown) {
    super(message);
    this.name = 'ParseError';
  }
}

// =============================================================
// PDF
// =============================================================
export async function parsePdf(buffer: Uint8Array): Promise<ParseResult> {
  try {
    const data = await pdfParse(buffer);
    return {
      texto: data.text.trim(),
      metadata: {
        chars: data.text.length,
        paginas: data.numpages,
        formato: 'pdf',
        warnings: data.text.trim().length < 100 ? ['PDF parece vazio ou só imagens (precisa OCR)'] : [],
      },
    };
  } catch (err) {
    throw new ParseError(`Falha no parsing de PDF: ${(err as Error).message}`, 'pdf', err);
  }
}

// =============================================================
// DOCX
// =============================================================
export async function parseDocx(buffer: Uint8Array): Promise<ParseResult> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer.buffer });
    const warnings = result.messages
      .filter((m: { type: string }) => m.type === 'warning')
      .map((m: { message: string }) => m.message);
    return {
      texto: result.value.trim(),
      metadata: {
        chars: result.value.length,
        formato: 'docx',
        warnings,
      },
    };
  } catch (err) {
    throw new ParseError(`Falha no parsing de DOCX: ${(err as Error).message}`, 'docx', err);
  }
}

// =============================================================
// PPTX
// =============================================================
export async function parsePptx(buffer: Uint8Array): Promise<ParseResult> {
  try {
    // officeparser usa node:buffer; polyfill abaixo.
    const nodeBuf = Buffer.from(buffer);
    const text: string = await officeparser.parseOfficeAsync(nodeBuf);
    const cleaned = text.trim();

    const warnings: string[] = [];
    if (cleaned.length < 100) {
      warnings.push('PPTX com pouco texto — pode ser deck só com imagens (considere OCR de slides exportados).');
    }

    return {
      texto: cleaned,
      metadata: {
        chars: cleaned.length,
        formato: 'pptx',
        warnings,
      },
    };
  } catch (err) {
    throw new ParseError(`Falha no parsing de PPTX: ${(err as Error).message}`, 'pptx', err);
  }
}

// =============================================================
// MD / Texto plano
// =============================================================
export function parseMd(buffer: Uint8Array): ParseResult {
  try {
    const texto = new TextDecoder('utf-8').decode(buffer).trim();
    return {
      texto,
      metadata: {
        chars: texto.length,
        formato: 'md',
        warnings: texto.length < 50 ? ['Arquivo muito curto'] : [],
      },
    };
  } catch (err) {
    throw new ParseError(`Falha no parsing de MD: ${(err as Error).message}`, 'md', err);
  }
}

// =============================================================
// Imagens — OCR via VisionProvider (Claude ou Gemini, configurável)
// =============================================================
export async function parseImage(buffer: Uint8Array, mimeType: string): Promise<ParseResult> {
  try {
    const provider = getVisionProvider();
    const result = await provider.extractText(buffer, mimeType);

    return {
      texto: result.text,
      metadata: {
        chars: result.text.length,
        formato: 'image',
        warnings: result.warnings,
        vision_provider: provider.name,
        vision_cost_usd: result.usage.cost_usd,
        vision_duration_ms: result.usage.duration_ms,
      },
    };
  } catch (err) {
    if (err instanceof VisionError) {
      throw new ParseError(`OCR via ${err.provider} falhou: ${err.message}`, 'image', err);
    }
    throw new ParseError(`Falha no parsing de imagem: ${(err as Error).message}`, 'image', err);
  }
}

// =============================================================
// Dispatcher
// =============================================================
export async function parseDocument(
  buffer: Uint8Array,
  formato: FormatoDocumento,
  mimeType?: string,
): Promise<ParseResult> {
  switch (formato) {
    case 'pdf':
      return parsePdf(buffer);
    case 'docx':
      return parseDocx(buffer);
    case 'pptx':
      return parsePptx(buffer);
    case 'md':
      return parseMd(buffer);
    case 'image':
      return parseImage(buffer, mimeType ?? 'image/png');
    default:
      throw new ParseError(`Formato não suportado: ${formato}`, formato);
  }
}
