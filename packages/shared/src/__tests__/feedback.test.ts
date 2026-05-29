/**
 * H10 — guarda contra drift entre o enum feedback_topic do banco
 * (migration 0001) e as constantes/rótulos compartilhados.
 */

import { describe, it, expect } from 'vitest';
import { FEEDBACK_TOPICS, FEEDBACK_TOPIC_LABELS } from '../constants.ts';

// Valores exatos do enum public.feedback_topic (0001_initial_schema.sql).
const DB_ENUM = ['sintese', 'nomenclatura', 'drive', 'prompts', 'outro'];

describe('feedback topics', () => {
  it('espelha o enum feedback_topic do banco (mesmos valores)', () => {
    expect([...FEEDBACK_TOPICS].sort()).toEqual([...DB_ENUM].sort());
  });

  it('tem um rótulo não-vazio para cada tópico', () => {
    for (const t of FEEDBACK_TOPICS) {
      expect(FEEDBACK_TOPIC_LABELS[t]).toBeTruthy();
    }
  });

  it('não tem rótulos órfãos (sem tópico correspondente)', () => {
    const topicSet = new Set<string>(FEEDBACK_TOPICS);
    for (const key of Object.keys(FEEDBACK_TOPIC_LABELS)) {
      expect(topicSet.has(key)).toBe(true);
    }
  });
});
