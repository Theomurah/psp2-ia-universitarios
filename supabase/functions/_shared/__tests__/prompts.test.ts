/**
 * T15 — testes do template engine de prompts.
 */

import { describe, it, expect } from 'vitest';
import {
  renderPrompt,
  applyPersonalizedSystem,
  SYSTEM_PROMPT_CLASSIFY,
  SYSTEM_PROMPT_SYNTHESIZE,
  SYSTEM_PROMPT_COMPRESS,
} from '../prompts.ts';

describe('renderPrompt', () => {
  it('substitui placeholders {{var}} por valor', () => {
    const out = renderPrompt('Olá {{nome}}, semestre {{semestre}}.', {
      nome: 'Theo',
      semestre: '2026.1',
    });
    expect(out).toBe('Olá Theo, semestre 2026.1.');
  });

  it('substitui null/undefined por string vazia', () => {
    expect(renderPrompt('a [{{x}}] b', { x: null })).toBe('a [] b');
    expect(renderPrompt('a [{{x}}] b', {})).toBe('a [] b');
  });

  it('mantém literais que não são placeholders', () => {
    const out = renderPrompt('Use { não } e {{ok}}', { ok: 'sim' });
    expect(out).toContain('Use { não }');
    expect(out).toContain('sim');
  });

  it('aceita números convertidos pra string', () => {
    const out = renderPrompt('{{n}} itens', { n: '42' });
    expect(out).toBe('42 itens');
  });
});

describe('applyPersonalizedSystem (H7)', () => {
  const base = 'SISTEMA BASE\n\n<<DOC>> regras';

  it('devolve o base inalterado quando não há prompt (zero mudança)', () => {
    expect(applyPersonalizedSystem(base)).toBe(base);
    expect(applyPersonalizedSystem(base, null)).toBe(base);
    expect(applyPersonalizedSystem(base, '')).toBe(base);
    expect(applyPersonalizedSystem(base, '   ')).toBe(base);
  });

  it('prepende o prompt personalizado antes do base', () => {
    const out = applyPersonalizedSystem(base, 'Você é tutor de Física 3.');
    expect(out).toBe(`Você é tutor de Física 3.\n\n${base}`);
    expect(out.indexOf('Física 3')).toBeLessThan(out.indexOf('SISTEMA BASE'));
  });

  it('faz trim do prompt personalizado', () => {
    expect(applyPersonalizedSystem(base, '  Contexto.  ')).toBe(`Contexto.\n\n${base}`);
  });
});

describe('SYSTEM_PROMPT_CLASSIFY', () => {
  it('contém placeholders esperados pelo pipeline.ts', () => {
    expect(SYSTEM_PROMPT_CLASSIFY).toContain('{{semestre}}');
    expect(SYSTEM_PROMPT_CLASSIFY).toContain('{{lista_materias}}');
  });

  it('exige OUTPUT JSON estrito (sem markdown)', () => {
    expect(SYSTEM_PROMPT_CLASSIFY).toMatch(/JSON/);
    expect(SYSTEM_PROMPT_CLASSIFY).toMatch(/Sem prosa/);
  });
});

describe('SYSTEM_PROMPT_SYNTHESIZE', () => {
  it('contém todos os placeholders contextuais', () => {
    const required = ['{{semestre}}', '{{materia_code}}', '{{materia_nome}}', '{{tipo}}', '{{titulo}}', '{{fonte}}'];
    for (const ph of required) {
      expect(SYSTEM_PROMPT_SYNTHESIZE).toContain(ph);
    }
  });

  it('reforça regras de preservação (LaTeX, tabelas, dados)', () => {
    expect(SYSTEM_PROMPT_SYNTHESIZE).toMatch(/LaTeX/);
    expect(SYSTEM_PROMPT_SYNTHESIZE).toMatch(/fórmulas?/i);
  });
});

describe('SYSTEM_PROMPT_COMPRESS', () => {
  it('contém placeholder {{modo}} e descreve compacta/cola', () => {
    expect(SYSTEM_PROMPT_COMPRESS).toContain('{{modo}}');
    expect(SYSTEM_PROMPT_COMPRESS).toMatch(/compacta/i);
    expect(SYSTEM_PROMPT_COMPRESS).toMatch(/cola/i);
  });

  it('regras de preservação incluem fórmulas e cabeçalho', () => {
    expect(SYSTEM_PROMPT_COMPRESS).toMatch(/fórmulas/i);
    expect(SYSTEM_PROMPT_COMPRESS).toMatch(/cabeçalho|frontmatter/i);
  });
});
