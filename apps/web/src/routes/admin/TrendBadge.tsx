/**
 * Mostra a variação % entre o período atual e o anterior (mesma duração).
 * Verde = subiu, vermelho = caiu. Para "falhas" e "custo", subir é ruim
 * (invertColor=true inverte a semântica de cor).
 */

interface Props {
  current: number;
  previous: number;
  /** Quando true, alta é "ruim" (vermelho) e baixa é "boa" (verde). Ex: falhas, custo. */
  invertColor?: boolean;
}

export default function TrendBadge({ current, previous, invertColor = false }: Props) {
  // Sem base de comparação: não mostra nada (evita "∞%").
  if (previous === 0 && current === 0) {
    return <span className="trend trend-flat">sem variação</span>;
  }
  if (previous === 0) {
    return <span className={`trend ${invertColor ? 'trend-bad' : 'trend-good'}`}>novo</span>;
  }

  const deltaPct = Math.round(((current - previous) / previous) * 100);
  if (deltaPct === 0) {
    return <span className="trend trend-flat">estável</span>;
  }

  const up = deltaPct > 0;
  const good = invertColor ? !up : up;
  const arrow = up ? '↑' : '↓';

  return (
    <span className={`trend ${good ? 'trend-good' : 'trend-bad'}`}>
      {arrow} {Math.abs(deltaPct)}%
    </span>
  );
}
