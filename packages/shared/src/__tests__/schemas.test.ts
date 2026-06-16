/**
 * T15 — testes dos schemas Zod e helpers de nomenclatura (T07).
 */

import { describe, it, expect } from 'vitest';
import {
  ClassificationSchema,
  ProfileFormSchema,
  UploadRequestSchema,
  PasswordSchema,
  passwordStrength,
  buildFilenameFinal,
  buildDriveFolderPath,
  sanitizeFilename,
} from '../schemas.ts';

describe('ClassificationSchema', () => {
  const valid = {
    materia_code: 'FISICA3',
    tipo: 'Aula' as const,
    data: '2026-04-15',
    identificador: '12',
    titulo: 'Lei de Coulomb',
    confianca: 0.9,
    razao: 'match exato no texto',
  };

  it('aceita classificação válida', () => {
    expect(() => ClassificationSchema.parse(valid)).not.toThrow();
  });

  it('rejeita materia_code com minúsculas', () => {
    expect(() => ClassificationSchema.parse({ ...valid, materia_code: 'fisica3' })).toThrow();
  });

  it('rejeita data fora do formato AAAA-MM-DD', () => {
    expect(() => ClassificationSchema.parse({ ...valid, data: '15/04/2026' })).toThrow();
  });

  it('aceita data null (docs sem data)', () => {
    expect(() => ClassificationSchema.parse({ ...valid, data: null })).not.toThrow();
  });

  it('rejeita data impossível mesmo no formato AAAA-MM-DD (PKG-SHARED-04)', () => {
    // documents.data_doc é `date` no Postgres — data alucinada pelo LLM
    // derrubaria o UPDATE inteiro e perderia a classificação.
    expect(() => ClassificationSchema.parse({ ...valid, data: '2026-13-45' })).toThrow();
    expect(() => ClassificationSchema.parse({ ...valid, data: '2026-02-30' })).toThrow();
    expect(() => ClassificationSchema.parse({ ...valid, data: '2026-00-10' })).toThrow();
  });

  it('aceita 29/02 só em ano bissexto', () => {
    expect(() => ClassificationSchema.parse({ ...valid, data: '2024-02-29' })).not.toThrow();
    expect(() => ClassificationSchema.parse({ ...valid, data: '2026-02-29' })).toThrow();
  });

  it('rejeita tipo fora do enum', () => {
    expect(() =>
      ClassificationSchema.parse({ ...valid, tipo: 'NaoExiste' as unknown as typeof valid.tipo }),
    ).toThrow();
  });

  it('rejeita confianca fora de [0, 1]', () => {
    expect(() => ClassificationSchema.parse({ ...valid, confianca: 1.5 })).toThrow();
    expect(() => ClassificationSchema.parse({ ...valid, confianca: -0.1 })).toThrow();
  });

  it('rejeita título acima de 80 chars', () => {
    expect(() =>
      ClassificationSchema.parse({ ...valid, titulo: 'x'.repeat(81) }),
    ).toThrow();
  });
});

describe('ProfileFormSchema', () => {
  it('aceita perfil válido com ao menos 1 matéria', () => {
    const r = ProfileFormSchema.parse({
      full_name: 'Theo Murah',
      curso: 'Engenharia de Produção',
      semestre_atual: '2026.1',
      materias: [{ code: 'FISICA3', nome: 'Física 3' }],
    });
    expect(r.materias).toHaveLength(1);
  });

  it('aceita codigo_horario_sigaa multi-turno separado por espaço (PKG-SHARED-03)', () => {
    const base = {
      full_name: 'Theo Murah',
      semestre_atual: '2026.1',
    };
    const comCodigo = (codigo: string) => ({
      ...base,
      materias: [{ code: 'EPR0999', nome: 'Lab de Produção', codigo_horario_sigaa: codigo }],
    });
    expect(() => ProfileFormSchema.parse(comCodigo('26N34'))).not.toThrow();
    expect(() => ProfileFormSchema.parse(comCodigo('2M34 4T12'))).not.toThrow();
    expect(() => ProfileFormSchema.parse(comCodigo('2M34  4T12'))).toThrow();  // espaço duplo
    expect(() => ProfileFormSchema.parse(comCodigo('2M34 xyz'))).toThrow();
  });

  it('rejeita sem matérias', () => {
    expect(() =>
      ProfileFormSchema.parse({
        full_name: 'X',
        semestre_atual: '2026.1',
        materias: [],
      }),
    ).toThrow();
  });

  it('rejeita semestre fora do formato AAAA.S', () => {
    expect(() =>
      ProfileFormSchema.parse({
        full_name: 'X',
        semestre_atual: '2026',
        materias: [{ code: 'F3', nome: 'x' }],
      }),
    ).toThrow();
  });

  it('horários requerem dia + HH:MM', () => {
    expect(() =>
      ProfileFormSchema.parse({
        full_name: 'X',
        semestre_atual: '2026.1',
        materias: [
          {
            code: 'F3',
            nome: 'F',
            horarios: [{ dia: 'seg', inicio: '8h', fim: '10:00' }],
          },
        ],
      }),
    ).toThrow();
  });
});

