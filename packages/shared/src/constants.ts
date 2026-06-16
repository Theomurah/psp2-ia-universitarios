/**
 * Constantes compartilhadas entre frontend e backend.
 * Refletem as decisões dos docs T07 (nomenclatura) e T08–T11 (prompts).
 */

// =============================================================
// Tipos de documento (enum)
// =============================================================
export const TIPOS_DOCUMENTO = [
  'Aula',
  'Plano',
  'Programa',
  'Cronograma',
  'Ficha',
  'Guia',
  'Resumo',
  'Resumão',
  'Questionário',
  'Estudo Dirigido',
  'Unidade',
  'Lista',
  'Apostila',
  'Cola',
  'Outro',
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

// =============================================================
// Formatos suportados
// =============================================================
export const FORMATOS_SUPORTADOS = ['pdf', 'docx', 'pptx', 'md', 'image'] as const;
export type FormatoDocumento = (typeof FORMATOS_SUPORTADOS)[number];

export const MIME_TO_FORMAT: Record<string, FormatoDocumento> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/markdown': 'md',
  'text/plain': 'md',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/heic': 'image',
  'image/webp': 'image',
};

// =============================================================
// Status do job
// =============================================================
export const JOB_STATUS = [
  'pending',
  'processing',
  'needs_review',
  'completed',
  'completed_with_warning',
  'failed',
] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

// =============================================================
// Passos do pipeline (current_step)
// =============================================================
export const PIPELINE_STEPS = [
  'parse',
  'classify',
  'synthesize',
  'compress',
  'validate',
  'nomenclature',
  'upload_drive',
] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

// =============================================================
// Feedback (H10) — tópico do feedback do aluno sobre uma síntese
// =============================================================
export const FEEDBACK_TOPICS = ['sintese', 'nomenclatura', 'drive', 'prompts', 'outro'] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

export const FEEDBACK_TOPIC_LABELS: Record<FeedbackTopic, string> = {
  sintese: 'Síntese',
  nomenclatura: 'Nomenclatura',
  drive: 'Google Drive',
  prompts: 'Prompts',
  outro: 'Outro',
};

// =============================================================
// Nomenclatura (T07)
// =============================================================
export const NOMENCLATURA = {
  formato: '{MATERIA_CODE} - {Tipo} - {Identificador} {Titulo}.{ext}',
  max_titulo_chars: 60,
  max_total_chars: 180,
  // Filesystem-safe: remove / \ : * ? " < > |
  caracteres_proibidos: /[\/\\:*?"<>|]/g,
} as const;

// =============================================================
// Modelos LLM (OpenRouter)
// =============================================================
export const MODELS = {
  classify: 'anthropic/claude-haiku-4.5',
  synthesize: 'anthropic/claude-sonnet-4.6',
  compress_compact: 'anthropic/claude-haiku-4.5',
  compress_cola: 'anthropic/claude-sonnet-4.6',
  judge: 'google/gemini-2.0-pro-experimental',
} as const;

// =============================================================
// Métricas-alvo (T11)
// =============================================================
export const TARGETS = {
  classify_confidence_auto: 0.7,        // ≥ 0.7 → segue automático
  classify_confidence_review: 0.4,      // 0.4-0.7 → needs_review
  synthesis_ratio_min: 0.20,
  synthesis_ratio_max: 0.50,
  compress_compact_ratio_min: 0.50,
  compress_compact_ratio_max: 0.70,
  compress_cola_ratio_min: 0.15,
  compress_cola_ratio_max: 0.25,
  semantic_score_pass: 0.80,
  semantic_score_warning: 0.60,
  judge_score_pass: 8.0,
  judge_score_warning: 6.0,
  max_retries: 2,
} as const;

// =============================================================
// SLO de tempo (T06)
// =============================================================
// TODO(observabilidade): nenhum caller hoje consome esses números.
// Quando o painel ops / dashboard admin (ver OBS-6 da auditoria
// 2026-05-26) entrar, comparar p95 real de runPipeline contra esses
// alvos por bucket de tamanho e disparar alerta quando estourar.
// Origem: auditoria 2026-05-26 (Agente 2 — Código Morto, A5).
export const SLO = {
  small_doc_chars: 5_000,
  medium_doc_chars: 20_000,
  large_doc_chars: 100_000,
  small_p95_seconds: 60,
  medium_p95_seconds: 90,
  large_p95_seconds: 150,
} as const;
