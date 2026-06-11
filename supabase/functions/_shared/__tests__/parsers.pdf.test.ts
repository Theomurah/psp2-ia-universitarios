/**
 * T15 — testes do parser de PDF.
 *
 * pdf-parse é mockado via vi.mock no string `npm:pdf-parse@1.1.1` (que o
 * vitest.config.ts aliasa pra tests/shims/pdf-parse.ts). Os testes cobrem:
 *   - extração feliz (texto + páginas + chars no metadata)
 *   - PDF sem texto (só imagens) → warning
 *   - erro do pdf-parse → ParseError(formato='pdf')
 */

import { describe, it, expect, vi } from 'vitest';
import { parsePdf, ParseError } from '../parsers.ts';

vi.mock('npm:pdf-parse@1.1.1', () => ({
  default: vi.fn(),
}));

import pdfParse from 'npm:pdf-parse@1.1.1';

describe('parsePdf', () => {
  it('extrai texto e número de páginas com sucesso', async () => {
    vi.mocked(pdfParse).mockResolvedValueOnce({
      text:
        'Aula 12 — Eletromagnetismo\n\nLei de Coulomb: a força entre cargas elétricas é proporcional ' +
        'ao produto das cargas e inversamente proporcional ao quadrado da distância entre elas.',
      numpages: 3,
    });

    const out = await parsePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

    expect(out.metadata.formato).toBe('pdf');
    expect(out.metadata.paginas).toBe(3);
    expect(out.texto).toContain('Lei de Coulomb');
    expect(out.metadata.warnings).toEqual([]);
  });

  it('emite warning para PDF só com imagens (texto < 100 chars)', async () => {
    vi.mocked(pdfParse).mockResolvedValueOnce({
      text: 'p.1',
      numpages: 10,
    });

    const out = await parsePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

    expect(out.metadata.warnings).toHaveLength(1);
    expect(out.metadata.warnings[0]).toMatch(/PDF parece vazio|imagens|OCR/i);
  });

  it('lança ParseError com formato="pdf" quando pdf-parse falha', async () => {
    vi.mocked(pdfParse).mockRejectedValueOnce(new Error('arquivo corrompido'));

    await expect(parsePdf(new Uint8Array([0xff, 0xff]))).rejects.toThrowError(ParseError);
    await expect(parsePdf(new Uint8Array([0xff, 0xff]))).rejects.toMatchObject({
      formato: 'pdf',
    });
  });

  it('preserva acentos no texto extraído', async () => {
    vi.mocked(pdfParse).mockResolvedValueOnce({
      text: 'Função de onda |ψ⟩ — não trivial. Ç ã õ.'.repeat(5),
      numpages: 1,
    });

    const out = await parsePdf(new Uint8Array());
    expect(out.texto).toContain('Função de onda');
    expect(out.texto).toContain('ψ');
  });
});
