/**
 * T20 — Preview do documento processado.
 *
 * Renderiza o Markdown sintetizado (ou compactado) como HTML semântico via
 * react-markdown + remark-gfm, carregados sob demanda (React.lazy). Enquanto
 * o chunk carrega, mostra o <pre> bruto como fallback (conteúdo visível desde
 * o primeiro paint). Auditoria 2026-06-10 — achados WEB-COMPONENTS-02 e -12.
 *
 * Migrado para useQuery em 2026-05-26 (auditoria — Agente 1, achado C4):
 * - request cancelada automaticamente via AbortSignal quando documentId muda
 * - dedup de requests in-flight
 * - cache compartilhado entre instâncias do componente
 */

import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { createLogger } from '../lib/log';

const log = createLogger('markdown-preview');

// Pesado (react-markdown + remark-gfm) — só entra no bundle quando usado.
const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

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
      if (err) {
        // Nunca renderizar a mensagem crua do PostgrestError na UI (pode expor
        // nomes de tabela/coluna/policy) — detalhe vai só pro log estruturado.
        log.error('preview_load_failed', { document_id: documentId, content_type: type, ...log.fromError(err) });
        throw new Error('preview_load_failed');
      }
      return data?.markdown ?? null;
    },
    staleTime: 5 * 60 * 1000, // 5 min — conteúdo gerado é imutável após processado
  });

  if (isLoading) return <p>Carregando preview…</p>;
  if (error) return <p className="error">Não foi possível carregar o conteúdo. Tente novamente.</p>;
  if (!data) return <p>Sem conteúdo gerado ainda.</p>;

  return (
    <div className="markdown-preview">
      <Suspense fallback={<pre>{data}</pre>}>
        <MarkdownRenderer markdown={data} />
      </Suspense>
    </div>
  );
}
