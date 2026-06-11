/**
 * Testes do parser SIGAA. Usa o atestado real do Theo (28/05/2026) como
 * fixture — qualquer mudança no layout do SIGAA quebra esses testes.
 */

import { describe, it, expect } from 'vitest';
import { parseHorarioCode, parseSigaaAtestado, UNB_TURNOS } from '../sigaa.ts';

// =============================================================
// parseHorarioCode
// =============================================================
describe('parseHorarioCode', () => {
  it('decodifica código simples 1 dia / 1 aula (3N1)', () => {
    const r = parseHorarioCode('3N1');
    expect(r).toEqual([{ dia: 'ter', inicio: '19:00', fim: '19:50' }]);
  });

  it('agrupa aulas consecutivas (26N34 → seg+sex 20:50-22:30)', () => {
    const r = parseHorarioCode('26N34');
    expect(r).toEqual([
      { dia: 'seg', inicio: '20:50', fim: '22:30' },
      { dia: 'sex', inicio: '20:50', fim: '22:30' },
    ]);
  });

  it('separa blocos não-consecutivos (3N13 → ter 19:00-19:50 + ter 20:50-21:40)', () => {
    const r = parseHorarioCode('3N13');
    expect(r).toEqual([
      { dia: 'ter', inicio: '19:00', fim: '19:50' },
      { dia: 'ter', inicio: '20:50', fim: '21:40' },
    ]);
  });

  it('decodifica 35T45 (ter+qui, tarde aulas 4 e 5)', () => {
    // Grade oficial UnB: T4=16:00-16:55, T5=16:55-17:50 — bate com a TABELA
    // DE HORÁRIOS impressa na fixture real (ENM0128 no slot 16:00-16:55).
    const r = parseHorarioCode('35T45');
    expect(r).toEqual([
      { dia: 'ter', inicio: '16:00', fim: '17:50' },
      { dia: 'qui', inicio: '16:00', fim: '17:50' },
    ]);
  });

  it('decodifica 24N12 (seg+qua, noturno aulas 1 e 2)', () => {
    const r = parseHorarioCode('24N12');
    expect(r).toEqual([
      { dia: 'seg', inicio: '19:00', fim: '20:40' },
      { dia: 'qua', inicio: '19:00', fim: '20:40' },
    ]);
  });

  it('rejeita código inválido', () => {
    expect(parseHorarioCode('xxx')).toEqual([]);
    expect(parseHorarioCode('26X34')).toEqual([]);
    expect(parseHorarioCode('')).toEqual([]);
  });

  it('domingo (1) é ignorado silenciosamente — não temos no enum', () => {
    const r = parseHorarioCode('1N1');
    expect(r).toEqual([]);
  });

  it('combina dias úteis e sábado (267N1 → seg+sex+sab)', () => {
    const r = parseHorarioCode('267N1');
    expect(r).toEqual([
      { dia: 'seg', inicio: '19:00', fim: '19:50' },
      { dia: 'sex', inicio: '19:00', fim: '19:50' },
      { dia: 'sab', inicio: '19:00', fim: '19:50' },
    ]);
  });

  it('UNB_TURNOS tem 3 turnos e aulas numeradas', () => {
    expect(Object.keys(UNB_TURNOS)).toEqual(['M', 'T', 'N']);
    expect(UNB_TURNOS.M[1].inicio).toBe('08:00');
    expect(UNB_TURNOS.N[4].fim).toBe('22:30');
  });

  it('UNB_TURNOS.T segue a grade oficial (7 slots, T1=12:55)', () => {
    expect(Object.keys(UNB_TURNOS.T)).toHaveLength(7);
    expect(UNB_TURNOS.T[1]).toEqual({ inicio: '12:55', fim: '13:50' });
    expect(UNB_TURNOS.T[4]).toEqual({ inicio: '16:00', fim: '16:55' });
    expect(UNB_TURNOS.T[7]).toEqual({ inicio: '18:55', fim: '19:50' });
  });
});

