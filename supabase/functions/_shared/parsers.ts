/**
 * Parsers de documentos por formato (T13).
 *
 * Cobre 3 dos 5 formatos do MVP:
 * - PDF (pdf-parse via npm:)
 * - DOCX (mammoth via npm:)
 * - MD (leitura nativa)
 *
 * Faltam (próxima iteração, T13 parcial):
 * - PPTX → officeparser via npm:
 * - Imagens → OCR via Claude/Gemini multimodal (passa pelo callLLM)
 */

import pdfParse from 'npm:pdf-parse@1.1.1';
import mammoth from 'npm:mammoth@1.8.0';

import type { FormatoDocumento } from '../../../packages/shared/src/constants.ts';

export interface ParseResult {
  texto: string;
  metadata: {
    chars: number;
    paginas?: number;
    formato: FormatoDocumento;
    warnings: string[];
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
    // pdf-parse aceita Buffer; em Deno passamos Uint8Array convertido
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
    // mammoth aceita ArrayBuffer
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
// Dispatcher
// =============================================================
export async function parseDocument(
  buffer: Uint8Array,
  formato: FormatoDocumento,
): Promise<ParseResult> {
  switch (formato) {
    case 'pdf':
      return parsePdf(buffer);
    case 'docx':
      return parseDocx(buffer);
    case 'md':
      return parseMd(buffer);
    case 'pptx':
      throw new ParseError(
        'Parser de PPTX não implementado ainda (T13 parcial). Use officeparser.',
        'pptx',
      );
    case 'image':
      throw new ParseError(
        'Parser de imagens precisa OCR multimodal — chamada separada via callLLM.',
        'image',
      );
    default:
      throw new ParseError(`Formato não suportado: ${formato}`, formato);
  }
}
