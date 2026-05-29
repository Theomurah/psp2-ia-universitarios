/**
 * Layout do painel /admin.
 *
 * Não tem sidebar — o /admin é uma seção normal do app, segue o mesmo
 * estilo de Dashboard/Atividade/Prompts. A topbar global continua visível.
 *
 * Esta layout só renderiza a sub-navegação (admin-subnav) acima do <Outlet/>.
 */

import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="container">
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

      <Outlet />
    </div>
  );
}
