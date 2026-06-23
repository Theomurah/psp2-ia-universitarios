/**
 * Gerador dos Relatórios Finais das Sprints 3, 4 e 5 (ABNT, espelha o formato do
 * "Relatorio Final - Sprint 1.docx"): Capa (cabeçalho UnB) → Folha de rosto →
 * Sumário (TOC) → 1 Introdução → 2 Metodologia → 3 Planejamento → 4 Desenvolvimento
 * (por história) → 5 Resultados → 6 Dificuldades e Aprendizados → 7 Considerações
 * → Referências.
 *
 * Rodar:  node tools/deliverable-docs/sprints345/build-reports.mjs
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, PageBreak,
  TableOfContents, ShadingType,
} from 'docx';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FONT = 'Arial';
const BLUE = '1F3864';
const BORDER = 'B0B0B0';
const HEADER_BG = 'F0F4F9';

const EQUIPE = [
  ['Theo Murahovschi', 'Product Owner / Frontend Lead', 'PO, condução do backlog, frontend e identidade visual'],
  ['Pedro Henrique', 'Desenvolvedor Frontend', 'Interface, dashboard, drag-and-drop, integração com Supabase'],
  ['Isaac', 'Desenvolvedor Backend (Lead)', 'Edge Functions, pipeline LLM, parsers e validação'],
  ['Guilherme', 'Desenvolvedor Backend', 'Suporte ao pipeline, geração de prompts e infraestrutura'],
  ['Luis Felipe', 'QA / Testes', 'Validação funcional, testes manuais e automatizados'],
];
const NOMES = ['THEO MURAHOVSCHI', 'PEDRO HENRIQUE', 'ISAAC', 'GUILHERME', 'LUIS FELIPE'];

// ---------- helpers ----------
const center = (text, opts = {}) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: opts.after ?? 60 },
  children: [new TextRun({ text, font: FONT, size: opts.size ?? 22, bold: opts.bold ?? false })],
});
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const body = (text) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 276 },
  children: [new TextRun({ text, font: FONT, size: 22 })],
});
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 },
  children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: BLUE })],
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 120 },
  children: [new TextRun({ text, font: FONT, size: 23, bold: true, color: BLUE })],
});
const bullet = (text) => new Paragraph({
  bullet: { level: 0 }, spacing: { after: 80 },
  children: [new TextRun({ text, font: FONT, size: 22 })],
});
const cellBorders = () => ({
  top: { style: BorderStyle.SINGLE, color: BORDER, size: 4 },
  bottom: { style: BorderStyle.SINGLE, color: BORDER, size: 4 },
  left: { style: BorderStyle.SINGLE, color: BORDER, size: 4 },
  right: { style: BorderStyle.SINGLE, color: BORDER, size: 4 },
});
const tc = (text, { bold = false, header = false, width } = {}) => new TableCell({
  width: width ? { size: width, type: WidthType.DXA } : undefined,
  borders: cellBorders(),
  shading: { fill: header ? HEADER_BG : 'FFFFFF', type: ShadingType.CLEAR, color: 'auto' },
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  children: [new Paragraph({ children: [new TextRun({ text, font: FONT, size: 20, bold: bold || header })] })],
});
const table = (headers, rows, widths) => new Table({
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  columnWidths: widths,
  rows: [
    new TableRow({ tableHeader: true, children: headers.map((h, i) => tc(h, { header: true, width: widths[i] })) }),
    ...rows.map((r) => new TableRow({ children: r.map((c, i) => tc(String(c), { width: widths[i] })) })),
  ],
});

// ---------- capa + folha de rosto + sumário ----------
function capa(def) {
  return [
    center('UNIVERSIDADE DE BRASÍLIA — UnB', { bold: true, size: 24, after: 40 }),
    center('FACULDADE DE TECNOLOGIA — FT', { bold: true, size: 22, after: 40 }),
    center('ENGENHARIA DE PRODUÇÃO', { bold: true, size: 22, after: 40 }),
    center('DISCIPLINA: PROJETO DE SISTEMAS DE PRODUÇÃO 2 — PSP2', { size: 20, after: 600 }),
    ...NOMES.map((n) => center(n, { size: 22, after: 30 })),
    center('', { after: 600 }),
    center(`RELATÓRIO FINAL DA ${def.titulo.toUpperCase()}`, { bold: true, size: 28, after: 60 }),
    center('Projeto: PSP2 — IA para Universitários', { size: 22, after: 1200 }),
    center('Brasília — DF', { size: 22, after: 20 }),
    center('2026', { size: 22 }),
    pageBreak(),
  ];
}
function folhaRosto(def) {
  return [
    ...NOMES.map((n) => center(n, { size: 22, after: 30 })),
    center('', { after: 400 }),
    center(`RELATÓRIO FINAL DA ${def.titulo.toUpperCase()}`, { bold: true, size: 26, after: 40 }),
    center('Projeto: PSP2 — IA para Universitários', { size: 22, after: 400 }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED, spacing: { after: 300, line: 276 }, indent: { left: 4000 },
      children: [new TextRun({
        text: `Relatório final da ${def.titulo} apresentado à disciplina Projeto de Sistemas de Produção 2 (PSP2), do curso de Engenharia de Produção da Universidade de Brasília, como parte das atividades avaliativas do semestre 2026.1.`,
        font: FONT, size: 20,
      })],
    }),
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Orientador(a): [A PREENCHER]', font: FONT, size: 20 })] }),
    new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: `Período da Sprint: ${def.periodo}`, font: FONT, size: 20 })] }),
    center('Brasília — DF', { size: 22, after: 20 }),
    center('2026', { size: 22 }),
    pageBreak(),
  ];
}
function sumario() {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'SUMÁRIO', font: FONT, size: 26, bold: true })] }),
    new TableOfContents('Sumário', { hyperlink: true, headingStyleRange: '1-2' }),
    pageBreak(),
  ];
}

// ---------- desenvolvimento (por história) ----------
function desenvolvimento(def) {
  const out = [h1('4 DESENVOLVIMENTO')];
  def.historias.forEach((hist, i) => {
    out.push(h2(`4.${i + 1} ${hist.h} — ${hist.titulo}`));
    out.push(body(hist.desc));
    if (hist.tarefas?.length) {
      out.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'Tarefas entregues:', font: FONT, size: 22, bold: true })] }));
      hist.tarefas.forEach((t) => out.push(bullet(t)));
    }
  });
  return out;
}

function buildReport(def) {
  const children = [
    ...capa(def),
    ...folhaRosto(def),
    ...sumario(),
    h1('1 INTRODUÇÃO'),
    ...def.introducao.map(body),
    h1('2 METODOLOGIA'),
    body('O desenvolvimento do projeto adota o framework ágil Scrum, organizado em sprints de duração fixa, com cerimônias de planejamento, revisão e retrospectiva. A divisão de responsabilidades respeita os papéis estabelecidos pela equipe e a comunicação ocorre por canais assíncronos e reuniões síncronas semanais. O repositório é mantido no GitHub, com fluxo de trabalho baseado em branches por funcionalidade e revisão por pares antes da integração à branch principal.'),
    h2('2.1 Composição da equipe'),
    table(['Integrante', 'Papel', 'Atribuições principais'], EQUIPE, [2400, 3000, 3960]),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    h2('2.2 Pilha tecnológica'),
    body('Frontend em React + Vite (TypeScript) hospedado na Vercel; backend em Supabase Edge Functions (Deno) com Postgres e Row Level Security; integração a múltiplos LLMs via OpenRouter e ao Google Drive via OAuth 2.0 com escopo restrito. CSS próprio com identidade visual UnB (sem framework de UI).'),
    h2('2.3 Fluxo de trabalho'),
    body('Branches por funcionalidade, revisão por pares antes do merge na branch principal, pipeline de CI (lint, typecheck, testes com cobertura e build) e deploy automatizado das Edge Functions, com aplicação de migrations versionadas antes do deploy.'),
    h1('3 PLANEJAMENTO DA SPRINT'),
    h2('3.1 Objetivos da sprint'),
    ...def.objetivos.map(body),
    h2('3.2 Histórias e tarefas planejadas'),
    table(['Épico', 'História', 'Tarefas'],
      def.historias.map((x) => [x.epico, `${x.h} — ${x.titulo}`, String(x.tarefas.length)]),
      [3000, 4560, 1800]),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    ...desenvolvimento(def),
    h1('5 RESULTADOS E DISCUSSÃO'),
    ...def.resultados.map(body),
    h1('6 DIFICULDADES E APRENDIZADOS'),
    ...def.dificuldades.map(body),
    h1('7 CONSIDERAÇÕES FINAIS'),
    ...def.consideracoes.map(body),
    h1('REFERÊNCIAS'),
    ...def.referencias.map((r) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: r, font: FONT, size: 20 })] })),
  ];

  return new Document({
    creator: 'PSP2 IA Universitários',
    title: `Relatório Final — ${def.titulo}`,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: BLUE }, paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 23, bold: true, color: BLUE }, paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1134, bottom: 1134, left: 1701 } } },
      children,
    }],
  });
}

// ===================== CONFIGS POR SPRINT =====================
const reports = [
  {
    titulo: 'Sprint 3', periodo: '26/05/2026 a 04/06/2026',
    output: 'Entregas/Teams/Relatorios/Relatorio Final - Sprint 3.docx',
    introducao: [
      'Este relatório apresenta os resultados da Sprint 3 do projeto PSP2 — IA para Universitários, desenvolvido no âmbito da disciplina Projeto de Sistemas de Produção 2 (PSP2) do curso de Engenharia de Produção da Universidade de Brasília (UnB), no semestre letivo de 2026.1.',
      'A Sprint 3 foi dedicada ao hardening completo do sistema: levar o produto da condição de "funciona no caminho feliz" para "seguro, observável, acessível e operável sob carga real". O escopo derivou diretamente de quatro rodadas de auditoria do código (26, 27 e 28 de maio e 10 de junho de 2026), que somaram cerca de 200 achados em múltiplas frentes — incluindo um achado crítico de escalada de privilégio.',
      'As entregas cobrem seis frentes: segurança de acesso e dados, defesa do pipeline de LLM, robustez do pipeline e do banco, observabilidade, acessibilidade e responsividade, e qualidade/CI-CD/higiene de código.',
    ],
    objetivos: [
      'Eliminar os achados crítico e de alta severidade das auditorias antes de qualquer exposição a usuários reais; endurecer a segurança de acesso (RLS, blindagem de colunas sensíveis, trilha de auditoria server-side); proteger o pipeline de LLM contra injeção e abuso; tornar o processamento assíncrono resiliente; padronizar a observabilidade com logs estruturados sem PII; elevar o frontend ao patamar WCAG 2.1 AA com responsividade e tema escuro; e endurecer o pipeline de entrega (CI/CD).',
    ],
    historias: [
      { epico: 'Segurança de Acesso e Dados', h: 'H13', titulo: 'Blindar privilégios e dados sensíveis no banco',
        desc: 'Fechou o achado crítico de escalada de privilégio (qualquer usuário podia se tornar admin via UPDATE em profiles) com um gatilho BEFORE UPDATE, revogou o SELECT de colunas sensíveis (tokens Google) re-concedendo por coluna, restringiu app_settings a administradores e tornou a trilha de auditoria administrativa íntegra (gravada no servidor, anti-forja), além de prover requeue auditável de jobs.',
        tarefas: ['T35 — Trigger anti-escalada de admin + blindagem de colunas (migrations 0020–0022)', 'T36 — Hardening de RLS + storage policies (0023) + redução de service_role', 'T37 — Auditoria admin anti-forja (0024) + requeue (0025) + demote de admins falsos (0026)'] },
      { epico: 'Defesa do Pipeline LLM', h: 'H14', titulo: 'Sandbox e contenção contra injeção e abuso',
        desc: 'Isolou o conteúdo do aluno em todas as etapas LLM com delimitadores <<DOC>> e instrução de sistema, adicionou guards de custo/abuso (teto de tamanho e de tokens, whitelist de extensões, guard de payload) e aplicou rate limit, autorização de origem e CORS estrito às Edge Functions.',
        tarefas: ['T38 — Sandbox <<DOC>> nas 3 etapas + judge + system prompt', 'T39 — Guards de custo/abuso (markdown 1 MB, whitelist, 411, teto de tokens, cost guard)', 'T40 — Rate limit por usuário + authorizeProcessDocument + CORS strict + verify_jwt'] },
      { epico: 'Robustez do Pipeline e Banco', h: 'H15', titulo: 'Resiliência a races, retries e falhas parciais',
        desc: 'Tornou o ciclo de vida do job robusto (claim atômico, started_at imutável, attempt_count, requeue de failed), tratou falhas silenciosas (finish_reason, timeout de LLM, validação de compressão, needs_review), consolidou correções de schema/índices/advisors e corrigiu a grade de horários da UnB e o parser SIGAA multi-turno, além de instituir a retenção de logs via pg_cron.',
        tarefas: ['T41 — Claim atômico + started_at + attempt_count + requeue de failed', 'T42 — finish_reason + timeout LLM + validação de compressão + needs_review', 'T43 — Migrations 0007/0011/0027 + grade UNB_TURNOS + parser SIGAA multi-turno', 'T44 — Retenção de activity_logs via pg_cron (0028) + roadmap operacional'] },
      { epico: 'Observabilidade', h: 'H16', titulo: 'Logs estruturados, duráveis e sem PII',
        desc: 'Introduziu um logger estruturado em JSON com redaction canônica de PII, adotado no backend e no frontend e nas cinco Edge Functions, com persistência durável em activity_logs e request_id de correlação, além de ErrorBoundary global, telemetria de retry e status de providers no painel administrativo.',
        tarefas: ['T45 — Logger estruturado com redaction de PII (back+front) + adoção nas 5 Edge Functions', 'T46 — Persistência durável em activity_logs + request_id', 'T47 — ErrorBoundary global + telemetria de retry + status de providers no /admin'] },
      { epico: 'Acessibilidade e Responsividade', h: 'H17', titulo: 'Acessibilidade WCAG 2.1 AA e multi-tela',
        desc: 'Elevou o frontend ao patamar WCAG 2.1 AA (foco visível com contraste, focus trap em modais, aria-live em toasts, título por rota, skip-link, aria-invalid, contraste AA, markdown renderizado) e tornou todas as telas responsivas (mobile-first) com tema claro/escuro.',
        tarefas: ['T48 — A11y WCAG (foco, focus trap, aria-live, title, aria-invalid, contraste, markdown)', 'T49 — UI responsiva mobile-first + tema claro/escuro'] },
      { epico: 'Qualidade, CI-CD e Higiene', h: 'H18', titulo: 'Pipeline de entrega confiável',
        desc: 'Endureceu o CI/CD (cobertura, gate de validação antes do deploy, aplicação de migrations, ESLint flat, Dependabot, CodeQL, npm audit) com cabeçalhos HTTP estritos no frontend, fez a faxina técnica (código morto, dependências órfãs, formatadores unificados) e alinhou o export de dados ao baseline de LGPD, consolidando as auditorias como prática de QA.',
        tarefas: ['T50 — CI/CD endurecido (coverage, gate, migrate, eslint, dependabot, codeql) + CSP/headers', 'T51 — Cleanup técnico + export CSV alinhado ao LGPD', 'T52 — Auditorias completas (4 rodadas, ~200 achados) como prática de QA'] },
    ],
    resultados: [
      'O principal resultado da Sprint 3 é a elevação do nível de maturidade do sistema. O achado crítico de escalada de privilégio foi eliminado, os tokens OAuth do Google deixaram de trafegar para o navegador, o pipeline assíncrono passou a resistir a condições de corrida, retries e falhas parciais, a observabilidade ganhou logs estruturados sem PII e o frontend atingiu conformidade WCAG 2.1 AA com responsividade e tema escuro.',
      'As correções foram rastreadas individualmente aos achados de auditoria que as motivaram e versionadas em migrations e commits temáticos. [A PREENCHER: consolidar o número de achados endereçados por severidade (crítico, alto, médio, baixo) e o percentual de cobertura de testes alcançado após a sprint.]',
    ],
    dificuldades: [
      'A principal dificuldade foi a escala dos achados: cerca de 200 itens distribuídos entre quatro rodadas de auditoria exigiram triagem e priorização rigorosas, separando correções de alta confiança (quick wins) das que dependiam de decisão de produto ou de acesso a infraestrutura.',
      'O aprendizado central foi o valor da defesa em profundidade: barreiras redundantes (gatilho no banco + colunas explícitas no cliente, RLS + autorização na função, sandbox + judge) garantem que a falha de uma camada não comprometa o sistema. A auditoria estruturada e versionada mostrou-se um instrumento de QA superior à inspeção ad hoc.',
    ],
    consideracoes: [
      'Ao final da Sprint 3, o sistema encontra-se em condição de receber usuários reais do ponto de vista de segurança, robustez, observabilidade e acessibilidade. As validações que dependem de ambiente público (teste com 50 documentos reais, teste do fluxo Drive com conta real) permanecem condicionadas ao deploy de produção e foram registradas como trabalho futuro.',
    ],
    referencias: [
      '[A PREENCHER: consolidar referências efetivamente consultadas — ex.: OWASP Top 10, WCAG 2.1, documentação Supabase/PostgreSQL RLS.]',
    ],
  },
  {
    titulo: 'Sprint 4', periodo: '05/06/2026 a 14/06/2026',
    output: 'Entregas/Teams/Relatorios/Relatorio Final - Sprint 4.docx',
    introducao: [
      'Este relatório apresenta os resultados da Sprint 4 do projeto PSP2 — IA para Universitários, no âmbito da disciplina PSP2 do curso de Engenharia de Produção da UnB, semestre 2026.1.',
      'A Sprint 4 foi dedicada à elaboração e finalização do artigo científico a ser submetido ao ENEGEP 2026, em conformidade com a norma ABNT NBR 14724:2024 e o template do evento. O corpo do artigo foi redigido em seis seções e complementado por capa, resumo, palavras-chave e referências.',
    ],
    objetivos: [
      'Redigir o corpo do artigo (introdução, revisão bibliográfica, metodologia, desenvolvimento do artefato, resultados e considerações finais), finalizar a capa, o resumo, as palavras-chave e as referências em ABNT, e preparar o documento para submissão — com a decisão editorial de reportar uma avaliação planejada, sem fabricar dados empíricos não coletados.',
    ],
    historias: [
      { epico: 'Documentação e Artigo', h: 'H19', titulo: 'Redigir o corpo do artigo ENEGEP',
        desc: 'Redigiu as seções 1 a 6 do artigo: introdução (problema, justificativa e objetivos SMART), revisão bibliográfica, metodologia (Design Science Research) e arquitetura, desenvolvimento do artefato, resultados (reportando o artefato funcional e a avaliação planejada, sem números fabricados) e considerações finais com trabalhos futuros.',
        tarefas: ['T53 — Introdução, problema, justificativa e objetivos SMART (Seção 1)', 'T54 — Revisão bibliográfica, metodologia (DSRM) e arquitetura (Seções 2–4)', 'T55 — Resultados, artefato e discussão (Seção 5) — avaliação planejada', 'T56 — Considerações finais e trabalhos futuros (Seção 6)'] },
      { epico: 'Documentação e Artigo', h: 'H20', titulo: 'Finalizar e submeter o artigo',
        desc: 'Finalizou a capa (título, autores, resumo de ~250 palavras e palavras-chave), consolidou as referências em ABNT e organizou a conferência de formatação e a preparação do PDF anonimizado para submissão.',
        tarefas: ['T57 — Capa, resumo, palavras-chave e referências ABNT (Seção 7)', 'T58 — Revisão e formatação ABNT NBR 14724 + PDF e pacote de submissão'] },
    ],
    resultados: [
      'O artigo foi redigido integralmente em suas seis seções, com aproximadamente 14 páginas no limite do template, sob o método Design Science Research. A Tabela 1 sintetiza os componentes implementados e seu estado, e a Seção 5 reporta o artefato funcional como principal resultado deste ciclo.',
      'Por decisão metodológica, a avaliação experimental (validação técnica com 50 documentos e sessões com dez estudantes, com SUS, TAM, comparativo cronometrado e entrevistas) é apresentada como integralmente planejada — com instrumentos e critérios de aceitação definidos — porém não executada, uma vez que dependia da disponibilização pública do sistema. Nenhum resultado empírico é, portanto, reportado, evitando-se a fabricação de dados.',
    ],
    dificuldades: [
      'A principal dificuldade foi a impossibilidade de executar a avaliação empírica no ciclo, por ausência de deploy público e de verba para os créditos de LLM, o que exigiu reescrever a seção de resultados para refletir honestamente o estado do trabalho.',
      'O aprendizado foi metodológico: em pesquisa baseada em Design Science, o artefato é, por si, um resultado legítimo; e a transparência quanto ao que foi e ao que não foi avaliado é mais valiosa, academicamente, do que números plausíveis sem coleta real.',
    ],
    consideracoes: [
      'Ao final da Sprint 4, o artigo encontra-se pronto para a revisão final de formatação e submissão. A execução da avaliação desenhada permanece como trabalho futuro prioritário, a ser realizada após a implantação pública do sistema, quando os resultados reais substituirão a descrição do protocolo planejado.',
    ],
    referencias: [
      'HEVNER, A. R. et al. Design Science in Information Systems Research. MIS Quarterly, v. 28, n. 1, p. 75-105, 2004.',
      'PEFFERS, K. et al. A Design Science Research Methodology for Information Systems Research. Journal of MIS, v. 24, n. 3, p. 45-77, 2007.',
      'BROOKE, J. SUS: a quick and dirty usability scale. In: Usability evaluation in industry. London: Taylor & Francis, 1996. p. 189-194.',
      'BARDIN, L. Análise de conteúdo. São Paulo: Edições 70, 2011.',
      '[A PREENCHER: a lista completa (26 referências) vive no corpo do artigo, Seção 7 — consolidar aqui as efetivamente citadas neste relatório.]',
    ],
  },
  {
    titulo: 'Sprint 5', periodo: '15/06/2026 a 25/06/2026',
    output: 'Entregas/Teams/Relatorios/Relatorio Final - Sprint 5.docx',
    introducao: [
      'Este relatório apresenta os resultados da Sprint 5 do projeto PSP2 — IA para Universitários, no âmbito da disciplina PSP2 do curso de Engenharia de Produção da UnB, semestre 2026.1.',
      'A Sprint 5 foi dedicada à jornada do cliente: a experiência completa do aluno, da aquisição ao hábito de uso, com a identidade visual da UnB e a base legal de LGPD. O objetivo foi consolidar e refinar o caminho que o estudante percorre — cadastro, onboarding, configuração do semestre, uso diário, personalização e voz do cliente.',
    ],
    objetivos: [
      'Entregar e refinar a jornada completa do aluno: entrada com identidade UnB e consentimento LGPD; onboarding guiado; configuração do perfil acadêmico (matérias/horários e import SIGAA, conexão do Drive); núcleo de uso diário (dashboard em tempo real, gestão e leitura de documentos, transparência operacional); e personalização e voz do cliente (biblioteca de prompts, system prompt portátil, feedback e direitos LGPD self-service).',
    ],
    historias: [
      { epico: 'Aquisição e Onboarding', h: 'H21', titulo: 'Entrada e ativação do aluno',
        desc: 'Entregou a porta de entrada do produto: login/cadastro com magic link e indicador de força de senha, identidade visual UnB, consentimento LGPD obrigatório no cadastro, páginas de Privacidade e Termos, e o onboarding guiado de quatro passos (curso, semestre, matérias e horários).',
        tarefas: ['T59 — Login/cadastro + magic link + força de senha + identidade visual UnB', 'T60 — Consentimento LGPD no signup + páginas Privacidade/Termos + 404', 'T61 — Onboarding guiado 4-step (curso, semestre, matérias, horários)'] },
      { epico: 'Perfil Acadêmico', h: 'H22', titulo: 'Configurar o semestre',
        desc: 'Entregou a página de matérias com grade visual de horários e a importação automática do atestado de matrícula do SIGAA (parser dedicado + Edge Function, com preview e merge não-destrutivo), além do fluxo de conexão do Google Drive nas configurações.',
        tarefas: ['T62 — Página /materias com grade visual + import SIGAA (parser + Edge Function)', 'T63 — Conexão do Google Drive nas configurações'] },
      { epico: 'Núcleo de Uso Diário', h: 'H23', titulo: 'Processar, acompanhar e gerir documentos',
        desc: 'Entregou o dashboard com métricas pessoais, filtros e atualização em tempo real; a gestão de documentos (arquivar/excluir) com preview da síntese em markdown renderizado; e a página de atividade, que dá transparência operacional sobre cada etapa do processamento.',
        tarefas: ['T64 — Dashboard com métricas pessoais, filtros e realtime', 'T65 — Gestão de documentos (arquivar/excluir) + preview de síntese em markdown', 'T66 — Página /atividade — transparência operacional'] },
      { epico: 'Personalização e Voz do Cliente', h: 'H24', titulo: 'Reter e ouvir o aluno',
        desc: 'Entregou a biblioteca de prompts copiáveis e o system prompt personalizado injetado na síntese (a saída portátil que caracteriza o produto), o widget de feedback no preview com painel administrativo agregado, e os direitos LGPD self-service (exportar/excluir dados) com filtro de dados de teste no painel.',
        tarefas: ['T67 — Biblioteca de prompts + system prompt personalizado na síntese', 'T68 — Feedback widget no preview + painel /admin/feedback', 'T69 — Privacidade self-service (export/delete) + filtro de dados de teste no /admin'] },
    ],
    resultados: [
      'A jornada do cliente foi construída de ponta a ponta: o aluno consegue cadastrar-se com consentimento informado, completar o onboarding, configurar o semestre (inclusive importando o SIGAA), conectar o Drive, processar e acompanhar documentos em tempo real, ler as sínteses, usar a biblioteca de prompts e o system prompt portátil, dar feedback e exercer seus direitos de privacidade.',
      'A experiência foi validada internamente em ambiente de desenvolvimento. [A PREENCHER: inserir métricas de uso e resultados de validação com usuários quando a avaliação for executada após o deploy público — taxa de conclusão do onboarding, tempo por etapa, satisfação.]',
    ],
    dificuldades: [
      'A principal dificuldade foi a impossibilidade de validar a jornada com usuários reais neste ciclo, por ausência de deploy público — o que deslocou a avaliação empírica (antigas histórias de testes com usuários) para trabalho futuro.',
      'O aprendizado foi tratar a jornada como um todo coeso (aquisição → ativação → uso → retenção) em vez de funcionalidades isoladas: decisões como o onboarding obrigatório, a transparência operacional e a saída portátil reforçam-se mutuamente na experiência do aluno.',
    ],
    consideracoes: [
      'Ao final da Sprint 5, a jornada do cliente está implementada e refinada, com identidade UnB, acessibilidade e base LGPD. A validação empírica com estudantes reais — mapeamento da jornada observada, testes de usabilidade (SUS/TAM) e coleta de feedback em escala — permanece como trabalho futuro, dependente da disponibilização pública do sistema.',
    ],
    referencias: [
      'BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de Dados Pessoais (LGPD).',
      '[A PREENCHER: consolidar referências de UX/usabilidade efetivamente consultadas (ex.: WCAG 2.1, heurísticas de Nielsen).]',
    ],
  },
];

async function main() {
  for (const def of reports) {
    const doc = buildReport(def);
    const buffer = await Packer.toBuffer(doc);
    const out = path.join(ROOT, def.output);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, buffer);
    console.log(`✓ ${def.output}`);
  }
  console.log(`\n${reports.length} relatórios gerados.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
