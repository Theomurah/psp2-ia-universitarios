/**
 * T20 — Preview do documento processado.
 *
 * Renderiza o Markdown sintetizado (ou compactado) em uma view simples.
 * Versão MVP: usa <pre> com Markdown bruto. Próxima iteração: react-markdown + KaTeX.
 *
 * Migrado para useQuery em 2026-05-26 (auditoria — Agente 1, achado C4):
 * - request cancelada automaticamente via AbortSignal quando documentId muda
 * - dedup de requests in-flight
 * - cache compartilhado entre instâncias do componente
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface Props {
  documentId: string;
  type?: 'synthesized' | 'compressed_compact' | 'compressed_cola';
}

export default function MarkdownPreview({ documentId, type = 'synthesized' }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['generated_content', documentId, type],
    queryFn: async ({ signal }): Promise<string | null> => {
      const { data, error: err } = await supabase
        .from('generated_content')
        .select('markdown')
        .eq('document_id', documentId)
        .eq('type', type)
        .abortSignal(signal)
        .maybeSingle();
      if (err) throw err;
      return data?.markdown ?? null;
    },
    staleTime: 5 * 60 * 1000, // 5 min — conteúdo gerado é imutável após processado
  });

  if (isLoading) return <p>Carregando preview…</p>;
  if (error) return <p className="error">Erro: {(error as Error).message}</p>;
  if (!data) return <p>Sem conteúdo gerado ainda.</p>;

  return (
    <div className="markdown-preview">
      <pre>{data}</pre>
    </div>
  );
}
