/**
 * Vitest config (T15).
 *
 * Roda em Node, mas os arquivos de Edge Function usam sintaxe Deno
 * (`npm:<pacote>@versao`, `Deno.env.get`, `node:buffer`). O setup abaixo
 * resolve essas particularidades sem precisar reescrever o código de
 * produção:
 *
 *   1. Aliases regex transformam `npm:foo@x.y.z` em shims locais que os
 *      testes podem sobreescrever com vi.mock.
 *   2. tests/setup.ts injeta um objeto global `Deno` mínimo (`Deno.env.get`)
 *      pra suprir o uso no models.ts / openrouter.ts / vision/index.ts.
 *
 * Roda apenas testes em supabase/functions/_shared/__tests__ e
 * packages/shared/src/__tests__ — o frontend não é coberto aqui.
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shim = (name: string) => resolve(__dirname, `tests/shims/${name}.ts`);

export default defineConfig({
  resolve: {
    alias: [
      // Deno-style npm: imports — todos os shims ficam em tests/shims/
      { find: /^npm:pdf-parse@.+$/, replacement: shim('pdf-parse') },
      { find: /^npm:mammoth@.+$/, replacement: shim('mammoth') },
      { find: /^npm:officeparser@.+$/, replacement: shim('officeparser') },
      { find: /^npm:@supabase\/supabase-js@.+$/, replacement: shim('supabase-js') },
      // std lib do Deno (HTTP server) — substituído por noop só pra import resolver
      { find: /^https:\/\/deno\.land\/std@.+\/http\/server\.ts$/, replacement: shim('deno-http') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'supabase/functions/_shared/__tests__/**/*.test.ts',
      'packages/shared/src/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'supabase/functions/_shared/**/*.ts',
        'packages/shared/src/**/*.ts',
      ],
      exclude: ['**/__tests__/**', '**/*.test.ts'],
    },
  },
});
