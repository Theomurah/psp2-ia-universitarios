/**
 * Sprint 5 — Jornada do cliente (15/06 → 25/06/2026).
 * 11 tarefas (T59–T69). Reformulação retroativa: descreve a construção e o
 * refinamento da jornada completa do aluno — da aquisição ao hábito de uso —
 * com identidade UnB e base LGPD. Rastreado por commit.
 *
 * Observação: a validação por testes com usuários reais (antigos H9/H10) NÃO foi
 * executada e está fora do backlog → trabalho extra/futuro.
 */

const EP_AQUI = 'Aquisição e Onboarding';
const EP_PERFIL = 'Perfil Acadêmico';
const EP_USO = 'Núcleo de Uso Diário';
const EP_VOZ = 'Personalização e Voz do Cliente';

const H21 = 'H21 - Entrada e ativação do aluno';
const H22 = 'H22 - Configurar o semestre';
const H23 = 'H23 - Processar, acompanhar e gerir documentos';
const H24 = 'H24 - Reter e ouvir o aluno';

const INI = '15/06/2026';
const FIM = '25/06/2026';

function id(n, epico, historia, tarefa, resp, poker, status, commits) {
  return [
    ['ID', `Sprint 5 — Tarefa ${n}`],
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
  // ===================== ÉPICO: Aquisição e Onboarding (H21) =====================
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_AQUI}/${H21}/PSP2 - S5T59 - Login Cadastro e Identidade Visual UnB.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 59',
    subtitle: 'Login/cadastro com magic link, força de senha e identidade visual UnB',
    emPalavrasSimples: [
      'A primeira etapa da jornada é entrar no produto. Esta entrega entrega a porta de entrada: tela de login/cadastro com três modos (email+senha, magic link e o caminho preparado para Google), indicador visual de força de senha, e o redesign completo com a identidade visual da UnB.',
      'A identidade UnB aplica a paleta oficial (verde #005923, azul #003366, amarelo #FFB81C) como CSS vars, um logo SVG inline (sem asset externo) e o redesign de login (split-screen com pitch institucional), topbar, dashboard e configurações. O magic link permite acesso sem senha (signInWithOtp), útil também para recrutar testadores.',
      'Por que isso importa? O primeiro contato define a percepção do produto. Uma entrada com identidade UnB reforça o pertencimento do público-alvo e diferencia de um template genérico — e os três modos de login reduzem o atrito de cadastro.',
    ],
    identificacao: id(59, EP_AQUI, H21, 'Login/cadastro + magic link + força de senha + identidade visual UnB', 'Pedro', 5, 'Concluído', 'f2617ed'),
    objetivo:
      'Entregar a entrada do aluno no produto com autenticação flexível (email+senha, magic link), indicador de força de senha e a identidade visual UnB aplicada de forma consistente.',
    criterio:
      'Login com email+senha, magic link e indicador de força de senha; paleta UnB em CSS vars; logo SVG inline; redesign de login/topbar/dashboard/configurações consistente com o design system.',
    conteudo: [
      { type: 'h3', text: '4.1. Autenticação' },
      {
        type: 'bullets',
        items: [
          'Email + senha (política forte: 12+ chars, maiúscula/minúscula/dígito) com indicador visual (4 barras, score 0–4).',
          'Magic link via signInWithOtp (acesso sem senha; recuperação implícita).',
          'Toasts cobrindo sucesso/erro de cada fluxo (login, signup, magic link).',
        ],
      },
      { type: 'h3', text: '4.2. Identidade visual UnB' },
      {
        type: 'bullets',
        items: [
          'Paleta oficial como CSS vars no :root (verde --primary, azul --secondary, amarelo --accent).',
          'UnbLogo.tsx (SVG inline, sem dependência de asset externo).',
          'Redesign: login split-screen, topbar com NavLinks, dashboard com cards/sombra, configurações em seções.',
        ],
      },
    ],
    validacao: [
      'Login funciona nos três modos com feedback (toast) em cada caso.',
      'Indicador de força de senha reflete a política.',
      'Identidade UnB consistente entre telas; sem paleta paralela.',
    ],
    dependencias: {
      texto: 'Relaciona-se com: T60 (consentimento), Sprint 3 T48/T49 (a11y/tema). Habilita:',
      proximos: [
        'T60 — consentimento LGPD no signup.',
        'T61 — onboarding pós-cadastro.',
      ],
    },
  },
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_AQUI}/${H21}/PSP2 - S5T60 - Consentimento LGPD e Paginas Legais.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 60',
    subtitle: 'Consentimento no cadastro, Política de Privacidade, Termos de Uso e página 404',
    emPalavrasSimples: [
      'Um produto acadêmico brasileiro que coleta dados de alunos precisa atender a LGPD desde o primeiro acesso. Esta entrega entrega o consentimento obrigatório no cadastro e as páginas legais que o sustentam.',
      'Em concreto: checkbox obrigatório de aceite no signup (Zod z.literal(true), bloqueia sem aceite) com links para as políticas; Política de Privacidade (/privacidade, 11 seções: dados, finalidades, base legal, subprocessadores, retenção, direitos) e Termos de Uso (/termos, incluindo limitações da IA); registro do consentimento na tabela user_consents (versão, aceite, data, user-agent); e uma página 404 que mostra a rota tentada em vez de redirecionar silenciosamente.',
      'Por que isso importa? Sem consentimento documentado e bases legais explícitas, o produto não pode receber usuários reais sem risco jurídico — ainda mais por transferir conteúdo a subprocessadores (OpenRouter, Google). É o portão de entrada legal da jornada.',
    ],
    identificacao: id(60, EP_AQUI, H21, 'Consentimento LGPD no signup + páginas Privacidade/Termos + 404', 'Pedro', 3, 'Concluído', 'f2617ed'),
    objetivo:
      'Garantir base legal LGPD na entrada do aluno: consentimento obrigatório e registrado no cadastro, páginas de Política de Privacidade e Termos de Uso, e tratamento explícito de rotas inexistentes.',
    criterio:
      'Signup exige aceite (checkbox Zod obrigatório) com links às políticas; /privacidade e /termos publicadas e versionadas; consentimento gravado em user_consents; página 404 mostra a rota tentada.',
    conteudo: [
      { type: 'h3', text: '4.1. Consentimento e registro' },
      {
        type: 'bullets',
        items: [
          'Checkbox obrigatório no signup (z.literal(true)) — sem aceite, cadastro bloqueado.',
          'recordConsent grava em user_consents (consent_type, version, accepted, given_at, user_agent) — comprovação Art. 8º.',
          'PRIVACY_VERSION versionada em lib/consents.ts.',
        ],
      },
      { type: 'h3', text: '4.2. Páginas legais e 404' },
      {
        type: 'bullets',
        items: [
          '/privacidade (11 seções: dados, finalidades, base legal Art. 7º/11, subprocessadores, retenção, direitos, segurança, contato).',
          '/termos (uso aceitável, propriedade intelectual, limitações da IA, lei aplicável Brasil).',
          'NotFoundPage mostra location.pathname + atalhos; rotas legais reconhecidas como standalone (sem topbar).',
        ],
      },
    ],
    validacao: [
      'Signup sem aceite é bloqueado.',
      'Consentimento aparece em user_consents após cadastro.',
      '/privacidade e /termos acessíveis sem login.',
      'URL inválida mostra 404 informativa, não redirect silencioso.',
    ],
    dependencias: {
      texto: 'Depende de: T59 (cadastro). Relaciona-se com: T69 (privacidade self-service). Habilita:',
      proximos: [
        'Recebimento de usuários reais com base legal.',
        'Direitos do titular (export/delete) na T69.',
      ],
    },
  },
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_AQUI}/${H21}/PSP2 - S5T61 - Onboarding Guiado em 4 Passos.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 61',
    subtitle: 'Onboarding obrigatório pós-cadastro: curso, semestre, matérias e horários',
    emPalavrasSimples: [
      'Logo após o cadastro, o aluno precisa configurar o básico para o produto fazer sentido. Esta entrega entrega um fluxo guiado de quatro passos que coleta nome, curso+semestre, matérias e horários — exibido automaticamente enquanto o perfil estiver incompleto.',
      'O fluxo: (1) boas-vindas com nome; (2) curso + semestre (formato AAAA.S); (3) matérias (código curto + nome, de 1 a 15); (4) horários opcionais por matéria (dia, início, fim). Um gate em RequireAuth (requireOnboarding) redireciona para /onboarding quando o perfil está incompleto; ao concluir, vai para o Dashboard.',
      'Por que isso importa? Antes, o aluno caía direto no Dashboard sem perfil e não conseguia organizar nada. A coleta estruturada (curso + matérias + horários) é o que habilita a estrutura de pastas no Drive, a sugestão de matéria no upload e a grade de horários — é a fundação da jornada.',
    ],
    identificacao: id(61, EP_AQUI, H21, 'Onboarding guiado 4-step (curso, semestre, matérias, horários)', 'Pedro', 5, 'Concluído', 'f2617ed'),
    objetivo:
      'Coletar de forma guiada e obrigatória o perfil acadêmico mínimo do aluno (curso, semestre, matérias e horários) logo após o cadastro, habilitando as demais funcionalidades.',
    criterio:
      'Fluxo de 4 passos exibido quando o perfil está incompleto; coleta nome, curso+semestre (AAAA.S), 1–15 matérias e horários opcionais; gate requireOnboarding redireciona corretamente; conclusão leva ao Dashboard.',
    conteudo: [
      { type: 'h3', text: '4.1. Passos do onboarding' },
      {
        type: 'table',
        columnWidths: [1600, 7760],
        headers: ['Passo', 'Coleta'],
        rows: [
          ['1', 'Boas-vindas + nome completo (pré-preenchido do user_metadata).'],
          ['2', 'Curso (texto livre) + semestre no formato AAAA.S (ex.: 2026.1).'],
          ['3', 'Matérias: lista de {código UPPERCASE, nome}, mín. 1, máx. 15.'],
          ['4', 'Horários (opcional): por matéria, {dia da semana, início, fim}.'],
        ],
      },
      { type: 'h3', text: '4.2. Gate e schema' },
      {
        type: 'bullets',
        items: [
          'RequireAuth com prop requireOnboarding redireciona para /onboarding quando o perfil está incompleto.',
          'Migration 0003 adiciona profiles.curso e documenta o shape de materias.horarios (jsonb).',
          'Schemas Zod: HorarioSchema, DIAS_SEMANA, ProfileFormSchema.curso, MateriaSchema.horarios.',
          'OnboardingPage não apaga o formulário em token refresh (fix do achado #14).',
        ],
      },
    ],
    validacao: [
      'Perfil incompleto redireciona para /onboarding.',
      'Formato AAAA.S validado; 1–15 matérias.',
      'Conclusão leva ao Dashboard com perfil completo.',
      'Refresh de token não apaga o que foi digitado.',
    ],
    dependencias: {
      texto: 'Depende de: T59/T60 (entrada). Habilita:',
      proximos: [
        'T62 — matérias/horários e import SIGAA.',
        'Estrutura {curso}/{semestre}/{matéria} no Drive.',
      ],
    },
  },

  // ===================== ÉPICO: Perfil Acadêmico (H22) =====================
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_PERFIL}/${H22}/PSP2 - S5T62 - Pagina de Materias e Import SIGAA.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 62',
    subtitle: 'Grade visual de horários e importação do atestado de matrícula do SIGAA',
    emPalavrasSimples: [
      'Digitar 7 matérias com horários uma a uma é trabalhoso. Esta entrega entrega a página /materias com uma grade visual semanal e a importação automática a partir do atestado de matrícula do SIGAA (PDF).',
      'Três peças integradas: (1) um parser puro do SIGAA (sigaa.ts) que decodifica códigos como 26N34 em blocos dia/hora e extrai cabeçalho + lista de matérias do atestado; (2) uma Edge Function parse-sigaa-atestado que recebe o PDF, extrai o texto e devolve as matérias; (3) a página /materias com grade em CSS Grid (cor determinística por matéria), lista lateral e um modal de import em 3 etapas (upload → parsing → preview) com merge não-destrutivo das matérias.',
      'Por que isso importa? A importação automática cobre o caso real "aluno entrou no semestre, tem 7 matérias, não vai digitar uma por uma", e o preview antes de salvar dá controle total. A grade visual transforma uma lista de strings em algo que o aluno bate o olho e entende a semana.',
    ],
    identificacao: id(62, EP_PERFIL, H22, 'Página /materias com grade visual + import SIGAA (parser + Edge Function)', 'Pedro / Isaac', 8, 'Concluído', 'bef65ab, 29dba00, 7670453'),
    objetivo:
      'Permitir ao aluno visualizar sua grade de horários e importar automaticamente suas matérias a partir do atestado de matrícula do SIGAA, com preview e merge não-destrutivo.',
    criterio:
      'Página /materias com grade semanal visual (cor por matéria) e lista lateral; parser SIGAA com testes; Edge Function parse-sigaa-atestado (JWT, rate limit, payload máx); modal de import em 3 etapas com merge inteligente que preserva campos manuais.',
    conteudo: [
      { type: 'h3', text: '4.1. Componentes' },
      {
        type: 'bullets',
        items: [
          'sigaa.ts: parseHorarioCode (ex.: 26N34 → blocos) + parseSigaaAtestado (cabeçalho + matérias); UNB_TURNOS canônico; 17 testes (inclui fixture real 2026.1).',
          'Edge Function parse-sigaa-atestado: POST multipart, JWT, rate limit 10/min, payload máx 5 MiB; reusa parsePdf.',
          'HorariosPage + HorariosGrade (CSS Grid, cor determinística por código) + ImportSigaaModal (upload → parsing → preview) + useImportSigaa.',
          'mergeMaterias: por código, atualiza campos do SIGAA, preserva manuais, nunca remove existentes.',
        ],
      },
      { type: 'h3', text: '4.2. Robustez (ver Sprint 3)' },
      {
        type: 'body',
        text: 'A correção da grade UNB_TURNOS da tarde e o parser multi-turno (T43, hardening) garantem que horários importados saiam corretos e completos — esta entrega consome esses fixes.',
      },
    ],
    validacao: [
      'Importar o atestado real (2026.1) preenche as matérias com horários corretos.',
      'Preview permite confirmar/reenviar antes de salvar.',
      'Merge preserva campos manuais e não remove matérias existentes.',
      'Grade visual destaca o bloco ao clicar no card e vice-versa.',
    ],
    dependencias: {
      texto: 'Depende de: T61 (perfil/matérias) e T43 (grade/parser corrigidos). Habilita:',
      proximos: [
        'Sugestão de matéria no upload por horário.',
        'Estrutura de pastas por matéria no Drive.',
      ],
    },
  },
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_PERFIL}/${H22}/PSP2 - S5T63 - Conexao do Google Drive.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 63',
    subtitle: 'Conectar o Google Drive nas configurações (OAuth + estados)',
    emPalavrasSimples: [
      'O destino final do material processado é o Drive do próprio aluno. Esta entrega entrega o caminho no frontend para o aluno conectar sua conta Google, que faltava (a Edge Function connect-drive já existia, mas sem consumidor).',
      'Em concreto: startDriveOAuth com escopo drive.file, access_type=offline e prompt=consent (para garantir o refresh_token); useFinishDriveConnection que lê os tokens da sessão pós-redirect e invoca connect-drive; e um card "Google Drive" nas Configurações com os estados Conectar / Conectando / Conectado em DD/MM/AAAA, tratando o retorno em /settings?drive=callback (com guard de StrictMode) e o caso migration_pending.',
      'Por que isso importa? Sem o caminho de conexão na UI, toda a integração de export (já pronta no backend) ficava inacessível. Esta entrega fecha o elo entre processar e entregar no Drive do aluno — o fim da jornada de uso.',
    ],
    identificacao: id(63, EP_PERFIL, H22, 'Conexão do Google Drive nas configurações', 'Pedro', 3, 'Concluído', 'c7ab6e3'),
    objetivo:
      'Disponibilizar no frontend o fluxo de conexão do Google Drive do aluno, consumindo a Edge Function connect-drive e refletindo os estados de conexão nas configurações.',
    criterio:
      'Card Google Drive em /settings com estados Conectar/Conectando/Conectado; OAuth com escopo drive.file, access_type=offline e prompt=consent (garante refresh_token); retorno em /settings?drive=callback tratado (guard StrictMode + migration_pending).',
    conteudo: [
      { type: 'h3', text: '4.1. Fluxo de conexão' },
      {
        type: 'bullets',
        items: [
          'useDrive.ts: startDriveOAuth (scope drive.file, access_type=offline, prompt=consent) + useFinishDriveConnection.',
          'Lê provider tokens da sessão pós-redirect e invoca connect-drive (que persiste o refresh_token).',
          'SettingsPage: card com estados Conectar / Conectando / Conectado em DD/MM/AAAA; trata migration_pending.',
          'Profile ganha drive_connected_at.',
        ],
      },
    ],
    validacao: [
      'Aluno conecta o Drive e o card mostra "Conectado em DD/MM/AAAA".',
      'O refresh_token é persistido (prompt=consent + access_type=offline).',
      'Retorno do OAuth não duplica chamadas (guard StrictMode).',
    ],
    dependencias: {
      texto: 'Depende de: connect-drive (Edge Function) e migrations Drive. Relaciona-se com: upload idempotente no Drive (hardening). Habilita:',
      proximos: [
        'Export automático do material processado para o Drive do aluno.',
        'Indicador "conectado como X" (getAbout, futuro).',
      ],
    },
  },

  // ===================== ÉPICO: Núcleo de Uso Diário (H23) =====================
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_USO}/${H23}/PSP2 - S5T64 - Dashboard com Metricas Filtros e Realtime.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 64',
    subtitle: 'Dashboard com métricas pessoais, filtros e atualização em tempo real',
    emPalavrasSimples: [
      'O Dashboard é a tela onde o aluno acompanha tudo. Esta entrega entrega os cards de métricas pessoais, os filtros de busca e a atualização em tempo real do status de processamento — sem precisar dar refresh.',
      'Os cards mostram documentos processados (% sucesso), caracteres analisados, custo acumulado, falhas e distribuição por matéria. A busca filtra por nome/título, com select de matéria e pílulas de status (Todos/Processando/Concluídos/Revisar/Falhou), tudo client-side. O Realtime escuta a tabela jobs e atualiza a UI instantaneamente quando o status muda, invalidando também as métricas e a atividade.',
      'Por que isso importa? O Dashboard é o coração do uso diário. Atualização em tempo real (em vez de polling) e métricas pessoais dão ao aluno a sensação de controle e transparência sobre o que o sistema está fazendo com seus documentos.',
    ],
    identificacao: id(64, EP_USO, H23, 'Dashboard com métricas pessoais, filtros e realtime', 'Pedro', 5, 'Concluído', '7670453, c216a5b'),
    objetivo:
      'Entregar o Dashboard do aluno com cards de métricas pessoais, filtros de busca/matéria/status e atualização em tempo real do status dos documentos.',
    criterio:
      'Cards de KPI (processados/%, caracteres, custo, falhas, distribuição por matéria) renderizados quando há ao menos 1 job; filtros client-side; Realtime atualiza status e invalida métricas/atividade; upload invalida a lista de jobs.',
    conteudo: [
      { type: 'h3', text: '4.1. Métricas e filtros' },
      {
        type: 'bullets',
        items: [
          'MetricsCards: documentos processados (% sucesso), caracteres analisados, custo acumulado, falhas, distribuição por matéria (top 6).',
          'useUserMetrics calcula tudo em uma única query; só renderiza se houver ao menos 1 job.',
          'Busca por nome/título + select de matéria + pílulas de status (5), tudo client-side em useMemo.',
        ],
      },
      { type: 'h3', text: '4.2. Realtime' },
      {
        type: 'bullets',
        items: [
          'Canal Supabase Realtime escuta jobs com filtro user_id=eq.{id} (defesa em profundidade).',
          'Mudança de status atualiza a UI e invalida métricas/atividade (fix do achado #15).',
          'Upload invalida [jobs] (não depende só do canal — fix do achado #16).',
        ],
      },
    ],
    validacao: [
      'Status muda na UI sem refresh ao concluir o processamento.',
      'Métricas e atividade refletem a mudança em tempo real.',
      'Filtros funcionam sem nova query.',
    ],
    dependencias: {
      texto: 'Depende de: pipeline (Sprints 1/2) e índices (T43). Habilita:',
      proximos: [
        'T65 — gestão e preview de documentos.',
        'T66 — página de atividade.',
      ],
    },
  },
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_USO}/${H23}/PSP2 - S5T65 - Gestao de Documentos e Preview da Sintese.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 65',
    subtitle: 'Arquivar/excluir documentos e preview da síntese em markdown renderizado',
    emPalavrasSimples: [
      'Conforme o aluno usa o produto, ele acumula documentos — e precisa gerenciá-los e ler as sínteses. Esta entrega entrega arquivar/excluir e o preview do conteúdo gerado, com markdown renderizado de verdade.',
      'Arquivar é soft delete (esconde da view, reversível, com toast "Desfazer"); excluir é hard delete (apaga linha + Storage + cascade, com confirmação inline). O preview abre num drawer e renderiza markdown (react-markdown + remark-gfm, lazy) em vez de texto bruto, com cancelamento/dedup/cache via useQuery. O drawer fecha sozinho se o documento sai da lista.',
      'Por que isso importa? Sem gestão, o histórico vira bagunça; sem preview legível, a entrega principal (a síntese) fica ilegível. Arquivar como default protege auditoria e dá Ctrl+Z; excluir é a saída clara mas protegida — equilíbrio entre limpeza e segurança.',
    ],
    identificacao: id(65, EP_USO, H23, 'Gestão de documentos (arquivar/excluir) + preview de síntese em markdown', 'Pedro', 5, 'Concluído', '7670453, c216a5b'),
    objetivo:
      'Permitir ao aluno gerenciar seu histórico (arquivar/excluir) e ler as sínteses em markdown renderizado, com operações seguras e UX consistente.',
    criterio:
      'Arquivar (soft delete reversível, com undo) e excluir (hard delete com confirmação) funcionando; view toggle Ativos/Arquivados; preview em drawer renderizando markdown (sem dangerouslySetInnerHTML), com cancelamento/dedup/cache.',
    conteudo: [
      { type: 'h3', text: '4.1. Arquivar e excluir' },
      {
        type: 'table',
        columnWidths: [2400, 3480, 3480],
        headers: ['Operação', 'Tipo', 'Reversível'],
        rows: [
          ['Arquivar', 'Soft delete (documents.archived_at)', 'Sim — toast "Desfazer" + aba Arquivados.'],
          ['Excluir', 'Hard delete (linha + Storage + cascade)', 'Não — confirmação inline.'],
        ],
      },
      { type: 'h3', text: '4.2. Preview da síntese' },
      {
        type: 'bullets',
        items: [
          'MarkdownPreview renderiza markdown (react-markdown + remark-gfm, lazy ~156kB), sem dangerouslySetInnerHTML (achado #11).',
          'useQuery: cancelamento via AbortSignal ao trocar de doc, dedup e cache (sem race condition).',
          'needs_review: síntese visível com badge de aviso (default aprovado), em vez de esconder o conteúdo (achado #34).',
          'Drawer fecha automaticamente se o doc sai da lista (arquivado/excluído).',
        ],
      },
    ],
    validacao: [
      'Arquivar esconde da view com opção de desfazer; excluir pede confirmação.',
      'Síntese aparece formatada (markdown), não texto cru.',
      'Trocar de doc rápido não pisca conteúdo antigo (sem race).',
    ],
    dependencias: {
      texto: 'Depende de: T64 (Dashboard) e migration de archive. Relaciona-se com: T48 (a11y/markdown). Habilita:',
      proximos: [
        'Histórico organizado e legível.',
        'Transparência operacional (T66).',
      ],
    },
  },
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_USO}/${H23}/PSP2 - S5T66 - Pagina de Atividade e Transparencia Operacional.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 66',
    subtitle: 'Página /atividade com eventos por etapa do pipeline',
    emPalavrasSimples: [
      'O aluno pediu transparência: ver exatamente o que o sistema fez com cada documento. Esta entrega entrega a página /atividade, uma tabela interativa dos eventos granulares de cada etapa do pipeline.',
      'Cada linha mostra: quando, qual documento (e matéria), qual etapa (parse, classify, synthesize, compress, nomenclatura, upload_drive), o tipo (badge start/success/warning/error/retry), o modelo de LLM usado, a duração, o custo em USD e a mensagem. Há filtros por tipo de evento (multi-select), por etapa (select) e busca textual. Reaproveita a tabela job_events existente, com RLS herdada.',
      'Por que isso importa? Transparência operacional é diferencial e confiança: o aluno vê qual modelo processou seu material, quanto custou e quanto demorou. É também a base para o aluno entender um aviso de needs_review ou uma falha.',
    ],
    identificacao: id(66, EP_USO, H23, 'Página /atividade — transparência operacional', 'Pedro', 3, 'Concluído', '7670453'),
    objetivo:
      'Dar ao aluno transparência operacional sobre o processamento de cada documento, exibindo os eventos granulares do pipeline com filtros, reusando a tabela job_events e a RLS existente.',
    criterio:
      'Página /atividade com tabela de job_events do usuário (quando, documento+matéria, etapa, tipo, modelo, duração, custo, mensagem); filtros por tipo (multi-select), etapa (select) e busca textual; isolamento por RLS.',
    conteudo: [
      { type: 'h3', text: '4.1. Conteúdo da tabela' },
      {
        type: 'bullets',
        items: [
          'Colunas: Quando · Documento (+ matéria) · Etapa · Tipo (badge) · Modelo LLM · Duração · Custo USD · Mensagem.',
          'Filtros: tipo de evento (5 toggles), etapa (7 opções), busca textual livre.',
          'Hook useActivity + useUserMetrics (reaproveitado nos cards); RLS job_events_select_via_job garante isolamento.',
          'Sem nova migration — reusa job_events.',
        ],
      },
    ],
    validacao: [
      'Aluno vê só os próprios eventos (RLS).',
      'Filtros por tipo/etapa e busca funcionam.',
      'Custo e modelo por etapa visíveis.',
    ],
    dependencias: {
      texto: 'Depende de: job_events (telemetria do pipeline). Relaciona-se com: T47 (retry telemetry). Habilita:',
      proximos: [
        'Entendimento de needs_review/falhas pelo próprio aluno.',
        'Base de transparência citável no artigo (IA responsável).',
      ],
    },
  },

  // ===================== ÉPICO: Personalização e Voz do Cliente (H24) =====================
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_VOZ}/${H24}/PSP2 - S5T67 - Biblioteca de Prompts e System Prompt Personalizado.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 67',
    subtitle: 'Biblioteca de prompts copiáveis e system prompt personalizado na síntese',
    emPalavrasSimples: [
      'A entrega de valor portátil do produto são os prompts: uma biblioteca de prompts prontos para colar em qualquer IA e um system prompt personalizado que reflete o aluno. Esta entrega entrega os dois.',
      'A biblioteca (/prompts) lista os prompts oficiais + os próprios do aluno (via RLS), com busca, filtro por categoria, preenchimento de placeholders e cópia com 1 clique (que incrementa o contador de uso). O system prompt personalizado é (re)gerado em /settings via Edge Function (sem LLM, determinístico) e é injetado no system message da síntese — opt-in, no-op quando não há prompt ativo.',
      'Por que isso importa? É o diferencial central do produto: gerar uma saída portátil (system prompt + prompts) que o aluno usa em qualquer LLM, em vez de ficar preso a uma plataforma. Sustenta a retenção e a proposta de valor do artigo.',
    ],
    identificacao: id(67, EP_VOZ, H24, 'Biblioteca de prompts + system prompt personalizado na síntese', 'Guilherme', 5, 'Concluído', 'cb99fc4, ab438c8'),
    objetivo:
      'Entregar a biblioteca de prompts copiáveis (oficiais + do aluno) e o system prompt personalizado, gerado deterministicamente e injetado na síntese, materializando a saída portátil do produto.',
    criterio:
      'Página /prompts lista oficiais + próprios (RLS), com busca, filtro, placeholders e cópia que incrementa usage_count; system prompt (re)gerável em /settings via Edge Function e injetado na síntese (opt-in).',
    conteudo: [
      { type: 'h3', text: '4.1. Biblioteca de prompts (/prompts)' },
      {
        type: 'bullets',
        items: [
          'Lista oficiais (is_official) + próprios do aluno (RLS dual); busca por título/descrição/template; filtro por categoria.',
          'Cards com preenchimento de placeholders ({{materia}}, {{topico}}) e cópia em 1 clique (toast + usage_count++).',
          'usage_count como telemetria de curadoria (quais prompts os alunos realmente usam).',
        ],
      },
      { type: 'h3', text: '4.2. System prompt personalizado' },
      {
        type: 'bullets',
        items: [
          'Seção "Prompt de estudo personalizado" em /settings: vê a versão ativa e (re)gera via generate-system-prompt (determinístico, sem LLM).',
          'process-document injeta o user_system_prompt ativo no system message da síntese (opt-in / no-op).',
          'applyPersonalizedSystem com sandbox (ver T38) para resistir a conteúdo adversarial.',
        ],
      },
    ],
    validacao: [
      'Aluno copia um prompt e o usage_count incrementa (próprios; oficiais falham silenciosamente por RLS).',
      'System prompt (re)gera em /settings e reflete matérias/materiais.',
      'Síntese usa o system prompt ativo quando existe; no-op quando não há.',
    ],
    dependencias: {
      texto: 'Depende de: biblioteca de prompts (Sprint 2) e generate-system-prompt. Relaciona-se com: T38 (sandbox). Habilita:',
      proximos: [
        'Diferencial de portabilidade citado no artigo.',
        'Curadoria de prompts por uso (ranking).',
      ],
    },
  },
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_VOZ}/${H24}/PSP2 - S5T68 - Feedback do Aluno e Painel Admin.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 68',
    subtitle: 'Widget de feedback no preview e painel agregado em /admin/feedback',
    emPalavrasSimples: [
      'Ouvir o aluno é parte essencial da jornada. Esta entrega entrega o widget de feedback (logo após o documento ficar pronto) e o painel administrativo que agrega esse feedback.',
      'No preview de jobs concluídos, um widget coleta nota (1–5), tópico e comentário, com insert direto via RLS (e estado "já avaliou"). No /admin/feedback, uma visão agregada mostra total, média, % positivas, distribuição por nota/tópico e comentários recentes, via RPC admin_feedback_overview (SECURITY DEFINER guardada por is_admin, migration 0017).',
      'Por que isso importa? Feedback no momento certo (logo após a entrega) tem a maior taxa de resposta, e o painel transforma respostas dispersas em sinal acionável. É o canal de voz do cliente que fecha o ciclo de retenção.',
    ],
    identificacao: id(68, EP_VOZ, H24, 'Feedback widget no preview + painel /admin/feedback', 'Pedro', 5, 'Concluído', 'cb99fc4'),
    objetivo:
      'Coletar feedback do aluno no momento da entrega e agregá-lo num painel administrativo, fornecendo sinal acionável sobre a qualidade percebida do produto.',
    criterio:
      'Widget de feedback (nota 1–5, tópico, comentário) no preview de jobs concluídos, com insert via RLS e estado "já avaliou"; /admin/feedback com agregado (total, média, % positivas, distribuição) via RPC admin_feedback_overview guardada por is_admin.',
    conteudo: [
      { type: 'h3', text: '4.1. Coleta (FeedbackWidget)' },
      {
        type: 'bullets',
        items: [
          'No preview de jobs concluídos: nota 1–5, tópico e comentário.',
          'Insert direto via RLS feedback_insert_own; estado "já avaliou" evita duplicidade.',
        ],
      },
      { type: 'h3', text: '4.2. Painel (/admin/feedback)' },
      {
        type: 'bullets',
        items: [
          'Agregado: total, média, % positivas, distribuição por nota/tópico, comentários recentes.',
          'RPC admin_feedback_overview (SECURITY DEFINER, guardada por is_admin) — migration 0017.',
          'FEEDBACK_TOPIC_LABELS; Feedback/FeedbackTopic na API pública.',
        ],
      },
    ],
    validacao: [
      'Aluno avalia um doc concluído; não consegue avaliar duas vezes.',
      'Painel /admin/feedback mostra o agregado correto (só admin).',
      'RPC rejeita não-admin (42501).',
    ],
    dependencias: {
      texto: 'Depende de: pipeline e admin panel. Relaciona-se com: T55 (resultados do artigo). Habilita:',
      proximos: [
        'Sinal de qualidade percebida para a Seção 5 do artigo.',
        'Instrumentação para futura validação com usuários (trabalho extra/futuro).',
      ],
    },
  },
  {
    output: `Entregas/Teams/Tarefas/Sprint 5/${EP_VOZ}/${H24}/PSP2 - S5T69 - Privacidade Self-service e Filtro de Dados de Teste.docx`,
    title: 'PSP2 — Entrega Sprint 5 / Tarefa 69',
    subtitle: 'Exportar/excluir dados (Art. 18 LGPD) e filtro de dados de teste no /admin',
    emPalavrasSimples: [
      'Fechar a jornada com responsabilidade significa dar ao aluno controle sobre os próprios dados e manter as métricas do admin limpas. Esta entrega entrega o self-service de privacidade (LGPD Art. 18) e o filtro de dados de teste no painel.',
      'O aluno, em Configurações > Privacidade, pode exportar todos os seus dados em JSON (export_user_data, sem tokens/senhas) e excluir a conta com confirmação textual (delete_my_account, cascade + logout). No /admin, um toggle "Incluir dados de teste" (default desligado) esconde os 50 perfis de teste do seed das métricas, via parâmetro p_include_test nas 9 RPCs admin (migration 0019).',
      'Por que isso importa? Direito de acesso e ao esquecimento são direitos fundamentais do titular (LGPD Art. 18) — sem self-service, dependiam de processo manual. E métricas contaminadas por dados de teste enganam a leitura do admin. Ambos fecham a jornada com integridade.',
    ],
    identificacao: id(69, EP_VOZ, H24, 'Privacidade self-service (export/delete) + filtro de dados de teste no /admin', 'Theo', 3, 'Concluído', '2855d3d'),
    objetivo:
      'Entregar ao aluno o controle dos próprios dados (exportação e exclusão LGPD Art. 18) e manter as métricas administrativas limpas com um filtro de dados de teste.',
    criterio:
      'Configurações > Privacidade com exportar JSON (export_user_data, sem tokens/senhas) e excluir conta (delete_my_account, cascade + logout, confirmação textual); toggle "Incluir dados de teste" no /admin (default off) propagado às 9 RPCs (p_include_test, migration 0019).',
    conteudo: [
      { type: 'h3', text: '4.1. Privacidade self-service (LGPD Art. 18)' },
      {
        type: 'bullets',
        items: [
          'export_user_data() (SECURITY DEFINER) retorna JSON com profile/documents/jobs/job_events/generated_content/prompts/consents — sem tokens OAuth nem senhas.',
          'delete_my_account() apaga auth.users em cascade; UI com confirmação textual ("digite EXCLUIR") + signOut e redirect.',
          'PrivacySection.tsx em Configurações.',
        ],
      },
      { type: 'h3', text: '4.2. Filtro de dados de teste no /admin' },
      {
        type: 'bullets',
        items: [
          'Migration 0019 adiciona p_include_test (default false) às 9 RPCs admin, escondendo os 50 perfis is_test do seed 0016.',
          'AdminPrefsProvider + toggle no AdminLayout propagam a preferência aos hooks de métricas/feedback.',
          'Toggle só visível onde tem efeito (achado #63).',
        ],
      },
    ],
    validacao: [
      'Exportar gera JSON sem tokens/senhas; excluir apaga tudo em cascade.',
      'Métricas do /admin escondem dados de teste por padrão.',
      'Toggle propaga corretamente para os hooks.',
    ],
    dependencias: {
      texto: 'Depende de: T60 (base LGPD), admin panel. Relaciona-se com: T35 (blindagem de colunas). Encerra a jornada com:',
      proximos: [
        'Direitos do titular atendidos (export/delete).',
        'Métricas administrativas confiáveis.',
      ],
    },
  },
];
