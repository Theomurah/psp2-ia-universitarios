/**
 * T15 — testes das 3 camadas baratas de validação (estrutural, quantitativa, semântica).
 * A camada 4 (LLM-as-judge) precisa OpenRouter e fica fora deste suite.
 */

import { describe, it, expect } from 'vitest';
import {
  validateStructural,
  validateClassification,
  validateQuantitative,
  validateSemantic,
  decideVerdict,
} from '../validation.ts';
import type { ClassificationResult } from '../../../../packages/shared/src/types.ts';

const VALID_HEADER_MARKDOWN = `FISICA3 | Aula | 12 — Lei de Coulomb
Fonte: Apostila
Semestre: 2026.1
Tópicos: campo, carga, distância

# Lei de Coulomb

## 1. Enunciado

A força entre cargas vale $$F = k \\frac{q_1 q_2}{r^2}$$.

## 2. Exemplo

Considere $q_1 = 1\\mu C$ e $q_2 = 2\\mu C$.`;

describe('validateStructural', () => {
  it('passa quando markdown tem cabeçalho fixo + H1 + 2 H2', () => {
    const r = validateStructural(VALID_HEADER_MARKDOWN);
    expect(r.passed).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.score).toBe(1.0);
  });

  it('falha quando não há cabeçalho fixo (linha com pipes)', () => {
    const r = validateStructural('# Só título\n\n## Seção');
    expect(r.passed).toBe(false);
    expect(r.errors.some((e) => e.includes('Cabeçalho'))).toBe(true);
  });

  it('falha quando não há H1', () => {
    const md = `FISICA3 | Aula | x
Fonte: x
Semestre: 2026.1

## Só H2`;
    const r = validateStructural(md);
    expect(r.errors.some((e) => e.includes('H1'))).toBe(true);
  });

  it('warning quando só 1 H2', () => {
    const md = `FISICA3 | Aula | x
Fonte: x
Semestre: 2026.1

# Título

## Única`;
    const r = validateStructural(md);
    expect(r.warnings.some((w) => w.includes('H2'))).toBe(true);
  });
});

describe('validateClassification', () => {
  const base: ClassificationResult = {
    materia_code: 'FISICA3',
    tipo: 'Aula',
    data: '2026-04-15',
    identificador: '12',
    titulo: 'Lei de Coulomb',
    confianca: 0.9,
    razao: 'match exato no texto',
  };

  it('passa com confiança alta (≥ 0.7)', () => {
    const r = validateClassification(base);
    expect(r.passed).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it('warning entre 0.4 e 0.7 (needs_review)', () => {
    const r = validateClassification({ ...base, confianca: 0.55 });
    expect(r.passed).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('falha com confiança < 0.4', () => {
    const r = validateClassification({ ...base, confianca: 0.3 });
    expect(r.passed).toBe(false);
    expect(r.errors[0]).toMatch(/0\.30/);
  });
});

describe('validateQuantitative', () => {
  it('synthesis dentro da faixa de ratio passa sem warning', () => {
    const r = validateQuantitative({
      chars_input: 10_000,
      chars_output: 3_000, // ratio 0.30 — dentro de [0.20, 0.50]
      modo: 'synthesis',
    });
    expect(r.passed).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it('synthesis com ratio fora da faixa → warning', () => {
    const r = validateQuantitative({
      chars_input: 10_000,
      chars_output: 6_000, // ratio 0.60 — fora
      modo: 'synthesis',
    });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('compressão com perda de fórmulas → erro', () => {
    const r = validateQuantitative({
      chars_input: 5000,
      chars_output: 3000,
      formulas_input: 5,
      formulas_output: 3,
      modo: 'compact',
    });
    expect(r.passed).toBe(false);
    expect(r.errors[0]).toMatch(/fórmula/i);
  });
});

describe('validateSemantic', () => {
  it('preserva keywords → score alto', () => {
    const original =
      'A lei de Coulomb descreve a força entre cargas elétricas pontuais. ' +
      'A constante de Coulomb relaciona força, carga e distância. ' +
      'Cargas elétricas geram campo elétrico. Coulomb e campo são conceitos centrais.';
    const output =
      'Lei de Coulomb. Força entre cargas elétricas. Constante de Coulomb. ' +
      'Cargas geram campo elétrico. Distância importa. Conceitos centrais.';

    const r = validateSemantic(original, output);
    expect(r.score).toBeGreaterThan(0.5);
  });

  it('keywords totalmente ausentes → score zero ou baixo', () => {
    const original = 'Termodinâmica entropia entalpia gibbs energia livre potencial químico';
    const output = 'lorem ipsum dolor sit amet consectetur';

    const r = validateSemantic(original, output);
    expect(r.score).toBeLessThan(0.5);
    expect(r.passed).toBe(false);
  });

  it('texto vazio retorna score 1.0 (caso degenerado controlado)', () => {
    const r = validateSemantic('', '');
    expect(r.score).toBe(1.0);
  });
});

describe('decideVerdict', () => {
  it('passed quando nenhum erro nem warning', () => {
    expect(decideVerdict([{ passed: true, layer: 'structural', score: 1, warnings: [], errors: [] }])).toBe('passed');
  });

  it('warning quando há warning sem erro', () => {
    expect(
      decideVerdict([{ passed: true, layer: 'quantitative', score: 0.9, warnings: ['ratio'], errors: [] }]),
    ).toBe('warning');
  });

  it('rejected quando há erro em qualquer camada', () => {
    expect(
      decideVerdict([
        { passed: true, layer: 'structural', score: 1, warnings: [], errors: [] },
        { passed: false, layer: 'semantic', score: 0.3, warnings: [], errors: ['baixa fidelidade'] },
      ]),
    ).toBe('rejected');
  });
});
