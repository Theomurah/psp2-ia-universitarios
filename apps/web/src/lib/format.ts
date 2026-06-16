/**
 * Formatadores compartilhados de número, custo e data.
 *
 * Origem: auditoria 2026-06-10 (achado WEB-ROUTES-06) — fmtNumber/fmtCost/
 * fmtDate/fmtRelative estavam duplicados em 6+ componentes e já divergiam
 * entre si. Esta é a implementação canônica, extraída de
 * `routes/admin/AdminDashboard.tsx` com comportamento idêntico.
 */

/** 1234 → "1.2k", 1_234_567 → "1.2M". */
export function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

/** Custo em dólar com piso de exibição ("< US$ 0,01"). */
export function fmtCost(usd: number): string {
  if (!usd || usd === 0) return 'US$ 0';
  if (usd < 0.01) return '< US$ 0,01';
  return `US$ ${Number(usd).toFixed(2)}`;
}

/** Data+hora curtas em pt-BR (ex: "10/06/2026 14:32"). */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Tempo relativo em pt-BR ("agora", "há 5 min", "há 2 h", "há 3 dias").
 * Acima de 14 dias cai pra data absoluta curta (ex: "10 de jun.").
 */
export function fmtRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  if (days <= 14) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
