/**
 * Entrega Sprint 2 — Tarefa 32: Edge Function generate-system-prompt.
 */

export default {
  output:
    'Entregas/Sprint 2/Geração de Prompts/H7 - Desenvolver gerador de system prompt/PSP2 - S2T32 - Edge Function Generate System Prompt.docx',

  title: 'PSP2 — Entrega Sprint 2 / Tarefa 32',
  subtitle: 'Edge Function generate-system-prompt — IMPLEMENTADA',

  emPalavrasSimples: [
    'Esta entrega é o "fábrica" que pega o template (T31) e os dados reais do aluno (matérias do perfil + últimos documentos processados + tópicos das sínteses) e produz o system prompt final pronto pra ser usado.',
    'Importante: a fábrica é DETERMINÍSTICA — ela só junta o que já existe no banco, sem chamar IA. Isso significa: rápida, barata, e dois alunos com o mesmo perfil teriam o mesmo prompt. Custa zero em tokens. A IA é usada nas tarefas anteriores (síntese, classificação) — aqui é só carpintaria.',
    'A função também é inteligente sobre quando refazer o prompt: ela calcula um "snapshot" dos dados que importam (matérias + últimos docs); se nada relevante mudou desde a última geração, ela reusa o prompt ativo em vez de criar uma nova versão. Quando o aluno adiciona matéria ou processa novo doc, o snapshot muda, e o prompt é regerado automaticamente.',
  ],

  identificacao: [
    ['ID', 'Sprint 2 — Tarefa 32'],
    ['Épico', 'Geração de Prompts'],
    ['História', 'H7 — Desenvolver gerador de system prompt'],
    ['Tarefa', 'Lógica de preenchimento automático com dados do aluno'],
    ['Responsável', 'Guilherme'],
    ['Planning Poker', '3'],
    ['Data de início', '14/05/2026'],
    ['Data de entrega', '26/05/2026'],
    ['Status', 'Concluída'],
    ['Branch', 'feature/sprint1-finalization'],
    ['Commit', '(será preenchido após push)'],
  ],

  objetivo:
    'Implementar a Edge Function POST /generate-system-prompt que (1) carrega o profile do aluno, (2) carrega últimos 30 documentos processados, (3) agrega tópicos por matéria das sínteses, (4) chama renderSystemPrompt do T31, (5) salva como nova versão em user_system_prompts (se snapshot mudou) ou reusa a ativa.',

  criterio:
    'Chamada autenticada retorna 200 com { ok: true, regenerated: bool, prompt: { id, prompt_text, version, semester_snapshot, source_documents, created_at } }. Quando regenerated=false, prompt é reutilizado (versão idêntica). Quando regenerated=true, a versão anterior fica is_active=false e a nova com version+1.',

  conteudo: [
    { type: 'h3', text: '4.1. Arquivos criados' },
    {
      type: 'table',
      columnWidths: [4500, 4860],
      headers: ['Arquivo', 'Responsabilidade'],
      rows: [
        ['supabase/functions/generate-system-prompt/index.ts', 'Edge Function principal — orquestra read profile + docs + tópicos + render + persist.'],
        ['_shared/system-prompt.ts (T31)', 'renderSystemPrompt + buildSemesterSnapshot.'],
        ['_shared/__tests__/system-prompt.test.ts', '13 testes cobrem rendering + snapshot.'],
      ],
    },
    { type: 'h3', text: '4.2. Fluxo da função' },
    {
      type: 'table',
      columnWidths: [800, 4280, 4280],
      headers: ['#', 'Passo', 'Detalhe'],
      rows: [
        ['1', 'Auth', 'createAuthClient(req).auth.getUser() — se falhar, 401.'],
        ['2', 'Read profile', 'select full_name, curso, semestre_atual, materias from profiles where id=user.id.'],
        ['3', 'Read docs', 'select materia_code, tipo, titulo, identificador, data_doc from documents where user_id=user.id AND processed_at IS NOT NULL ORDER BY processed_at DESC LIMIT 30.'],
        ['4', 'Aggregate tópicos', 'select metadata, documents!inner(materia_code, user_id) from generated_content where type=synthesized AND documents.user_id=user.id → Set por materia_code.'],
        ['5', 'Build snapshot', 'buildSemesterSnapshot(input) — string determinística.'],
        ['6', 'Decide reuso', 'Se já existe user_system_prompts ativo com mesmo snapshot → retorna ele (regenerated=false).'],
        ['7', 'Desativa anterior + insere nova', 'update is_active=false na anterior; insert nova com version+1.'],
        ['8', 'Retorna', 'JSON com prompt completo (texto + meta).'],
      ],
    },
    { type: 'h3', text: '4.3. Quando regenera (snapshot diff)' },
    {
      type: 'bullets',
      items: [
        'Aluno adicionou/removeu matéria.',
        'Aluno mudou semestre (raro mas possível).',
        'Aluno processou doc novo que entra no top-10 mais recentes.',
        'Aluno passou force=true como query param (?force=true) — útil pra debug ou regerar manualmente da UI.',
      ],
    },
    { type: 'h3', text: '4.4. Quando reusa (snapshot igual)' },
    {
      type: 'bullets',
      items: [
        'Aluno só atualizou nome ou senha (não entra no snapshot).',
        'Aluno fez upload mas o doc ainda não está processed_at.',
        'Aluno chama a função 2x seguidas sem nada mudar.',
      ],
    },
    { type: 'h3', text: '4.5. Versioning + auditoria' },
    {
      type: 'body',
      text: 'Cada regeneração cria uma nova linha em user_system_prompts com is_active=true e a anterior vira false. O campo source_documents guarda os UUIDs dos docs que contribuíram pra essa versão (útil pra debug: "por que o prompt diz que eu estudei essa matéria?"). version incrementa monotonicamente.',
    },
    { type: 'h3', text: '4.6. Sem LLM' },
    {
      type: 'body',
      text: 'A função NÃO chama OpenRouter nem nenhum modelo. Toda a "inteligência" foi codificada no template + no agregador de tópicos. Custo de execução: tempo de DB + tempo de renderização (~50ms total esperado). Permite regerar o prompt sob demanda sem preocupação financeira.',
    },
  ],

  validacao: [
    'Função retorna 200 + JSON estruturado em ambos os caminhos (regenerated true/false).',
    '401 quando JWT inválido/ausente.',
    'Idempotente: 2 chamadas seguidas sem dados novos → ambas retornam mesma versão.',
    'Concorrência: 2 chamadas paralelas após mudança podem criar 2 versões — aceitável (a última fica ativa). Não há lock pessimista.',
    'Snapshot estável a ordem das matérias (testado).',
  ],

  dependencias: {
    texto: 'Depende de T31. Habilita:',
    proximos: [
      'T34 (tela /prompts) — pode adicionar um card "Meu System Prompt" que chama essa função.',
      'Botão "Regerar agora" na UI usando ?force=true.',
      'Notificação automática: trigger de Postgres que invalida o prompt ativo quando profile.materias muda — opcional, próxima iteração.',
    ],
  },
};
