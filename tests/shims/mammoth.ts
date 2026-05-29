/**
 * Shim de `npm:mammoth@1.8.0` pros testes Vitest (T15).
 */

export default {
  async extractRawText(
    _opts: { arrayBuffer: ArrayBufferLike },
  ): Promise<{ value: string; messages: Array<{ type: string; message: string }> }> {
    return { value: '', messages: [] };
  },
};
