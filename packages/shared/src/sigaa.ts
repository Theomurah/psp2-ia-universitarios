/**
 * Parser do atestado de matrícula do SIGAA (UnB) — formato texto.
 *
 * Estratégia: busca por âncora.
 *   1. Acha todos os códigos de disciplina (`[A-Z]{2,4}\d{3,4}`) no bloco
 *      entre "TURMAS MATRICULADAS" e "TABELA DE HORÁRIOS".
 *   2. Para cada código, isola o "bloco" de texto entre ele e o próximo.
 *   3. Extrai do bloco: nome, turma, código de horário, local, professor —
 *      cada um com regex independente, sem assumir que estão na mesma linha.
 *
 * Resiliente a layouts diferentes do `pdf-parse` (que quebra colunas em
 * linhas separadas) e do `pdftotext -layout` (que mantém colunas alinhadas).
 *
 * Código SIGAA de horário (ex: "26N34"):
 *   - Dígitos antes da letra: dias (2=seg, 3=ter, 4=qua, 5=qui, 6=sex, 7=sab)
 *   - Letra: turno (M=manhã, T=tarde, N=noturno)
 *   - Dígitos depois: aulas (consecutivas viram bloco único)
 */

import type { DiaSemana } from './schemas.ts';

// =============================================================
// Tabela de horários UnB
// =============================================================
export const UNB_TURNOS: Record<'M' | 'T' | 'N', Record<number, { inicio: string; fim: string }>> = {
  M: {
    1: { inicio: '08:00', fim: '08:55' },
    2: { inicio: '08:55', fim: '09:50' },
    3: { inicio: '10:00', fim: '10:55' },
    4: { inicio: '10:55', fim: '11:50' },
    5: { inicio: '12:00', fim: '12:55' },
  },
  T: {
    1: { inicio: '14:00', fim: '14:55' },
    2: { inicio: '14:55', fim: '15:50' },
    3: { inicio: '16:00', fim: '16:55' },
    4: { inicio: '16:55', fim: '17:50' },
    5: { inicio: '18:00', fim: '18:55' },
    6: { inicio: '18:55', fim: '19:50' },
  },
  N: {
    1: { inicio: '19:00', fim: '19:50' },
    2: { inicio: '19:50', fim: '20:40' },
    3: { inicio: '20:50', fim: '21:40' },
    4: { inicio: '21:40', fim: '22:30' },
  },
};

const DIA_BY_NUM: Record<number, DiaSemana | null> = {
  1: null, 2: 'seg', 3: 'ter', 4: 'qua', 5: 'qui', 6: 'sex', 7: 'sab',
};

// =============================================================
// Tipos
// =============================================================
export interface HorarioBloco { dia: DiaSemana; inicio: string; fim: string; }
export interface SigaaMateria {
  code: string;
  nome: string;
  turma: string | null;
  professor: string | null;
  local: string | null;
  codigo_horario_sigaa: string | null;
  horarios: HorarioBloco[];
}
export interface SigaaAtestado {
  nome_aluno: string | null;
  matricula: string | null;
  curso: string | null;
  semestre: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  materias: SigaaMateria[];
  warnings: string[];
}

// =============================================================
// Decodificador de código SIGAA
// =============================================================
const HORARIO_REGEX = /^([1-7]+)([MTN])([1-9]+)$/;

export function parseHorarioCode(code: string): HorarioBloco[] {
  const m = HORARIO_REGEX.exec(code);
  if (!m) return [];
  const dias = m[1].split('').map(Number);
  const turno = m[2] as 'M' | 'T' | 'N';
  const aulas = m[3].split('').map(Number);

  const tabela = UNB_TURNOS[turno];
  const aulasResolvidas = aulas
    .map((n) => ({ n, slot: tabela[n] }))
    .filter((x): x is { n: number; slot: { inicio: string; fim: string } } => Boolean(x.slot))
    .sort((a, b) => a.n - b.n);
  if (aulasResolvidas.length === 0) return [];

  const blocos: { inicio: string; fim: string }[] = [];
  let atual = { inicio: aulasResolvidas[0].slot.inicio, fim: aulasResolvidas[0].slot.fim, n: aulasResolvidas[0].n };
  for (let i = 1; i < aulasResolvidas.length; i++) {
    const a = aulasResolvidas[i];
    if (a.n === atual.n + 1) {
      atual = { inicio: atual.inicio, fim: a.slot.fim, n: a.n };
    } else {
      blocos.push({ inicio: atual.inicio, fim: atual.fim });
      atual = { inicio: a.slot.inicio, fim: a.slot.fim, n: a.n };
    }
  }
  blocos.push({ inicio: atual.inicio, fim: atual.fim });

  const out: HorarioBloco[] = [];
  for (const numDia of dias) {
    const dia = DIA_BY_NUM[numDia];
    if (!dia) continue;
    for (const b of blocos) {
      out.push({ dia, inicio: b.inicio, fim: b.fim });
    }
  }
  return out;
}

