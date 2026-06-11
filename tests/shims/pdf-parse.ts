/**
 * Shim de `npm:pdf-parse@1.1.1` pros testes Vitest (T15).
 * O default export é sobrescrito por vi.mock em cada teste de parser.
 */

export default async function pdfParse(
  _buffer: Uint8Array,
): Promise<{ text: string; numpages: number }> {
  return { text: '', numpages: 0 };
}
