/**
 * Edge Function: process-document
 *
 * Recebe um job_id, baixa o arquivo do Storage, e roda o pipeline completo
 * em background via EdgeRuntime.waitUntil(). Atualiza job.status + job_events
 * a cada passo. Frontend escuta via Realtime.
 *
 * Cobre:
 *   T12 — endpoint que dispara processamento
 *   T14 — fila assíncrona via waitUntil (sem pg_cron)
 *   T16 — tratamento de erros com retry e status: failed
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, handleCorsPrefligh } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { parseDocument } from '../_shared/parsers.ts';
import { classify, synthesize, compress } from '../_shared/pipeline.ts';
import {
  validateStructural,
  validateClassification,
  validateQuantitative,
  validateSemantic,
  decideVerdict,
} from '../_shared/validation.ts';
import { buildFilenameFinal, buildDriveFolderPath } from '../../../packages/shared/src/schemas.ts';
import type { PipelineStep } from '../../../packages/shared/src/constants.ts';

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

serve(async (req) => {
  const cors = handleCorsPrefligh(req);
  if (cors) return cors;

  try {
    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'missing_job_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Responde 202 já e segue processando em background
    EdgeRuntime.waitUntil(runPipeline(job_id));

    return new Response(JSON.stringify({ status: 'processing' }), {
      status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('process-document erro inicial:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// =============================================================
// Pipeline principal — roda em background via waitUntil
// =============================================================
async function runPipeline(jobId: string): Promise<void> {
  const service = createServiceClient();

  // Helpers de telemetria/erro
  const setStep = async (step: PipelineStep, progress: number) => {
    await service.from('jobs').update({
      status: 'processing',
      current_step: step,
      progress_percent: progress,
      started_at: new Date().toISOString(),
    }).eq('id', jobId);
  };

  const logEvent = async (
    step: string,
    event_type: 'start' | 'success' | 'retry' | 'warning' | 'error',
    extra: Partial<{
      message: string; duration_ms: number; llm_model: string;
      tokens_input: number; tokens_output: number; cost_usd: number;
    }> = {},
  ) => {
    await service.from('job_events').insert({ job_id: jobId, step, event_type, ...extra });
  };

  const fail = async (reason: string, step: string) => {
    await logEvent(step, 'error', { message: reason });
    await service.from('jobs').update({
      status: 'failed',
      error_reason: reason,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
  };

  try {
    // 0) Carrega job + documento + perfil
    const { data: job, error: jobErr } = await service
      .from('jobs').select('*, documents(*)').eq('id', jobId).single();
    if (jobErr || !job) throw new Error(`Job ${jobId} não encontrado`);

    const doc = job.documents;
    const { data: profile, error: profErr } = await service
      .from('profiles').select('*').eq('id', job.user_id).single();
    if (profErr || !profile) throw new Error('Profile não encontrado');

    // 1) PARSE
    await setStep('parse', 10);
    const t0 = Date.now();
    const { data: fileBlob, error: dlErr } = await service.storage
      .from('documents').download(doc.storage_path);
    if (dlErr || !fileBlob) throw new Error(`Falha ao baixar do Storage: ${dlErr?.message}`);
    const buffer = new Uint8Array(await fileBlob.arrayBuffer());
    const parseResult = await parseDocument(buffer, doc.format);
    await logEvent('parse', 'success', {
      duration_ms: Date.now() - t0,
      message: `${parseResult.metadata.chars} chars extraídos`,
    });

    if (parseResult.texto.length < 50) {
      return await fail('Documento muito curto após parse (< 50 chars)', 'parse');
    }

    // 2) CLASSIFY
    await setStep('classify', 25);
    const cls = await classify({
      texto_bruto: parseResult.texto,
      semestre: profile.semestre_atual ?? '2026.1',
      materias: profile.materias ?? [],
    });
    await logEvent('classify', 'success', {
      duration_ms: cls.usage.duration_ms,
      llm_model: cls.usage.model,
      tokens_input: cls.usage.tokens_input,
      tokens_output: cls.usage.tokens_output,
      cost_usd: cls.usage.cost_usd,
      message: `${cls.result.materia_code} · ${cls.result.tipo} · conf=${cls.result.confianca.toFixed(2)}`,
    });

    const clsValidation = validateClassification(cls.result);
    if (!clsValidation.passed) {
      // Confiança muito baixa → falha
      return await fail(clsValidation.errors.join('; '), 'classify');
    }

    // Atualiza doc com a classificação
    await service.from('documents').update({
      materia_code: cls.result.materia_code,
      tipo: cls.result.tipo,
      data_doc: cls.result.data,
      identificador: cls.result.identificador,
      titulo: cls.result.titulo,
      classificacao_confianca: cls.result.confianca,
    }).eq('id', doc.id);

    // 3) SYNTHESIZE
    await setStep('synthesize', 45);
    const materiaNome = profile.materias?.find((m: { code: string }) => m.code === cls.result.materia_code)?.nome ?? cls.result.materia_code;
    const synth = await synthesize({
      texto_bruto: parseResult.texto,
      contexto: {
        materia_code: cls.result.materia_code,
        materia_nome: materiaNome,
        tipo: cls.result.tipo,
        data: cls.result.data,
        identificador: cls.result.identificador,
        titulo: cls.result.titulo,
        semestre: profile.semestre_atual ?? '2026.1',
        fonte: null,
      },
    });
    await logEvent('synthesize', 'success', {
      duration_ms: synth.usage.duration_ms,
      llm_model: synth.usage.model,
      tokens_input: synth.usage.tokens_input,
      tokens_output: synth.usage.tokens_output,
      cost_usd: synth.usage.cost_usd,
    });

    // Validações da síntese
    const structural = validateStructural(synth.result.markdown);
    const quantitative = validateQuantitative({
      chars_input: parseResult.texto.length,
      chars_output: synth.result.markdown.length,
      modo: 'synthesis',
    });
    const semantic = validateSemantic(parseResult.texto, synth.result.markdown);
    const synthVerdict = decideVerdict([structural, quantitative, semantic]);
    if (synthVerdict === 'rejected') {
      return await fail(`Síntese rejeitada: ${[...structural.errors, ...quantitative.errors, ...semantic.errors].join('; ')}`, 'synthesize');
    }

    // Salva o markdown sintetizado
    await service.from('generated_content').insert({
      document_id: doc.id,
      type: 'synthesized',
      markdown: synth.result.markdown,
      metadata: synth.result.metadata,
      validation_score: semantic.score,
    });

    // 4) COMPRESS (modo compacta)
    await setStep('compress', 70);
    const comp = await compress({
      markdown_sintetizado: synth.result.markdown,
      modo: 'compacta',
    });
    await logEvent('compress', 'success', {
      duration_ms: comp.usage.duration_ms,
      llm_model: comp.usage.model,
      tokens_input: comp.usage.tokens_input,
      tokens_output: comp.usage.tokens_output,
      cost_usd: comp.usage.cost_usd,
    });

    await service.from('generated_content').insert({
      document_id: doc.id,
      type: 'compressed_compact',
      markdown: comp.result.markdown,
      metadata: comp.result.metadata,
    });

    // 5) NOMENCLATURE
    await setStep('nomenclature', 85);
    const filenameFinal = buildFilenameFinal({
      materia_code: cls.result.materia_code,
      tipo: cls.result.tipo,
      identificador: cls.result.identificador,
      data: cls.result.data,
      titulo: cls.result.titulo,
      extension: 'md',
    });
    const driveFolderPath = buildDriveFolderPath(
      profile.semestre_atual ?? '2026.1',
      materiaNome,
    );
    await service.from('documents').update({
      filename_final: filenameFinal,
      drive_folder_path: driveFolderPath,
    }).eq('id', doc.id);

    // 6) UPLOAD_DRIVE (skeleton — H6/Sprint 2 implementa de fato)
    await setStep('upload_drive', 95);
    await logEvent('upload_drive', 'warning', {
      message: 'Drive export ainda não implementado (H6/Sprint 2)',
    });

    // 7) Conclui
    const totalCost = cls.usage.cost_usd + synth.usage.cost_usd + comp.usage.cost_usd;
    await service.from('jobs').update({
      status: synthVerdict === 'warning' ? 'completed_with_warning' : 'completed',
      current_step: null,
      progress_percent: 100,
      chars_input: parseResult.texto.length,
      chars_synthesis: synth.result.markdown.length,
      chars_compression: comp.result.markdown.length,
      cost_usd_total: totalCost,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
    await service.from('documents').update({
      processed_at: new Date().toISOString(),
    }).eq('id', doc.id);

  } catch (err) {
    console.error('runPipeline erro:', err);
    await fail((err as Error).message, 'unknown');
  }
}
