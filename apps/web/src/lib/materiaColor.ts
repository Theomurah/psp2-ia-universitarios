/**
 * Cor determinística por código de matéria.
 *
 * Mesma matéria → mesma cor sempre (independente da ordem). 8 cores
 * compatíveis com a paleta UnB + complementares acessíveis.
 */

const PALETTE: { bg: string; border: string; text: string }[] = [
  { bg: '#005923', border: '#003d18', text: '#ffffff' }, // verde UnB
  { bg: '#003366', border: '#001a33', text: '#ffffff' }, // azul UnB
  { bg: '#B85C00', border: '#8a4500', text: '#ffffff' }, // âmbar
  { bg: '#7c3aed', border: '#5b21b6', text: '#ffffff' }, // violeta
  { bg: '#0891b2', border: '#0e7490', text: '#ffffff' }, // ciano
  { bg: '#be185d', border: '#831843', text: '#ffffff' }, // pink
  { bg: '#65a30d', border: '#3f6212', text: '#ffffff' }, // lime
  { bg: '#475569', border: '#1e293b', text: '#ffffff' }, // slate
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