// =============================================================
// parseSigaaAtestado — fixture real do Theo
// =============================================================
const FIXTURE_THEO_2026_1 = `
Sistema Integrado de Gestão de Atividades Acadêmicas
EMITIDO EM 28/05/2026 14:58

ATESTADO DE MATRÍCULA

Período Letivo: 2026.1 (16/03/2026 à 18/07/2026)    Nível: GRADUAÇÃO
Matrícula: 232013096                                  Vínculo: REGULAR
Nome: THEO FREIRE MURAHOVSCHI
Curso: ENGENHARIA DE PRODUÇÃO/EPR - BACHARELADO - NOTURNO

TURMAS MATRICULADAS: 7
Cód. Componentes Curriculares/Docentes Turma Status Horário

IFD0179 FISICA 3   01    MATRICULADO(A)   26N34
FABIO MENEZES DE SOUZA LIMA
Tipo: DISCIPLINA  Local: ICC AT 117

MUS0761 HISTÓRIA DA MÚSICA 3    03    MATRICULADO(A)   3N34
RENAN VENTURA PEREIRA
Tipo: DISCIPLINA Local: SG2 - 71/5

MUS0765 INSTRUMENTO SUPLEMENTAR VIOLÃO 1    03    MATRICULADO(A)   6N12
ALESSANDRO BORGES CORDEIRO
Tipo: DISCIPLINA Local: SG4 - Sala Samambaia

ECO0019 INTRODUÇÃO À ECONOMIA   17    MATRICULADO(A)   24N12
PEDRO GABRIEL EDUARD VALERA MILWARD MEINERS
Tipo: DISCIPLINA  Local: BSA N A1 22/4

EPR0073 PROJETO DE SISTEMAS DE PRODUÇÃO 2   02    MATRICULADO(A)   5N34
MARCIA TEREZINHA LONGEN ZINDEL
Tipo: DISCIPLINA  Local: DT 25/15

EPR0072 SISTEMAS DE INFORMAÇÃO EM ENGENHARIA DE PRODUÇÃO   01    MATRICULADO(A)   35N12
EDGARD COSTA OLIVEIRA
Tipo: DISCIPLINA Local: Sala 05 ULEG-FT

ENM0128 TRANSPORTE DE CALOR E MASSA   01    MATRICULADO(A)   35T45
EDGAR AMARAL SILVEIRA
Tipo: DISCIPLINA  Local: FT - DT 16/15 (CORREDOR ENM)

TABELA DE HORÁRIOS:
`;

describe('parseSigaaAtestado — fixture Theo 2026.1', () => {
  const r = parseSigaaAtestado(FIXTURE_THEO_2026_1);

  it('extrai cabeçalho', () => {
    expect(r.nome_aluno).toBe('THEO FREIRE MURAHOVSCHI');
    expect(r.matricula).toBe('232013096');
    expect(r.curso).toContain('ENGENHARIA DE PRODUÇÃO');
    expect(r.semestre).toBe('2026.1');
    expect(r.periodo_inicio).toBe('2026-03-16');
    expect(r.periodo_fim).toBe('2026-07-18');
  });

  it('extrai 7 matérias', () => {
    expect(r.materias).toHaveLength(7);
  });

  it('FISICA 3 — código + nome + turma + horário', () => {
    const m = r.materias.find((m) => m.code === 'IFD0179');
    expect(m).toBeDefined();
    expect(m?.nome).toBe('FISICA 3');
    expect(m?.turma).toBe('01');
    expect(m?.codigo_horario_sigaa).toBe('26N34');
    expect(m?.local).toBe('ICC AT 117');
    expect(m?.professor).toBe('FABIO MENEZES DE SOUZA LIMA');
    expect(m?.horarios).toEqual([
      { dia: 'seg', inicio: '20:50', fim: '22:30' },
      { dia: 'sex', inicio: '20:50', fim: '22:30' },
    ]);
  });

  it('INTRODUÇÃO À ECONOMIA (com acentos no nome)', () => {
    const m = r.materias.find((m) => m.code === 'ECO0019');
    expect(m?.nome).toContain('ECONOMIA');
    expect(m?.codigo_horario_sigaa).toBe('24N12');
    expect(m?.local).toBe('BSA N A1 22/4');
  });

  it('TRANSPORTE DE CALOR E MASSA (turno tarde)', () => {
    const m = r.materias.find((m) => m.code === 'ENM0128');
    expect(m?.codigo_horario_sigaa).toBe('35T45');
    expect(m?.horarios).toEqual([
      { dia: 'ter', inicio: '16:00', fim: '17:50' },
      { dia: 'qui', inicio: '16:00', fim: '17:50' },
    ]);
  });

  it('todos os códigos foram extraídos (sem warnings de código não decodificado)', () => {
    const codesProblema = r.warnings.filter((w) => w.includes('não pôde ser decodificado'));
    expect(codesProblema).toEqual([]);
  });
});

