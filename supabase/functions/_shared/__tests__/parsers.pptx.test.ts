/**
 * T15 — testes do parser de PPTX (jszip mockado + extração pura do XML).
 *
 * Trocamos o officeparser (descompactava em disco, quebrava no edge com erro
 * sem `.message`) por jszip in-memory + leitura do XML dos slides.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('npm:jszip@3.10.1', () => ({
  default: { loadAsync: vi.fn() },
}));

import JSZip from 'npm:jszip@3.10.1';
import { parsePptx, pptxTextFromSlideXml, ParseError } from '../parsers.ts';

// Monta um objeto compatível com a API de jszip que o parsePptx usa:
// { files: { path: { async('string') -> Promise<string> } } }.
function fakeZip(slides: Record<string, string>) {
  const files: Record<string, { async: (t: string) => Promise<string> }> = {};
  for (const [path, xml] of Object.entries(slides)) {
    files[path] = { async: () => Promise.resolve(xml) };
  }
  return { files };
}

describe('pptxTextFromSlideXml', () => {
  it('concatena os runs <a:t> de um slide', () => {
    const xml = '<a:p><a:r><a:t>Teoria das</a:t></a:r><a:r><a:t>Comunidades</a:t></a:r></a:p>';
    expect(pptxTextFromSlideXml(xml)).toBe('Teoria das Comunidades');
  });

  it('decodifica entidades XML', () => {
    expect(pptxTextFromSlideXml('<a:t>A &amp; B &lt; C &gt; D</a:t>')).toBe('A & B < C > D');
  });

  it('slide sem <a:t> → string vazia', () => {
    expect(pptxTextFromSlideXml('<p:sld><p:cSld/></p:sld>')).toBe('');
  });
});

describe('parsePptx', () => {
  it('extrai o texto dos slides em ordem numérica', async () => {
    vi.mocked(JSZip.loadAsync).mockResolvedValueOnce(fakeZip({
      'ppt/slides/slide2.xml': '<a:t>Segundo</a:t>',
      'ppt/slides/slide1.xml': '<a:t>Primeiro</a:t>',
      'ppt/presentation.xml': '<x/>', // ignorado — não é slide
    }) as never);

    const out = await parsePptx(new Uint8Array([0x50, 0x4b]));

    expect(out.metadata.formato).toBe('pptx');
    expect(out.metadata.paginas).toBe(2);
    // slide1 antes de slide2 (ordenação numérica, não lexicográfica)
    expect(out.texto).toBe('Primeiro\n\nSegundo');
  });

  it('emite warning quando o deck tem pouco texto (< 100 chars)', async () => {
    vi.mocked(JSZip.loadAsync).mockResolvedValueOnce(fakeZip({
      'ppt/slides/slide1.xml': '<a:t>Capa</a:t>',
    }) as never);

    const out = await parsePptx(new Uint8Array());
    expect(out.metadata.warnings).toHaveLength(1);
    expect(out.metadata.warnings[0]).toMatch(/PPTX|imagens|OCR/i);
  });

  it('ParseError (formato=pptx) quando não há nenhum slide', async () => {
    vi.mocked(JSZip.loadAsync).mockResolvedValueOnce(fakeZip({ 'ppt/presentation.xml': '<x/>' }) as never);
    await expect(parsePptx(new Uint8Array())).rejects.toMatchObject({ formato: 'pptx' });
  });

  it('ParseError quando o zip é inválido (loadAsync rejeita) — sem "undefined"', async () => {
    vi.mocked(JSZip.loadAsync).mockRejectedValueOnce(new Error('End of data reached'));
    await expect(parsePptx(new Uint8Array())).rejects.toThrowError(ParseError);
    await expect(parsePptx(new Uint8Array())).rejects.toMatchObject({ formato: 'pptx' });
  });
});
