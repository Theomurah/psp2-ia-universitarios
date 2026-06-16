/**
 * Teste de paridade entre as whitelists de redação dos dois loggers:
 *
 *   - canônica:  supabase/functions/_shared/log.ts   (REDACT_KEYS, privada)
 *   - espelho:   apps/web/src/lib/log.ts             (REDACT_KEYS, exportada)
 *
 * Origem: auditoria 2026-06-10 (WEB-HOOKS-LIB-08/10 — o espelho manual já
 * tinha driftado uma vez; TESTS-02, item 4 do plano priorizado).
 *
 * Abordagem: extração do literal `new Set([...])` direto do código-fonte dos
 * dois arquivos (readFileSync + regex), em vez de import. Motivo: o log.ts do
 * front importa `./supabase`, que cria o client supabase-js em import-time —
 * intestável no harness atual (o shim de supabase-js lança em createClient,
 * TESTS-01) e fora dos include patterns do vitest.config.ts. A extração
 * textual é imune a isso e tem guarda própria contra regex silenciosamente
 * quebrada (mínimo de chaves + spot-check das chaves do CLAUDE.md).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_LOG = resolve(__dirname, '../log.ts');
const FRONTEND_LOG = resolve(__dirname, '../../../../apps/web/src/lib/log.ts');

/**
 * Diferenças INTENCIONAIS documentadas no comentário do front
 * (apps/web/src/lib/log.ts): chaves só-frontend que NÃO existem na canônica.
 * Qualquer extra além destas é drift não documentado → o teste falha.
 */
const DOCUMENTED_FRONT_ONLY = new Set(['full_name', 'details', 'hint']);

/** Extrai as entradas do literal `REDACT_KEYS = new Set([...])` de um fonte. */
function extractRedactKeys(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf-8');
  const match = source.match(/REDACT_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (!match) {
    throw new Error(`REDACT_KEYS literal not found in ${filePath}`);
  }
  // Remove comentários de linha dentro do array antes de capturar as strings
  const body = match[1].replace(/\/\/[^\n]*/g, '');
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const backendKeys = extractRedactKeys(BACKEND_LOG);
const frontendKeys = extractRedactKeys(FRONTEND_LOG);
const backendSet = new Set(backendKeys);
const frontendSet = new Set(frontendKeys);

describe('REDACT_KEYS — sanidade da extração', () => {
  it('encontra um número plausível de chaves em ambos os arquivos (regex não quebrou)', () => {
    expect(backendKeys.length).toBeGreaterThanOrEqual(15);
    expect(frontendKeys.length).toBeGreaterThanOrEqual(15);
  });

  it('não há chaves duplicadas nos literais (Set deduplicaria em silêncio)', () => {
    expect(backendKeys.length).toBe(backendSet.size);
    expect(frontendKeys.length).toBe(frontendSet.size);
  });

  it('todas as chaves são lowercase — o lookup usa key.toLowerCase()', () => {
    for (const key of [...backendKeys, ...frontendKeys]) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});

describe('REDACT_KEYS — paridade front vs backend (WEB-HOOKS-LIB-08/10)', () => {
  it('toda chave da lista canônica (backend) existe no espelho do front', () => {
    const missingInFront = backendKeys.filter((k) => !frontendSet.has(k));
    // Mensagem útil no diff: lista exatamente o que driftou
    expect(missingInFront).toEqual([]);
  });

  it('extras do front são exatamente as diferenças intencionais documentadas', () => {
    const frontOnly = frontendKeys.filter((k) => !backendSet.has(k)).sort();
    expect(frontOnly).toEqual([...DOCUMENTED_FRONT_ONLY].sort());
  });
});

describe('REDACT_KEYS — chaves obrigatórias do CLAUDE.md presentes nas duas listas', () => {
  // Tabela "O que nunca logar" do CLAUDE.md: tokens, credenciais,
  // conteúdo do aluno e PII.
  const REQUIRED_EVERYWHERE = [
    'password',
    'access_token',
    'refresh_token',
    'google_refresh_token',
    'provider_token',
    'authorization',
    'cookie',
    'email',
    'markdown',
    'texto',
    'texto_bruto',
    'messages',
  ];

  it.each(REQUIRED_EVERYWHERE)('backend redige %s', (key) => {
    expect(backendSet.has(key)).toBe(true);
  });

  it.each(REQUIRED_EVERYWHERE)('frontend redige %s', (key) => {
    expect(frontendSet.has(key)).toBe(true);
  });

  it('front redige details/hint de PostgrestError (podem conter valor de linha)', () => {
    expect(frontendSet.has('details')).toBe(true);
    expect(frontendSet.has('hint')).toBe(true);
  });
});
