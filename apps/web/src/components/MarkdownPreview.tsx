/**
 * T20 — Preview do documento processado.
 *
 * Renderiza o Markdown sintetizado (ou compactado) em uma view simples.
 * Versão MVP: usa <pre> com Markdown bruto. Próxima iteração: react-markdown + KaTeX.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  documentId: string;
  type?: 'synthesized' | 'compressed_compact' | 'compressed_cola';
}

export default function MarkdownPreview({ documentId, type = 'synthesized' }: Props) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('generated_content')
      .select('markdown')
      .eq('document_id', documentId)
      .eq('type', type)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setMarkdown(null);
        } else {
          setMarkdown(data?.markdown ?? null);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [documentId, type]);

  if (loading) return <p>Carregando preview…</p>;
  if (error) return <p className="error">Erro: {error}</p>;
  if (!markdown) return <p>Sem conteúdo gerado ainda.</p>;

  return (
    <div className="markdown-preview">
      <pre>{markdown}</pre>
    </div>
  );
}
