/**
 * Testes do scheduler SRS (frente 1.7). Cobre learning steps, graduação,
 * crescimento de intervalo em review, ajuste de ease por nota, lapse →
 * relearning e os clamps (ease mínimo, intervalo mínimo).
 */

import { describe, it, expect } from 'vitest';
import {
  initialState,
  review,
  isDue,
  previewSchedule,
  formatDueIn,
  DEFAULT_SRS_CONFIG,
  type SchedulingState,
} from '../srs.ts';

const NOW = 1_750_000_000_000; // epoch fixo p/ determinismo
const MIN = 60_000;
const DAY = 86_400_000;
const cfg = DEFAULT_SRS_CONFIG;

/** Atalho: cria um cartão já graduado em review com o intervalo dado. */
function reviewCard(intervalDays: number, ease = 2.5): SchedulingState {
  return {
    state: 'review',
    ease,
    intervalDays,
    repetitions: 3,
    lapses: 0,
    learningStep: 0,
    dueAt: NOW,
  };
}

describe('initialState / isDue', () => {
  it('cria cartão novo vencido imediatamente', () => {
    const s = initialState(NOW);
    expect(s.state).toBe('new');
    expect(s.ease).toBe(2.5);
    expect(s.intervalDays).toBe(0);
    expect(isDue(s, NOW)).toBe(true);
  });
});

describe('learning steps (cartão novo)', () => {
  it('Bom avança pelos passos [1, 10] e depois gradua pra review', () => {
    const s0 = initialState(NOW);

    // 1º Bom: passo 0 → passo 1 (10 min)
    const s1 = review(s0, 'good', NOW, cfg);
    expect(s1.state).toBe('learning');
    expect(s1.learningStep).toBe(1);
    expect(s1.dueAt).toBe(NOW + 10 * MIN);

    // 2º Bom: acabaram os passos → gradua com intervalo de 1 dia
    const s2 = review(s1, 'good', NOW, cfg);
    expect(s2.state).toBe('review');
    expect(s2.intervalDays).toBe(cfg.graduatingIntervalDays);
    expect(s2.dueAt).toBe(NOW + DAY);
  });

  it('Errei reseta pro primeiro passo (1 min)', () => {
    const s0 = initialState(NOW);
    const s1 = review(s0, 'good', NOW, cfg); // passo 1
    const s2 = review(s1, 'again', NOW, cfg);
    expect(s2.state).toBe('learning');
    expect(s2.learningStep).toBe(0);
    expect(s2.dueAt).toBe(NOW + 1 * MIN);
  });

  it('Fácil gradua imediatamente com o intervalo de easy (4 dias)', () => {
    const s0 = initialState(NOW);
    const s = review(s0, 'easy', NOW, cfg);
    expect(s.state).toBe('review');
    expect(s.intervalDays).toBe(cfg.easyIntervalDays);
    expect(s.dueAt).toBe(NOW + 4 * DAY);
  });

  it('Difícil repete o passo atual sem avançar', () => {
    const s0 = initialState(NOW);
    const s = review(s0, 'hard', NOW, cfg);
    expect(s.state).toBe('learning');
    expect(s.learningStep).toBe(0);
    expect(s.dueAt).toBe(NOW + 1 * MIN);
  });
});

describe('review (cartão graduado)', () => {
  it('Bom multiplica o intervalo pelo ease', () => {
    const s = review(reviewCard(10, 2.5), 'good', NOW, cfg);
    expect(s.intervalDays).toBe(25); // 10 * 2.5
    expect(s.ease).toBe(2.5); // bom não mexe no ease
    expect(s.repetitions).toBe(4);
    expect(s.dueAt).toBe(NOW + 25 * DAY);
  });

  it('Difícil reduz o ease em 0.15 e cresce pouco', () => {
    const s = review(reviewCard(10, 2.5), 'hard', NOW, cfg);
    expect(s.ease).toBeCloseTo(2.35, 5);
    expect(s.intervalDays).toBe(12); // round(10 * 1.2)
  });

  it('Fácil aumenta o ease em 0.15 e aplica o bônus', () => {
    const s = review(reviewCard(10, 2.5), 'easy', NOW, cfg);
    expect(s.ease).toBeCloseTo(2.65, 5);
    expect(s.intervalDays).toBe(34); // round(10 * 2.65 * 1.3)
  });

  it('garante crescimento de pelo menos 1 dia', () => {
    const s = review(reviewCard(1, 1.3), 'hard', NOW, cfg);
    expect(s.intervalDays).toBeGreaterThanOrEqual(2);
  });
});

