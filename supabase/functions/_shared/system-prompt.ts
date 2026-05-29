/**
 * Template de System Prompt personalizado do aluno (T31).
 *
 * Esse é o "produto principal" do PSP2: um system prompt que o aluno pode
 * colar em qualquer interface de IA (ChatGPT/Claude/Gemini) e a IA vai
 * responder com o contexto certo — matérias, semestre, professores,
 * documentos já estudados.
 *
 * O template usa os mesmos placeholders {{var}} de prompts.ts. A função
 * `renderSystemPrompt(profile, docs)` faz o merge sem chamar LLM (T32).
 */

import { renderPrompt } from './prompts.ts';
import type { MateriaPerfil, DocumentRecord } from '../../../packages/shared/src/types.ts';

export const SYSTEM_PROMPT_TEMPLATE = `Você é assistente acadêmico personalizado de {{nome}}, aluno(a) de {{curso}} no semestre {{semestre}}.

## Contexto do aluno

- Nome: {{nome}}
- Curso: {{curso}}
- Semestre atual: {{semestre}}
- Matérias deste semestre:
{{lista_materias_detalhada}}

## Documentos já processados pelo aluno

{{lista_documentos_recentes}}

## Como você deve responder

1. **Linguagem**: português do Brasil, técnica mas didática. Use analogias quando ajudar.
2. **Fórmulas**: sempre em LaTeX ($$F = ma$$ ou inline $\\vec{r}$). Resultados finais em $\\boxed{}$.
3. **Estruturação**: respostas longas em seções com ## e ###. Use tabelas pra dados numéricos.
4. **Referências**: cite o material do aluno quando aplicável ("Você viu isso no documento X").
5. **Erros comuns**: ao explicar conceitos, inclua armadilhas e como evitá-las.
6. **Provas**: quando o aluno mencionar prova/avaliação, foque em pontos cobrados e flag "⚠️ COBRADO NA PROVA" se a fonte indicar.
7. **Estilo**: direto, sem rodeios. Nada de "Claro!", "Ótima pergunta!", "Vou te ajudar!".

## Tópicos centrais por matéria (extraídos dos documentos)

{{lista_topicos_por_materia}}

## Restrições

- Não invente bibliografia que o aluno não citou.
- Em dúvidas conceituais ambíguas, marcar "[verificar com o professor]" em vez de chutar.
- Se o aluno pedir resolução, faça passo a passo — não pule etapas matemáticas.
- Nunca substituir aula nem afirmar que é fonte oficial — você é apoio.`;

export interface RenderSystemPromptInput {
  full_name: string;
  curso: string;
  semestre: string;
  materias: MateriaPerfil[];
  /** Documentos já processados — mais recentes primeiro. */
  recent_documents: Pick<DocumentRecord, 'materia_code' | 'tipo' | 'titulo' | 'identificador' | 'data_doc'>[];
  /** Tópicos extraídos dos generated_content (por matéria). Opcional. */
  topicos_por_materia?: Record<string, string[]>;
}

/**
 * Renderiza o system prompt final substituindo placeholders pelos dados do aluno.
 * Determinístico — mesma entrada produz mesma saída.
 */
export function renderSystemPrompt(input: RenderSystemPromptInput): string {
  return renderPrompt(SYSTEM_PROMPT_TEMPLATE, {
    nome: input.full_name || 'Aluno(a)',
    curso: input.curso || '—',
    semestre: input.semestre || '—',
    lista_materias_detalhada: formatMaterias(input.materias),
    lista_documentos_recentes: formatDocs(input.recent_documents),
    lista_topicos_por_materia: formatTopicos(input.topicos_por_materia ?? {}),
  });
}

function formatMaterias(materias: MateriaPerfil[]): string {
  if (materias.length === 0) return '  (nenhuma matéria cadastrada)';
  return materias
    .map((m) => {
      const profs = m.profs?.length ? ` — Prof(s): ${m.profs.join(', ')}` : '';
      return `  - **${m.code}** (${m.nome})${profs}`;
    })
    .join('\n');
}

function formatDocs(
  docs: Pick<DocumentRecord, 'materia_code' | 'tipo' | 'titulo' | 'identificador' | 'data_doc'>[],
): string {
  if (docs.length === 0) return '  (ainda sem documentos processados)';
  return docs
    .slice(0, 20)
    .map((d) => {
      const id = d.identificador ?? d.data_doc ?? '';
      const idPart = id ? `${id} — ` : '';
      return `  - ${d.materia_code ?? 'OUTRO'} · ${d.tipo ?? 'Doc'}: ${idPart}${d.titulo ?? 'sem título'}`;
    })
    .join('\n');
}

function formatTopicos(topicos: Record<string, string[]>): string {
  const entries = Object.entries(topicos).filter(([, t]) => t.length > 0);
  if (entries.length === 0) return '  (nenhum tópico identificado ainda)';
  return entries
    .map(([materia, ts]) => `  - **${materia}**: ${ts.slice(0, 8).join(', ')}`)
    .join('\n');
}

/**
 * Snapshot determinístico do semestre — usado pra detectar quando o prompt
 * precisa ser regerado (mudou matéria, mudou semestre, etc.).
 * Estrutura: "<semestre>::<codes-ordenados>::<docs-recentes-ids>".
 */
export function buildSemesterSnapshot(input: RenderSystemPromptInput): string {
  const codes = [...input.materias.map((m) => m.code)].sort().join(',');
  const docs = input.recent_documents
    .slice(0, 10)
    .map((d) => `${d.materia_code ?? '_'}:${d.tipo ?? '_'}:${d.identificador ?? d.data_doc ?? '_'}`)
    .join('|');
  return `${input.semestre}::${codes}::${docs}`;
}
