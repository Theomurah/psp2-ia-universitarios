/**
 * Helper para criar clientes Supabase dentro de Edge Functions.
 *
 * - createAuthClient: client autenticado com JWT do usuário (respeita RLS)
 * - createServiceClient: client com service_role (bypassa RLS — usar com cuidado)
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.45.0';

export function createAuthClient(req: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
  });
}

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceKey);
}
