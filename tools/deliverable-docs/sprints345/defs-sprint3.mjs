/**
 * Sprint 3 — Hardening completo do sistema (26/05 → 04/06/2026).
 * 18 tarefas (T35–T52). Reformulação retroativa: descreve o trabalho de hardening
 * efetivamente feito após a Sprint 2, rastreado por commit, endereçando as
 * auditorias 2026-05-26/27/28 (~96 achados) e 2026-06-10 (104 achados).
 */

const EPICO_SEG = 'Segurança de Acesso e Dados';
const EPICO_LLM = 'Defesa do Pipeline LLM';
const EPICO_ROB = 'Robustez do Pipeline e Banco';
const EPICO_OBS = 'Observabilidade';
const EPICO_A11Y = 'Acessibilidade e Responsividade';
const EPICO_QA = 'Qualidade, CI-CD e Higiene';

const H13 = 'H13 - Blindar privilégios e dados sensíveis no banco';
const H14 = 'H14 - Sandbox e contenção contra injeção e abuso';
const H15 = 'H15 - Resiliência a races, retries e falhas parciais';
const H16 = 'H16 - Logs estruturados, duráveis e sem PII';
const H17 = 'H17 - Acessibilidade WCAG 2.1 AA e multi-tela';
const H18 = 'H18 - Pipeline de entrega confiável';

const INI = '26/05/2026';
const FIM = '04/06/2026';

function id(n, epico, historia, tarefa, resp, poker, status, commits) {
  return [
    ['ID', `Sprint 3 — Tarefa ${n}`],
    ['Épico', epico],
    ['História', historia],
    ['Tarefa', tarefa],
    ['Responsável', resp],
    ['Planning Poker', String(poker)],
    ['Data de início', INI],
    ['Data de entrega', FIM],
    ['Status', status],
    ['Commits', commits],
  ];
}

