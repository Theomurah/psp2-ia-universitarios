/**
 * Parsers de documentos por formato (T13 — completo).
 *
 * Cobre os 5 formatos do MVP:
 * - PDF (pdf-parse via npm:)
 * - DOCX (mammoth via npm:)
 * - PPTX (descompacta o zip com jszip + extrai o texto do XML dos slides)
 * - MD (leitura nativa)
 * - Imagens (OCR multimodal via VisionProvider — Claude ou Gemini)
 */

import pdfParse from 'npm:pdf-parse@1.1.1';
import mammoth from 'npm:mammoth@1.8.0';
import JSZip from 'npm:jszip@3.10.1';

import type { FormatoDocumento } from '../../../packages/shared/src/constants.ts';
import { getVisionProvider, VisionError } from './vision/index.ts';
import type { ModelExtraParams } from './openrouter.ts';

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
  // `override` exigido: Error já declara `cause` (ES2022) e o deno check
  // roda com noImplicitOverride.
  constructor(message: string, public formato: FormatoDocumento, public override cause?: unknown) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Opções de parsing — plumbing de configuração runtime.
 *
 * `visionModel`: modelo de OCR resolvido pelo caller (ex.: via getModelConfig(),
 * que lê app_settings editável no /admin). Sem valor, getVisionProvider cai
 * pro fallback de env (VISION_MODEL / VISION_PROVIDER) e depois pro default.
 * Origem: auditoria 2026-06-10 (EDGE-HANDLERS-07).
 */
export interface ParseOptions {
  visionModel?: string;
  /** Params avançados do estágio de visão (effort/thinking) — ver getModelParams(). */
  visionParams?: ModelExtraParams;
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
    // Cast seguro: o buffer chega de `new Uint8Array(await blob.arrayBuffer())`,
    // então o backing store é sempre ArrayBuffer (nunca SharedArrayBuffer).
    const result = await mammoth.extractRawText({ arrayBuffer: buffer.buffer as ArrayBuffer });
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
    // .pptx é um zip Open XML. O officeparser (usado antes) descompactava em
    // disco temporário e quebrava no runtime do edge — jogava um erro sem
    // `.message`, virando "Falha no parsing de PPTX: undefined". Aqui
    // descompacta IN-MEMORY com jszip e lê o texto dos slides direto do XML.
    const zip = await JSZip.loadAsync(buffer);
    const slidePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => slideNumber(a) - slideNumber(b));

    if (slidePaths.length === 0) {
      throw new Error('nenhum slide encontrado (ppt/slides/slideN.xml) — arquivo não parece um .pptx válido');
    }

    const parts: string[] = [];
    for (const path of slidePaths) {
      const xml = await zip.files[path].async('string');
      const text = pptxTextFromSlideXml(xml);
      if (text) parts.push(text);
    }
    const cleaned = parts.join('\n\n').trim();

    const warnings: string[] = [];
    if (cleaned.length < 100) {
      warnings.push('PPTX com pouco texto — pode ser deck só com imagens (considere OCR de slides exportados).');
    }

    return {
      texto: cleaned,
      metadata: {
        chars: cleaned.length,
        paginas: slidePaths.length,
        formato: 'pptx',
        warnings,
      },
    };
  } catch (err) {
    // Surface robusto: throw não-Error (oficeparser/jszip) não vira `undefined`.
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseError(`Falha no parsing de PPTX: ${msg}`, 'pptx', err);
  }
}

/** Ordena slideN.xml pelo número N (slide2 depois de slide1, não lexicográfico). */
function slideNumber(path: string): number {
  const m = path.match(/slide(\d+)\.xml$/);
  return m ? Number(m[1]) : 0;
}

/**
 * Extrai o texto visível de um slide a partir do seu XML: concatena os runs
 * `<a:t>…</a:t>` (texto dos shapes), decodificando entidades XML. Exportada
 * pra teste — é a parte com risco; o jszip é lib madura.
 */
export function pptxTextFromSlideXml(xml: string): string {
  const runs = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) ?? [];
  return runs
    .map((r) => r.replace(/<a:t[^>]*>([\s\S]*?)<\/a:t>/, '$1'))
    .map(decodeXmlEntities)
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
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
export async function parseImage(
  buffer: Uint8Array,
  mimeType: string,
  opts?: ParseOptions,
): Promise<ParseResult> {
  try {
    // Override programático (app_settings via /admin) tem prioridade; aliases
    // legados ('claude', 'gemini') são expandidos dentro de getVisionProvider.
    const provider = getVisionProvider(opts?.visionModel, opts?.visionParams);
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
  opts?: ParseOptions,
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
      return parseImage(buffer, mimeType ?? 'image/png', opts);
    default:
      throw new ParseError(`Formato não suportado: ${formato}`, formato);
  }
}
