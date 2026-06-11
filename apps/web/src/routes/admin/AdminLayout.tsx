/**
 * Layout do painel /admin.
 *
 * Não tem sidebar — o /admin é uma seção normal do app, segue o mesmo
 * estilo de Dashboard/Atividade/Prompts. A topbar global continua visível.
 *
 * Renderiza a sub-navegação + o toggle "incluir dados de teste" (que controla,
 * via AdminPrefsProvider, se as RPCs incluem os perfis is_test do seed 0016).
 */

import { NavLink, Outlet } from 'react-router-dom';
import { AdminPrefsProvider, useAdminPrefs } from '../../hooks/useAdminPrefs';

function TestDataToggle() {
  const { includeTest, setIncludeTest } = useAdminPrefs();
  return (
    <label
      className="admin-test-toggle"
      title="Inclui os perfis de teste (seed) nas métricas. Desligado = só dados reais."
    >
      <input
        type="checkbox"
        checked={includeTest}
        onChange={(e) => setIncludeTest(e.target.checked)}
      />
      <span>Incluir dados de teste</span>
    </label>
  );
}

export default function AdminLayout() {
  return (
    <AdminPrefsProvider>
      <div className="container">
        <div className="admin-topbar-row">
          <nav className="admin-subnav" role="tablist" aria-label="Seções do painel admin">
            <NavLink to="/admin/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
              Visão geral
            </NavLink>
            <NavLink to="/admin/prompts" className={({ isActive }) => (isActive ? 'active' : '')}>
              Prompts
            </NavLink>
            <NavLink to="/admin/modelos" className={({ isActive }) => (isActive ? 'active' : '')}>
              Modelos
            </NavLink>
            <NavLink to="/admin/feedback" className={({ isActive }) => (isActive ? 'active' : '')}>
              Feedback
            </NavLink>
          </nav>
          <TestDataToggle />
        </div>

        <Outlet />
      </div>
    </AdminPrefsProvider>
  );
}
