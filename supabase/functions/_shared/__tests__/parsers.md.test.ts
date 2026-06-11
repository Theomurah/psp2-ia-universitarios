/**
 * T15 — testes do parser de MD (formato mais simples, sem deps externas).
 */

import { describe, it, expect } from 'vitest';
import { parseMd, parseDocument } from '../parsers.ts';

describe('parseMd', () => {
  it('decodifica UTF-8 e mantém estrutura', () => {
    const md = `# Título

## Seção 1

Conteúdo de exemplo com fórmula relevante para garantir
que o arquivo passe do limite mínimo de 50 caracteres.

Fórmula: $E = mc^2$`;
    const buffer = new TextEncoder().encode(md);
    const out = parseMd(buffer);

    expect(out.metadata.formato).toBe('md');
    expect(out.metadata.chars).toBeGreaterThan(0);
    expect(out.texto).toContain('Fórmula: $E = mc^2$');
    expect(out.metadata.warnings).toHaveLength(0);
  });

  it('preserva acentos e caracteres especiais', () => {
    const md = 'Função de onda: |ψ⟩ — não trivial. Ç ã õ.';
    const buffer = new TextEncoder().encode(md);
    const out = parseMd(buffer);

    expect(out.texto).toBe(md);
  });

  it('emite warning para arquivo muito curto (< 50 chars)', () => {
    const buffer = new TextEncoder().encode('curto');
    const out = parseMd(buffer);

    expect(out.metadata.warnings).toContain('Arquivo muito curto');
  });

  it('faz trim de whitespace inicial/final', () => {
    const buffer = new TextEncoder().encode('\n\n  conteúdo  \n\n');
    const out = parseMd(buffer);

    expect(out.texto).toBe('conteúdo');
  });

  it('dispatcher parseDocument routes md → parseMd', async () => {
    const buffer = new TextEncoder().encode('# Hello\n\nConteúdo de teste.');
    const out = await parseDocument(buffer, 'md');

    expect(out.metadata.formato).toBe('md');
  });
});
