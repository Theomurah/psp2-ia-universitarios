/**
 * Testes do núcleo de geração de flashcards por IA (Fase 6): montagem do prompt
 * (com sandbox) e parsing/validação da resposta do LLM.
 */

import { describe, it, expect } from 'vitest';
import {
  buildFlashcardMessages,
  parseFlashcardsResponse,
  clampCount,
  MAX_GEN_CARDS,
  MAX_INPUT_CHARS,
} from '../flashcard-prompt.ts';

describe('clampCount', () => {
  it('mantém valores válidos e arredonda pra baixo', () => {
    expect(clampCount(10)).toBe(10);
    expect(clampCount(10.9)).toBe(10);
  });
  it('limita ao intervalo [1, MAX_GEN_CARDS]', () => {
    expect(clampCount(0)).toBe(1);
    expect(clampCount(-5)).toBe(1);
    expect(clampCount(999)).toBe(MAX_GEN_CARDS);
  });
  it('NaN cai no default 10', () => {
    expect(clampCount(NaN)).toBe(10);
  });
});

describe('buildFlashcardMessages', () => {
  it('retorna system + user e sandboxa o material', () => {
    const msgs = buildFlashcardMessages('Conteúdo de física.', 'P1 de mecânica', 5);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
    const user = msgs[1].content as string;
    expect(user).toContain('<<DOC>>'); // material vai dentro do envelope
    expect(user).toContain('P1 de mecânica');
    expect(user).toContain('5');
  });

  it('instrui LaTeX e JSON no system', () => {
    const sys = buildFlashcardMessages('x', 'y', 3)[0].content as string;
    expect(sys).toContain('$$');
    expect(sys).toMatch(/json/i);
    expect(sys).toContain('cards');
  });

  it('trunca material gigante a MAX_INPUT_CHARS', () => {
    const huge = 'a'.repeat(MAX_INPUT_CHARS + 5000);
    const user = buildFlashcardMessages(huge, 'ctx', 10)[1].content as string;
    // O envelope adiciona marcadores, mas o miolo não pode passar do teto.
    expect(user.length).toBeLessThan(MAX_INPUT_CHARS + 500);
  });

  it('usa contexto default quando vazio', () => {
    const user = buildFlashcardMessages('material', '', 4)[1].content as string;
    expect(user).toContain('Cartões gerais');
  });
});

describe('parseFlashcardsResponse', () => {
  const valid = JSON.stringify({
    cards: [
      { front: 'Derivada de $x^2$?', back: '$$2x$$', topico: 'Derivadas', tags: ['cálculo'] },
      { front: 'Capital?', back: 'Brasília', topico: null, tags: [] },
    ],
  });

  it('parseia {cards:[...]}', () => {
    const out = parseFlashcardsResponse(valid);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ front: 'Derivada de $x^2$?', back: '$$2x$$', topico: 'Derivadas' });
    expect(out[1].topico).toBeNull();
  });

  it('aceita array cru e cercas de código', () => {
    const fenced = '```json\n[{"front":"A","back":"B"}]\n```';
    const out = parseFlashcardsResponse(fenced);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ front: 'A', back: 'B', topico: null, tags: [] });
  });

  it('descarta cartões sem frente ou verso', () => {
    const out = parseFlashcardsResponse(JSON.stringify({ cards: [
      { front: 'só frente', back: '' },
      { front: '', back: 'só verso' },
      { front: 'ok', back: 'ok' },
    ] }));
    expect(out).toHaveLength(1);
    expect(out[0].front).toBe('ok');
  });

  it('limita ao max e normaliza tags', () => {
    const many = { cards: Array.from({ length: 10 }, (_, i) => ({ front: `f${i}`, back: `b${i}`, tags: ['a', 2, '', 'b'] })) };
    const out = parseFlashcardsResponse(JSON.stringify(many), 3);
    expect(out).toHaveLength(3);
    expect(out[0].tags).toEqual(['a', 'b']); // strings não-vazias só
  });

  it('retorna [] em JSON inválido', () => {
    expect(parseFlashcardsResponse('não é json')).toEqual([]);
    expect(parseFlashcardsResponse('{"cards": "errado"}')).toEqual([]);
  });
});
