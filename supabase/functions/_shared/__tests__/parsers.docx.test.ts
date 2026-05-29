/**
 * T15 — testes do parser de DOCX (mammoth mockado).
 */

import { describe, it, expect, vi } from 'vitest';
import { parseDocx, ParseError } from '../parsers.ts';

vi.mock('npm:mammoth@1.8.0', () => ({
  default: { extractRawText: vi.fn() },
}));

import mammoth from 'npm:mammoth@1.8.0';

describe('parseDocx', () => {
  it('extrai texto e propaga warnings do mammoth', async () => {
    vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
      value: 'Questionário SIEP — Capítulo 3\n\nResolva:\n1. ...',
      messages: [
        { type: 'warning', message: 'Style "Heading 9" mapeado pra padrão' },
        { type: 'info', message: 'Document loaded' },
      ],
    });

    const out = await parseDocx(new Uint8Array([0x50, 0x4b]));

    expect(out.metadata.formato).toBe('docx');
    expect(out.texto).toContain('Questionário SIEP');
    expect(out.metadata.chars).toBe(out.texto.length);
    expect(out.metadata.warnings).toEqual(['Style "Heading 9" mapeado pra padrão']);
  });

  it('warnings vazio quando não há tipo "warning" nas messages', async () => {
    vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
      value: 'conteúdo simples e direto',
      messages: [{ type: 'info', message: 'ok' }],
    });

    const out = await parseDocx(new Uint8Array());
    expect(out.metadata.warnings).toEqual([]);
  });

  it('lança ParseError com formato="docx" quando mammoth falha', async () => {
    vi.mocked(mammoth.extractRawText).mockRejectedValueOnce(new Error('zip inválido'));

    await expect(parseDocx(new Uint8Array())).rejects.toThrowError(ParseError);
    await expect(parseDocx(new Uint8Array())).rejects.toMatchObject({
      formato: 'docx',
    });
  });

  it('chama mammoth com arrayBuffer derivado do Uint8Array', async () => {
    vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({ value: 'ok', messages: [] });
    const buf = new Uint8Array([1, 2, 3, 4]);

    await parseDocx(buf);

    expect(mammoth.extractRawText).toHaveBeenCalledWith({ arrayBuffer: buf.buffer });
  });
});
