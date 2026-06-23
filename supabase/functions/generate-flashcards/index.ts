/**
 * Edge Function: generate-flashcards (Fase 6, frente 2.1).
 *
 * Recebe um material (texto) + um contexto e gera cartões frente/verso com LaTeX
 * via LLM. Fluxo simples: texto entra, JSON de cartões sai — sem storage nem fila
 * (o frontend extrai o texto e persiste os cartões depois).
 *
 * Hardening (mesmo padrão de generate-system-prompt):
 * - JWT obrigatório
 * - Rate limit (10/min — chamada custa tokens)
 * - Input sandboxado (<<DOC>>) no prompt; truncado a MAX_INPUT_CHARS
 * - NUNCA loga material/contexto/cartões (conteúdo do aluno) — só contagens/custo
 * - Erros não vazam mensagem interna
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCorsPreflight } from '../_shared/cors.ts';
import { createAuthClient } from '../_shared/supabase-client.ts';
import {
  jsonResponse,
  errorResponse,
  parseJsonBody,
  requireContentType,
  requireMaxPayload,
} from '../_shared/http.ts';
import { checkRateLimit, clientFingerprint } from '../_shared/rate-limit.ts';
import { createLogger } from '../_shared/log.ts';
import { getModelConfig } from '../_shared/models.ts';
import { callLLMWithRetry, OpenRouterError } from '../_shared/openrouter.ts';
import {
  buildFlashcardMessages,
  parseFlashcardsResponse,
  clampCount,
  MAX_INPUT_CHARS,
} from '../_shared/flashcard-prompt.ts';

const log = createLogger('generate-flashcards');
const MAX_BODY_BYTES = 200_000;

interface GenerateBody {
  text?: unknown;
  context?: unknown;
  count?: unknown;
}

serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;

  try {
    const ctErr = requireContentType(req, 'application/json');
    if (ctErr) return ctErr;
    const sizeErr = requireMaxPayload(req, MAX_BODY_BYTES);
    if (sizeErr) return sizeErr;

    // 1) Autentica
    const auth = createAuthClient(req);
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return errorResponse(req, 'unauthorized', 401);

    // 2) Rate limit
    const fp = clientFingerprint(req, user.id);
    const rl = checkRateLimit(`gen-flashcards:${fp}`, { max: 10, windowSec: 60 });
    if (!rl.ok) {
      log.warn('rate_limited', { user_id: user.id, window_sec: 60 });
      return errorResponse(req, 'rate_limited', 429);
    }

    // 3) Body
    const [body, parseErr] = await parseJsonBody<GenerateBody>(req);
    if (parseErr) return parseErr;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const context = typeof body?.context === 'string' ? body.context : '';
    const count = clampCount(Number(body?.count));
    if (text.length < 20) {
      return errorResponse(req, 'missing_required', 400, 'Envie um material com pelo menos algumas frases.');
    }

    // 4) LLM
    const config = await getModelConfig();
    const model = config.synthesize;
    const messages = buildFlashcardMessages(text, context, count);

    let result;
    try {
      result = await callLLMWithRetry({
        model,
        messages,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });
    } catch (err) {
      const status = err instanceof OpenRouterError ? err.status : 0;
      log.error('llm_failed', { user_id: user.id, model, status });
      return errorResponse(req, 'llm_error', 502, 'A IA não conseguiu gerar agora. Tente de novo.');
    }

    // 5) Parse + valida (sem logar conteúdo)
    const cards = parseFlashcardsResponse(result.content, count);
    if (cards.length === 0) {
      log.warn('no_cards', { user_id: user.id, model, input_chars: Math.min(text.length, MAX_INPUT_CHARS) });
      return errorResponse(req, 'no_cards', 422, 'Não consegui extrair cartões desse material. Tente um texto mais claro.');
    }

    log.info('generated', {
      user_id: user.id,
      model,
      requested: count,
      produced: cards.length,
      input_chars: Math.min(text.length, MAX_INPUT_CHARS),
      tokens_input: result.tokens_input,
      tokens_output: result.tokens_output,
      cost_usd: result.cost_usd,
    });

    return jsonResponse(req, { ok: true, cards });
  } catch (err) {
    log.error('unhandled', log.fromError(err));
    return errorResponse(req, 'internal_error', 500);
  }
});
