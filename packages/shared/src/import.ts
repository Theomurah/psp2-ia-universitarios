/**
 * Importação de flashcards — parsing puro e testável (Fase 4).
 *
 * Cobre os formatos de TEXTO (CSV/TSV e o export "Notes in Plain Text" do Anki)
 * e a conversão de um campo do Anki (HTML + MathJax/LaTeX) pro markdown+LaTeX que
 * o MathMarkdown renderiza. O parsing binário do `.apkg` (zip + SQLite) fica no
 * frontend (`lib/apkg.ts`, depende de WASM), mas reusa `ankiFieldToContent` daqui.
 */

export interface ParsedCard {
  front: string;
  back: string;
  tags: string[];
  topico: string | null;
}

// ============================================================
// Conversão de campo Anki → markdown + LaTeX
// ============================================================

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function safeCodePoint(n: number): string {
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith('#x')) return safeCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return safeCodePoint(parseInt(lower.slice(1), 10));
    return lower in NAMED_ENTITIES ? NAMED_ENTITIES[lower] : m;
  });
}

/**
 * Converte um campo do Anki (HTML + delimitadores de math) no markdown+LaTeX do
 * nosso renderer. Idempotente em texto puro (sem HTML/math, devolve trim).
 */
export function ankiFieldToContent(raw: string): string {
  let s = raw ?? '';
  // Math: MathJax \(..\) \[..\] e os shortcodes do Anki [$]..[/$] / [$$]..[/$$] / [latex]..[/latex]
  s = s.replace(/\\\[/g, () => '$$').replace(/\\\]/g, () => '$$');
  s = s.replace(/\\\(/g, () => '$').replace(/\\\)/g, () => '$');
  s = s.replace(/\[\$\$\]([\s\S]*?)\[\/\$\$\]/g, (_m, m: string) => `$$${m}$$`);
  s = s.replace(/\[\$\]([\s\S]*?)\[\/\$\]/g, (_m, m: string) => `$${m}$`);
  s = s.replace(/\[latex\]([\s\S]*?)\[\/latex\]/gi, (_m, m: string) => `$$${m}$$`);
  // HTML → texto: quebras viram \n, demais tags são removidas.
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(div|p|li|tr|h[1-6]|blockquote)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ============================================================
// CSV / TSV / texto Anki
// ============================================================

export interface DelimitedOptions {
  /** Separador. Se ausente, detecta `#separator:` ou tab vs vírgula. */
  delimiter?: string;
  hasHeader?: boolean;
  frontIndex?: number;     // default 0
  backIndex?: number;      // default 1
  tagsIndex?: number;      // default: nenhuma (ou `#tags column:` do Anki)
  topicoIndex?: number;
  /** Aplica ankiFieldToContent nos campos (HTML/math). Default true. */
  convert?: boolean;
}

function sepToken(t: string): string {
  const map: Record<string, string> = { tab: '\t', comma: ',', semicolon: ';', pipe: '|', space: ' ' };
  return map[t.toLowerCase()] ?? (t.length === 1 ? t : ',');
}

/** Parser CSV/TSV com aspas (RFC4180-ish): "" escapa aspas dentro do campo. */
function parseRows(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Faz o parse de CSV/TSV ou do export de texto do Anki em cartões.
 * Reconhece diretivas `#separator:`, `#tags column:` e ignora linhas `#`.
 */
export function parseDelimited(text: string, opts: DelimitedOptions = {}): ParsedCard[] {
  const normalized = text.replace(/\r\n?/g, '\n');
  let delimiter = opts.delimiter;
  let tagsIndex = opts.tagsIndex;
  const contentLines: string[] = [];

  for (const line of normalized.split('\n')) {
    if (line.startsWith('#')) {
      const sep = /^#separator:(.+)$/i.exec(line);
      if (sep && !delimiter) delimiter = sepToken(sep[1].trim());
      const tcol = /^#tags column:\s*(\d+)/i.exec(line);
      if (tcol && tagsIndex === undefined) tagsIndex = Number(tcol[1]) - 1; // Anki é 1-based
      continue;
    }
    contentLines.push(line);
  }

  const body = contentLines.join('\n').trim();
  if (!body) return [];
  if (!delimiter) delimiter = body.includes('\t') ? '\t' : ',';

  const rows = parseRows(body, delimiter);
  const start = opts.hasHeader ? 1 : 0;
  const fIdx = opts.frontIndex ?? 0;
  const bIdx = opts.backIndex ?? 1;
  const convert = opts.convert ?? true;

  const out: ParsedCard[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 2) continue;
    const front = convert ? ankiFieldToContent(r[fIdx] ?? '') : (r[fIdx] ?? '').trim();
    const back = convert ? ankiFieldToContent(r[bIdx] ?? '') : (r[bIdx] ?? '').trim();
    if (!front && !back) continue;
    const tags =
      tagsIndex !== undefined && r[tagsIndex]
        ? r[tagsIndex].split(/[\s,]+/).map((t) => t.trim()).filter(Boolean)
        : [];
    const topico =
      opts.topicoIndex !== undefined ? (r[opts.topicoIndex]?.trim() || null) : null;
    out.push({ front, back, tags, topico });
  }
  return out;
}

/** Separador de campos do Anki dentro de `notes.flds` (unidade 0x1f). */
export const ANKI_FIELD_SEP = '\x1f';
