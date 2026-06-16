/**
 * Setup global pros testes (T15).
 *
 * Edge Functions usam `Deno.env.get(...)` em runtime. No Vitest (Node) precisamos
 * de um stub global, ou o import dos módulos falha em parse-time.
 */

import { beforeEach, vi } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var Deno: {
    env: {
      get(name: string): string | undefined;
      set(name: string, value: string): void;
      delete(name: string): void;
    };
  };
}

const envStore = new Map<string, string>();

if (!('Deno' in globalThis)) {
  (globalThis as unknown as { Deno: unknown }).Deno = {
    env: {
      get: (name: string) => envStore.get(name) ?? process.env[name],
      set: (name: string, value: string) => envStore.set(name, value),
      delete: (name: string) => envStore.delete(name),
    },
  };
}

beforeEach(() => {
  envStore.clear();
  vi.restoreAllMocks();
});
