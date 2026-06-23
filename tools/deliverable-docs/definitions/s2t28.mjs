/**
 * Entrega Sprint 2 — Tarefa 28: Criação automática de pastas no Drive.
 */

export default {
  output:
    'Entregas/Teams/Tarefas/Sprint 2/Integração Google Drive/H6 - Implementar exportação para Google Drive/PSP2 - S2T28 - Criar Pastas Drive.docx',

  title: 'PSP2 — Entrega Sprint 2 / Tarefa 28',
  subtitle: 'Criação Automática de Estrutura de Pastas no Drive — IMPLEMENTADA',

  emPalavrasSimples: [
    'O Google Drive não tem "categorias" como o iCloud Fotos — toda organização é manual, via pastas que o usuário cria. Como nosso sistema processa muitos arquivos do aluno automaticamente, precisamos garantir que cada arquivo cai numa pasta certa: por exemplo, "PSP2 - Estudos / 2026.1 / Física 3 / FISICA3 - Aula - 12 Lei de Coulomb.md".',
    'Esta entrega implementa a lógica que cria essa estrutura na hora certa: antes de enviar o arquivo, o sistema verifica se a pasta-mãe ("2026.1") já existe; se não, cria. Depois verifica a pasta-filha ("Física 3"); se não existe, cria também. E só então envia o arquivo pra dentro. Tudo via 1 ou 2 chamadas HTTP, sem precisar pedir pra IA "pensar" — é puro código determinístico.',
    'Por que importa? Sem isso, todos os arquivos cairiam na raiz do Drive do aluno, criando bagunça. Com isso, a organização é idêntica ao filesystem que o aluno usaria manualmente — só que automática, durável e idempotente (rodar 10 vezes não cria 10 pastas iguais).',
  ],

  identificacao: [
    ['ID', 'Sprint 2 — Tarefa 28'],
    ['Épico', 'Integração Google Drive'],
    ['História', 'H6 — Implementar exportação para Google Drive'],
    ['Tarefa', 'Criação automática de estrutura de pastas por matéria'],
    ['Responsável', 'Isaac'],
    ['Planning Poker', '3'],
    ['Data de início', '14/05/2026'],
    ['Data de entrega', '26/05/2026'],
    ['Status', 'Concluído'],
    ['Branch', 'feature/sprint1-finalization'],
    ['Commit', '(será preenchido após push)'],
  ],

  objetivo:
    'Implementar helpers idempotentes pra criar/encontrar pastas no Drive do aluno, garantindo a estrutura "PSP2 - Estudos / {semestre} / {materia}" sem duplicação.\n\nA biblioteca cobre: findFolder (busca), createFolder (criação), findOrCreateFolder (atomicidade), ensureFolderPath (cadeia recursiva) e ensureRootFolder (raiz do app).',

  criterio:
    'Rodar ensureFolderPath(rootId, ["2026.1", "Física 3"]) duas vezes consecutivas com a mesma cadeia retorna o mesmo folder_id (idempotência). Cobertura de erros: 401 → DriveAuthExpiredError; 4xx/5xx → DriveError com status preservado.',

  conteudo: [
    { type: 'h3', text: '4.1. Arquivo criado' },
    {
      type: 'body',
      text: 'supabase/functions/_shared/drive/folders.ts — 110 linhas, 5 funções exportadas, sem dependências além do fetch global e do tipo DriveTokenPair/Folder.',
    },
    { type: 'h3', text: '4.2. API pública' },
    {
      type: 'table',
      columnWidths: [2900, 6460],
      headers: ['Função', 'Comportamento'],
      rows: [
        ['findFolder(name, parentId, opts)', 'Busca a 1ª pasta com nome igual + parent igual + não-trashed. Retorna DriveFolder|null. Escapa aspas simples no nome (evita query injection na q= do Drive).'],
        ['createFolder(name, parentId, opts)', 'Cria uma nova pasta. Se parentId=null, cai no root do "My Drive" do usuário.'],
        ['findOrCreateFolder(name, parentId, opts)', 'Idempotente: tenta find; se null, chama create. Atômico do ponto de vista do app (race condition entre duas chamadas paralelas é mitigada por reusar o que tiver).'],
        ['ensureFolderPath(rootId, segments, opts)', 'Garante toda a cadeia. ex: ensureFolderPath(rootId, ["2026.1", "Física 3"]) → cria "2026.1" se faltar, "Física 3" dentro dele se faltar, retorna o id de "Física 3".'],
        ['ensureRootFolder(opts, name?)', 'Atalho pra criar/encontrar a pasta-raiz do app (default name = "PSP2 - Estudos").'],
      ],
    },
    { type: 'h3', text: '4.3. Estrutura padrão criada' },
    {
      type: 'code',
      code: `My Drive (aluno)
└─ PSP2 - Estudos                 ← criada na 1ª conexão (T27)
   └─ 2026.1                       ← semestre
      ├─ Física 3                  ← matéria
      │   ├─ FISICA3 - Aula - 12 Lei de Coulomb.md
      │   ├─ FISICA3 - Lista - 03 Exercícios cap 5.md
      │   └─ ...
      ├─ Cálculo 2
      └─ ...`,
    },
    { type: 'h3', text: '4.4. Tratamento de erro' },
    {
      type: 'table',
      columnWidths: [1800, 7560],
      headers: ['Status HTTP', 'Comportamento'],
      rows: [
        ['200/201', 'Sucesso — retorna { id, name, parent_id }.'],
        ['401', 'Lança DriveAuthExpiredError — caller deve pedir reauth.'],
        ['403', 'Lança DriveError (provavelmente quota ou escopo insuficiente).'],
        ['404', 'Não deve acontecer no flow (sempre criamos sob root ou pasta sabida).'],
        ['5xx', 'Lança DriveError com status — caller pode retentar (não há retry built-in ainda).'],
      ],
    },
    { type: 'h3', text: '4.5. Integração no pipeline (process-document)' },
    {
      type: 'code',
      code: `// process-document/index.ts (resumido)
const folderId = await ensureFolderPath(
  profile.drive_root_folder_id,
  [profile.semestre_atual ?? '2026.1', materiaNome],
  { accessToken: token.access_token },
);
// folderId já está pronto pro upload do arquivo (T29).`,
    },
    { type: 'h3', text: '4.6. Testes' },
    {
      type: 'body',
      text: 'drive.folders.test.ts — 14 testes cobrem find (com/sem resultado, escape de aspas), create (com/sem parent), findOrCreate (caminho find e caminho create), ensureFolderPath (cadeia de 2 níveis), ensureRootFolder. Erros 401/4xx/5xx testados.',
    },
  ],

  validacao: [
    '14 testes unitários passando, todos com fetch mockado (zero rede real).',
    'Idempotente: duas chamadas seguidas com mesmos args retornam o mesmo folder.',
    'Escape de aspas simples no nome impede query injection em q=.',
    'Erros 401 retornam classe específica (DriveAuthExpiredError) — facilita decisão do caller.',
    'Pronto pra ser chamado pelo passo upload_drive do pipeline (T29).',
  ],

  dependencias: {
    texto: 'Depende de: T27 (tokens válidos + DriveError/AuthExpiredError). Habilita:',
    proximos: [
      'T29 (upload de arquivo) — usa ensureFolderPath antes do upload.',
      'T30 (testar com conta real) — necessita config GCP do T27.',
      'Possível otimização: cache de folder_ids em memória por usuário (1 cadastro + N uploads).',
    ],
  },
};
