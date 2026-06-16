/**
 * Cor determinística por código de matéria.
 *
 * Mesma matéria → mesma cor sempre (independente da ordem). 8 cores
 * compatíveis com a paleta UnB + complementares acessíveis.
 *
 * As cores que têm token no design system (`apps/web/src/index.css`)
 * referenciam as CSS vars — se a identidade visual mudar no `:root`, os chips
 * acompanham (auditoria 2026-06-10, achado WEB-HOOKS-LIB-09). Os valores são
 * consumidos só via style inline, onde `var(...)` resolve normalmente.
 *
 * EXCEÇÃO CONSCIENTE à regra "sem hex" do CLAUDE.md: as 5 cores complementares
 * (violeta, ciano, pink, lime, slate) e o border do âmbar não têm token no
 * `:root`. Se esses tons entrarem no design system (ex.: `--materia-violet`),
 * troque os hex abaixo pelas vars correspondentes.
 */

const PALETTE: { bg: string; border: string; text: string }[] = [
  { bg: 'var(--primary)', border: 'var(--unb-green-dark)', text: 'var(--text-on-primary)' },   // verde UnB
  { bg: 'var(--secondary)', border: 'var(--unb-blue-dark)', text: 'var(--text-on-primary)' },  // azul UnB
  { bg: 'var(--warn)', border: '#8a4500', text: 'var(--text-on-primary)' },                    // âmbar
  { bg: '#7c3aed', border: '#5b21b6', text: 'var(--text-on-primary)' },                        // violeta
  { bg: '#0891b2', border: '#0e7490', text: 'var(--text-on-primary)' },                        // ciano
  { bg: '#be185d', border: '#831843', text: 'var(--text-on-primary)' },                        // pink
  { bg: '#65a30d', border: '#3f6212', text: 'var(--text-on-primary)' },                        // lime
  { bg: '#475569', border: '#1e293b', text: 'var(--text-on-primary)' },                        // slate
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function colorForMateria(code: string): { bg: string; border: string; text: string } {
  return PALETTE[hashCode(code.toUpperCase()) % PALETTE.length];
}
