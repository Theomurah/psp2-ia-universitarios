/**
 * Entrega Sprint 2 — Tarefa 33: Biblioteca de 8 prompts oficiais.
 */

export default {
  output:
    'Entregas/Teams/Tarefas/Sprint 2/Geração de Prompts/H7 - Desenvolver gerador de system prompt/PSP2 - S2T33 - Biblioteca 8 Prompts Oficiais.docx',

  title: 'PSP2 — Entrega Sprint 2 / Tarefa 33',
  subtitle: 'Biblioteca de 8 Prompts Oficiais — IMPLEMENTADA',

  emPalavrasSimples: [
    'O system prompt personalizado (T31/T32) ensina a IA QUEM é o aluno. Esta entrega é a outra metade: ensina a IA o QUE FAZER em tarefas comuns do dia a dia universitário. São 8 templates prontos pra: resumir aula, gerar lista de exercícios, explicar conceito como pra leigo, montar quiz de revisão, comparar dois conceitos, resolver passo a passo, fazer fichamento, e montar plano de estudo dirigido.',
    'Cada template tem placeholders que o aluno preenche na hora (matéria, tópico, título do documento). Os templates já incluem as regras certas: usar LaTeX, dificuldade graduada, gabarito separado, etc. O aluno só clica "copiar" e cola na IA que preferir.',
    'Esses prompts são CURADOS pelo time — entram com is_official=true e ficam visíveis pra todos os usuários (via RLS). Alunos podem criar prompts próprios (não oficiais) no futuro, mas isso é fora do escopo desta tarefa.',
  ],

  identificacao: [
    ['ID', 'Sprint 2 — Tarefa 33'],
    ['Épico', 'Geração de Prompts'],
    ['História', 'H7 — Desenvolver gerador de system prompt'],
    ['Tarefa', 'Criar biblioteca de ≥ 8 prompts para tarefas comuns'],
    ['Responsável', 'Theo'],
    ['Planning Poker', '2'],
    ['Data de início', '14/05/2026'],
    ['Data de entrega', '26/05/2026'],
    ['Status', 'Concluído'],
    ['Branch', 'feature/sprint1-finalization'],
    ['Commit', '(será preenchido após push)'],
  ],

  objetivo:
    'Popular a tabela prompt_library com 8 prompts oficiais (is_official=true, user_id=NULL) cobrindo tarefas comuns no estudo universitário. Cada prompt tem categoria (estudo/exercício/redação/revisão), descrição curta e template com placeholders {{materia}}, {{topico}}, {{titulo_doc}}, {{prova_data}}.',

  criterio:
    'Migration 0005_seed_prompt_library.sql aplicada cria 8 linhas em prompt_library com is_official=true e user_id=NULL. RLS permite leitura por qualquer aluno autenticado. Cada template é coerente, sem erros de português, e usa placeholders consistentes com o frontend.',

  conteudo: [
    { type: 'h3', text: '4.1. Arquivo criado' },
    {
      type: 'body',
      text: 'supabase/migrations/0005_seed_prompt_library.sql — 1 DELETE (idempotência) + 8 INSERT. Aplicada via supabase db push (modo recomendado, ver 0003).',
    },
    { type: 'h3', text: '4.2. Lista completa dos 8 prompts' },
    {
      type: 'table',
      columnWidths: [3000, 1300, 5060],
      headers: ['Título', 'Categoria', 'Quando usar'],
      rows: [
        ['Resumir aula', 'estudo', 'Aluno tem material de aula crua e quer um resumo estruturado com conceitos, fórmulas LaTeX e erros comuns.'],
        ['Lista de exercícios sobre {{topico}}', 'exercicio', 'Antes de prova: lista de 8 exercícios graduados (🟢 fácil → 🔴 difícil) com gabarito separado.'],
        ['Explicar como se eu fosse leigo', 'estudo', 'Aluno encalhou num conceito difícil — pede explicação com analogias do dia a dia e exemplo simples.'],
        ['Quiz de revisão pra prova', 'revisao', 'Véspera de prova: 10 questões múltipla escolha + 3 abertas, com gabarito explicado.'],
        ['Comparar 2 conceitos', 'estudo', 'Tabela comparativa entre conceitos que confundem (lei de Coulomb vs. campo elétrico, derivada vs. diferencial).'],
        ['Resolver exercício passo a passo', 'exercicio', 'Aluno cola um exercício e quer resolução detalhada com explicação de cada passo + verificação.'],
        ['Fichamento de capítulo', 'redacao', 'Atividade acadêmica formal: fichamento estruturado com tese, argumentos, citações com página, crítica.'],
        ['Estudo dirigido sobre {{materia}}', 'revisao', 'Plano de estudo personalizado contando até a data da prova ({{prova_data}}), com cronograma diário.'],
      ],
    },
    { type: 'h3', text: '4.3. Padrão de cada prompt' },
    {
      type: 'bullets',
      items: [
        'Título curto e descritivo (≤ 50 chars).',
        'Description: 1 frase explicando o caso de uso.',
        'Template em $$...$$ (dollar-quoted) — permite incluir $ e " sem escape.',
        'Placeholders {{materia}}, {{topico}}, {{titulo_doc}}, {{prova_data}} preenchidos pelo aluno na UI antes de copiar (T34).',
        'Categoria: estudo | exercicio | redacao | revisao.',
      ],
    },
    { type: 'h3', text: '4.4. Idempotência da migration' },
    {
      type: 'body',
      text: 'A migration começa com `delete from prompt_library where is_official=true` antes dos inserts. Isso permite re-rodar a migration (ou aplicar uma versão atualizada via `supabase db push`) sem duplicar prompts. Prompts criados pelo aluno (user_id != null) não são tocados.',
    },
    { type: 'h3', text: '4.5. Exemplo: "Resolver exercício passo a passo"' },
    {
      type: 'code',
      code: `Resolva este exercício de {{materia}} passo a passo:

[COLE O ENUNCIADO AQUI]

Regras:
1. **Identifique** os dados (em LaTeX).
2. **Identifique** o que está sendo pedido.
3. **Equacione** mostrando a fórmula original ANTES de substituir valores.
4. **Substitua** valores um por um, com unidades.
5. **Calcule** mostrando contas intermediárias (não pule operações).
6. **Resultado final** com unidades em $\\boxed{...}$.
7. **Verificação**: o resultado faz sentido física/matematicamente?

Comente cada passo em 1-2 frases — não apenas mostre conta.`,
    },
  ],

  validacao: [
    'Aplicar a migration cria exatamente 8 linhas com is_official=true.',
    'Re-aplicar a migration não duplica (idempotente).',
    'RLS policy `prompts_select_official_or_own` permite SELECT por qualquer aluno autenticado.',
    'Cada template menciona LaTeX onde fórmulas são esperadas (consistência com synthesize/compress).',
    'Sem erro de português em nenhum dos 8 templates.',
  ],

  dependencias: {
    texto: 'Depende de migration 0001 (schema da tabela prompt_library). Habilita:',
    proximos: [
      'T34 — tela /prompts no frontend que lista esses prompts.',
      'No futuro: alunos criando prompts próprios (insert via RLS policy prompts_insert_own — já existe no schema).',
      'No futuro: ranking dos prompts mais usados (usage_count já incrementado pelo frontend).',
      'Possível telemetria: ver quais categorias os alunos mais copiam — refinar a curadoria.',
    ],
  },
};
