/**
 * Testes do parsing de importação (Fase 4): conversão de campo Anki (HTML +
 * MathJax → markdown+LaTeX) e parsing de CSV/TSV/texto-Anki.
 */

import { describe, it, expect } from 'vitest';
import { ankiFieldToContent, parseDelimited } from '../import.ts';

describe('ankiFieldToContent', () => {
  it('converte <br> em quebra de linha e remove tags', () => {
    expect(ankiFieldToContent('Linha 1<br>Linha 2')).toBe('Linha 1\nLinha 2');
    expect(ankiFieldToContent('<b>Negrito</b> normal')).toBe('Negrito normal');
  });

  it('decodifica entidades HTML', () => {
    expect(ankiFieldToContent('a &lt; b &amp; c &#39;x&#39;')).toBe("a < b & c 'x'");
    expect(ankiFieldToContent('&nbsp;espaço')).toBe('espaço');
  });

  it('converte MathJax \\( \\) inline para $...$', () => {
    expect(ankiFieldToContent('A derivada \\(x^2\\) é...')).toBe('A derivada $x^2$ é...');
  });

  it('converte MathJax \\[ \\] bloco para $$...$$', () => {
    expect(ankiFieldToContent('\\[e^{i\\pi}+1=0\\]')).toBe('$$e^{i\\pi}+1=0$$');
  });

  it('converte shortcodes [$]..[/$] e [$$]..[/$$] do Anki', () => {
    expect(ankiFieldToContent('[$]x^2[/$]')).toBe('$x^2$');
    expect(ankiFieldToContent('[$$]\\int_a^b f[/$$]')).toBe('$$\\int_a^b f$$');
  });

  it('converte [latex]..[/latex] em bloco', () => {
    expect(ankiFieldToContent('[latex]\\frac{1}{2}[/latex]')).toBe('$$\\frac{1}{2}$$');
  });

  it('texto puro volta intacto (idempotente)', () => {
    expect(ankiFieldToContent('Apenas texto.')).toBe('Apenas texto.');
  });
});

describe('parseDelimited — CSV', () => {
  it('parseia CSV simples front,back', () => {
    const out = parseDelimited('Capital do Brasil,Brasília\n2+2,4');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ front: 'Capital do Brasil', back: 'Brasília', tags: [] });
    expect(out[1].back).toBe('4');
  });

  it('respeita aspas com vírgula e aspas escapadas', () => {
    const out = parseDelimited('"Olá, mundo","Ele disse ""oi"""');
    expect(out[0].front).toBe('Olá, mundo');
    expect(out[0].back).toBe('Ele disse "oi"');
  });

  it('pula header quando hasHeader', () => {
    const out = parseDelimited('frente,verso\nA,B', { hasHeader: true });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ front: 'A', back: 'B' });
  });

  it('ignora linhas sem 2 colunas e cartões vazios', () => {
    const out = parseDelimited('A,B\nsozinho\n,\nC,D');
    expect(out.map((c) => c.front)).toEqual(['A', 'C']);
  });
});

describe('parseDelimited — TSV e diretivas Anki', () => {
  it('auto-detecta TAB quando presente', () => {
    const out = parseDelimited('Front\tBack');
    expect(out[0]).toMatchObject({ front: 'Front', back: 'Back' });
  });

  it('lê #separator:tab e #tags column:3, ignorando comentários #', () => {
    const text = [
      '#separator:tab',
      '#html:true',
      '#tags column:3',
      '# comentário qualquer',
      'O que é uma derivada?\tA taxa de variação\tcálculo derivadas',
    ].join('\n');
    const out = parseDelimited(text);
    expect(out).toHaveLength(1);
    expect(out[0].front).toBe('O que é uma derivada?');
    expect(out[0].back).toBe('A taxa de variação');
    expect(out[0].tags).toEqual(['cálculo', 'derivadas']);
  });

  it('converte HTML/math dos campos por padrão', () => {
    const out = parseDelimited('Derivada de \\(x^2\\),<b>2x</b>');
    expect(out[0].front).toBe('Derivada de $x^2$');
    expect(out[0].back).toBe('2x');
  });
});
