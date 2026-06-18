/**
 * Renderizador de Markdown + LaTeX pros flashcards (frente 1.8).
 *
 * Espelha o MarkdownRenderer (react-markdown + remark-gfm, sem rehype-raw → HTML
 * cru continua escapado, seguro contra XSS) e adiciona:
 *   - remark-math   → reconhece `$...$` (inline) e `$$...$$` (bloco)
 *   - rehype-katex  → renderiza com KaTeX (rápido, sem JS runtime pesado)
 *
 * `throwOnError: false`: LaTeX malformado num cartão vira texto vermelho em vez
 * de derrubar a página. Carregado sob demanda (lazy) onde for usado, porque
 * react-markdown + KaTeX são pesados pro chunk inicial.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Props {
  /** Conteúdo markdown (pode conter LaTeX em `$...$` / `$$...$$`). */
  content: string;
}

export default function MathMarkdown({ content }: Props) {
  return (
    <div className="markdown-rendered">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: 'var(--error)' }]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
