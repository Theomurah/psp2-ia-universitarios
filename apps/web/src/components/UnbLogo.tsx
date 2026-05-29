/**
 * Logo institucional — símbolo oficial da UnB.
 *
 * Asset: /unb-logo.svg (em apps/web/public/), baixado da Wikimedia Commons
 * (domínio público — geometria simples sem threshold de originalidade).
 * Fonte: File:Webysther_20160322_-_Logo_UnB_(sem_texto).svg
 */

interface Props {
  size?: number;
  variant?: 'full' | 'mark';
  className?: string;
}

export default function UnbLogo({ size = 40, variant = 'full', className }: Props) {
  return (
    <span className={`unb-logo ${className ?? ''}`} aria-label="Universidade de Brasília">
      <img
        src="/unb-logo.svg"
        alt=""
        height={size}
        className="unb-logo-mark"
        aria-hidden
      />
      {variant === 'full' && (
        <span className="unb-logo-text">
          <span className="unb-logo-brand">PSP2</span>
          <span className="unb-logo-sub">Assistente IA · UnB</span>
        </span>
      )}
    </span>
  );
}