describe('UploadRequestSchema', () => {
  it('aceita upload válido', () => {
    expect(() =>
      UploadRequestSchema.parse({
        filename_original: 'aula12.pdf',
        format: 'pdf',
        size_bytes: 1024,
        storage_path: 'user-id/aula12.pdf',
      }),
    ).not.toThrow();
  });

  it('rejeita size_bytes acima de 50 MiB', () => {
    expect(() =>
      UploadRequestSchema.parse({
        filename_original: 'big.pdf',
        format: 'pdf',
        size_bytes: 51 * 1024 * 1024,
        storage_path: 'u/big.pdf',
      }),
    ).toThrow();
  });

  it('rejeita formato fora do enum', () => {
    expect(() =>
      UploadRequestSchema.parse({
        filename_original: 'a.txt',
        format: 'txt',
        size_bytes: 100,
        storage_path: 'u/a.txt',
      }),
    ).toThrow();
  });
});

describe('sanitizeFilename', () => {
  it('remove caracteres proibidos do filesystem', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('colapsa espaços e faz trim', () => {
    expect(sanitizeFilename('  a   b  ')).toBe('a b');
  });

  it('trunca acima do limite de chars do título', () => {
    const out = sanitizeFilename('a'.repeat(100));
    expect(out.length).toBeLessThanOrEqual(60);
  });
});

describe('buildFilenameFinal', () => {
  it('segue formato {MATERIA} - {Tipo} - {ID} {Titulo}.{ext}', () => {
    const out = buildFilenameFinal({
      materia_code: 'FISICA3',
      tipo: 'Aula',
      identificador: '12',
      data: '2026-04-15',
      titulo: 'Lei de Coulomb',
      extension: 'md',
    });
    expect(out).toBe('FISICA3 - Aula - 12 Lei de Coulomb.md');
  });

  it('usa data quando identificador é null', () => {
    const out = buildFilenameFinal({
      materia_code: 'CALC2',
      tipo: 'Aula',
      identificador: null,
      data: '2026-04-15',
      titulo: 'Derivadas',
      extension: 'md',
    });
    expect(out).toBe('CALC2 - Aula - 2026-04-15 Derivadas.md');
  });

  it('omite parte de ID quando ambos null', () => {
    const out = buildFilenameFinal({
      materia_code: 'M1',
      tipo: 'Resumo',
      identificador: null,
      data: null,
      titulo: 'Resumão',
      extension: 'md',
    });
    expect(out).toBe('M1 - Resumo - Resumão.md');
  });

  it('trunca total acima de 180 chars', () => {
    const out = buildFilenameFinal({
      materia_code: 'M1',
      tipo: 'Resumo',
      identificador: null,
      data: null,
      titulo: 'X'.repeat(200),
      extension: 'md',
    });
    expect(out.length).toBeLessThanOrEqual(180);
  });
});

describe('buildDriveFolderPath', () => {
  it('compõe semestre/materia', () => {
    expect(buildDriveFolderPath('2026.1', 'Física 3')).toBe('2026.1/Física 3');
  });
});

describe('PasswordSchema (signup — política forte)', () => {
  it('rejeita senha curta', () => {
    const r = PasswordSchema.safeParse('Abc12345');
    expect(r.success).toBe(false);
  });

  it('rejeita senha sem maiúscula', () => {
    const r = PasswordSchema.safeParse('abcdef123456');
    expect(r.success).toBe(false);
  });

  it('rejeita senha sem minúscula', () => {
    const r = PasswordSchema.safeParse('ABCDEF123456');
    expect(r.success).toBe(false);
  });

  it('rejeita senha sem dígito', () => {
    const r = PasswordSchema.safeParse('AbcDefGhiJkl');
    expect(r.success).toBe(false);
  });

  it('aceita senha forte (12 chars, mix)', () => {
    const r = PasswordSchema.safeParse('Senha1Segura');
    expect(r.success).toBe(true);
  });

  it('rejeita senha muito longa (> 128)', () => {
    const r = PasswordSchema.safeParse('A1b' + 'x'.repeat(200));
    expect(r.success).toBe(false);
  });
});

describe('passwordStrength', () => {
  it('vazio = score 0', () => {
    expect(passwordStrength('').score).toBe(0);
    expect(passwordStrength('').label).toBe('muito fraca');
  });

  it('curto = score 1', () => {
    expect(passwordStrength('abc12345').score).toBe(1);
  });

  it('12 chars sem mix = score 2', () => {
    expect(passwordStrength('aaaaaaaaaaaa').score).toBe(2);
  });

  it('12 chars + maiúscula + minúscula = score 3', () => {
    expect(passwordStrength('AaaaaAaaaaaa').score).toBe(3);
  });

  it('12 chars + maiúscula + minúscula + número + símbolo = score 4 (forte)', () => {
    expect(passwordStrength('Senha1Forte!@').score).toBe(4);
    expect(passwordStrength('Senha1Forte!@').label).toBe('forte');
  });
});
