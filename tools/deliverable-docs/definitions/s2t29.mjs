/**
 * Entrega Sprint 2 — Tarefa 29: Upload automático no Drive.
 */

export default {
  output:
    'Entregas/Teams/Tarefas/Sprint 2/Integração Google Drive/H6 - Implementar exportação para Google Drive/PSP2 - S2T29 - Upload Automatico Drive.docx',

  title: 'PSP2 — Entrega Sprint 2 / Tarefa 29',
  subtitle: 'Upload Automático dos Documentos no Drive — IMPLEMENTADA',

  emPalavrasSimples: [
    'Esta entrega é a "última milha" do pipeline: depois de processar o documento (extrair texto, classificar, sintetizar em Markdown, comprimir), o sistema agora coloca o resultado direto na pasta correta do Google Drive do aluno. O aluno abre o Drive no celular e tudo já está lá, organizado por semestre e matéria.',
    'A implementação usa o protocolo "multipart upload" da Drive API — uma única requisição HTTP que envia o metadata (nome do arquivo, MIME type, pasta-destino) junto com os bytes do arquivo. Pra arquivos do tamanho do MVP (até 50 MiB), isso é mais simples e mais rápido que o upload em chunks ("resumable").',
    'Importante: o upload é "best effort". Se o token Google falhou (revogado, quota), o pipeline continua normalmente e marca um warning no job. O aluno vê o resumo no app de qualquer forma — o Drive é um bonus, não um bloqueio.',
  ],

  identificacao: [
    ['ID', 'Sprint 2 — Tarefa 29'],
    ['Épico', 'Integração Google Drive'],
    ['História', 'H6 — Implementar exportação para Google Drive'],
    ['Tarefa', 'Implementar upload automático dos docs processados'],
    ['Responsável', 'Isaac'],
    ['Planning Poker', '3'],
    ['Data de início', '14/05/2026'],
    ['Data de entrega', '26/05/2026'],
    ['Status', 'Concluído'],
    ['Branch', 'feature/sprint1-finalization'],
    ['Commit', '(será preenchido após push)'],
  ],

  objetivo:
    'Enviar pro Drive do aluno o arquivo Markdown sintetizado pelo pipeline, na pasta correta (semestre/matéria), com nome final padronizado, e salvar o id do arquivo no banco pra referência futura.\n\nO upload não deve interromper o pipeline em caso de erro — se Drive falhar, o resto do processamento continua e o aluno só perde o backup automático (que pode ser feito depois manualmente).',

  criterio:
    'Doc processado completamente aparece na pasta correta do Drive (PSP2 - Estudos / semestre / matéria) com nome no formato T07. Coluna documents.drive_file_id populada. Falha no Drive não falha o job — só vira warning.',

  conteudo: [
    { type: 'h3', text: '4.1. Arquivo criado' },
    {
      type: 'body',
      text: 'supabase/functions/_shared/drive/upload.ts — 90 linhas. Exporta uploadFile (multipart genérico) e uploadMarkdown (wrapper conveniente forçando mime text/markdown).',
    },
    { type: 'h3', text: '4.2. Protocolo multipart' },
    {
      type: 'body',
      text: 'A Drive API aceita upload multipart em uploadType=multipart. O body tem 2 partes separadas por boundary: (1) JSON com metadata (name, mimeType, parents), (2) bytes do arquivo. O código monta esse body manualmente — o fetch não tem helper nativo.',
    },
    {
      type: 'code',
      code: `// upload.ts (resumido)
const boundary = \`psp2-\${crypto.randomUUID()}\`;
const head =
  \`--\${boundary}\\r\\n\` +
  'Content-Type: application/json; charset=UTF-8\\r\\n\\r\\n' +
  JSON.stringify(metadata) + '\\r\\n' +
  \`--\${boundary}\\r\\n\` +
  \`Content-Type: \${mimeType}\\r\\n\\r\\n\`;
const tail = \`\\r\\n--\${boundary}--\`;
const body = new Uint8Array(head + content + tail);

await fetch(uploadUrl, {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${accessToken}\`,
    'Content-Type': \`multipart/related; boundary=\${boundary}\`,
  },
  body,
});`,
    },
    { type: 'h3', text: '4.3. Wire-up no process-document' },
    {
      type: 'body',
      text: 'O step 6 (upload_drive) do pipeline foi reescrito. Antes só dava warning "não implementado"; agora chama tryUploadToDrive() que faz refresh do token, garante a cadeia de pastas, faz upload e salva o id.',
    },
    {
      type: 'code',
      code: `// process-document/index.ts (resumido)
async function tryUploadToDrive({ profile, filename, markdown, pathSegments, service }) {
  if (!profile.google_refresh_token) {
    return { skipped: true, reason: 'Drive não conectado' };
  }
  let token = await ensureFreshToken({ ...profile como DriveTokenPair });
  const folderId = await ensureFolderPath(profile.drive_root_folder_id, pathSegments, { accessToken: token.access_token });
  const file = await uploadMarkdown({ accessToken: token.access_token, parentId: folderId, filename, markdown });
  return { skipped: false, file_id: file.id, duration_ms };
}`,
    },
    { type: 'h3', text: '4.4. Persistência do drive_file_id' },
    {
      type: 'body',
      text: 'Após upload bem-sucedido, documents.drive_file_id recebe o id retornado pela Drive API. Permite, no futuro, abrir o arquivo direto no Drive a partir do dashboard (botão "Abrir no Drive" linkando pra https://drive.google.com/file/d/{id}).',
    },
    { type: 'h3', text: '4.5. Tratamento robusto de erros' },
    {
      type: 'table',
      columnWidths: [2900, 6460],
      headers: ['Caso', 'Comportamento'],
      rows: [
        ['Aluno não conectou Drive (sem refresh_token)', 'skipped=true, reason="Drive não conectado". Job continua, marca warning no job_events.'],
        ['Token expirou de vez (revogado)', 'skipped=true, reason="Token Google expirado — reconectar". Mensagem acionável.'],
        ['Erro de rede no refresh', 'skipped=false, error="refresh falhou: ...". Job marca error no job_events mas continua e completa.'],
        ['Erro 4xx/5xx na Drive API', 'skipped=false, error="Drive {status}: {body}". Idem, job continua.'],
        ['Sucesso', 'documents.drive_file_id atualizado, job_events com tipo success.'],
      ],
    },
    { type: 'h3', text: '4.6. Testes' },
    {
      type: 'body',
      text: 'drive.upload.test.ts — 5 testes cobrem: upload de string MD (verifica multipart correto), upload de Uint8Array (PDF), 401 → DriveAuthExpiredError, 403 → DriveError, uploadMarkdown força text/markdown e inclui o conteúdo no body.',
    },
  ],

  validacao: [
    'Header Authorization correto (Bearer {token}).',
    'Content-Type multipart/related com boundary único por chamada (UUID).',
    'Body inclui metadata JSON + bytes do arquivo separados por boundary.',
    'parentId honrado — arquivo aparece na pasta certa.',
    'Erro 401 → DriveAuthExpiredError; erros 4xx/5xx → DriveError com status preservado.',
    'Pipeline NÃO falha por causa do Drive — só marca warning e continua.',
  ],

  dependencias: {
    texto: 'Depende de: T27 (tokens válidos), T28 (folder ids). Habilita:',
    proximos: [
      'T30 — testar fluxo com conta real (bloqueado por config GCP).',
      'Botão "Abrir no Drive" no JobCard quando documents.drive_file_id estiver populado.',
      'Sincronização reversa (se aluno editar no Drive, importar de volta) — fora de escopo do MVP.',
    ],
  },
};
