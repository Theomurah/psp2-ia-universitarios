/**
 * Schemas Zod para validar I/O dos prompts LLM e formulários.
 * Single source of truth — usado em frontend (forms) e backend (Edge Functions).
 */

import { z } from 'zod';
import {
  TIPOS_DOCUMENTO,
  FORMATOS_SUPORTADOS,
  NOMENCLATURA,
  DRIVE_UPLOAD_MODES,
  DRIVE_RAW_NAME_MODES,
} from './constants.ts';

// =============================================================
// Classificação (T09)
// =============================================================

/**
 * Valida que a string AAAA-MM-DD é uma data real do calendário.
 * Round-trip via Date UTC: '2026-13-45' e '2026-02-30' são rejeitadas —
 * a coluna documents.data_doc é `date` no Postgres e recusaria o UPDATE
 * inteiro, perdendo a classificação. Auditoria 2026-06-10 (PKG-SHARED-04).
 */
const isRealIsoDate = (value: string): boolean => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const ClassificationSchema = z.object({
  materia_code: z.string().regex(/^[A-Z][A-Z0-9_]+$/, 'MATERIA_CODE em UPPERCASE com underscore'),
  tipo: z.enum(TIPOS_DOCUMENTO),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isRealIsoDate, 'data must be a real calendar date (AAAA-MM-DD)')
    .nullable(),
  identificador: z.string().max(50).nullable(),
  titulo: z.string().min(3).max(80),
  confianca: z.number().min(0).max(1),
  razao: z.string().max(300),
});
export type Classification = z.infer<typeof ClassificationSchema>;

// (SynthesisInputSchema / CompressionInputSchema removidos — zero callers e
//  já divergiam do contrato real do pipeline: SynthesizeInput tem
//  user_system_prompt (H7) e CompressInput não tem metadata_origem. O contrato
//  canônico vive em supabase/functions/_shared/pipeline.ts. Mesmo critério do
//  GeneratedContent na auditoria A4. Auditoria 2026-06-10 / PKG-SHARED-02.)

// =============================================================
// Perfil — Formulário de onboarding
// =============================================================
export const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const HorarioSchema = z.object({
  dia: z.enum(DIAS_SEMANA),
  inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  fim: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
});
export type Horario = z.infer<typeof HorarioSchema>;

export const MateriaSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]+$/, 'Use UPPERCASE com underscore. Ex: FISICA3'),
  nome: z.string().min(2).max(80),
  profs: z.array(z.string()).optional(),
  horarios: z.array(HorarioSchema).optional(),
  /** Dados opcionais importados do atestado SIGAA */
  turma: z.string().max(10).optional(),
  professor: z.string().max(120).optional(),
  local: z.string().max(80).optional(),
  /**
   * Código(s) originais do SIGAA para preservar o source-of-truth.
   * Disciplina multi-turno tem mais de um, separados por espaço: "2M34 4T12".
   */
  codigo_horario_sigaa: z
    .string()
    .regex(/^[1-7]+[MTN][1-9]+( [1-7]+[MTN][1-9]+)*$/)
    .optional(),
});

export const ProfileFormSchema = z.object({
  full_name: z.string().min(2).max(100),
  curso: z.string().min(2).max(80).optional().or(z.literal('')),
  semestre_atual: z.string().regex(/^\d{4}\.\d$/, 'Formato: AAAA.S. Ex: 2026.1'),
  materias: z.array(MateriaSchema).min(1, 'Adicione ao menos 1 matéria').max(15),
});
export type ProfileForm = z.infer<typeof ProfileFormSchema>;

// =============================================================
// Senha — política forte (signup; signin aceita qualquer senha pré-existente)
// =============================================================
// Critérios:
//   - 12+ caracteres
//   - 1+ letra maiúscula
//   - 1+ letra minúscula
//   - 1+ dígito
// (Não exige símbolo — pesquisa NIST SP 800-63B recomenda foco em comprimento.)
export const PasswordSchema = z
  .string()
  .min(12, 'Senha deve ter ao menos 12 caracteres')
  .max(128, 'Senha muito longa')
  .refine((v) => /[A-Z]/.test(v), 'Inclua ao menos uma letra maiúscula')
  .refine((v) => /[a-z]/.test(v), 'Inclua ao menos uma letra minúscula')
  .refine((v) => /\d/.test(v), 'Inclua ao menos um número');

/** Calcula força de senha (0-4) para indicador visual. */
export function passwordStrength(value: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'muito fraca' | 'fraca' | 'razoável' | 'boa' | 'forte';
} {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  const labels = ['muito fraca', 'fraca', 'razoável', 'boa', 'forte'] as const;
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}

// =============================================================
// Upload (frontend → Edge Function)
// =============================================================
export const UploadRequestSchema = z.object({
  filename_original: z.string().min(1).max(200),
  format: z.enum(FORMATOS_SUPORTADOS),
  size_bytes: z.number().int().positive().max(50 * 1024 * 1024), // 50 MiB
  storage_path: z.string().min(1),
  // Opções de envio ao Drive escolhidas no upload (migration 0033). Defaults
  // preservam o comportamento atual (só síntese; nome do cru irrelevante).
  drive_upload_mode: z.enum(DRIVE_UPLOAD_MODES).default('synthesized'),
  drive_raw_name_mode: z.enum(DRIVE_RAW_NAME_MODES).default('original'),
});
export type UploadRequest = z.infer<typeof UploadRequestSchema>;

export const UploadResponseSchema = z.object({
  job_id: z.string().uuid(),
  document_id: z.string().uuid(),
  status: z.literal('pending'),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

// =============================================================
// Nomenclatura helpers
// =============================================================
export function sanitizeFilename(raw: string): string {
  return raw
    .replace(NOMENCLATURA.caracteres_proibidos, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NOMENCLATURA.max_titulo_chars);
}

// Whitelist canônica de extensões aceitas no caminho de upload do PSP2.
// Origem: auditoria 2026-05-26 (Agente 3 — Segurança, achado S-07).
// Restringir aqui evita que algum endpoint futuro deixe o cliente passar
// "../etc/passwd" ou similares pelo campo `extension` do filename final.
export const ALLOWED_FILE_EXTENSIONS = ['md', 'pdf', 'docx', 'pptx', 'txt'] as const;
export type AllowedFileExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];

export interface NomeFinalParams {
  materia_code: string;
  tipo: string;
  identificador: string | null;
  data: string | null;       // AAAA-MM-DD
  titulo: string;
  extension: AllowedFileExtension;
}

export function buildFilenameFinal(p: NomeFinalParams): string {
  if (!ALLOWED_FILE_EXTENSIONS.includes(p.extension)) {
    throw new Error(`Extensão não permitida: ${p.extension}`);
  }
  const id = p.identificador ?? p.data ?? '';
  const idPart = id ? `${id} ` : '';
  const titulo = sanitizeFilename(p.titulo);
  const raw = `${p.materia_code} - ${p.tipo} - ${idPart}${titulo}.${p.extension}`;
  return raw.slice(0, NOMENCLATURA.max_total_chars);
}

export function buildDriveFolderPath(semestre: string, materiaNome: string): string {
  return `${semestre}/${materiaNome}`;
}
