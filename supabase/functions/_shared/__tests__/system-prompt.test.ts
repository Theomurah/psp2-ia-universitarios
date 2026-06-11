/**
 * T31/T32 — testes da renderização do system prompt personalizado.
 */

import { describe, it, expect } from 'vitest';
import { renderSystemPrompt, buildSemesterSnapshot } from '../system-prompt.ts';

const base = {
  full_name: 'Theo Murah',
  curso: 'Engenharia de Produção',
  semestre: '2026.1',
  materias: [
    { code: 'FISICA3', nome: 'Física 3', profs: ['Fábio Lima'] },
    { code: 'CALC2', nome: 'Cálculo 2' },
  ],
  recent_documents: [
    { materia_code: 'FISICA3', tipo: 'Aula', titulo: 'Lei de Coulomb', identificador: '12', data_doc: '2026-04-15' },
    { materia_code: 'CALC2', tipo: 'Lista', titulo: 'Derivadas Direcionais', identificador: '03', data_doc: null },
  ],
  topicos_por_materia: {
    FISICA3: ['campo elétrico', 'lei de Coulomb', 'cargas'],
    CALC2: ['derivada parcial', 'gradiente'],
  },
};

describe('renderSystemPrompt', () => {
  it('inclui nome, curso, semestre nas primeiras linhas', () => {
    const out = renderSystemPrompt(base);
    expect(out).toContain('Theo Murah');
    expect(out).toContain('Engenharia de Produção');
    expect(out).toContain('2026.1');
  });

  it('lista cada matéria com código + nome + profs quando disponíveis', () => {
    const out = renderSystemPrompt(base);
    expect(out).toContain('**FISICA3** (Física 3)');
    expect(out).toMatch(/Prof\(s\): Fábio Lima/);
    expect(out).toContain('**CALC2** (Cálculo 2)');
  });

  it('lista documentos recentes em formato uniforme', () => {
    const out = renderSystemPrompt(base);
    expect(out).toContain('FISICA3 · Aula:');
    expect(out).toContain('Lei de Coulomb');
    expect(out).toContain('CALC2 · Lista:');
  });

  it('inclui tópicos por matéria quando informados', () => {
    const out = renderSystemPrompt(base);
    expect(out).toContain('**FISICA3**: campo elétrico, lei de Coulomb, cargas');
    expect(out).toContain('**CALC2**: derivada parcial, gradiente');
  });

  it('placeholder gracioso quando sem matérias', () => {
    const out = renderSystemPrompt({ ...base, materias: [] });
    expect(out).toContain('(nenhuma matéria cadastrada)');
  });

  it('placeholder gracioso quando sem documentos', () => {
    const out = renderSystemPrompt({ ...base, recent_documents: [] });
    expect(out).toContain('(ainda sem documentos processados)');
  });

  it('placeholder gracioso quando sem tópicos', () => {
    const out = renderSystemPrompt({ ...base, topicos_por_materia: {} });
    expect(out).toContain('(nenhum tópico identificado ainda)');
  });

  it('respeita regras: LaTeX, "⚠️ COBRADO NA PROVA", não inventar', () => {
    const out = renderSystemPrompt(base);
    expect(out).toMatch(/LaTeX/);
    expect(out).toContain('⚠️ COBRADO NA PROVA');
    expect(out).toMatch(/não invente/i);
  });

  it('mesma entrada → mesma saída (determinístico)', () => {
    const a = renderSystemPrompt(base);
    const b = renderSystemPrompt(base);
    expect(a).toBe(b);
  });

  it('limita documentos recentes a 20 entradas', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      materia_code: 'X',
      tipo: 'Aula',
      titulo: `Doc ${i}`,
      identificador: String(i),
      data_doc: null,
    }));
    const out = renderSystemPrompt({ ...base, recent_documents: many });
    expect((out.match(/Doc \d+/g) ?? []).length).toBeLessThanOrEqual(20);
  });
});

describe('buildSemesterSnapshot', () => {
  it('muda quando matérias mudam', () => {
    const s1 = buildSemesterSnapshot(base);
    const s2 = buildSemesterSnapshot({
      ...base,
      materias: [...base.materias, { code: 'NEW', nome: 'Nova' }],
    });
    expect(s1).not.toBe(s2);
  });

  it('é estável independente de ordem das matérias', () => {
    const s1 = buildSemesterSnapshot(base);
    const s2 = buildSemesterSnapshot({
      ...base,
      materias: [base.materias[1], base.materias[0]],
    });
    expect(s1).toBe(s2);
  });

  it('muda quando docs recentes mudam', () => {
    const s1 = buildSemesterSnapshot(base);
    const s2 = buildSemesterSnapshot({
      ...base,
      recent_documents: [...base.recent_documents, {
        materia_code: 'OUTRO',
        tipo: 'Resumo',
        titulo: 'extra',
        identificador: 'x',
        data_doc: null,
      }],
    });
    expect(s1).not.toBe(s2);
  });
});
