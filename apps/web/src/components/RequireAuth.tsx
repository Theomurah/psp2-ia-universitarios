/**
 * Route guard — redireciona pra /login se não tiver sessão.
 * Uso: <Route element={<RequireAuth><DashboardPage/></RequireAuth>} />
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: React.ReactNode;
}

export default function RequireAuth({ children }: Props) {
  const { loading, session } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container">
        <p>Carregando…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
