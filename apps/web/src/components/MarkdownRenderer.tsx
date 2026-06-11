/**
 * Renderizador de Markdown — separado do MarkdownPreview de propósito:
 * react-markdown + remark-gfm são pesados, então este módulo é carregado
 * sob demanda via React.lazy (code-splitting) só quando há conteúdo a exibir.
 *
 * Segurança: react-markdown NÃO usa dangerouslySetInnerHTML e, por padrão,
 * escapa HTML cru embutido no markdown (sem rehype-raw). A árvore gerada é
 * HTML semântico real (h1-h6, ul/ol, table), navegável por leitor de tela
 * (WCAG 1.3.1) — auditoria 2026-06-10, achado WEB-COMPONENTS-12.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  /** Conteúdo markdown a renderizar. */
  markdown: string;
}

export default function MarkdownRenderer({ markdown }: Props) {
  return (
    <div className="markdown-rendered">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
