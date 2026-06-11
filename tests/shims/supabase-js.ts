/**
 * Shim de `npm:@supabase/supabase-js@2.45.0` — não testamos Edge Functions
 * que dependem do client (process-document, ingest-document) por aqui.
 * Existe só pra import resolver caso algum módulo transitivo puxe.
 */

export interface SupabaseClient {
  from(table: string): unknown;
  storage: { from(bucket: string): unknown };
  auth: { getUser(): Promise<unknown> };
}

export function createClient(_url: string, _key: string, _opts?: unknown): SupabaseClient {
  throw new Error('createClient shim — não suportado em testes.');
}
