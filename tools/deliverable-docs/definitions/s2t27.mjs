/**
 * Entrega Sprint 2 — Tarefa 27: OAuth2 com Google Drive (CÓDIGO).
 */

export default {
  output:
    'Entregas/Teams/Tarefas/Sprint 2/Integração Google Drive/H6 - Implementar exportação para Google Drive/PSP2 - S2T27 - OAuth2 Google Drive.docx',

  title: 'PSP2 — Entrega Sprint 2 / Tarefa 27',
  subtitle: 'OAuth2 com Google Drive — IMPLEMENTADA (código pronto)',

  emPalavrasSimples: [
    'OAuth é o protocolo que permite ao nosso sistema "pedir permissão" pra mexer no Google Drive do aluno sem nunca ver a senha dele. O usuário entra no Google (na página oficial), clica em "Permitir", e o Google nos manda um "passe" (access token) que vale por 1 hora. Junto vem um "passe-mestre" (refresh token) que dura indefinidamente e serve pra gerar novos passes de hora em hora.',
    'Esta entrega configura toda a camada de código que troca/refresh esses tokens, mais a função Edge "connect-drive" que recebe os tokens recém-emitidos do frontend e os guarda em segurança. Inclui também tratamento explícito do caso "token expirou de vez" (revogação pelo usuário) — nesse caso a função pede pra reconectar em vez de falhar silenciosamente.',
    'O que NÃO está nesta entrega: a configuração no Google Cloud Console (criar o OAuth Client ID, habilitar a Drive API, registrar a URL de callback). Esses passos exigem acesso ao painel do Google e são feitos pelo time uma única vez. O código está pronto e esperando essa configuração.',
  ],

  identificacao: [
    ['ID', 'Sprint 2 — Tarefa 27'],
    ['Épico', 'Integração Google Drive'],
    ['História', 'H6 — Implementar exportação para Google Drive'],
    ['Tarefa', 'Configurar OAuth2 com Google Drive API'],
    ['Responsável', 'Isaac'],
    ['Planning Poker', '5'],
    ['Data de início', '04/05/2026'],
    ['Data de entrega', '23/05/2026'],
    ['Status', 'Concluído'],
    ['Branch', 'feature/sprint1-finalization'],
    ['Commit', '(será preenchido após push)'],
  ],

  objetivo:
    'Implementar todas as primitivas de OAuth2 necessárias pra integração com Google Drive: refresh de access_token, validação de validade, recepção dos tokens emitidos pelo Supabase Auth, e persistência segura.\n\nA implementação é client-side leve: Supabase Auth gerencia o redirect flow (o aluno faz login com Google no padrão Supabase), e nossa Edge Function só recebe os tokens já emitidos e os armazena, mais o refresh quando expira.',

  criterio:
    'Endpoint POST /connect-drive aceita { provider_token, provider_refresh_token, expires_in } e (a) valida o token chamando Drive API listFiles real, (b) persiste tokens + criou folder raiz, (c) retorna 401 com erro tipado se token inválido. Função helper ensureFreshToken faz refresh transparente quando token expira.',

  conteudo: [
    { type: 'h3', text: '4.1. Arquivos criados' },
    {
      type: 'table',
      columnWidths: [4500, 4860],
      headers: ['Arquivo', 'Responsabilidade'],
      rows: [
        ['_shared/drive/types.ts', 'Tipos DriveTokenPair, DriveFolder, DriveFileUploadResult + erros DriveError e DriveAuthExpiredError.'],
        ['_shared/drive/oauth.ts', 'refreshAccessToken via POST oauth2.googleapis.com/token + ensureFreshToken com margem de 60s.'],
        ['_shared/drive/index.ts', 'Barrel: reexporta types + oauth + folders + upload pra import único.'],
        ['supabase/functions/connect-drive/index.ts', 'Edge Function que recebe tokens do frontend, valida via ensureRootFolder, persiste no profile e retorna o id da pasta raiz criada.'],
        ['supabase/migrations/0004_drive_oauth.sql', 'Adiciona colunas google_access_token, google_token_expires_at, drive_connected_at em profiles.'],
      ],
    },
    { type: 'h3', text: '4.2. Fluxo completo de OAuth (visão de produto)' },
    {
      type: 'table',
      columnWidths: [800, 4280, 4280],
      headers: ['#', 'Ação', 'Onde acontece'],
      rows: [
        ['1', 'Aluno clica "Conectar Google Drive" na tela de Configurações.', 'Frontend (a fazer na próxima iteração — UI)'],
        ['2', 'supabase.auth.signInWithOAuth({ provider: "google", scopes: "drive.file" })', 'Frontend → Supabase Auth'],
        ['3', 'Google mostra tela de consentimento. Aluno clica "Permitir".', 'Google'],
        ['4', 'Google redireciona pro callback do Supabase com os tokens.', 'Google → Supabase'],
        ['5', 'Supabase devolve `session.provider_token` e `session.provider_refresh_token` no JWT.', 'Supabase → Frontend'],
        ['6', 'Frontend chama POST /connect-drive com os tokens.', 'Frontend → Edge Function'],
        ['7', 'Edge Function valida (chama Drive API real pra criar a pasta "PSP2 - Estudos") e salva no profile.', 'Edge Function → Google + DB'],
      ],
    },
    { type: 'h3', text: '4.3. ensureFreshToken — refresh transparente' },
    {
      type: 'body',
      text: 'A função ensureFreshToken (em oauth.ts) recebe um token e retorna um token válido. Se o atual ainda tem ≥ 60s de margem, retorna ele mesmo. Se está perto de expirar, chama o endpoint Google de token refresh com o refresh_token salvo e devolve um novo par.',
    },
    {
      type: 'code',
      code: `// oauth.ts (resumido)
export async function ensureFreshToken(current, marginSeconds = 60) {
  const margin = marginSeconds * 1000;
  if (current.expires_at - margin > Date.now()) return current;
  if (!current.refresh_token) throw new DriveAuthExpiredError(...);
  return refreshAccessToken(current.refresh_token);
}`,
    },
    { type: 'h3', text: '4.4. Erros tipados' },
    {
      type: 'table',
      columnWidths: [2900, 6460],
      headers: ['Classe', 'Quando lançar'],
      rows: [
        ['DriveError', 'Erro genérico da Drive API (4xx/5xx). Inclui status + body.'],
        ['DriveAuthExpiredError', 'Especificamente 401 (refresh revogado ou access inválido). Caller deve pedir reauth.'],
      ],
    },
    { type: 'h3', text: '4.5. Migration 0004 — colunas em profiles' },
    {
      type: 'code',
      code: `alter table public.profiles
  add column if not exists google_access_token text,
  add column if not exists google_token_expires_at timestamptz,
  add column if not exists drive_connected_at timestamptz;`,
    },
    { type: 'h3', text: '4.6. Testes' },
    {
      type: 'body',
      text: 'drive.oauth.test.ts: 7 testes cobrem refresh feliz, 400/401 (DriveAuthExpiredError), 500 (DriveError), missing client_id, ensureFreshToken nos 3 caminhos (válido / quase expira / sem refresh).',
    },
  ],

  validacao: [
    'Edge Function "connect-drive" responde 200 quando recebe tokens válidos do Supabase Auth.',
    '401 → erro tipado "drive_auth_expired" com mensagem acionável ("reconecte sua conta Google").',
    'Tokens persistidos com expires_at calculado no momento da recepção (Date.now() + expires_in * 1000).',
    'Migration 0004 incluída + fallback no código pra migration ainda não aplicada (salva o que conseguir).',
    '7 testes unitários cobrem todos os ramos de refresh + ensureFreshToken.',
  ],

  dependencias: {
    texto: 'Bloqueio externo: a config no Google Cloud Console precisa ser feita pelo time. Steps mínimos:',
    proximos: [
      'GCP Console: criar projeto (ou usar existente) → APIs & Services → habilitar Google Drive API.',
      'GCP Console: criar OAuth 2.0 Client ID (Web Application) → redirect URI = https://<projeto-supabase>.supabase.co/auth/v1/callback.',
      'Copiar Client ID + Secret pras secrets do Supabase: supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...',
      'Supabase Console: Auth → Providers → Google → enable + colar Client ID/Secret.',
      'Configurar scope mínimo: https://www.googleapis.com/auth/drive.file (só vê arquivos criados pelo app).',
      'Frontend: habilitar botão "Entrar com Google" no LoginPage + adicionar handler que chama POST /connect-drive após signInWithOAuth.',
      'Testar com conta real (T30 — bloqueada por esses 6 passos acima).',
    ],
  },
};
