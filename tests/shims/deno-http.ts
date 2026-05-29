/**
 * Shim de `https://deno.land/std@.../http/server.ts` — sem efeito em testes.
 */

export function serve(_handler: (req: Request) => Response | Promise<Response>): void {
  /* noop */
}
