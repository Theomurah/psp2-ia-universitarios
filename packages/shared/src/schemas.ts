/**
 * Schemas Zod para validar I/O dos prompts LLM e formulários.
 * Single source of truth — usado em frontend (forms) e backend (Edge Functions).
 */

import { z } from 'zod';
import { TIPOS_DOCUMENTO, FORMATOS_SUPORTADOS, NOMENCLATURA } from './constants';

// =============================================================
// Classificação (T09)
// =============================================================
export const ClassificationSchema = z.object({
  materia_code: z.string().regex(/^[A-Z][A-Z0-9_]+$/, 'MATERIA_CODE em UPPERCASE com underscore'),
  tipo: z.enum(TIPOS_DOCUMENTO),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  identificador: z.string().max(50).nullable(),
  titulo: z.string().min(3).max(80),
  confianca: z.number().min(0).max(1),
  razao: z.string().max(300),
});
export type Classification = z.infer<typeof ClassificationSchema>;

// =============================================================
// Síntese (T08)
// =============================================================
export const SynthesisInputSchema = z.object({
  texto_bruto: z.string().min(50),
  contexto: z.object({
    materia_code: z.string(),
    materia_nome: z.string(),
    tipo: z.enum(TIPOS_DOCUMENTO),
    data: z.string().nullable(),
    identificador: z.string().nullable(),
    titulo: z.string(),
    semestre: z.string(),
    fonte: z.string().nullable(),
  }),
});
export type SynthesisInput = z.infer<typeof SynthesisInputSchema>;

// =============================================================
// Compressão (T10)
// =============================================================
export const CompressionInputSchema = z.object({
  markdown_sintetizado: z.string().min(100),
  modo: z.enum(['compacta', 'cola']),
  metadata_origem: z.object({
    chars_input_original: z.number(),
    formulas_count: z.number(),
    secoes_count: z.number(),
  }),
});
export type CompressionInput = z.infer<typeof CompressionInputSchema>;

// =============================================================
// Perfil — Formulário de onboarding
// =============================================================
export const MateriaSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]+$/, 'Use UPPERCASE com underscore. Ex: FISICA3'),
  nome: z.string().min(2).max(60),
  profs: z.array(z.string()).optional(),
});

export const ProfileFormSchema = z.object({
  full_name: z.string().min(2).max(100),
  semestre_atual: z.string().regex(/^\d{4}\.\d$/, 'Formato: AAAA.S. Ex: 2026.1'),
  materias: z.array(MateriaSchema).min(1, 'Adicione ao menos 1 matéria').max(15),
});
export type ProfileForm = z.infer<typeof ProfileFormSchema>;

// =============================================================
// Upload (frontend → Edge Function)
// =============================================================
export const UploadRequestSchema = z.object({
  filename_original: z.string().min(1).max(200),
  format: z.enum(FORMATOS_SUPORTADOS),
  size_bytes: z.number().int().positive().max(50 * 1024 * 1024), // 50 MiB
  storage_path: z.string().min(1),
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

export interface NomeFinalParams {
  materia_code: string;
  tipo: string;
  identificador: string | null;
  data: string | null;       // AAAA-MM-DD
  titulo: string;
  extension: string;          // 'md', 'pdf', etc.
}

export function buildFilenameFinal(p: NomeFinalParams): string {
  const id = p.identificador ?? p.data ?? '';
  const idPart = id ? `${id} ` : '';
  const titulo = sanitizeFilename(p.titulo);
  const raw = `${p.materia_code} - ${p.tipo} - ${idPart}${titulo}.${p.extension}`;
  return raw.slice(0, NOMENCLATURA.max_total_chars);
}

export function buildDriveFolderPath(semestre: string, materiaNome: string): string {
  return `${semestre}/${materiaNome}`;
}
