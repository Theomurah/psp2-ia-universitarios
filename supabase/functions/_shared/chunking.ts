/**
 * Chunking de documentos grandes (T24).
 *
 * Estratégia híbrida:
 *   1. Tenta dividir por seções Markdown (## headings).
 *   2. Se alguma seção for maior que `maxChars`, usa janela com overlap nela.
 *   3. Se não houver seções identificáveis, aplica janela direta no doc inteiro.
 *
 * Constantes calibradas pra Claude Sonnet 4.6 (200k de contexto, 8k de saída):
 *   CHUNK_THRESHOLD = 50_000 chars   → abaixo disso roda fluxo normal
 *   CHUNK_MAX_CHARS = 30_000 chars   → tamanho-alvo de cada chunk
 *   CHUNK_OVERLAP   = 2_000 chars    → preserva contexto entre janelas
 *   MAX_DEPTH       = 3              → guarda contra recursão infinita no reduce
 */

export const CHUNK_THRESHOLD = 50_000;
export const CHUNK_MAX_CHARS = 30_000;
export const CHUNK_OVERLAP = 2_000;
export const MAX_DEPTH = 3;

export interface Chunk {
  index: number;
  total: number;
  content: string;
  /** Título da seção (## ...) quando o chunk corresponde a uma seção Markdown. */
  source_section?: string;
}

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

/**
 * Quebra texto em chunks usando estratégia híbrida.
 * Retorna sempre ao menos 1 chunk (mesmo pra texto vazio).
 */
export function chunkDocument(text: string, opts: ChunkOptions = {}): Chunk[] {
  const maxChars = opts.maxChars ?? CHUNK_MAX_CHARS;
  const overlap = opts.overlap ?? CHUNK_OVERLAP;

  if (!text) return [{ index: 0, total: 1, content: '' }];

  // 1) Split por headings ## (mantém o cabeçalho na seção)
  const sections = splitByH2(text);

  if (sections.length > 1) {
    const allFit = sections.every((s) => s.content.length <= maxChars);
    if (allFit) {
      return sections.map((s, i) => ({
        index: i,
        total: sections.length,
        content: s.content,
        source_section: s.heading ?? undefined,
      }));
    }

    // 2) Híbrido: pra seções grandes, aplica janela; pequenas viram chunk único
    const out: Chunk[] = [];
    for (const sec of sections) {
      if (sec.content.length <= maxChars) {
        out.push({
          index: out.length,
          total: -1,
          content: sec.content,
          source_section: sec.heading ?? undefined,
        });
      } else {
        const windowed = slidingWindow(sec.content, maxChars, overlap);
        for (const w of windowed) {
          out.push({
            index: out.length,
            total: -1,
            content: w.content,
            source_section: sec.heading ?? undefined,
          });
        }
      }
    }
    return out.map((c) => ({ ...c, total: out.length }));
  }

  // 3) Fallback: nenhum heading detectado → janela direta
  return slidingWindow(text, maxChars, overlap);
}

interface Section {
  heading: string | null;
  content: string;
}

/**
 * Divide texto onde aparece um heading H2 (`## ...`).
 * O heading fica como primeira linha da seção correspondente.
 * Conteúdo anterior ao 1º ## vira a primeira seção com heading=null.
 */
export function splitByH2(text: string): Section[] {
  const lines = text.split('\n');
  const out: Section[] = [];
  let current: Section = { heading: null, content: '' };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (current.content.trim()) out.push(current);
      current = { heading: match[1].trim(), content: line + '\n' };
    } else {
      current.content += line + '\n';
    }
  }
  if (current.content.trim()) out.push(current);

  // Se não achou nenhum ##, retorna 1 seção
  return out.length > 0 ? out : [{ heading: null, content: text }];
}

/**
 * Janela deslizante com overlap.
 * Garante que o último chunk vai até o fim do texto sem repetir além do esperado.
 */
export function slidingWindow(text: string, max: number, overlap: number): Chunk[] {
  if (text.length <= max) return [{ index: 0, total: 1, content: text }];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;
  while (start < text.length) {
    const end = Math.min(start + max, text.length);
    chunks.push({ index, total: -1, content: text.slice(start, end) });
    if (end === text.length) break;
    start = Math.max(end - overlap, start + 1); // garante progresso mesmo se overlap > max
    index++;
  }
  return chunks.map((c) => ({ ...c, total: chunks.length }));
}

/**
 * Indica se um texto deve ser processado em chunks (acima do threshold).
 */
export function shouldChunk(text: string, threshold = CHUNK_THRESHOLD): boolean {
  return text.length > threshold;
}
