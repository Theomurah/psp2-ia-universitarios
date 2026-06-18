/**
 * Parser de `.apkg` (Anki) no browser — Fase 4.
 *
 * `.apkg` é um ZIP com um SQLite (`collection.anki2` / `.anki21` / `.anki21b`,
 * este último comprimido com zstd) + mídia. Aqui: descompacta (jszip), descomprime
 * o zstd se preciso (fzstd), lê o SQLite (sql.js / WASM) e extrai os cartões da
 * tabela `notes` (campos separados por 0x1f). A conversão HTML+math → markdown+
 * LaTeX é reusada de `@psp2/shared` (testada lá).
 *
 * Tudo é importado estaticamente aqui de propósito: este módulo é carregado via
 * `import()` dinâmico só quando o usuário escolhe um `.apkg`, então sql.js/jszip
 * (pesados) ficam fora do bundle inicial.
 *
 * Simplificação consciente: pega o 1º campo como frente e os demais como verso
 * (cobre o note type "Básico" e a maioria dos baralhos compartilhados). Templates
 * de note type arbitrários não são renderizados.
 */

import JSZip from 'jszip';
import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { Database } from 'sql.js';
import { ankiFieldToContent, ANKI_FIELD_SEP, type ParsedCard } from '@psp2/shared';

export interface ParsedImport {
  name: string;
  cards: ParsedCard[];
}

function deckNameFromFilename(filename: string): string {
  const base = filename.replace(/\.apkg$/i, '').replace(/[_-]+/g, ' ').trim();
  return base || 'Baralho importado';
}

function readDeckName(db: Database): string | null {
  try {
    const res = db.exec('select decks from col limit 1');
    const raw = res[0]?.values?.[0]?.[0];
    if (typeof raw !== 'string') return null;
    const decks = JSON.parse(raw) as Record<string, { name?: string }>;
    const names = Object.values(decks)
      .map((d) => d?.name)
      .filter((n): n is string => !!n && n !== 'Default');
    return names[0] ?? null;
  } catch {
    return null;
  }
}

function readCards(db: Database): ParsedCard[] {
  const res = db.exec('select flds, tags from notes');
  const rows = res[0]?.values ?? [];
  const out: ParsedCard[] = [];
  for (const row of rows) {
    const flds = String(row[0] ?? '');
    const tagsStr = String(row[1] ?? '');
    const fields = flds.split(ANKI_FIELD_SEP);
    const front = ankiFieldToContent(fields[0] ?? '');
    const back = ankiFieldToContent(fields.slice(1).join('\n\n'));
    if (!front && !back) continue;
    const tags = tagsStr.split(' ').map((t) => t.trim()).filter(Boolean);
    out.push({ front, back, tags, topico: null });
  }
  return out;
}

export async function parseApkg(file: File): Promise<ParsedImport> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  let dbBytes: Uint8Array | null = null;
  const b21 = zip.file('collection.anki21b');
  const a21 = zip.file('collection.anki21');
  const a2 = zip.file('collection.anki2');
  if (b21) {
    const compressed = await b21.async('uint8array');
    const { decompress } = await import('fzstd');
    dbBytes = decompress(compressed);
  } else if (a21) {
    dbBytes = await a21.async('uint8array');
  } else if (a2) {
    dbBytes = await a2.async('uint8array');
  }
  if (!dbBytes) throw new Error('apkg_sem_collection');

  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  const db = new SQL.Database(dbBytes);
  try {
    const name = readDeckName(db) ?? deckNameFromFilename(file.name);
    const cards = readCards(db);
    if (cards.length === 0) throw new Error('apkg_sem_notas');
    return { name, cards };
  } finally {
    db.close();
  }
}
