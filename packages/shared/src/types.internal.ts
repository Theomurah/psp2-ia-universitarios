/**
 * Tipos canônicos de schema que ainda não têm caller no codebase.
 *
 * Origem: auditoria 2026-05-26 (Agente 2 — Código Morto, achado A4).
 * Foram movidos de `types.ts` pra cá pra reduzir o ruído da API pública
 * de `@psp2/shared` enquanto a feature ainda não está consumida — sem
 * deletar, porque espelham linha-a-linha o schema do banco (migration 0001).
 *
 * (2026-05-29: Feedback/FeedbackTopic → types.ts/constants.ts, H10 implementado.
 *  UserSystemPrompt → types.ts, H7 implementado. Só GeneratedContent segue aqui.)
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