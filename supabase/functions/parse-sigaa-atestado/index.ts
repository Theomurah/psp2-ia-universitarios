/**
 * Edge Function: parse-sigaa-atestado
 *
 * Recebe o PDF do "Atestado de Matrícula" exportado do SIGAA (UnB) e devolve
 * JSON estruturado com cabeçalho (nome, curso, semestre, período) + lista de
 * matérias + horários decodificados.
 *
 * Não persiste nada — apenas parseia. O frontend mostra o resultado pro
 * usuário confirmar/editar e só então grava em `profiles.materias`.
 *
 * Body: multipart/form-data com campo `file` (PDF, max 5 MiB)
 * Resposta: { ok: true, parsed: SigaaAtestado } | { ok: false, error: ... }
 *
 * Hardening:
 * - JWT obrigatório
 * - Rate limit 10/min por usuário (operação rara)
 * - Tamanho máximo 5 MiB
 * - Erros não vazam stack
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCorsPrefligh } from '../_shared/cors.ts';
import { createAuthClient } from '../_shared/supabase-client.ts';
import {
  jsonResponse,
  errorResponse,
  requireMaxPayload,
} from '../_shared/http.ts';
import { checkRateLimit, clientFingerprint } from '../_shared/rate-limit.ts';
import { parsePdf } from '../_shared/parsers.ts';
import { parseSigaaAtestado } from '../../../packages/shared/src/sigaa.ts';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MiB

serve(async (req) => {
  const cors = handleCorsPrefligh(req);
  if (cors) return cors;

  try {
    const sizeErr = requireMaxPayload(req, MAX_BODY_BYTES);
    if (sizeErr) return sizeErr;

    // 1) JWT
    const auth = createAuthClient(req);
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) {
      return errorResponse(req, 'unauthorized', 401);
    }

    // 2) Rate limit
    const fp = clientFingerprint(req, user.id);
    const rl = checkRateLimit(`parse-sigaa:${fp}`, { max: 10, windowSec: 60 });
    if (!rl.ok) return errorResponse(req, 'rate_limited', 429);

    // 3) Lê o arquivo do multipart
    const ct = req.headers.get('content-type') ?? '';
    if (!ct.startsWith('multipart/form-data')) {
      return errorResponse(req, 'unsupported_media_type', 415,
        'Envie multipart/form-data com o campo "file".');
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return errorResponse(req, 'invalid_body', 400, 'Formulário inválido.');
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return errorResponse(req, 'missing_required', 400, 'Campo "file" obrigatório.');
    }
    if (file.size > MAX_BODY_BYTES) {
      return errorResponse(req, 'payload_too_large', 413);
    }
    if (file.size < 100) {
      return errorResponse(req, 'invalid_body', 400, 'Arquivo muito pequeno — confira o PDF.');
    }

    // Validação relaxada de mime — Safari/macOS às vezes manda octet-stream.
    // Confiamos no parsePdf pra detectar conteúdo não-PDF e erro.
    const buffer = new Uint8Array(await file.arrayBuffer());

    // 4) Parse PDF → texto
    let texto: string;
    try {
      const parsed = await parsePdf(buffer);
      texto = parsed.texto;
    } catch (err) {
      console.error('parse-sigaa-atestado parsePdf:', err);
      return errorResponse(req, 'invalid_body', 422,
        'Não foi possível ler o PDF. Confira se é o atestado de matrícula do SIGAA.');
    }

    if (texto.length < 100) {
      return errorResponse(req, 'invalid_body', 422,
        'O PDF parece vazio ou só imagens (sem texto extraível).');
    }

    // 5) Parse SIGAA → estruturado
    const parsed = parseSigaaAtestado(texto);

    if (parsed.materias.length === 0) {
      return errorResponse(req, 'invalid_body', 422,
        'Não consegui identificar matérias no PDF. Confira se é o "Atestado de Matrícula" do SIGAA → Discente → Ensino.');
    }

    return jsonResponse(req, { ok: true, parsed });
  } catch (err) {
    console.error('parse-sigaa-atestado erro:', err);
    return errorResponse(req, 'internal_error', 500);
  }
});
