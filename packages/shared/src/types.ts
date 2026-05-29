/**
 * Tipos compartilhados entre frontend e Edge Functions.
 * Espelham as 8 tabelas do schema (migration 0001).
 */

import type {
  FormatoDocumento,
  JobStatus,
  PipelineStep,
  TipoDocumento,
} from './constants.ts';

// =============================================================
// Profile (extends auth.users)
// =============================================================
export interface HorarioAula {
  dia: 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';
  inicio: string;      // "HH:MM"
  fim: string;         // "HH:MM"
}

export interface MateriaPerfil {
  code: string;        // "FISICA3"
  nome: string;        // "Física 3"
  profs?: string[];    // ["Fábio Lima"]
  horarios?: HorarioAula[];
  /** Campos opcionais — importados do atestado SIGAA. */
  turma?: string;                    // "01"
  professor?: string;                // "FABIO MENEZES DE SOUZA LIMA"
  local?: string;                    // "ICC AT 117"
  codigo_horario_sigaa?: string;     // "26N34"
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  curso: string | null;                 // "Engenharia de Produção"
  semestre_atual: string | null;        // "2026.1"
  materias: MateriaPerfil[];
  drive_root_folder_id: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================
// Document
// =============================================================
export interface DocumentRecord {
  id: string;
  user_id: string;

  filename_original: string;
  filename_final: string | null;
  format: FormatoDocumento;
  size_bytes: number;
  storage_path: string;

  drive_file_id: string | null;
  drive_folder_path: string | null;

  // Resultado da classificação (T09)
  materia_code: string | null;
  tipo: TipoDocumento | null;
  data_doc: string | null;              // ISO date
  identificador: string | null;
  titulo: string | null;
  classificacao_confianca: number | null;

  created_at: string;
  processed_at: string | null;

  // Soft delete (migration 0007) — null = ativo, timestamp = arquivado
  archived_at: string | null;
}

// =============================================================
// Job (pipeline state)
// =============================================================
export interface JobRecord {
  id: string;
  user_id: string;
  document_id: string;

  status: JobStatus;
  current_step: PipelineStep | null;
  progress_percent: number;
  attempt_count: number;
  error_reason: string | null;

  chars_input: number | null;
  chars_synthesis: number | null;
  chars_compression: number | null;
  cost_usd_total: number;

  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// =============================================================
// Job event (log granular)
// =============================================================
export type JobEventType = 'start' | 'success' | 'retry' | 'warning' | 'error';

export interface JobEvent {
  id: number;
  job_id: string;
  step: string;
  event_type: JobEventType;
  message: string | null;
  duration_ms: number | null;
  llm_model: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  created_at: string;
}

// (GeneratedContent / GeneratedContentType movidos para types.internal.ts —
//  schema-first, sem caller no codebase ainda. Auditoria 2026-05-26 / A4.)

// =============================================================
// Prompt library
// =============================================================
export type PromptCategory = 'estudo' | 'exercicio' | 'redacao' | 'revisao';

export interface PromptLibraryItem {
  id: string;
  user_id: string | null;               // null = oficial
  title: string;
  description: string | null;
  template: string;
  category: PromptCategory;
  is_official: boolean;
  usage_count: number;
  created_at: string;
}

// (UserSystemPrompt, Feedback, FeedbackTopic movidos para types.internal.ts —
//  schema-first, consumo planejado em H7/H10. Auditoria 2026-05-26 / A4.)

// =============================================================
// LLM call I/O
// =============================================================
export interface ClassificationResult {
  materia_code: string;
  tipo: TipoDocumento;
  data: string | null;
  identificador: string | null;
  titulo: string;
  confianca: number;
  razao: string;
}

export interface SynthesisResult {
  markdown: string;
  metadata: {
    topicos_extraidos: string[];
    formulas_count: number;
    secoes_count: number;
    chars_input: number;
    chars_output: number;
    ratio_compressao: number;
  };
}

export interface CompressionResult {
  markdown: string;
  metadata: {
    modo: 'compacta' | 'cola';
    chars_input: number;
    chars_output: number;
    ratio_compressao: number;
    formulas_preservadas: number;
    avisos_preservados: boolean;
  };
}

export interface ValidationResult {
  passed: boolean;
  layer: 'structural' | 'quantitative' | 'semantic' | 'judge';
  score: number;                        // 0.0 a 1.0 (ou 0-10 no judge)
  warnings: string[];
  errors: string[];
}
