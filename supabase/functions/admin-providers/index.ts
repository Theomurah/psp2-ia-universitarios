/**
 * Edge Function: admin-providers.
 *
 * Reporta QUAIS providers de LLM têm chave configurada (booleans, nunca o
 * valor do secret). Usado pelo painel /admin/modelos pra destravar só os
 * grupos de modelo disponíveis — espelha o `list_providers` do Kawi.
 *
 * Hardening:
 * - JWT obrigatório + checagem is_admin (só admin enxerga config de infra)
 * - Não vaza o valor de nenhuma chave — só `true/false` de presença
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCorsPreflight } from '../_shared/cors.ts';
import { createAuthClient, createServiceClient } from '../_shared/supabase-client.ts';
import { jsonResponse, errorResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/log.ts';

const log = createLogger('admin-providers');

// Mapeamento provider → env vars que o destravam (em ordem de tentativa).
// Mantido em sincronia com PROVIDERS no _shared/openrouter.ts.
const PROVIDER_ENVS: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  google: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY', 'LLM_API_KEY'],
};

function hasKey(envs: string[]): boolean {
  return envs.some((e) => {
    const v = Deno.env.get(e);
    return typeof v === 'string' && v.trim().length > 0;
  });
}

serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;

  try {
    // 1) Autentica
    const auth = createAuthClient(req);
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) {
      return errorResponse(req, 'unauthorized', 401);
    }

    // 2) Só admin — config de infra não é pra usuário comum
    const service = createServiceClient();
    const { data: profile, error: profErr } = await service
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    if (profErr || !profile?.is_admin) {
      return errorResponse(req, 'forbidden', 403);
    }

    // 3) Presença de chave por provider (nunca o valor)
    const providers: Record<string, boolean> = {};
    for (const [id, envs] of Object.entries(PROVIDER_ENVS)) {
      providers[id] = hasKey(envs);
    }

    // Também sinaliza se há um endpoint custom (LLM_BASE_URL) configurado.
    const customBaseUrl = !!Deno.env.get('LLM_BASE_URL');

    log.info('providers_listed', {
      openai: providers.openai,
      anthropic: providers.anthropic,
      google: providers.google,
      openrouter: providers.openrouter,
      custom: customBaseUrl,
    });

    return jsonResponse(req, { providers, customBaseUrl });
  } catch (err) {
    log.error('list_providers_failed', log.fromError(err));
    return errorResponse(req, 'internal_error', 500);
  }
});
