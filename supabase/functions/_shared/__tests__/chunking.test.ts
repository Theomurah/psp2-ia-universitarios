/**
 * T24 — testes da lógica de chunking pra docs grandes.
 */

import { describe, it, expect } from 'vitest';
import {
  chunkDocument,
  splitByH2,
  slidingWindow,
  shouldChunk,
  CHUNK_MAX_CHARS,
  CHUNK_OVERLAP,
  CHUNK_THRESHOLD,
} from '../chunking.ts';

describe('shouldChunk', () => {
  it('true para text acima do threshold', () => {
    expect(shouldChunk('x'.repeat(CHUNK_THRESHOLD + 1))).toBe(true);
  });

  it('false para text no/abaixo do threshold', () => {
    expect(shouldChunk('x'.repeat(CHUNK_THRESHOLD))).toBe(false);
    expect(shouldChunk('curto')).toBe(false);
  });
});

describe('splitByH2', () => {
  it('mantém seções identificadas por ##', () => {
    const md = `Intro sem heading.

## Seção 1

Conteúdo 1

## Seção 2

Conteúdo 2`;
    const out = splitByH2(md);
    expect(out).toHaveLength(3);
    expect(out[0].heading).toBeNull();
    expect(out[1].heading).toBe('Seção 1');
    expect(out[2].heading).toBe('Seção 2');
    expect(out[1].content).toContain('Conteúdo 1');
  });

  it('retorna 1 seção quando não há ##', () => {
    const out = splitByH2('apenas parágrafo único');
    expect(out).toHaveLength(1);
    expect(out[0].heading).toBeNull();
  });

  it('ignora linhas vazias antes do primeiro heading', () => {
    const out = splitByH2('## A\nx\n## B\ny');
    expect(out).toHaveLength(2);
  });
});

describe('slidingWindow', () => {
  it('retorna 1 chunk quando texto cabe', () => {
    const out = slidingWindow('curto', 100, 10);
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe('curto');
    expect(out[0].total).toBe(1);
  });

  it('cria múltiplos chunks com overlap', () => {
    const text = 'a'.repeat(50);
    const out = slidingWindow(text, 20, 5);
    // 50 chars, janela 20, overlap 5 → começa em 0, 15, 30, 45 (último até 50)
    expect(out.length).toBeGreaterThanOrEqual(3);
    // overlap real: chunk[1] inclui últimos 5 chars de chunk[0]
    for (const c of out) {
      expect(c.content.length).toBeLessThanOrEqual(20);
    }
    // Todos os chunks têm total igual ao total real
    expect(new Set(out.map((c) => c.total)).size).toBe(1);
  });

  it('garante progresso mesmo com overlap >= max', () => {
    const out = slidingWindow('a'.repeat(30), 10, 15);
    // Não deve loopar infinitamente; progressão mínima de 1 char
    expect(out.length).toBeGreaterThan(1);
    expect(out.length).toBeLessThan(100);
  });
});

describe('chunkDocument', () => {
  it('texto vazio retorna 1 chunk vazio', () => {
    expect(chunkDocument('')).toEqual([{ index: 0, total: 1, content: '' }]);
  });

  it('texto pequeno sem ## retorna 1 chunk', () => {
    const out = chunkDocument('curto sem heading', { maxChars: 100 });
    expect(out).toHaveLength(1);
    expect(out[0].source_section).toBeUndefined();
  });

  it('texto com várias seções pequenas → 1 chunk por seção', () => {
    const md = `# Doc

## A

aaa

## B

bbb

## C

ccc`;
    const out = chunkDocument(md, { maxChars: 1000 });
    expect(out).toHaveLength(4);
    expect(out[1].source_section).toBe('A');
    expect(out[2].source_section).toBe('B');
  });

  it('seção grande dispara janela só nela; pequenas continuam unitárias', () => {
    const big = 'X'.repeat(500);
    const md = `## Pequena\n\nintro\n\n## Grande\n\n${big}\n\n## Outra\n\nfim`;
    const out = chunkDocument(md, { maxChars: 200, overlap: 20 });
    expect(out.length).toBeGreaterThanOrEqual(4);
    // todos os chunks da seção "Grande" mantêm source_section='Grande'
    const grandes = out.filter((c) => c.source_section === 'Grande');
    expect(grandes.length).toBeGreaterThanOrEqual(2);
    for (const c of grandes) {
      expect(c.content.length).toBeLessThanOrEqual(200);
    }
  });

  it('todos os chunks têm o mesmo total e indices 0..N-1', () => {
    const text = 'Y'.repeat(10_000);
    const out = chunkDocument(text, { maxChars: 1000, overlap: 100 });
    expect(out.every((c) => c.total === out.length)).toBe(true);
    expect(out.map((c) => c.index)).toEqual(out.map((_, i) => i));
  });

  it('default opts usam CHUNK_MAX_CHARS e CHUNK_OVERLAP', () => {
    const text = 'Z'.repeat(CHUNK_MAX_CHARS * 2 + CHUNK_OVERLAP);
    const out = chunkDocument(text);
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});
