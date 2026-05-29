/**
 * Grade visual semana × horário.
 *
 * Renderiza em CSS Grid: colunas = dias úteis (seg-sáb), linhas = horas.
 * Cada matéria vira um bloco posicionado por `grid-row` calculado em
 * pixels-por-30-minutos.
 *
 * - Header dos dias compacto (só "Seg/Ter/...").
 * - Faixa horária = min/max das matérias (com 30 min de respiro).
 * - Sem matérias com horário: não renderiza grade (caller decide).
 */

import { useMemo } from 'react';
import type { MateriaPerfil } from '@psp2/shared';
import { colorForMateria } from '../lib/materiaColor';

interface Props {
  materias: MateriaPerfil[];
  onSelectMateria?: (code: string) => void;
  selectedCode?: string | null;
}

const DIAS: { key: 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab'; label: string }[] = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
];

const ROW_HEIGHT_PX = 18; // por 30 minutos — mais denso que antes (era 22)

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export default function HorariosGrade({ materias, onSelectMateria, selectedCode }: Props) {
  // Faixa horária: mínimo e máximo das matérias (+ 30 min de respiro).
  // Se sem matérias, mostra 8h-22h por convenção.
  const { minMin, maxMin } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const m of materias) {
      for (const h of m.horarios ?? []) {
        lo = Math.min(lo, timeToMinutes(h.inicio));
        hi = Math.max(hi, timeToMinutes(h.fim));
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      return { minMin: 8 * 60, maxMin: 22 * 60 };
    }
    lo = Math.max(0, Math.floor((lo - 30) / 30) * 30);
    hi = Math.min(24 * 60, Math.ceil((hi + 30) / 30) * 30);
    return { minMin: lo, maxMin: hi };
  }, [materias]);

  const totalRows = (maxMin - minMin) / 30;

  // Labels só nas horas inteiras (8:00, 9:00 — nada de 8:30)
  const horasLabels = useMemo(() => {
    const out: { min: number }[] = [];
    const first = Math.ceil(minMin / 60) * 60;
    for (let t = first; t <= maxMin; t += 60) out.push({ min: t });
    return out;
  }, [minMin, maxMin]);

  if (materias.length === 0) {
    return null;
  }

  return (
    <div className="grade-wrapper" role="region" aria-label="Grade horária semanal">
      <div
        className="grade-table"
        style={{
          gridTemplateColumns: `56px repeat(${DIAS.length}, minmax(0, 1fr))`,
          gridTemplateRows: `32px repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`,
        }}
      >
        {/* Canto vazio do header */}
        <div className="grade-cell grade-corner" />

        {/* Cabeçalho de dias — só sigla, sem label duplicado */}
        {DIAS.map((d, i) => (
          <div key={d.key} className="grade-cell grade-day-header" style={{ gridColumn: i + 2 }}>
            {d.label}
          </div>
        ))}

        {/* Labels de hora à esquerda */}
        {horasLabels.map(({ min }) => {
          const row = (min - minMin) / 30 + 2;
          return (
            <div key={`label-${min}`} className="grade-cell grade-hour-label" style={{ gridRow: row, gridColumn: 1 }}>
              {minutesToLabel(min)}
            </div>
          );
        })}

        {/* Linhas de fundo (zebra + linha forte na hora cheia) */}
        {Array.from({ length: totalRows }).map((_, i) => {
          const row = i + 2;
          const minNow = minMin + i * 30;
          const isHourMark = minNow % 60 === 0;
          return (
            <div
              key={`bg-${i}`}
              className={`grade-cell grade-bg-row ${isHourMark ? 'hour-line' : ''}`}
              style={{ gridRow: row, gridColumn: '2 / -1' }}
            />
          );
        })}

        {/* Blocos das matérias */}
        {materias.flatMap((mat) =>
          (mat.horarios ?? []).map((h, idx) => {
            const diaIdx = DIAS.findIndex((d) => d.key === h.dia);
            if (diaIdx === -1) return null;
            const startMin = timeToMinutes(h.inicio);
            const endMin = timeToMinutes(h.fim);
            const rowStart = (startMin - minMin) / 30 + 2;
            const rowSpan = Math.max(1, Math.round((endMin - startMin) / 30));
            const color = colorForMateria(mat.code);
            const isSelected = selectedCode === mat.code;
            const showLocal = rowSpan >= 4 && Boolean(mat.local);
            return (
              <button
                key={`${mat.code}-${idx}-${h.dia}`}
                type="button"
                className={`grade-block ${isSelected ? 'selected' : ''}`}
                style={{
                  gridColumn: diaIdx + 2,
                  gridRow: `${rowStart} / span ${rowSpan}`,
                  background: color.bg,
                  borderColor: color.border,
                  color: color.text,
                }}
                onClick={() => onSelectMateria?.(mat.code)}
                title={`${mat.code} · ${mat.nome}\n${h.inicio} – ${h.fim}${mat.local ? `\n${mat.local}` : ''}${mat.professor ? `\n${mat.professor}` : ''}`}
              >
                <strong>{mat.code}</strong>
                <span className="grade-block-time">{h.inicio}</span>
                {showLocal && <span className="grade-block-local">{mat.local}</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