describe('lapse (Errei em review)', () => {
  it('cai pra relearning, perde ease e conta o lapse', () => {
    const s = review(reviewCard(30, 2.5), 'again', NOW, cfg);
    expect(s.state).toBe('relearning');
    expect(s.lapses).toBe(1);
    expect(s.repetitions).toBe(0);
    expect(s.ease).toBeCloseTo(2.3, 5);
    expect(s.learningStep).toBe(0);
    expect(s.dueAt).toBe(NOW + cfg.relearningStepsMin[0] * MIN);
  });

  it('Bom em relearning re-gradua pra review', () => {
    const lapsed = review(reviewCard(30, 2.5), 'again', NOW, cfg);
    const back = review(lapsed, 'good', NOW, cfg);
    expect(back.state).toBe('review');
    expect(back.intervalDays).toBeGreaterThanOrEqual(1);
    expect(back.dueAt).toBe(NOW + back.intervalDays * DAY);
  });
});

describe('clamps', () => {
  it('ease nunca cai abaixo de 1.3', () => {
    let s = reviewCard(10, 1.35);
    s = review(s, 'hard', NOW, cfg); // -0.15 levaria a 1.20
    expect(s.ease).toBe(1.3);
  });

  it('intervalo respeita o teto de maxIntervalDays', () => {
    const s = review(reviewCard(30000, 2.5), 'easy', NOW, cfg);
    expect(s.intervalDays).toBe(cfg.maxIntervalDays);
  });
});

describe('sequências realistas', () => {
  it('cartão novo → 2x Bom gradua e depois cresce a cada Bom', () => {
    let s = initialState(NOW);
    s = review(s, 'good', NOW, cfg); // learning passo 1
    s = review(s, 'good', NOW, cfg); // gradua → 1 dia
    expect(s.state).toBe('review');
    expect(s.intervalDays).toBe(1);
    s = review(s, 'good', NOW, cfg); // 1 * 2.5 → 2 (max(2.5→3? )) round(2.5)=3 vs prev+1=2 → 3
    const afterFirst = s.intervalDays;
    s = review(s, 'good', NOW, cfg);
    expect(s.intervalDays).toBeGreaterThan(afterFirst); // cresce de forma monotônica
  });

  it('dois Difícil seguidos em learning não avançam o passo', () => {
    const s0 = initialState(NOW);
    const s1 = review(s0, 'hard', NOW, cfg);
    const s2 = review(s1, 'hard', NOW, cfg);
    expect(s1.learningStep).toBe(0);
    expect(s2.learningStep).toBe(0);
    expect(s2.state).toBe('learning');
  });

  it('ciclo completo de lapse: review → Errei → relearning → Bom → review', () => {
    const mature = reviewCard(50, 2.6);
    const lapsed = review(mature, 'again', NOW, cfg);
    expect(lapsed.state).toBe('relearning');
    expect(lapsed.lapses).toBe(1);
    const recovered = review(lapsed, 'good', NOW, cfg);
    expect(recovered.state).toBe('review');
    expect(recovered.lapses).toBe(1); // lapse permanece contabilizado
    expect(recovered.ease).toBeCloseTo(2.4, 5); // perdeu 0.2 no lapse, não recupera no good
  });
});

describe('previewSchedule / formatDueIn', () => {
  it('preview retorna as 4 notas com intervalos crescentes (hard < good < easy)', () => {
    const p = previewSchedule(reviewCard(10, 2.5), NOW, cfg);
    expect(p.again.state).toBe('relearning');
    expect(p.hard.intervalDays).toBeLessThan(p.good.intervalDays);
    expect(p.good.intervalDays).toBeLessThan(p.easy.intervalDays);
  });

  it('formata o tempo até a revisão', () => {
    expect(formatDueIn({ ...reviewCard(0), dueAt: NOW }, NOW)).toBe('agora');
    expect(formatDueIn({ ...reviewCard(0), dueAt: NOW + 10 * MIN }, NOW)).toBe('10 min');
    expect(formatDueIn({ ...reviewCard(0), dueAt: NOW + 3 * DAY }, NOW)).toBe('3 d');
    expect(formatDueIn({ ...reviewCard(0), dueAt: NOW + 60 * DAY }, NOW)).toBe('2 mes');
  });
});