export default [
  // ===================== ÉPICO: Segurança de Acesso e Dados (H13) =====================
  {
    output: `Entregas/Sprint 3/${EPICO_SEG}/${H13}/PSP2 - S3T35 - Anti-escalada de Privilegio e Blindagem de Colunas.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 35',
    subtitle: 'Trigger anti-escalada de admin e blindagem de colunas sensíveis',
    emPalavrasSimples: [
      'Esta entrega fecha o furo mais grave encontrado na auditoria de 10/06: qualquer aluno logado conseguia rodar um UPDATE na própria linha de profiles e se promover a administrador (is_admin = true). Como o painel /admin é protegido só por essa coluna, isso dava acesso total às métricas e configurações de todos os usuários.',
      'A correção usa três camadas no banco: (1) um gatilho BEFORE UPDATE que bloqueia qualquer mudança em colunas privilegiadas (is_admin, is_test, email) vinda do próprio usuário — só funções de admin com SECURITY DEFINER conseguem alterar; (2) revogação do SELECT em nível de tabela em profiles, re-concedido coluna a coluna, de modo que google_access_token e google_refresh_token nunca trafegam para o navegador; (3) app_settings legível apenas por admin.',
      'Por que isso importa? Sem o gatilho, o controle de acesso do produto inteiro era contornável com uma linha de SQL. É o tipo de falha que invalida toda a confiança no isolamento entre alunos — precisava ser tratada antes de qualquer exposição a usuários reais.',
    ],
    identificacao: id(35, EPICO_SEG, H13, 'Blindar escalada de privilégio e colunas sensíveis (migrations 0020–0022)', 'Isaac', 5, 'Concluído', '3f31d5b'),
    objetivo:
      'Eliminar o vetor de escalada de privilégio em public.profiles e impedir que tokens OAuth do Google e configurações administrativas cheguem ao cliente, por meio de defesa no nível do banco (triggers, REVOKE/GRANT por coluna e RLS), independente do comportamento do frontend.',
    criterio:
      'Um usuário comum não consegue alterar is_admin, is_test nem email da própria linha por UPDATE direto (o gatilho levanta exceção); um SELECT do cliente em profiles não retorna as colunas google_*_token; app_settings só é legível por quem passa em is_admin(). Migrations 0020–0022 aplicadas e verificadas via get_advisors.',
    conteudo: [
      { type: 'h3', text: '4.1. Migrations aplicadas' },
      {
        type: 'table',
        columnWidths: [1500, 7860],
        headers: ['Migration', 'O que faz'],
        rows: [
          ['0020', 'Trigger BEFORE UPDATE em profiles que rejeita mudança de is_admin / is_test / email feita fora das RPCs admin (SECURITY DEFINER). Fecha o achado CRÍTICO #1 da auditoria 2026-06-10.'],
          ['0021', 'REVOKE SELECT table-level de profiles + GRANT coluna a coluna, removendo google_access_token / google_refresh_token do conjunto exposto a authenticated (achado HIGH #5).'],
          ['0022', 'app_settings legível somente por admin — verificado que o único leitor é a tela AdminModelos (achado #77).'],
        ],
      },
      { type: 'h3', text: '4.2. Defesa em profundidade' },
      {
        type: 'bullets',
        items: [
          'O gatilho é a barreira final: mesmo que uma policy RLS futura seja afrouxada por engano, a coluna privilegiada continua protegida.',
          'A blindagem por coluna casa com o fix de frontend (T65/useProfile) que passou a usar lista explícita de colunas — defesa redundante por design.',
          'Funções admin legítimas continuam alterando essas colunas porque rodam como SECURITY DEFINER, fora do escopo do gatilho de usuário.',
        ],
      },
    ],
    validacao: [
      'Tentativa de UPDATE profiles SET is_admin = true pelo próprio usuário retorna erro (testado via SQL autenticado).',
      'SELECT do cliente em profiles não traz colunas google_*_token.',
      'get_advisors (MCP Supabase) não reporta mais exposição dessas colunas.',
      'Painel /admin continua funcional para admins reais.',
    ],
    dependencias: {
      texto: 'Depende de: schema base (0001), admin role (0008). Habilita:',
      proximos: [
        'T36 — hardening de RLS e storage policies.',
        'T37 — auditoria admin server-side anti-forja.',
        'Exposição segura a usuários reais (pré-requisito de toda a Sprint 5).',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_SEG}/${H13}/PSP2 - S3T36 - Hardening de RLS e Storage e Reducao de service_role.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 36',
    subtitle: 'RLS por operação, policies de Storage e uso mínimo de service_role',
    emPalavrasSimples: [
      'Row Level Security (RLS) é a regra do banco que garante que o aluno A só enxergue os dados do aluno A. Esta entrega reescreveu todas essas regras para ficarem mais estritas e previsíveis, e ajustou as Edge Functions para usarem o token do próprio usuário (com RLS) em vez da chave de serviço (que ignora RLS) sempre que possível.',
      'Concretamente: policies separadas por operação (select/insert/update/delete) em vez de uma permissiva para tudo; WITH CHECK explícito para impedir que um UPDATE troque o dono da linha; (select auth.uid()) para o planner do Postgres reaproveitar o valor; políticas de Storage com TO authenticated e a policy de UPDATE que faltava; e troca de service_role por authClient nas funções ingest, generate-system-prompt e connect-drive, onde o acesso é só do próprio usuário.',
      'Por que isso importa? Cada lugar onde o código usa service_role é um lugar onde a RLS não protege nada — é o backend confiando em si mesmo. Reduzir esse uso ao mínimo necessário diminui o raio de dano de qualquer bug futuro.',
    ],
    identificacao: id(36, EPICO_SEG, H13, 'Hardening de RLS + storage policies (0023) + reduzir service_role', 'Isaac', 5, 'Concluído', '3f31d5b, 5a0efac'),
    objetivo:
      'Endurecer o isolamento entre usuários: policies RLS por operação com WITH CHECK explícito em toda tabela com user_id, policies de Storage completas (TO authenticated + UPDATE), e substituição de service_role por cliente autenticado com RLS nas Edge Functions cujo acesso é restrito ao próprio dono.',
    criterio:
      'Toda tabela com user_id tem policies separadas por operação com (select auth.uid()) = user_id e WITH CHECK que impede troca de dono; o bucket documents tem policies TO authenticated cobrindo inclusive UPDATE; ingest/generate-system-prompt/connect-drive operam sob RLS do usuário, sem service_role onde não é necessário.',
    conteudo: [
      { type: 'h3', text: '4.1. RLS endurecida (gabarito 0006 + 0023)' },
      {
        type: 'bullets',
        items: [
          'Policies recriadas com (select auth.uid()) — avaliação via initPlan, mais barata no planner.',
          'TO authenticated em todas as policies (defesa em profundidade contra acesso anônimo).',
          'WITH CHECK separado do USING para impedir que um UPDATE transfira a linha para outro user_id.',
          'Policies por operação substituem FOR ALL permissivo.',
          'Storage (0023): policies com TO authenticated e a policy de UPDATE que estava ausente desde a 0002.',
        ],
      },
      { type: 'h3', text: '4.2. Menos service_role' },
      {
        type: 'table',
        columnWidths: [3120, 6240],
        headers: ['Edge Function', 'Mudança'],
        rows: [
          ['ingest-document', 'Passa a usar authClient (token do usuário) + RLS no lugar de service_role para criar documento/job do próprio aluno.'],
          ['generate-system-prompt', 'Lê os documentos do aluno sob RLS, sem privilégio elevado.'],
          ['connect-drive', 'Persiste tokens do próprio usuário via authClient.'],
        ],
      },
    ],
    validacao: [
      'Aluno A não lê/edita linhas do aluno B em nenhuma tabela (testes de RLS).',
      'UPDATE não consegue trocar user_id (bloqueado por WITH CHECK).',
      'Upload/listagem no Storage funcionam só para o dono; UPDATE coberto por policy.',
      'Fluxo de ingest/system-prompt/connect-drive funciona sem service_role.',
    ],
    dependencias: {
      texto: 'Depende de: T35 (blindagem de colunas). Relaciona-se com: EXTRAS #16 (hardening 0006). Habilita:',
      proximos: [
        'T37 — auditoria admin server-side.',
        'Operação segura do pipeline sob carga de usuários reais.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_SEG}/${H13}/PSP2 - S3T37 - Auditoria Admin Server-side e Requeue Auditavel.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 37',
    subtitle: 'Trilha de auditoria admin anti-forja, requeue de jobs e demote de admins falsos',
    emPalavrasSimples: [
      'Toda ação administrativa (trocar o modelo de LLM do pipeline, editar um prompt oficial que afeta todos os alunos, reprocessar um job) precisa deixar um rastro confiável de quem fez o quê. Antes, parte dessa trilha era gravada pelo próprio cliente — ou seja, podia ser forjada ou simplesmente omitida.',
      'Esta entrega move a auditoria para o servidor: triggers SECURITY DEFINER gravam a trilha de forma que o cliente não consegue inserir um evento com escopo "admin" nem suprimir um evento real. Inclui também a RPC admin_requeue_job, que devolve um job travado para a fila (pending) registrando a ação na auditoria, e a remoção dos administradores falsos que o seed de dados de teste (0016) havia criado.',
      'Por que isso importa? Uma trilha de auditoria que o auditado controla não é auditoria. Mover a gravação para o servidor com SECURITY DEFINER é o que torna o log de ações admin uma evidência real — necessário para LGPD e para operar o sistema com responsabilidade.',
    ],
    identificacao: id(37, EPICO_SEG, H13, 'Auditoria admin anti-forja (0024) + requeue (0025) + demote admins falsos (0026)', 'Isaac', 3, 'Concluído', '3f31d5b'),
    objetivo:
      'Garantir uma trilha de auditoria administrativa íntegra (gravada no servidor, não pelo cliente), prover uma ação segura e auditável de requeue de jobs travados e remover administradores indevidos criados pelo seed de teste.',
    criterio:
      'O cliente não consegue gravar activity_logs com scope=admin nem suprimir eventos; mudanças de app_settings e prompts oficiais geram trilha via triggers SECURITY DEFINER; existe RPC admin_requeue_job que move jobs failed/processing/pending-estagnado para pending com registro de auditoria; o seed 0016 não deixa admins falsos (0026 + guard de idempotência).',
    conteudo: [
      { type: 'h3', text: '4.1. Migrations' },
      {
        type: 'table',
        columnWidths: [1500, 7860],
        headers: ['Migration', 'O que faz'],
        rows: [
          ['0024', 'activity_logs anti-forja: o cliente não grava scope=admin; auditoria de ações admin via triggers SECURITY DEFINER (achado #37).'],
          ['0025', 'RPC admin_requeue_job — jobs failed/processing/pending-estagnado voltam para pending, com auditoria (fecha o achado #20 e #69).'],
          ['0026', 'Demove admins falsos criados pelo seed 0016 + guard de idempotência no 0016 (achado #35).'],
        ],
      },
      { type: 'h3', text: '4.2. Ciclo do requeue' },
      {
        type: 'body',
        text: 'O alerta de jobs presos no /admin agora tem ação real: o botão de requeue chama admin_requeue_job (validada por is_admin internamente), que devolve o job para a fila e dispara o reprocessamento autorizado. Antes, o alerta mandava "reprocessar manualmente" sem nenhuma ação disponível.',
      },
    ],
    validacao: [
      'Tentativa do cliente de inserir activity_logs com scope=admin é rejeitada.',
      'Mudança de modelo/prompt oficial aparece na trilha de auditoria gravada no servidor.',
      'admin_requeue_job devolve job failed para pending e registra a ação.',
      'Após 0026, não há admins falsos remanescentes do seed.',
    ],
    dependencias: {
      texto: 'Depende de: T35/T36 (RLS e colunas), 0009/0010 (admin panel). Habilita:',
      proximos: [
        'T47 — status de providers e observabilidade do /admin.',
        'Operação confiável do painel administrativo.',
      ],
    },
  },

  // ===================== ÉPICO: Defesa do Pipeline LLM (H14) =====================
  {
    output: `Entregas/Sprint 3/${EPICO_LLM}/${H14}/PSP2 - S3T38 - Sandbox Anti Prompt-Injection.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 38',
    subtitle: 'Sandbox <<DOC>> do conteúdo do aluno em todas as etapas LLM',
    emPalavrasSimples: [
      'O conteúdo que o aluno envia (um PDF, uma foto do quadro) é texto que vai dentro do prompt enviado ao modelo de IA. Sem proteção, um documento malicioso podia conter algo como "IGNORE AS INSTRUÇÕES ANTERIORES E FAÇA X" e o modelo obedeceria — isso é prompt injection.',
      'A defesa envolve o conteúdo do aluno em delimitadores explícitos <<DOC>> ... <</DOC>>, remove qualquer ocorrência prévia desses delimitadores no texto (para o atacante não "fechar o envelope") e adiciona uma instrução de sistema dizendo que tudo entre os delimitadores é apenas dado, nunca instrução. Aplica-se nas três etapas do pipeline (classificação, síntese, compressão), na camada 4 (LLM-as-judge) e no system prompt personalizado do aluno.',
      'Por que isso importa? O pipeline concatena texto não confiável com instruções do sistema. Sem o sandbox, a classificação e a síntese — e até o system prompt pessoal gerado depois — podiam ser corrompidos por um único documento hostil. É defesa pragmática, sem custo extra de tokens relevante.',
    ],
    identificacao: id(38, EPICO_LLM, H14, 'Sandbox <<DOC>> nas 3 etapas + judge + system prompt', 'Guilherme', 5, 'Concluído', '2e0f7d7, 5a0efac'),
    objetivo:
      'Mitigar prompt injection em todas as superfícies que concatenam input do aluno em prompts LLM, isolando o conteúdo em um envelope <<DOC>> com instrução de sistema explícita e neutralização de delimitadores plantados.',
    criterio:
      'As etapas classify, synthesize e compress, a camada validateJudge e a injeção do system prompt personalizado passam o conteúdo do aluno por sandboxUserInput; tentativas de fechar o envelope no input são neutralizadas; convenção documentada no CLAUDE.md e coberta por teste de regressão.',
    conteudo: [
      { type: 'h3', text: '4.1. Como funciona o sandbox' },
      {
        type: 'bullets',
        items: [
          'Envolve o conteúdo extraído em <<DOC>> e <</DOC>>.',
          'Remove ocorrências prévias dos delimitadores no input (replace por marcador neutro).',
          'Concatena uma SANDBOX_INSTRUCTION ao system prompt: o que está entre os delimitadores é dado, nunca comando.',
          'Cobertura ampliada na auditoria 06-10: judge (#78) e system prompt do aluno (#98), não só as 3 etapas (achado S-04 da 05-26).',
        ],
      },
      { type: 'h3', text: '4.2. Superfícies cobertas' },
      {
        type: 'table',
        columnWidths: [4200, 5160],
        headers: ['Superfície', 'Status'],
        rows: [
          ['classify / synthesize / compress', 'Sandbox aplicado (origem S-04).'],
          ['validateJudge (camada 4)', 'Sandbox aplicado (achado #78).'],
          ['system prompt personalizado do aluno', 'Prependido com sandbox (achado #98).'],
        ],
      },
    ],
    validacao: [
      'Documento com "IGNORE INSTRUÇÕES" não altera a classificação nem a síntese.',
      'Delimitadores plantados no input são neutralizados.',
      'Teste de regressão cobre o sandbox (fecha a lacuna de 0% de cobertura — achado #38).',
      'Convenção registrada no CLAUDE.md (§Segurança).',
    ],
    dependencias: {
      texto: 'Relaciona-se com: T42 (validação do pipeline), camada LLM-as-judge. Habilita:',
      proximos: [
        'Processamento seguro de documentos de origem não confiável.',
        'Geração de system prompt resistente a conteúdo adversarial.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_LLM}/${H14}/PSP2 - S3T39 - Guards de Custo e Abuso do Pipeline.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 39',
    subtitle: 'Tetos de tamanho, whitelist de extensões, guard de payload e cost guard',
    emPalavrasSimples: [
      'O pipeline gasta dinheiro (tokens de LLM) e quota (Google Drive) a cada execução. Esta entrega adiciona uma série de "tetos" que impedem que um documento anormal ou uma chamada abusiva queimem recursos sem benefício.',
      'Os guards incluem: abortar o upload para o Drive se a síntese passar de 1 MB (alucinação ou expansão indevida); whitelist de extensões permitidas no nome final; rejeitar uploads sem Content-Length (que contornavam o limite de payload, achado #36); um teto de tokens de saída por chamada (LLM_MAX_OUTPUT_TOKENS, default 8192) nos 5 estágios; e leitura correta do custo real por chamada (usage.cost com usage.include).',
      'Por que isso importa? Em um produto que paga por uso de IA, cada chamada sem limite é um risco financeiro. Esses guards transformam "pode dar muito errado e caro" em "no pior caso, falha barato e cedo".',
    ],
    identificacao: id(39, EPICO_LLM, H14, 'Guards de custo/abuso: markdown 1MB, whitelist extensões, payload 411, teto de tokens, cost guard', 'Isaac', 3, 'Concluído', 'c496797, b811ecf, 5a0efac, d68c321'),
    objetivo:
      'Limitar o consumo de recursos do pipeline (tokens LLM e quota Drive) com guards de defesa em profundidade que falham cedo e barato diante de entradas anormais ou tentativas de contornar limites.',
    criterio:
      'Síntese acima de 1 MB não sobe ao Drive; nome final só aceita extensões da whitelist; upload sem Content-Length é rejeitado (411); cada chamada LLM respeita LLM_MAX_OUTPUT_TOKENS; o custo real por chamada é lido de usage.cost.',
    conteudo: [
      { type: 'h3', text: '4.1. Guards implementados' },
      {
        type: 'table',
        columnWidths: [3600, 5760],
        headers: ['Guard', 'Proteção'],
        rows: [
          ['Abortar Drive se markdown > 1 MB', 'Evita estourar quota Google em síntese anômala (S-08).'],
          ['Whitelist de extensões em buildFilenameFinal', 'Restringe nome final a md/pdf/docx/pptx/txt (S-07).'],
          ['Guard 411 sem Content-Length', 'Fecha o bypass do limite de payload (achado #36).'],
          ['LLM_MAX_OUTPUT_TOKENS (default 8192)', 'Teto de saída por chamada nos 5 estágios.'],
          ['cost_usd via usage.cost + usage.include', 'Custo real por chamada (corrige cost sempre 0, achado #22).'],
        ],
      },
    ],
    validacao: [
      'Síntese > 1 MB marca warning e não chama a API do Drive.',
      'Extensão fora da whitelist lança erro em buildFilenameFinal.',
      'Requisição sem Content-Length retorna 411.',
      'cost_usd passa a refletir o custo real do provider.',
    ],
    dependencias: {
      texto: 'Relaciona-se com: T41 (claim/retry), T47 (telemetria de custo). Habilita:',
      proximos: [
        'Operação do pipeline com previsibilidade de custo.',
        'Métricas de custo confiáveis no /admin.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_LLM}/${H14}/PSP2 - S3T40 - Rate Limit Autorizacao e CORS das Edge Functions.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 40',
    subtitle: 'Autorização de process-document, rate limit por usuário, CORS strict e verify_jwt',
    emPalavrasSimples: [
      'As Edge Functions são as portas de entrada do backend. Esta entrega tranca essas portas: quem pode bater, de onde, e quantas vezes.',
      'Em concreto: authorizeProcessDocument garante que só o dono do job (ou uma chamada interna service_role) dispare o processamento — antes, qualquer um com um job_id válido podia disparar processamento alheio, queimando custo; rate limit de 10/min por usuário corta loops de reprocessamento; CORS com whitelist explícita (e string vazia quando a origem não é permitida, em vez de ecoar a origem do atacante); e verify_jwt = true explícito por função no config.toml, para nenhum deploy futuro deixar uma função aberta por engano.',
      'Por que isso importa? A falha de autorização em process-document era crítica: permitia a um terceiro disparar processamento de jobs de outros alunos. Somada a rate limit e CORS strict, esta entrega fecha a superfície de abuso das funções.',
    ],
    identificacao: id(40, EPICO_LLM, H14, 'Rate limit por usuário + authorizeProcessDocument + CORS strict + verify_jwt', 'Isaac', 5, 'Concluído', '1f780cf, 4ffcdff, abe11bd, 33a6d91'),
    objetivo:
      'Controlar autenticação, autorização, origem e taxa das Edge Functions: process-document só roda para o dono do job ou chamada interna; rate limit por usuário; CORS por whitelist; verify_jwt explícito por função.',
    criterio:
      'process-document rejeita disparo por quem não é dono nem service_role; chamadas do usuário passam por rate limit (10/min); origem fora da whitelist não é ecoada (header vazio); config.toml declara verify_jwt por função, incluindo parse-sigaa-atestado.',
    conteudo: [
      { type: 'h3', text: '4.1. Controles aplicados' },
      {
        type: 'bullets',
        items: [
          'authorizeProcessDocument: Bearer = service_role (interno) OU JWT do dono do job. Devolve a origem (service | user + userId). Achado SEG A1 da auditoria 2026-05-28.',
          'Rate limit por user.id (10/min) em re-disparos via JWT; chamadas internas service_role isentas.',
          'corsHeadersFor retorna string vazia quando a origem não está na whitelist (em vez de ecoar allowed[0]) — logs limpos e sem header smuggling.',
          'verify_jwt = true explícito por função no config.toml (achados #59 e #65 — incluindo parse-sigaa-atestado).',
        ],
      },
    ],
    validacao: [
      'Disparo de process-document por não-dono é rejeitado.',
      'Mais de 10 disparos/min do mesmo usuário são barrados.',
      'Origem não-whitelisted recebe header CORS vazio.',
      'Toda função declara verify_jwt no config.toml.',
    ],
    dependencias: {
      texto: 'Relaciona-se com: T36 (RLS), T39 (guards de custo). Habilita:',
      proximos: [
        'Exposição segura das Edge Functions a tráfego real.',
        'Proteção da quota OpenRouter contra burst.',
      ],
    },
  },

  // ===================== ÉPICO: Robustez do Pipeline e Banco (H15) =====================
  {
    output: `Entregas/Sprint 3/${EPICO_ROB}/${H15}/PSP2 - S3T41 - Claim Atomico e Resiliencia de Jobs.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 41',
    subtitle: 'Claim atômico, started_at não-regressivo, attempt_count e requeue de failed',
    emPalavrasSimples: [
      'O pipeline roda de forma assíncrona: um job entra na fila e um worker o processa. Sem cuidado, dois workers podiam pegar o mesmo job e processá-lo duas vezes (gastando tokens em dobro), ou um job que falhou ficava preso sem chance de retry.',
      'Esta entrega torna o ciclo de vida do job robusto: um claim atômico (UPDATE ... WHERE status=pending) garante que apenas um worker assume o job; started_at é gravado uma única vez no claim (antes era sobrescrito a cada etapa, falseando as métricas de duração); attempt_count é incrementado a cada falha (telemetria honesta para o watchdog); e o claim passa a aceitar re-disparo de jobs failed dentro do limite de tentativas.',
      'Por que isso importa? Essas eram bombas silenciosas que só apareceriam em produção sob carga: processamento duplicado, métricas de SLO erradas e jobs presos para sempre. Corrigir o ciclo de vida é pré-requisito para confiar no pipeline com usuários reais.',
    ],
    identificacao: id(41, EPICO_ROB, H15, 'Claim atômico + started_at + attempt_count + requeue de failed', 'Isaac', 5, 'Concluído', '2e27501, e5908f0, 5a0efac'),
    objetivo:
      'Tornar o pipeline assíncrono resiliente a corrida entre workers, a métricas falsas de duração e a jobs presos, por meio de claim atômico, started_at imutável, contagem honesta de tentativas e requeue de jobs failed.',
    criterio:
      'Dois disparos concorrentes do mesmo job não causam processamento duplicado; started_at é gravado uma vez; attempt_count incrementa a cada falha; um job failed pode voltar para a fila dentro do limite de tentativas.',
    conteudo: [
      { type: 'h3', text: '4.1. Correções' },
      {
        type: 'bullets',
        items: [
          'Claim atômico: UPDATE jobs SET status=processing, started_at=now() WHERE id=$1 AND status=pending — 0 linhas afetadas significa que outro worker já assumiu (early return sem custo). Origem: D1/A1 (auditoria 2026-05-26).',
          'started_at removido do setStep — não é mais sobrescrito a cada transição; completed_at - started_at reflete a duração real.',
          'attempt_count++ em cada fail() (achado A5) — habilita o watchdog pg_cron futuro.',
          'O claim passa a aceitar re-disparo de failed quando attempt_count < max (achados #20 e #52).',
        ],
      },
      { type: 'h3', text: '4.2. Atualizações terminais' },
      {
        type: 'body',
        text: 'As atualizações terminais de status passaram a checar erro e a tratar attempt_count de forma consistente, encerrando o padrão read-then-write não-atômico sinalizado no achado #52.',
      },
    ],
    validacao: [
      'Disparo duplo do mesmo job processa só uma vez.',
      'Métricas de duração param de refletir só a última etapa.',
      'attempt_count cresce a cada falha.',
      'Job failed reentra na fila via requeue (T37) dentro do limite.',
    ],
    dependencias: {
      texto: 'Relaciona-se com: T37 (requeue RPC), T44 (watchdog roadmap). Habilita:',
      proximos: [
        'Watchdog pg_cron de jobs presos (roadmap CLAUDE.md).',
        'Confiabilidade do pipeline sob concorrência.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_ROB}/${H15}/PSP2 - S3T42 - Finish Reason Timeout e Validacao do Pipeline.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 42',
    subtitle: 'finish_reason, timeout de LLM, validação de compressão e needs_review',
    emPalavrasSimples: [
      'Quando um modelo de IA é interrompido por atingir o limite de tokens, ele devolve um texto truncado — mas o pipeline tratava isso como sucesso e mandava a síntese cortada pro Drive. Esta entrega passa a checar o finish_reason e impede que uma síntese truncada seja entregue como concluída.',
      'Inclui também: timeout configurável nas chamadas LLM (AbortSignal.timeout), para um fetch pendurado não deixar o job preso em "processing"; validação da etapa de compressão (perda de fórmulas/avisos agora gera warning); e a atribuição de needs_review quando a classificação é incerta — o documento é entregue, mas sinalizado para revisão humana, em vez de ir como concluído silenciosamente.',
      'Por que isso importa? São os casos de borda que corroem a confiança: resumo cortado pela metade, job travado para sempre, compressão que perdeu a fórmula essencial. Tratá-los é o que separa "funciona na demo" de "funciona no dia a dia".',
    ],
    identificacao: id(42, EPICO_ROB, H15, 'finish_reason, timeout LLM, validação de compressão e needs_review', 'Guilherme', 5, 'Concluído', '5a0efac, 97a1ec2'),
    objetivo:
      'Endereçar falhas silenciosas do pipeline: síntese truncada por max_tokens, chamadas LLM sem timeout, compressão não validada e classificação incerta sem sinalização.',
    criterio:
      'finish_reason=length não vai como completed; chamadas LLM têm timeout (AbortSignal); a compressão é validada (perda de conteúdo essencial gera warning); classificação incerta marca needs_review com badge visível na UI.',
    conteudo: [
      { type: 'h3', text: '4.1. Correções de robustez do conteúdo' },
      {
        type: 'table',
        columnWidths: [3600, 5760],
        headers: ['Item', 'Comportamento'],
        rows: [
          ['finish_reason=length', 'Síntese truncada não é marcada como completed nem sobe ao Drive (achado #3, HIGH).'],
          ['Timeout LLM', 'callLLM com AbortSignal.timeout — fetch pendurado não trava o job em processing (achado #25).'],
          ['Validação de compressão', 'Perda de fórmulas/avisos no compress gera warning (achado #26).'],
          ['needs_review', 'Confiança na faixa [review, auto) marca needs_review; doc completa e sobe, mas sinaliza revisão (achado B1 da 05-28; #27, #34).'],
        ],
      },
      { type: 'h3', text: '4.2. needs_review na UI' },
      {
        type: 'body',
        text: 'O status needs_review passou a ter prioridade sobre completed_with_warning, é logado em job_events e aparece na /atividade. A síntese fica visível com um badge de aviso (aprovado por padrão), em vez de esconder o conteúdo — o que casa com o fix de UI do achado #34.',
      },
    ],
    validacao: [
      'Síntese truncada por limite de tokens não é entregue como concluída.',
      'Chamada LLM que pendura é abortada por timeout.',
      'Compressão que perde conteúdo essencial gera warning.',
      'Classificação incerta gera needs_review com badge.',
    ],
    dependencias: {
      texto: 'Relaciona-se com: T38 (sandbox), T41 (claim/retry). Habilita:',
      proximos: [
        'Qualidade confiável da saída entregue ao aluno.',
        'Sinalização de revisão na jornada do cliente (Sprint 5).',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_ROB}/${H15}/PSP2 - S3T43 - Migrations de Schema Indices e Correcoes SIGAA.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 43',
    subtitle: 'Schema cleanup, índices, advisors e correção da grade UNB / parser SIGAA',
    emPalavrasSimples: [
      'Esta entrega agrupa os ajustes de banco e de dados de horário que sustentam a performance e a correção do produto. Do lado do banco: constraints, índices e comentários que documentam e protegem o schema; do lado dos horários: a grade de turnos da UnB estava deslocada e o parser do SIGAA pegava só o primeiro horário de cada matéria.',
      'No banco: CHECK em progress_percent (impede gravar 150%), índices para os caminhos quentes (lista de docs processados, query principal do Dashboard), consolidação de policies do prompt_library (o planner rodava duas por ação) e comentários SQL que documentam decisões direto no schema. Nos horários: a tabela UNB_TURNOS da tarde começava às 14:00 quando o correto é 12:55 (horários importados saíam ~1h errados — a fixture real prova: 35T45 = ter/qui 16:00–17:50), e o parser SIGAA passou a capturar todos os códigos de horário da disciplina.',
      'Por que isso importa? Índice e CHECK errados aparecem como lentidão e dados inválidos em produção; horário deslocado faz o aluno perder aula. São defeitos que minam a confiança nos dados — exatamente o que a auditoria pegou.',
    ],
    identificacao: id(43, EPICO_ROB, H15, 'Migrations 0007/0011/0027 + grade UNB_TURNOS + parser SIGAA multi-turno', 'Isaac', 5, 'Concluído', 'f029f61, c70a504, 3f31d5b, 61e68be'),
    objetivo:
      'Consolidar correções de schema/performance do banco (constraints, índices, advisors, comentários) e corrigir a grade de turnos da UnB e o parser SIGAA para que horários importados fiquem corretos e completos.',
    criterio:
      'progress_percent tem CHECK 0–100; existem índices para os caminhos quentes (documents.processed_at, jobs(user_id, created_at desc)); policies de prompt_library consolidadas (1 por ação); advisors sem os warnings endereçados; UNB_TURNOS da tarde inicia em 12:55; parser SIGAA captura todos os códigos de horário por matéria.',
    conteudo: [
      { type: 'h3', text: '4.1. Banco — migrations e advisors' },
      {
        type: 'table',
        columnWidths: [1500, 7860],
        headers: ['Migration', 'O que faz'],
        rows: [
          ['0007', 'CHECK (progress_percent 0–100) em jobs; índice parcial idx_documents_processed; comments SQL (feedback.job_id, job_events, user_consents, handle_new_user). Achados D2/B4/A5/C3/C4/G3.'],
          ['0011', 'Índice em feedback.job_id (unindexed FK) + consolidação de 2 policies permissive por ação no prompt_library em 1.'],
          ['0027', 'Índice jobs(user_id, created_at desc) para a query principal do Dashboard (achado #75).'],
        ],
      },
      { type: 'h3', text: '4.2. Horários — grade e parser SIGAA' },
      {
        type: 'bullets',
        items: [
          'UNB_TURNOS.T corrigido: a tarde começa em T1 12:55 (antes 14:00) — horários importados saíam ~1h errados (achado #4, HIGH).',
          'Parser SIGAA captura todos os códigos de horário da disciplina, não só o primeiro — disciplinas em turnos distintos não perdem mais blocos (achado #29).',
          'ClassificationSchema rejeita datas impossíveis; UPDATE de documents passa a checar erro (achado #30).',
        ],
      },
    ],
    validacao: [
      'Gravar progress_percent = 150 falha (CHECK).',
      'Query do Dashboard usa o índice jobs(user_id, created_at desc).',
      'get_advisors não reporta mais os warnings endereçados.',
      'Importar a fixture real do SIGAA (2026.1) reproduz horários corretos da tarde e múltiplos blocos.',
    ],
    dependencias: {
      texto: 'Relaciona-se com: T62 (import SIGAA na jornada), T64 (Dashboard). Habilita:',
      proximos: [
        'Performance da query principal do Dashboard.',
        'Confiabilidade da grade de horários da Sprint 5.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_ROB}/${H15}/PSP2 - S3T44 - Retencao via pg_cron e Roadmap Operacional.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 44',
    subtitle: 'Limpeza de activity_logs via pg_cron e roadmap de jobs agendados',
    emPalavrasSimples: [
      'Algumas tabelas crescem para sempre se nada as limpar — a activity_logs grava eventos a cada carregamento de página. Esta entrega cria o primeiro job agendado (pg_cron) do projeto, que apaga registros com mais de 90 dias, e documenta o roadmap dos demais jobs operacionais previstos.',
      'A migration 0028 agenda a retenção (com guard caso a extensão pg_cron não esteja disponível). O CLAUDE.md passa a listar os jobs pg_cron planejados — watchdog de jobs presos, refresh proativo do token Google, limpeza de job_events antigos, snapshot de métricas — com frequência e sprint-alvo, e o padrão correto: sempre via migration versionada, nunca pelo dashboard do Supabase.',
      'Por que isso importa? Tabela que cresce sem limite vira custo e lentidão silenciosos. Resolver a retenção agora e registrar o roadmap evita que isso seja esquecido entre sessões e equipes.',
    ],
    identificacao: id(44, EPICO_ROB, H15, 'Retenção de activity_logs via pg_cron (0028) + roadmap operacional', 'Isaac', 2, 'Concluído', '3f31d5b, 430b64b'),
    objetivo:
      'Conter o crescimento ilimitado de activity_logs com retenção automatizada via pg_cron e documentar o roadmap operacional de jobs agendados, padronizando a aplicação por migration versionada.',
    criterio:
      'Migration 0028 agenda a limpeza de activity_logs > 90 dias (com guard se pg_cron indisponível); o CLAUDE.md lista os jobs pg_cron previstos com frequência, sprint-alvo e padrão de migration.',
    conteudo: [
      { type: 'h3', text: '4.1. Retenção entregue' },
      {
        type: 'body',
        text: 'A migration 0028 usa create extension if not exists pg_cron e cron.schedule para apagar activity_logs com mais de 90 dias, com guard caso a extensão não esteja disponível no ambiente (achado #66).',
      },
      { type: 'h3', text: '4.2. Roadmap operacional (CLAUDE.md)' },
      {
        type: 'table',
        columnWidths: [4200, 2580, 2580],
        headers: ['Job', 'Frequência', 'Sprint-alvo'],
        rows: [
          ['Watchdog de jobs presos (>10min em processing → pending)', 'a cada 5 min', 'futuro'],
          ['Refresh proativo de google_access_token', 'a cada 30 min', 'futuro'],
          ['Limpeza de job_events antigos (>90 dias)', 'diário 03:00', 'futuro'],
          ['Retenção de activity_logs (>90 dias)', 'diário 03:00', 'entregue (0028)'],
          ['Snapshot diário de métricas', 'diário 04:00', 'futuro'],
        ],
      },
    ],
    validacao: [
      'cron.schedule da retenção registrado (ou guard acionado se pg_cron ausente).',
      'CLAUDE.md documenta o roadmap e o padrão de migration.',
      'Aplicação só via migration versionada (não pelo dashboard).',
    ],
    dependencias: {
      texto: 'Relaciona-se com: T41 (attempt_count habilita watchdog), T46 (activity_logs). Habilita:',
      proximos: [
        'Watchdog de jobs presos (próxima migration).',
        'Snapshot de métricas para o /admin.',
      ],
    },
  },

  // ===================== ÉPICO: Observabilidade (H16) =====================
  {
    output: `Entregas/Sprint 3/${EPICO_OBS}/${H16}/PSP2 - S3T45 - Logger Estruturado com Redacao de PII.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 45',
    subtitle: 'Log JSON com redaction de PII no backend e frontend, adotado nas 5 Edge Functions',
    emPalavrasSimples: [
      'Logs em texto livre são impossíveis de monitorar e perigosos: um console.log(err) podia vazar o conteúdo do aluno, tokens ou detalhes do banco. Esta entrega cria um logger estruturado que emite um evento JSON por linha, com uma whitelist canônica de chaves sensíveis que são automaticamente redigidas como [redacted].',
      'O helper _shared/log.ts (backend) e seu espelho apps/web/src/lib/log.ts (frontend) compartilham a mesma lista de redação (tokens, markdown, texto bruto, email, messages do LLM, Authorization, etc.), truncam strings longas e têm fromError() que extrai só campos seguros do erro (sem details/hint do PostgrestError). As 5 Edge Functions adotaram o logger, e a separação dev/prod é controlada por LOG_LEVEL (backend) e build-time pelo Vite (frontend).',
      'Por que isso importa? Sem isso, observar produção significava arriscar vazar PII em cada linha de log. JSON estruturado destrava qualquer pipeline de monitoramento e a redação garante que dados sensíveis nunca cheguem ao coletor.',
    ],
    identificacao: id(45, EPICO_OBS, H16, 'Logger estruturado com redaction de PII (backend + frontend) + adoção nas 5 Edge Functions', 'Theo', 8, 'Concluído', 'c5e04ca, 25a2eaf, fb5feee, f526a73'),
    objetivo:
      'Padronizar a observabilidade do sistema com um logger JSON estruturado, com redaction canônica de PII/segredos, adotado em backend e frontend, e separação de nível entre desenvolvimento e produção.',
    criterio:
      'Eventos emitidos como JSON 1-linha (ts, level, fn, evt, ...fields), filtráveis por jq; chaves sensíveis redigidas; fromError() não vaza details/hint; as 5 Edge Functions usam createLogger; LOG_LEVEL (backend) e Vite (frontend) controlam o nível; sem console.* cru que vaze PostgrestError.',
    conteudo: [
      { type: 'h3', text: '4.1. Componentes' },
      {
        type: 'bullets',
        items: [
          '_shared/log.ts: createLogger(fn) + fromError() + REDACT_KEYS canônica (tokens OAuth, markdown, texto_bruto, messages, email, password, authorization, cookie, api_key, id_token...).',
          'apps/web/src/lib/log.ts: espelho do backend com a mesma whitelist + emailDomain() (loga só o domínio do email).',
          'Adoção em ingest / process-document / connect-drive / generate-system-prompt / parse-sigaa-atestado.',
          'Redação recursiva e truncamento defensivo (strings a 500/200 chars).',
        ],
      },
      { type: 'h3', text: '4.2. Separação dev/prod' },
      {
        type: 'table',
        columnWidths: [3120, 6240],
        headers: ['Ambiente', 'Nível'],
        rows: [
          ['Edge Functions', 'LOG_LEVEL (debug|info|warn|error, default info). debug suprimido em prod.'],
          ['Frontend (vite dev)', 'debug (loga tudo).'],
          ['Frontend (vite build)', 'warn (só warn+error; info/debug viram no-op). Override via localStorage psp2:log_level.'],
        ],
      },
    ],
    validacao: [
      'jq filtra eventos por .evt / .level no Supabase Studio.',
      'fromError() não expõe details/hint do PostgrestError.',
      'Teste de redação, fromError e threshold no _shared/__tests__/log.test.ts.',
      'Teste de paridade da whitelist front/back (fecha achados #39 e #71).',
    ],
    dependencias: {
      texto: 'Origem: auditoria 2026-05-26 A3/A6/A8; EXTRAS #23. Habilita:',
      proximos: [
        'T46 — persistência durável em activity_logs.',
        'T47 — telemetria de retry e status de providers.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_OBS}/${H16}/PSP2 - S3T46 - Persistencia Duravel de Logs e Request ID.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 46',
    subtitle: 'Persistência de eventos em activity_logs com request_id de correlação',
    emPalavrasSimples: [
      'Logs no console somem quando o servidor recicla. Esta entrega grava os eventos importantes (info+) de forma durável numa tabela activity_logs, com um request_id que correlaciona todos os eventos de uma mesma sessão/ação — para conseguir reconstruir "o que aconteceu nesse fluxo" depois.',
      'A migration 0018 cria a tabela (append-only, RLS: cada um lê os próprios logs, admin lê todos via is_admin()). O persist() do logger grava de forma não-bloqueante, e o threshold de persistência é independente do console: em produção o console mostra só warn+, mas a auditoria de admin (info, scope=admin) continua sendo gravada.',
      'Por que isso importa? Observabilidade durável é o que permite investigar um problema horas depois, auditar ações administrativas e dar ao aluno transparência sobre o que o sistema fez. É a base para qualquer análise pós-incidente.',
    ],
    identificacao: id(46, EPICO_OBS, H16, 'Persistência durável em activity_logs + request_id', 'Theo', 3, 'Concluído', '1742c57'),
    objetivo:
      'Persistir eventos de log de forma durável e correlacionável (request_id), com RLS adequada, mantendo o threshold de persistência independente do nível de console.',
    criterio:
      'Migration 0018 cria activity_logs (user_id, level, scope, evt, request_id, fields jsonb); persist() grava info+ de forma não-bloqueante; cada usuário lê os próprios logs, admin lê todos via is_admin(); auditoria de admin (info) é persistida mesmo em prod.',
    conteudo: [
      { type: 'h3', text: '4.1. Modelo (migration 0018)' },
      {
        type: 'bullets',
        items: [
          'Tabela append-only: user_id, level, scope, evt, request_id, fields jsonb, created_at.',
          'RLS: insert/select own + select admin via is_admin(); índices por user/data, level e scope.',
          'request_id de correlação por sessão (crypto.randomUUID).',
          'lib/supabase.ts usa console.error no guard de bootstrap de propósito (evita ciclo log.ts → supabase.ts).',
        ],
      },
      { type: 'h3', text: '4.2. Threshold independente' },
      {
        type: 'body',
        text: 'O nível de persistência é independente do console: em prod o console mostra só warn+, mas eventos info (ex.: auditoria de admin, scope=admin) continuam sendo gravados em activity_logs. A retenção dessa tabela é tratada na T44 (pg_cron 0028).',
      },
    ],
    validacao: [
      'Eventos info+ aparecem em activity_logs com request_id.',
      'Usuário lê só os próprios logs; admin lê todos.',
      'Auditoria de admin (info) persiste mesmo em prod.',
      'Bootstrap de supabase.ts não cria ciclo de import.',
    ],
    dependencias: {
      texto: 'Depende de: T45 (logger). Relaciona-se com: T44 (retenção). Habilita:',
      proximos: [
        'UI de consulta de logs no /admin (futuro — achado #67).',
        'Análise pós-incidente e auditoria LGPD.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_OBS}/${H16}/PSP2 - S3T47 - ErrorBoundary Telemetria de Retry e Status de Providers.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 47',
    subtitle: 'ErrorBoundary global, retry em job_events e status de providers no /admin',
    emPalavrasSimples: [
      'Esta entrega cobre três frentes de observabilidade visível: capturar erros que antes deixavam a tela branca, registrar quando o provedor de IA falha e se recupera, e mostrar no painel admin quais providers de LLM estão configurados.',
      'Em concreto: um ErrorBoundary global (mais listeners de window.error e unhandledrejection) substitui a tela branca por um fallback amigável; um callback onRetry no wrapper de chamada LLM registra cada retry transitório (429/5xx) em job_events com event_type=retry, tornando a instabilidade do provider auditável; e a Edge Function admin-providers reporta quais providers têm chave configurada (só booleans, nunca o valor do segredo), destravando no dropdown só os modelos cujo provider está conectado.',
      'Por que isso importa? Erro invisível é erro que ninguém corrige. Tela branca silenciosa, retry sem rastro e dropdown oferecendo modelos sem chave eram pontos cegos — esta entrega ilumina cada um deles.',
    ],
    identificacao: id(47, EPICO_OBS, H16, 'ErrorBoundary global + telemetria de retry em job_events + status de providers no /admin', 'Theo / Pedro', 5, 'Concluído', '23f7046, d63c3eb, 74cb07a, 41d287d'),
    objetivo:
      'Tornar visíveis os erros de render, a instabilidade dos providers de LLM (retries) e a disponibilidade de chaves por provider no painel administrativo.',
    criterio:
      'Erro de render mostra fallback amigável (não tela branca); cada retry transitório vira evento em job_events (event_type=retry) com attempt/status/delay/modelo; admin-providers reporta presença de chave por provider (booleans), e o dropdown só oferece modelos de providers conectados.',
    conteudo: [
      { type: 'h3', text: '4.1. ErrorBoundary + handlers globais' },
      {
        type: 'bullets',
        items: [
          'ErrorBoundary global envolvendo App em main.tsx (fallback com título, mensagem e botão Recarregar).',
          'window.addEventListener(error) e (unhandledrejection) capturam erros fora do ciclo de render do React.',
          'Origem: auditoria 2026-05-26 (Observabilidade A1); EXTRAS #22.',
        ],
      },
      { type: 'h3', text: '4.2. Telemetria de retry + status de providers' },
      {
        type: 'bullets',
        items: [
          'onRetry em callLLMWithRetry → job_events.event_type=retry (attempt, status, delay, modelo). Exceção do callback é silenciada (observabilidade nunca quebra pipeline).',
          'Edge Function admin-providers (gated por is_admin) reporta booleans de presença de chave por provider.',
          'useActiveProviders consome isso; config/models.ts é a única fonte dos IDs ofertados.',
        ],
      },
    ],
    validacao: [
      'Erro de render mostra fallback, não tela branca.',
      'select * from job_events where event_type = retry mostra os backoffs.',
      'admin-providers nunca retorna o valor do segredo, só presença.',
      'Dropdown de modelos só lista providers conectados.',
    ],
    dependencias: {
      texto: 'Depende de: T45 (logger), T37 (admin auditável). Habilita:',
      proximos: [
        'Diagnóstico de instabilidade de provider.',
        'Gestão de modelos por provider no /admin (Sprint 5, T69 relacionado).',
      ],
    },
  },

  // ===================== ÉPICO: Acessibilidade e Responsividade (H17) =====================
  {
    output: `Entregas/Sprint 3/${EPICO_A11Y}/${H17}/PSP2 - S3T48 - Acessibilidade WCAG 2.1 AA.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 48',
    subtitle: 'Foco visível, focus trap, aria-live, títulos por rota e contraste AA',
    emPalavrasSimples: [
      'Acessibilidade significa que uma pessoa usando teclado ou leitor de tela consegue usar o app por inteiro. A auditoria de 10/06 encontrou vários pontos onde isso falhava, e esta entrega os corrige de uma vez.',
      'As correções incluem: indicador de foco global com contraste real (outline azul UnB + halo amarelo — o amarelo sozinho dava ~1.7:1, quase invisível); focus trap em modais com foco inicial e devolução; toasts com aria-live persistente que anunciam de verdade; document.title por rota e skip-link; aria-invalid/aria-describedby nos formulários; markdown da síntese renderizado de verdade (em vez de texto bruto ilegível em <pre>); badges com contraste AA; e a grade de horários com aria-label e correção do grid-row fracionário.',
      'Por que isso importa? Além de ser requisito (WCAG 1.4.11, contraste de indicador de foco ≥ 3:1), acessibilidade é parte da qualidade do produto: um aluno com leitor de tela precisava conseguir saber que "o documento ficou pronto". Esta entrega torna a jornada utilizável por todos.',
    ],
    identificacao: id(48, EPICO_A11Y, H17, 'A11y WCAG 2.1 AA: foco, focus trap, aria-live, title por rota, aria-invalid, contraste, markdown', 'Pedro', 8, 'Concluído', 'c216a5b'),
    objetivo:
      'Elevar o frontend ao patamar WCAG 2.1 AA nos pontos sinalizados pela auditoria: foco visível com contraste, navegação por teclado em modais, anúncios de leitor de tela, títulos por rota, semântica de formulários e renderização legível do conteúdo.',
    criterio:
      'Indicador de foco com contraste ≥ 3:1 (azul UnB + halo amarelo); modais com focus trap, foco inicial e devolução; toasts anunciados via aria-live; document.title por rota + skip-link; formulários com aria-invalid/aria-describedby; síntese renderizada como markdown; badges em AA; grade com aria-label.',
    conteudo: [
      { type: 'h3', text: '4.1. Correções WCAG' },
      {
        type: 'table',
        columnWidths: [4200, 5160],
        headers: ['Área', 'Correção (achado 06-10)'],
        rows: [
          ['Foco global', 'Outline azul UnB (#003366) + halo amarelo (#FFB81C). Contraste 1.7:1 → 12:1 (#2, WCAG 1.4.11).'],
          ['Modais', 'Focus trap, foco inicial e devolução de foco (#6).'],
          ['Toasts', 'aria-live persistente; viewport não desmonta vazio (#8).'],
          ['Navegação SPA', 'document.title por rota, skip-link, gestão de foco na troca de página (#10).'],
          ['Conteúdo', 'Síntese renderizada com react-markdown + remark-gfm (lazy), sem dangerouslySetInnerHTML (#11).'],
          ['Formulários', 'aria-invalid / aria-describedby nos erros (#47).'],
          ['Badges', 'tone-warn / tone-success em contraste AA (#9).'],
          ['Grade de horários', 'aria-label nos blocos; fix do grid-row fracionário (#18, #43).'],
        ],
      },
    ],
    validacao: [
      'Navegação completa por teclado com foco sempre visível.',
      'Leitor de tela anuncia "Documento pronto" via toast.',
      'Cada rota tem título próprio; skip-link funciona.',
      'Síntese aparece como markdown formatado, não texto cru.',
    ],
    dependencias: {
      texto: 'Origem: auditoria 2026-06-10 (#2,6,8,9,10,11,18,43,45,46,47). Relaciona-se com: T49 (responsividade), Sprint 5 (jornada). Habilita:',
      proximos: [
        'Jornada do cliente utilizável por leitor de tela e teclado.',
        'Conformidade a ser citada na metodologia do artigo.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_A11Y}/${H17}/PSP2 - S3T49 - UI Responsiva e Tema Claro-Escuro.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 49',
    subtitle: 'Layout responsivo mobile-first e tema claro/escuro com identidade UnB',
    emPalavrasSimples: [
      'O aluno consulta horário e documentos no celular entre as aulas — então o app precisa funcionar bem em telas estreitas. Esta entrega torna todas as telas responsivas e adiciona tema claro/escuro.',
      'No mobile (≤768px), os links da topbar viram um menu hambúrguer (a topbar nunca é escondida — só os links colapsam); grids usam minmax(min(Npx,100%),1fr) para não forçar scroll horizontal; tabelas largas rolam na horizontal dentro do wrapper; e prefers-reduced-motion zera animações. O tema é setado por um script inline no index.html antes do paint (evita flash), com fonte da verdade em localStorage e default seguindo o SO; os tokens do dark vivem em [data-theme="dark"] e preservam a identidade UnB.',
      'Por que isso importa? Um produto cujo público abre no celular precisa ser mobile-first de verdade, e tema escuro é peça de primeira classe para quem estuda à noite. Sem isso, a jornada do cliente quebra na tela onde ela mais acontece.',
    ],
    identificacao: id(49, EPICO_A11Y, H17, 'UI responsiva mobile-first + tema claro/escuro', 'Pedro', 5, 'Concluído', 'ea475eb'),
    objetivo:
      'Tornar todas as telas reativas a qualquer largura (mobile-first) e oferecer tema claro/escuro preservando a identidade UnB, aplicado antes do paint para evitar flash.',
    criterio:
      'Topbar colapsa em menu hambúrguer ≤768px (sem esconder a topbar); grids fluidos sem scroll horizontal; tabelas largas rolam na horizontal; prefers-reduced-motion respeitado; tema [data-theme] com persistência em localStorage e default pelo SO; tokens dark preservam verde/azul/amarelo UnB.',
    conteudo: [
      { type: 'h3', text: '4.1. Responsividade' },
      {
        type: 'bullets',
        items: [
          'Topbar mobile (≤768px): links viram dropdown sob o hambúrguer; topbar nunca escondida.',
          'Grids fluidos: repeat(auto-fit, minmax(min(Npx,100%),1fr)) — sem scroll horizontal em telas estreitas.',
          'Tabelas largas: wrapper com overflow-x:auto.',
          'Grupos de pills/ações com flex-wrap.',
          'prefers-reduced-motion zera animações/transições.',
        ],
      },
      { type: 'h3', text: '4.2. Tema claro/escuro' },
      {
        type: 'bullets',
        items: [
          'data-theme setado por script inline no index.html antes do paint (sem flash).',
          'Fonte da verdade: localStorage psp2:theme; default segue prefers-color-scheme.',
          'Tokens dark em [data-theme="dark"] sobrescrevem só superfície/texto/borda/feedback; identidade UnB mantida.',
          'ThemeToggle na topbar; documentado no CLAUDE.md.',
        ],
      },
    ],
    validacao: [
      'Nenhuma tela força scroll horizontal no mobile.',
      'Topbar colapsa corretamente ≤768px.',
      'Alternar tema persiste e não pisca no reload.',
      'Identidade UnB preservada no dark.',
    ],
    dependencias: {
      texto: 'Relaciona-se com: T48 (a11y), Sprint 5 (todas as telas da jornada). Habilita:',
      proximos: [
        'Uso confortável no celular entre aulas.',
        'Tema escuro como recurso de primeira classe.',
      ],
    },
  },

  // ===================== ÉPICO: Qualidade, CI-CD e Higiene (H18) =====================
  {
    output: `Entregas/Sprint 3/${EPICO_QA}/${H18}/PSP2 - S3T50 - CI-CD Endurecido e Headers de Seguranca.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 50',
    subtitle: 'Coverage, gate de validação no deploy, migrate job, ESLint/Dependabot/CodeQL e CSP no Vercel',
    emPalavrasSimples: [
      'O pipeline de entrega (CI/CD) é o que impede código quebrado de chegar à produção. Esta entrega o endurece em várias frentes e fecha a configuração de cabeçalhos de segurança do frontend.',
      'No CI: testes rodam com cobertura; um job validate (lint/typecheck/test/build) roda ANTES do deploy (needs: validate), para nenhum push subir função quebrada; um job migrate (supabase db push) aplica as migrations antes do deploy das functions, para o banco não ficar para trás; ESLint flat v9, Dependabot (updates semanais agrupados), CodeQL e npm audit. No Vercel: HSTS, CSP estrita (sem origens não usadas), X-Frame-Options, Permissions-Policy, worker-src/frame-src explícitos, e o catch-all que não serve mais index.html para assets inexistentes.',
      'Por que isso importa? Sem gate de validação, um deploy podia subir uma Edge Function que nem compila; sem o job de migrations, o código novo encontrava um banco velho. Endurecer o CI/CD é o que torna a entrega contínua confiável.',
    ],
    identificacao: id(50, EPICO_QA, H18, 'CI/CD endurecido (coverage, deploy gate, migrate, eslint, dependabot, codeql, npm audit) + CSP/headers Vercel', 'Theo', 5, 'Concluído', '514841e, ba413b4, 866e9d9, 33a6d91'),
    objetivo:
      'Tornar a entrega contínua confiável: cobertura no teste, gate de validação antes do deploy, aplicação de migrations no CI, análise estática/segurança de dependências e cabeçalhos HTTP estritos no frontend.',
    criterio:
      'CI roda testes com --coverage; deploy-functions tem job validate como needs do deploy e job migrate (supabase db push) antes das functions; ESLint flat v9, Dependabot, CodeQL e npm audit ativos; vercel.json com HSTS, CSP estrita, X-Frame-Options, Permissions-Policy e catch-all corrigido.',
    conteudo: [
      { type: 'h3', text: '4.1. CI/CD' },
      {
        type: 'bullets',
        items: [
          'ci.yml: npm test com --coverage (v8) + upload de artefato.',
          'deploy-functions.yml: job validate (lint/typecheck/test/build) com needs: validate; job migrate (supabase db push, CLI pinada, concurrency group) antes do deploy (achados #31, #59, #60).',
          '@vitest/coverage-v8 em devDeps; package-lock.json versionado para npm ci reproduzível.',
          'ESLint flat config v9 (apps/web), Dependabot, CodeQL e npm audit no CI.',
        ],
      },
      { type: 'h3', text: '4.2. Cabeçalhos do Vercel' },
      {
        type: 'bullets',
        items: [
          'HSTS (preload), CSP estrita com whitelist Supabase/OpenRouter/Google só onde usada (achados #56, #57, #90).',
          'X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP.',
          'worker-src/frame-src explícitos; catch-all não serve index.html para assets inexistentes (#58).',
          'Cache imutável em /assets/.',
        ],
      },
    ],
    validacao: [
      'Push com função quebrada é barrado pelo gate validate.',
      'Migrations são aplicadas antes do deploy das functions.',
      'CodeQL/npm audit rodam no CI.',
      'Cabeçalhos de segurança presentes na resposta do Vercel.',
    ],
    dependencias: {
      texto: 'Origem: auditoria 2026-05-26 F-05/F-10; auditoria 2026-06-10 (#31,56,57,58,59,60,90). Habilita:',
      proximos: [
        'Deploy de produção com confiança.',
        'Threshold de cobertura após medir baseline.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_QA}/${H18}/PSP2 - S3T51 - Cleanup Tecnico e Export CSV Alinhado ao LGPD.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 51',
    subtitle: 'Remoção de código morto, unificação de utilitários e export CSV seguro',
    emPalavrasSimples: [
      'Código morto e duplicado é fricção: confunde a leitura, fragiliza refatorações e infla o bundle. Esta entrega faz a faxina técnica que a auditoria pediu e alinha a ferramenta de export ao baseline de LGPD.',
      'A limpeza inclui: remoção dos providers de vision órfãos (claude.ts/gemini.ts) e do helper sem callers; remoção das devDeps Tailwind/PostCSS/Autoprefixer (o CSS é hand-rolled); tipos órfãos movidos para types.internal.ts; unificação dos formatadores (fmtNumber/fmtCost/fmtDate/fmtRelative duplicados em 6+ componentes); CSP enxuta; README corrigido (a stack real é CSS próprio + tokens UnB, não Tailwind/shadcn); e o export CSV passou a ler a connection string de env (não de /tmp previsível), com allowlist de colunas, chmod 600 e aviso de retenção.',
      'Por que isso importa? Cada peça de dead code é um campo minado para quem refatora depois, e um export que despeja PII em claro contradiz o próprio baseline de LGPD do projeto. Faxina e alinhamento aqui pagam dividendos em toda manutenção futura.',
    ],
    identificacao: id(51, EPICO_QA, H18, 'Cleanup técnico (dead code, devDeps, types.internal, formatadores, README) + export CSV LGPD', 'Isaac / Theo', 3, 'Concluído', '522c039, ab9412f, 67a9fb1, c216a5b, 118cc71'),
    objetivo:
      'Reduzir dívida técnica (código morto, dependências órfãs, duplicação) e alinhar a ferramenta de export CSV ao baseline de LGPD do projeto.',
    criterio:
      'Vision providers órfãos e devDeps Tailwind/PostCSS removidos; tipos sem caller em types.internal.ts; formatadores unificados em lib/format.ts; README descreve a stack real; export CSV lê env, usa allowlist de colunas, chmod 600 e aviso de retenção.',
    conteudo: [
      { type: 'h3', text: '4.1. Cleanup técnico' },
      {
        type: 'bullets',
        items: [
          'Remove ClaudeVisionProvider/GeminiVisionProvider e extractWithFallback (factory sempre usa OpenRouter). ~180 linhas líquidas removidas.',
          'Remove devDeps Tailwind/PostCSS/Autoprefixer (CSS hand-rolled, sem @apply).',
          'Tipos órfãos schema-first movidos para types.internal.ts.',
          'lib/format.ts unifica fmtNumber/fmtCost/fmtDate/fmtRelative (achado #70); button.danger único; token --surface definido (#72, #73).',
          'README com a stack real (CSS próprio + tokens UnB, não Tailwind/shadcn — achado #68).',
        ],
      },
      { type: 'h3', text: '4.2. Export CSV alinhado ao LGPD' },
      {
        type: 'bullets',
        items: [
          'Connection string via env PSP2_DB_URL (antes: arquivo previsível em /tmp — achado #41).',
          'Allowlist explícita de colunas por tabela (antes SELECT * em 9 de 10 — achados #85, #86).',
          'CSVs com chmod 600 + aviso de retenção; app_settings só chaves não-sensíveis.',
          'Project ref de prod removido da mensagem de erro (#103).',
        ],
      },
    ],
    validacao: [
      'Build/typecheck/lint verdes após remoção de dead code.',
      'Nenhum import quebrado por tipos movidos.',
      'Formatadores vêm de uma única fonte.',
      'Export CSV não despeja PII em claro nem usa caminho previsível.',
    ],
    dependencias: {
      texto: 'Origem: auditoria 2026-05-26 (Código Morto) e 2026-06-10 (#68,70,72,73,85,86,93,94). Relaciona-se com: T50 (CI). Habilita:',
      proximos: [
        'Manutenção mais barata e segura.',
        'Export de dados conforme LGPD.',
      ],
    },
  },
  {
    output: `Entregas/Sprint 3/${EPICO_QA}/${H18}/PSP2 - S3T52 - Auditorias Completas como Pratica de QA.docx`,
    title: 'PSP2 — Entrega Sprint 3 / Tarefa 52',
    subtitle: 'Quatro rodadas de auditoria multi-frente como prática de garantia de qualidade',
    emPalavrasSimples: [
      'Esta entrega documenta a prática que guiou toda a Sprint 3: auditorias completas e sistemáticas do estado do sistema, em múltiplas frentes, antes de expor o produto a usuários. Foram quatro rodadas (26, 27 e 28/05 e 10/06), totalizando cerca de 200 achados.',
      'Cada rodada cobre frentes como bugs/lacunas funcionais, código morto, segurança, observabilidade, testes/qualidade e banco de dados, e produz relatórios versionados no repositório (mais um RESUMO-EXECUTIVO e QUICKWINS por rodada). Cada achado vira ou um commit de correção (rastreado) ou uma pendência catalogada — o que dá rastreabilidade total de "por que esta mudança foi feita".',
      'Por que isso importa? Auditar de forma estruturada e versionada transforma "achismo de qualidade" em evidência. É o que sustentou priorizar as correções certas (do crítico de escalada de privilégio aos quick wins) e o que dá ao artigo e aos relatórios uma base factual de garantia de qualidade.',
    ],
    identificacao: id(52, EPICO_QA, H18, 'Auditorias completas do sistema (4 rodadas, ~200 achados, 6 frentes) como prática de QA', 'Theo', 5, 'Concluído', 'a49e0c5, 23acd63'),
    objetivo:
      'Estabelecer e documentar a auditoria multi-frente como prática de QA do projeto, com relatórios versionados, rastreio achado→commit/pendência e síntese executiva por rodada.',
    criterio:
      'Existem pacotes de auditoria versionados (2026-05-26/27/28 e 2026-06-10) cobrindo múltiplas frentes; cada rodada tem síntese; achados rastreiam para commits de correção ou pendências catalogadas em PENDENCIAS.md.',
    conteudo: [
      { type: 'h3', text: '4.1. Rodadas de auditoria' },
      {
        type: 'table',
        columnWidths: [2400, 2400, 4560],
        headers: ['Rodada', 'Frentes', 'Saída'],
        rows: [
          ['2026-05-26/27/28', 'Bugs, Código Morto, Segurança, Observabilidade, Testes, Banco', '6 relatórios + RESUMO-EXECUTIVO + QUICKWINS por dia (~96 achados).'],
          ['2026-06-10', 'Crítico→Info (segurança, a11y, robustez, DB, frontend)', 'AUDITORIA-2026-06-10.md (104 achados, 1 crítico + 4 highs).'],
        ],
      },
      { type: 'h3', text: '4.2. Rastreabilidade' },
      {
        type: 'bullets',
        items: [
          'Cada achado auto-corrigido vira commit citando a origem (ex.: "achado #1 da auditoria 2026-06-10").',
          'O que não foi auto-corrigido é catalogado em docs/PENDENCIAS.md por categoria de bloqueio.',
          'Os pacotes ficam em Entregas/Auditoria-*/ para consulta futura.',
        ],
      },
    ],
    validacao: [
      'Pacotes de auditoria presentes e versionados no repo.',
      'Achados crítico/high da 06-10 endereçados nas tarefas T35–T51.',
      'PENDENCIAS.md reflete o que sobrou.',
    ],
    dependencias: {
      texto: 'Origem: EXTRAS #26 (auditoria multi-agente). Alimenta: todas as tarefas de hardening desta sprint. Habilita:',
      proximos: [
        'Base factual para os relatórios de sprint e o artigo.',
        'Próximas rodadas antes de cada marco de exposição.',
      ],
    },
  },
];
