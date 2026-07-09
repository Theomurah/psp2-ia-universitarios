/**
 * materias.ts
 *
 * Helpers de domínio para a lista de matérias do perfil.
 *
 * `mergeMaterias` unifica matérias atuais com importadas (ex: atestado SIGAA)
 * por código, case-insensitive: existentes são atualizadas campo-a-campo (o
 * dado importado tem prioridade quando presente, senão preserva o atual) e
 * novas são anexadas. Usado no import SIGAA da grade (HorariosPage) e do
 * onboarding — mantido aqui pra ser fonte única (as duas telas mesclam igual).
 */

import type { MateriaPerfil, SigaaAtestado } from '@psp2/shared';

export function mergeMaterias(
  atuais: MateriaPerfil[],
  importadas: MateriaPerfil[],
): MateriaPerfil[] {
  const byCode = new Map<string, MateriaPerfil>();
  for (const m of atuais) byCode.set(m.code.toUpperCase(), { ...m });
  for (const imp of importadas) {
    const key = imp.code.toUpperCase();
    const existing = byCode.get(key);
    if (existing) {
      byCode.set(key, {
        ...existing,
        nome: imp.nome || existing.nome,
        horarios: imp.horarios && imp.horarios.length > 0 ? imp.horarios : existing.horarios,
        turma: imp.turma ?? existing.turma,
        professor: imp.professor ?? existing.professor,
        local: imp.local ?? existing.local,
        codigo_horario_sigaa: imp.codigo_horario_sigaa ?? existing.codigo_horario_sigaa,
      });
    } else {
      byCode.set(key, imp);
    }
  }
  return Array.from(byCode.values());
}

/** Converte as matérias parseadas do atestado SIGAA no shape `MateriaPerfil`. */
export function sigaaMateriasToPerfil(parsed: SigaaAtestado): MateriaPerfil[] {
  return parsed.materias.map((m) => ({
    code: m.code,
    nome: m.nome,
    horarios: m.horarios,
    turma: m.turma ?? undefined,
    professor: m.professor ?? undefined,
    local: m.local ?? undefined,
    codigo_horario_sigaa: m.codigo_horario_sigaa ?? undefined,
  }));
}
