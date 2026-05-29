import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';

interface Props {
  children: React.ReactNode;
}

/**
 * Guard de admin. Espera 3 sinais antes de decidir:
 *   1. auth resolveu (loading=false)
 *   2. existe session (senão manda pra /login)
 *   3. query `is_admin` resolveu (data não é undefined)
 *
 * BUG anterior: usava `isLoading` que é false quando enabled=false → no primeiro
 * render `data` ainda era undefined mas isLoading=false → caía em Navigate to "/".
 * Só funcionava no segundo click porque o cache já tinha `true`.
 */
export default function RequireAdmin({ children }: Props) {
  const { loading: authLoading, session } = useAuth();
  const { data: isAdmin } = useIsAdmin();

  if (authLoading) {
    return (
      <div className="full-page-loader">
        <span className="spinner" />
        <span>Carregando…</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Distingue "não sei ainda" (undefined) de "sei que é false".
  if (isAdmin === undefined) {
    return (
      <div className="full-page-loader">
        <span className="spinner" />
        <span>Verificando permissões…</span>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
