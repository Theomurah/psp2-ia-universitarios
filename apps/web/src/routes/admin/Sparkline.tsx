/**
 * Sparkline SVG inline — sem dep externa.
 * Recebe array de números e renderiza linha + área + ponto final.
 * Cores usam tokens UnB (var(--primary), var(--success), etc).
 */

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  label?: string;
  formatValue?: (n: number) => string;
}

export default function Sparkline({
  values,
  width = 240,
  height = 56,
  color = 'var(--primary)',
  label,
  formatValue,
}: Props) {
  const safe = values.length === 0 ? [0] : values;
  const n = safe.length;
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const range = max - min || 1;
  const padX = 4;
  const padY = 6;
  const w = width - padX * 2;
  const h = height - padY * 2;

  const points = safe.map((v, i) => {
    const x = padX + (n === 1 ? w / 2 : (i / (n - 1)) * w);
    const y = padY + h - ((v - min) / range) * h;
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padY + h).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + h).toFixed(1)} Z`;
  const last = points[points.length - 1];

  const total = safe.reduce((a, b) => a + b, 0);

  return (
    <div className="sparkline-card">
      {label && <span className="sparkline-label">{label}</span>}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label ?? 'Tendência'} dos últimos ${n} dias`}
      >
        <path d={areaPath} fill={color} fillOpacity="0.12" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last.x} cy={last.y} r="3" fill={color} />
      </svg>
      <div className="sparkline-foot">
        <strong>{formatValue ? formatValue(total) : total}</strong>
        <small>total · {n}d</small>
      </div>
    </div>
  );
}
