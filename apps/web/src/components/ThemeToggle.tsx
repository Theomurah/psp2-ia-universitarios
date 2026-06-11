/**
 * Botão de alternância de tema (claro / escuro) na topbar.
 *
 * O tema é aplicado no <html data-theme="..."> por um script inline no
 * index.html que roda antes do paint (evita flash). Aqui só lemos o estado
 * atual, alternamos e persistimos em localStorage ('psp2:theme').
 */

import { useState } from 'react';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('psp2:theme', next);
    } catch {
      /* localStorage indisponível (modo privado) — tema ainda aplica na sessão */
    }
    setTheme(next);
  };

  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="ghost icon-only theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      <span aria-hidden>{isDark ? '☀' : '☾'}</span>
    </button>
  );
}
