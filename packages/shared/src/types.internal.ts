/**
 * Tipos canônicos de schema que ainda não têm caller no codebase.
 *
 * Origem: auditoria 2026-05-26 (Agente 2 — Código Morto, achado A4).
 * Foram movidos de `types.ts` pra cá pra reduzir o ruído da API pública
 * de `@psp2/shared` enquanto a feature ainda não está consumida — sem
 * deletar, porque espelham linha-a-linha o schema do banco (migration 0001)
 * e provavelmente serão consumidos nas Sprints 3–4 (H6 generate-system-prompt
 * UI, H10 feedback widget).
 *
 * **Não exportar** via `index.ts` enquanto não houver caller real.
 * Quando a feature for implementada, mover o tipo de volta pra `types.ts`.
 */

// =============================================================
// Generated content (síntese, compressão, cola)
// Tabela: public.generated_content. Lida hoje só pelo MarkdownPreview
// usando inline shape; quando a UI ganhar páginas dedicadas, importar daqui.
// =============================================================
export type GeneratedContentType =
  | 'synthesized'
  | 'compressed_compact'
  | 'compressed_cola';

export interface GeneratedContent {
  id: string;
  document_id: string;
  type: GeneratedContentType;
  markdown: string;
  metadata: {
    topicos?: string[];
    formulas_count?: number;
    secoes_count?: number;
    [k: string]: unknown;
  };
  validation_score: number | null;
  created_at: string;
}

// =============================================================
// User system prompt (output principal — H7 Sprint 3)
// Tabela: public.user_system_prompts. Hoje gerada pela Edge Function
// generate-system-prompt mas sem UI consumidora.
// =============================================================
export interface UserSystemPrompt {
  id: string;
  user_id: string;
  prompt_text: string;
  semester_snapshot: string;
  source_documents: string[];
  version: number;
  is_active: boolean;
  created_at: string;
}

// =============================================================
// Feedback (H10 Sprint 4)
// Tabela: public.feedback. Schema-first, sem UI ainda.
// =============================================================
export type FeedbackTopic = 'sintese' | 'nomenclatura' | 'drive' | 'prompts' | 'outro';

export interface Feedback {
  id: string;
  user_id: string;
  job_id: string | null;
  rating: 1 | 2 | 3 | 4 | 5;
  topic: FeedbackTopic;
  comments: string | null;
  created_at: string;
}
