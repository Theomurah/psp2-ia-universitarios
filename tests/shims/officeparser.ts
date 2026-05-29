/**
 * Shim de `npm:officeparser@4.0.5` pros testes Vitest (T15).
 */

export default {
  async parseOfficeAsync(_buffer: Buffer | Uint8Array): Promise<string> {
    return '';
  },
};