describe('parseSigaaAtestado — edge cases', () => {
  it('texto vazio retorna materias=[] com warning', () => {
    const r = parseSigaaAtestado('');
    expect(r.materias).toEqual([]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('disciplina multi-turno: captura TODOS os códigos de horário (2M34 4T12)', () => {
    // Antes só o primeiro código era decodificado — o bloco da tarde sumia
    // silenciosamente. Auditoria 2026-06-10 (PKG-SHARED-03).
    const r = parseSigaaAtestado(`
TURMAS MATRICULADAS: 1
EPR0999 LABORATÓRIO DE PRODUÇÃO   01    MATRICULADO(A)   2M34 4T12
MARIA HELENA DOS SANTOS SILVA
Tipo: DISCIPLINA  Local: FT - DT 10/1
`);
    expect(r.materias).toHaveLength(1);
    const m = r.materias[0];
    expect(m.nome).toBe('LABORATÓRIO DE PRODUÇÃO');
    expect(m.codigo_horario_sigaa).toBe('2M34 4T12');
    expect(m.horarios).toEqual([
      { dia: 'seg', inicio: '10:00', fim: '11:50' },   // 2M34 → M3+M4
      { dia: 'qua', inicio: '12:55', fim: '14:55' },   // 4T12 → T1+T2
    ]);
    const codesProblema = r.warnings.filter((w) => w.includes('não pôde ser decodificado'));
    expect(codesProblema).toEqual([]);
  });

  it('disciplina multi-turno em layout pdf-parse (códigos em linha separada)', () => {
    const r = parseSigaaAtestado(`
TURMAS MATRICULADAS: 1
EPR0999
LABORATÓRIO DE PRODUÇÃO
MARIA HELENA DOS SANTOS SILVA
Tipo: DISCIPLINA
Local: FT - DT 10/1
01
MATRICULADO(A)
2M34 4T12
TABELA DE HORÁRIOS:
`);
    expect(r.materias).toHaveLength(1);
    const m = r.materias[0];
    expect(m.nome).toBe('LABORATÓRIO DE PRODUÇÃO');
    expect(m.professor).toBe('MARIA HELENA DOS SANTOS SILVA');
    expect(m.codigo_horario_sigaa).toBe('2M34 4T12');
    expect(m.horarios).toHaveLength(2);
  });

  it('texto sem cabeçalho mas com bloco de matérias funciona parcial', () => {
    const r = parseSigaaAtestado(`
TURMAS MATRICULADAS: 1
IFD0179 FISICA 3   01    MATRICULADO(A)   26N34
FABIO MENEZES
Tipo: DISCIPLINA  Local: ICC AT 117
`);
    expect(r.materias).toHaveLength(1);
    expect(r.nome_aluno).toBeNull();
    expect(r.materias[0].code).toBe('IFD0179');
  });
});

// =============================================================
// Fixture simulando output do pdf-parse no Deno
// — cada célula da tabela vira uma linha separada
// =============================================================
const FIXTURE_PDF_PARSE_STYLE = `
UNIVERSIDADE DE BRASÍLIA
SISTEMA INTEGRADO DE GESTÃO DE ATIVIDADES ACADÊMICAS
EMITIDO EM 28/05/2026 14:58
ATESTADO DE MATRÍCULA
Período Letivo: 2026.1 (16/03/2026 à 18/07/2026)
Nível:
GRADUAÇÃO
Matrícula:
232013096
Vínculo:
REGULAR
Nome:
THEO FREIRE MURAHOVSCHI
Curso:
ENGENHARIA DE PRODUÇÃO/EPR - BACHARELADO - NOTURNO
TURMAS MATRICULADAS: 7
Cód.
Componentes Curriculares/Docentes
Turma
Status
Horário
IFD0179
FISICA 3
FABIO MENEZES DE SOUZA LIMA
Tipo: DISCIPLINA
Local: ICC AT 117
01
MATRICULADO(A)
26N34
MUS0761
HISTÓRIA DA MÚSICA 3
RENAN VENTURA PEREIRA
Tipo: DISCIPLINA
Local: SG2 - 71/5
03
MATRICULADO(A)
3N34 (16/03/2026 -
18/07/2026)
MUS0765
INSTRUMENTO SUPLEMENTAR VIOLÃO 1
ALESSANDRO BORGES CORDEIRO
Tipo: DISCIPLINA
Local: SG4 - Sala Samambaia
03
MATRICULADO(A)
6N12 (16/03/2026 -
18/07/2026)
ECO0019
INTRODUÇÃO À ECONOMIA
PEDRO GABRIEL EDUARD VALERA MILWARD MEINERS
Tipo: DISCIPLINA
Local: BSA N A1 22/4
17
MATRICULADO(A)
24N12 (16/03/2026 -
18/07/2026)
EPR0073
PROJETO DE SISTEMAS DE PRODUÇÃO 2
MARCIA TEREZINHA LONGEN ZINDEL
Tipo: DISCIPLINA
Local: DT 25/15
02
MATRICULADO(A)
5N34 (16/03/2026 -
18/07/2026)
EPR0072
SISTEMAS DE INFORMAÇÃO EM ENGENHARIA DE
PRODUÇÃO
EDGARD COSTA OLIVEIRA
Tipo: DISCIPLINA
Local: Sala 05 ULEG-FT
01
MATRICULADO(A)
35N12 (16/03/2026 -
18/07/2026)
ENM0128
TRANSPORTE DE CALOR E MASSA
EDGAR AMARAL SILVEIRA
Tipo: DISCIPLINA
Local: FT - DT 16/15 (CORREDOR ENM)
01
MATRICULADO(A)
35T45
TABELA DE HORÁRIOS:
`;

// =============================================================
// Fixture REAL — texto exato extraído pelo pdf-parse@1.1.1 do PDF do Theo
// (capturado rodando a lib localmente em 28/05/2026). Código COLADO no nome.
// =============================================================
const FIXTURE_PDF_PARSE_REAL = "\n\n28/05/26, 14:59Sistema Integrado de Gestão de Atividades Acadêmicas\nPage 1 of 2https://sigaa.unb.br/sigaa/portais/discente/discente.jsf#\nPortal Discente\nUNIVERSIDADE DE BRASÍLIA\nSISTEMA INTEGRADO DE GESTÃO DE ATIVIDADES ACADÊMICAS\nEMITIDO EM 28/05/2026 14:58\nATESTADO DE MATRÍCULA\nPeríodo Letivo:2026.1 (16/03/2026 à 18/07/2026)Nível:GRADUAÇÃO\nMatrícula:232013096Vínculo:REGULAR\nNome:THEO FREIRE MURAHOVSCHI\nCurso:ENGENHARIA DE PRODUÇÃO/EPR - BACHARELADO - NOTURNO\nTURMAS MATRICULADAS: 7\nCód.Componentes Curriculares/DocentesTurmaStatusHorário\nIFD0179FISICA 3\nFABIO MENEZES DE SOUZA LIMA\nTipo: DISCIPLINA Local: ICC AT 117\n01\nMATRICULADO(A)\n26N34\nMUS0761HISTÓRIA DA MÚSICA 3\nRENAN VENTURA PEREIRA\nTipo: DISCIPLINA Local: SG2 - 71/5\n03\nMATRICULADO(A)\n3N34 (16/03/2026 -\n18/07/2026)\nMUS0765INSTRUMENTO SUPLEMENTAR VIOLÃO 1\nALESSANDRO BORGES CORDEIRO\nTipo: DISCIPLINA Local: SG4 - Sala Samambaia\n03\nMATRICULADO(A)\n6N12 (16/03/2026 -\n18/07/2026)\nECO0019INTRODUÇÃO À ECONOMIA\nPEDRO GABRIEL EDUARD VALERA MILWARD MEINERS\nTipo: DISCIPLINA Local: BSA N A1 22/4\n17\nMATRICULADO(A)\n24N12 (16/03/2026 -\n18/07/2026)\nEPR0073PROJETO DE SISTEMAS DE PRODUÇÃO 2\nMARCIA TEREZINHA LONGEN ZINDEL\nTipo: DISCIPLINA Local: DT 25/15\n02\nMATRICULADO(A)\n5N34 (16/03/2026 -\n18/07/2026)\nEPR0072SISTEMAS DE INFORMAÇÃO EM ENGENHARIA DE\nPRODUÇÃO\nEDGARD COSTA OLIVEIRA\nTipo: DISCIPLINA Local: Sala 05 ULEG-FT\n01\nMATRICULADO(A)\n35N12 (16/03/2026 -\n18/07/2026)\nENM0128TRANSPORTE DE CALOR E MASSA\nEDGAR AMARAL SILVEIRA\nTipo: DISCIPLINA Local: FT - DT 16/15 (CORREDOR ENM)\n01\nMATRICULADO(A)\n35T45\nTABELA DE HORÁRIOS:\nHoráriosDomSegTerQuaQuiSexSab\n16:00 -\n16:55\n------ENM0128---ENM0128------";

describe('parseSigaaAtestado — texto REAL do pdf-parse (código colado no nome)', () => {
  const r = parseSigaaAtestado(FIXTURE_PDF_PARSE_REAL);

  it('extrai cabeçalho mesmo com campos colados (Nome:THEO...)', () => {
    expect(r.nome_aluno).toBe('THEO FREIRE MURAHOVSCHI');
    expect(r.matricula).toBe('232013096');
    expect(r.semestre).toBe('2026.1');
    expect(r.curso).toContain('ENGENHARIA DE PRODUÇÃO');
  });

  it('extrai as 7 matérias (código colado no nome)', () => {
    expect(r.materias).toHaveLength(7);
    expect(r.materias.map((m) => m.code)).toEqual(
      ['IFD0179', 'MUS0761', 'MUS0765', 'ECO0019', 'EPR0073', 'EPR0072', 'ENM0128']
    );
  });

  it('IFD0179 — nome "FISICA 3" separado do código, professor e local corretos', () => {
    const m = r.materias.find((m) => m.code === 'IFD0179')!;
    expect(m.nome).toBe('FISICA 3');
    expect(m.professor).toBe('FABIO MENEZES DE SOUZA LIMA');
    expect(m.local).toBe('ICC AT 117');
    expect(m.codigo_horario_sigaa).toBe('26N34');
    expect(m.turma).toBe('01');
  });

  it('EPR0072 — nome de 2 linhas reconstruído', () => {
    const m = r.materias.find((m) => m.code === 'EPR0072')!;
    expect(m.nome).toContain('SISTEMAS DE INFORMAÇÃO');
    expect(m.nome).toContain('PRODUÇÃO');
    expect(m.professor).toBe('EDGARD COSTA OLIVEIRA');
  });

  it('ECO0019 — nome com acento, professor longo', () => {
    const m = r.materias.find((m) => m.code === 'ECO0019')!;
    expect(m.nome).toBe('INTRODUÇÃO À ECONOMIA');
    expect(m.professor).toContain('PEDRO GABRIEL');
    expect(m.codigo_horario_sigaa).toBe('24N12');
  });

  it('todos têm horário decodificado', () => {
    for (const m of r.materias) {
      expect(m.codigo_horario_sigaa).toBeTruthy();
      expect(m.horarios.length).toBeGreaterThan(0);
    }
  });
});

describe('parseSigaaAtestado — layout pdf-parse (linhas soltas)', () => {
  const r = parseSigaaAtestado(FIXTURE_PDF_PARSE_STYLE);

  it('extrai cabeçalho', () => {
    expect(r.nome_aluno).toBe('THEO FREIRE MURAHOVSCHI');
    expect(r.matricula).toBe('232013096');
    expect(r.curso).toContain('ENGENHARIA DE PRODUÇÃO');
    expect(r.semestre).toBe('2026.1');
    expect(r.periodo_inicio).toBe('2026-03-16');
  });

  it('extrai 7 matérias mesmo com linhas soltas', () => {
    expect(r.materias).toHaveLength(7);
    const codes = r.materias.map((m) => m.code);
    expect(codes).toEqual(['IFD0179', 'MUS0761', 'MUS0765', 'ECO0019', 'EPR0073', 'EPR0072', 'ENM0128']);
  });

  it('FISICA 3 — código de horário extraído corretamente (26N34)', () => {
    const m = r.materias.find((m) => m.code === 'IFD0179');
    expect(m?.codigo_horario_sigaa).toBe('26N34');
    expect(m?.horarios.length).toBeGreaterThan(0);
  });

  it('professor é extraído mesmo em linha separada', () => {
    const fisica = r.materias.find((m) => m.code === 'IFD0179');
    expect(fisica?.professor).toBe('FABIO MENEZES DE SOUZA LIMA');
    const eco = r.materias.find((m) => m.code === 'ECO0019');
    expect(eco?.professor).toContain('PEDRO');
  });

  it('local é extraído após "Local:" mesmo em linha separada', () => {
    const fisica = r.materias.find((m) => m.code === 'IFD0179');
    expect(fisica?.local).toBe('ICC AT 117');
  });

  it('código de horário com período entre parênteses funciona (3N34 (16/03/...))', () => {
    const hist = r.materias.find((m) => m.code === 'MUS0761');
    expect(hist?.codigo_horario_sigaa).toBe('3N34');
    expect(hist?.horarios).toEqual([
      { dia: 'ter', inicio: '20:50', fim: '22:30' },
    ]);
  });

  it('ENM0128 — turno tarde (35T45)', () => {
    const enm = r.materias.find((m) => m.code === 'ENM0128');
    expect(enm?.codigo_horario_sigaa).toBe('35T45');
  });
});