// =============================================================
// Regex de cabeçalho — tolerante a múltiplos espaços e quebras
// =============================================================
const RX_NOME = /Nome:\s*([A-ZÀ-Ý][A-ZÀ-Ýa-zà-ý\s]+?)(?=\s*(?:Curso|Matr[ií]cula|N[íi]vel|V[íi]nculo|Per[íi]odo|TURMAS|$))/i;
const RX_CURSO = /Curso:\s*([^\n\r]+?)(?=\s*(?:TURMAS|N[íi]vel|V[íi]nculo|Matr[ií]cula|Nome|Per[íi]odo|$))/i;
const RX_MATRICULA = /Matr[íi]cula:\s*(\d{6,15})/i;
const RX_PERIODO_LETIVO = /Per[ií]odo Letivo:\s*(\d{4}\.\d)\s*\(\s*(\d{2}\/\d{2}\/\d{4})\s*[àa\-–—]+\s*(\d{2}\/\d{2}\/\d{4})\s*\)/i;

// Código de disciplina: 2-4 letras maiúsculas + 3-4 dígitos (ex: IFD0179, ECO0019).
// SEM \b no final: o pdf-parse cola o código no nome ("IFD0179FISICA 3"),
// e não há word-boundary entre dígito e letra. Com \b final, nada casava.
const RX_CODIGO_MATERIA = /\b([A-Z]{2,4}\d{3,4})/g;

// Código de horário SIGAA, com word-boundary
const RX_CODIGO_HORARIO = /\b([1-7]+[MTN][1-9]+)\b/;

// Local: depois de "Local:"
const RX_LOCAL = /Local:\s*([^\n\r]+?)(?=\s*(?:Tipo:|Hor[áa]rio:|$|\n))/i;

// Turma + MATRICULADO
const RX_TURMA_MATRICULA = /\b(\d{2,3})\s+MATRICULADO\(A\)/i;

