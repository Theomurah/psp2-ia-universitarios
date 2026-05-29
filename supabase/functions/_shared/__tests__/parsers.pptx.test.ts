/**
 * T15 — testes do parser de PPTX (officeparser mockado).
 */

import { describe, it, expect, vi } from 'vitest';
import { parsePptx, ParseError } from '../parsers.ts';

vi.mock('npm:officeparser@4.0.5', () => ({
  default: { parseOfficeAsync: vi.fn() },
}));

import officeparser from 'npm:officeparser@4.0.5';

describe('parsePptx', () => {
  it('extrai texto de deck com conteúdo', async () => {
    const longSlideText = 'Slide 1: TCM\n\nTeoria das Comunidades Microbianas. '.repeat(10);
    vi.mocked(officeparser.parseOfficeAsync).mockResolvedValueOnce(longSlideText);

    const out = await parsePptx(new Uint8Array([0x50, 0x4b]));

    expect(out.metadata.formato).toBe('pptx');
    expect(out.texto).toContain('Teoria das Comunidades');
    expect(out.metadata.warnings).toEqual([]);
  });

  it('emite warning quando deck tem pouco texto (< 100 chars, possivelmente só imagens)', async () => {
    vi.mocked(officeparser.parseOfficeAsync).mockResolvedValueOnce('Capa');

    const out = await parsePptx(new Uint8Array());

    expect(out.metadata.warnings).toHaveLength(1);
    expect(out.metadata.warnings[0]).toMatch(/PPTX|imagens|OCR/i);
  });

  it('lança ParseError com formato="pptx" quando officeparser falha', async () => {
    vi.mocked(officeparser.parseOfficeAsync).mockRejectedValueOnce(new Error('arquivo malformado'));

    await expect(parsePptx(new Uint8Array())).rejects.toThrowError(ParseError);
    await expect(parsePptx(new Uint8Array())).rejects.toMatchObject({
      formato: 'pptx',
    });
  });
});