const BR_DATE_TO_ISO = (br: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// =============================================================
// Helpers
// =============================================================

/** Acha o índice do início do bloco "TURMAS MATRICULADAS:" no texto. */
function findBlocoStart(text: string): number {
  const m = /TURMAS\s+MATRICULADAS/i.exec(text);
  return m ? m.index + m[0].length : -1;
}

/** Acha o índice do fim do bloco (início da "TABELA DE HORÁRIOS"). */
function findBlocoEnd(text: string): number {
  const m = /TABELA\s+DE\s+HOR[ÁA]RIOS/i.exec(text);
  return m ? m.index : -1;
}

/**
 * Detecta se uma linha parece "nome de pessoa" (3+ palavras em ALL CAPS,
 * sem dígitos, sem ":", sem palavras conhecidas que não são nomes).
 *
 * Usada pra separar professor do nome da disciplina (ambos vêm em CAPS).
 */
function pareceNomeDePessoa(linha: string): boolean {
  if (!/^[A-ZÀ-Ý][A-ZÀ-Ý\s]+$/.test(linha)) return false;
  if (linha.includes(':') || /\d/.test(linha)) return false;
  if (/MATRICULADO|DISCIPLINA|GRADUA[ÇC][ÃA]O|REGULAR|TURMAS/i.test(linha)) return false;
  const palavras = linha.trim().split(/\s+/);
  // Nomes de pessoa: pelo menos 3 palavras (nome + sobrenome composto)
  // — descarta "FÍSICA 3", "INTRODUÇÃO À ECONOMIA" (2-3 palavras curtas, mas o filtro abaixo discrimina)
  if (palavras.length < 3) return false;
  // Filtros adicionais: nomes de pessoa têm pelo menos 1 palavra com 4+ chars
  // (descarta "DE", "DA", "DO", siglas curtas em série)
  const temPalavraLonga = palavras.some((p) => p.length >= 4);
  if (!temPalavraLonga) return false;
  return true;
}

/**
 * Detecta se uma linha parece "continuação do nome de disciplina":
 * curta (1-2 palavras), ALL CAPS, pode ter dígito.
 */
function pareceContinuacaoNome(linha: string): boolean {
  if (!/^[A-ZÀ-Ý][A-ZÀ-Ý\s\d]*$/.test(linha)) return false;
  if (linha.includes(':')) return false;
  const palavras = linha.trim().split(/\s+/);
  return palavras.length <= 3;
}

/**
 * Extrai nome da disciplina E professor do bloco.
 *
 * Suporta dois layouts:
 *   A) Single-line (pdftotext -layout):
 *      "IFD0179 FISICA 3  01  MATRICULADO(A)  26N34\nFABIO MENEZES DE SOUZA LIMA\nTipo:..."
 *   B) Multi-line (pdf-parse no Deno):
 *      "IFD0179\nFISICA 3\nFABIO MENEZES DE SOUZA LIMA\nTipo:..."
 *
 * Estratégia:
 *   1. Acha onde fica "MATRICULADO(A)" — divide bloco em "antes" e "depois".
 *   2. NOME = o que vem ANTES (descartando código, turma, código de horário).
 *      Em layout A, o nome compartilha linha com MATRICULADO; em layout B,
 *      são linhas separadas.
 *   3. PROFESSOR = primeira linha "nome de pessoa" DEPOIS de MATRICULADO,
 *      mas antes de Tipo:/Local:.
 *   4. Se não tiver MATRICULADO no bloco (caso raro), fallback: acumula
 *      linhas curtas até primeiro nome-de-pessoa.
 */
function extractNomeEProfessor(bloco: string, code: string): { nome: string; professor: string | null } {
  const semCode = bloco.replace(new RegExp(`^\\s*${code}\\s*`), '');

  // Acha posição de MATRICULADO(A)
  const matricMatch = /MATRICULADO\(A\)/i.exec(semCode);

  let antesMatric: string;
  let depoisMatric: string;
  if (matricMatch) {
    antesMatric = semCode.slice(0, matricMatch.index);
    depoisMatric = semCode.slice(matricMatch.index + matricMatch[0].length);
  } else {
    antesMatric = semCode;
    depoisMatric = '';
  }

  // === NOME ===
  // Pega linhas válidas do "antes de MATRICULADO".
  const linhasAntes = antesMatric.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
  const nomeLinhas: string[] = [];
  for (const linha of linhasAntes) {
    if (/^Tipo:/i.test(linha) || /^Local:/i.test(linha)) break;
    if (/^\d{2,3}$/.test(linha)) continue;                          // turma solta
    if (/^[1-7]+[MTN][1-9]+(\s*\(.*)?$/.test(linha)) continue;      // horário solto
    if (/^[(\d]/.test(linha) && !pareceContinuacaoNome(linha)) continue;

    // Caso layout A: a linha tem "FISICA 3   01" — limpa números soltos no final
    const limpo = linha
      .replace(/\s+\d{2,3}\s*$/, '')                                // turma vazada no fim
      .replace(/\s+[1-7]+[MTN][1-9]+(\s*\(.*?\))?\s*$/, '')         // horário no fim
      .replace(/\s{2,}/g, ' ')                                      // colapsa espaços longos
      .trim();
    if (!limpo) continue;
    nomeLinhas.push(limpo);
  }

  // === PROFESSOR ===
  // Procura primeira linha "nome de pessoa" DEPOIS de MATRICULADO.
  let professor: string | null = null;
  const linhasDepois = depoisMatric.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
  for (const linha of linhasDepois) {
    if (/^Tipo:/i.test(linha) || /^Local:/i.test(linha)) break;
    if (/^[1-7]+[MTN][1-9]+(\s*\(.*)?$/.test(linha)) continue;
    if (/^[(\d]/.test(linha)) continue;
    if (pareceNomeDePessoa(linha)) {
      professor = linha;
      break;
    }
  }

  // Fallback: se não achou professor depois e o nomeLinhas tem 2+ entradas,
  // a última pode ser o professor (caso de layout B sem MATRICULADO no meio).
  if (!professor && nomeLinhas.length >= 2) {
    const ultima = nomeLinhas[nomeLinhas.length - 1];
    if (pareceNomeDePessoa(ultima)) {
      professor = ultima;
      nomeLinhas.pop();
    }
  }

  const nome = nomeLinhas.join(' ').replace(/\s+/g, ' ').trim();
  return { nome, professor };
}

// =============================================================
// Parser principal
// =============================================================
export function parseSigaaAtestado(rawText: string): SigaaAtestado {
  const warnings: string[] = [];

  // Normaliza quebras de linha mas preserva pra heurística
  const text = rawText.replace(/\r\n?/g, '\n');

  // --- Cabeçalho ---
  const nome = RX_NOME.exec(text)?.[1]?.trim().replace(/\s+/g, ' ') ?? null;
  const matricula = RX_MATRICULA.exec(text)?.[1]?.trim() ?? null;
  const curso = RX_CURSO.exec(text)?.[1]?.trim().replace(/\s+/g, ' ') ?? null;

  const periodo = RX_PERIODO_LETIVO.exec(text);
  const semestre = periodo?.[1] ?? null;
  const periodo_inicio = periodo ? BR_DATE_TO_ISO(periodo[2]) : null;
  const periodo_fim = periodo ? BR_DATE_TO_ISO(periodo[3]) : null;

  // --- Encontra bloco de matérias ---
  const blocoStart = findBlocoStart(text);
  if (blocoStart < 0) {
    warnings.push('Não encontrei a seção "TURMAS MATRICULADAS" — verifique se o PDF é o atestado completo.');
    return {
      nome_aluno: nome, matricula, curso, semestre,
      periodo_inicio, periodo_fim, materias: [], warnings,
    };
  }
  const blocoEnd = findBlocoEnd(text);
  const limiteFim = blocoEnd > 0 ? blocoEnd : text.length;

  // --- Acha todos os códigos de disciplina dentro do bloco ---
  // Reset lastIndex (regex global tem estado)
  RX_CODIGO_MATERIA.lastIndex = 0;
  const matches: { code: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = RX_CODIGO_MATERIA.exec(text)) !== null) {
    if (m.index >= blocoStart && m.index < limiteFim) {
      matches.push({ code: m[1], index: m.index });
    }
  }

  if (matches.length === 0) {
    warnings.push('Nenhum código de disciplina encontrado no bloco. O PDF pode estar em formato inesperado.');
    return {
      nome_aluno: nome, matricula, curso, semestre,
      periodo_inicio, periodo_fim, materias: [], warnings,
    };
  }

  // --- Para cada código, extrai matéria ---
  const materias: SigaaMateria[] = [];
  for (let i = 0; i < matches.length; i++) {
    const { code, index } = matches[i];
    const blocoFim = i + 1 < matches.length ? matches[i + 1].index : limiteFim;
    const bloco = text.slice(index, blocoFim);

    const { nome: nomeDisc, professor } = extractNomeEProfessor(bloco, code);
    const horarioMatch = RX_CODIGO_HORARIO.exec(bloco);
    const codigoHorario = horarioMatch?.[1] ?? null;
    const localMatch = RX_LOCAL.exec(bloco);
    const local = localMatch?.[1]?.trim() ?? null;
    const turmaMatch = RX_TURMA_MATRICULA.exec(bloco);
    const turma = turmaMatch?.[1]?.trim() ?? null;

    materias.push({
      code,
      nome: nomeDisc || code,
      turma,
      professor,
      local,
      codigo_horario_sigaa: codigoHorario,
      horarios: codigoHorario ? parseHorarioCode(codigoHorario) : [],
    });
  }

  // --- Warnings por matéria ---
  for (const mat of materias) {
    if (mat.codigo_horario_sigaa && mat.horarios.length === 0) {
      warnings.push(`Código "${mat.codigo_horario_sigaa}" (${mat.code}) não pôde ser decodificado — confira manualmente.`);
    }
    if (!mat.codigo_horario_sigaa) {
      warnings.push(`${mat.code} (${mat.nome}) ficou sem horário — confira manualmente.`);
    }
  }

  return {
    nome_aluno: nome,
    matricula,
    curso,
    semestre,
    periodo_inicio,
    periodo_fim,
    materias,
    warnings,
  };
}
