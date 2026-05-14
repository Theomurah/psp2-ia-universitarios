/**
 * Mostra o email do usuário logado + botão de logout.
 * Se não estiver logado, não renderiza nada (a topbar segue aparecendo na /login mesmo assim).
 */

import { useNavigate } from 'react-router-dom';
import { useAuth, signOut } from '../hooks/useAuth';

export default function TopbarUser() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading || !user) return null;

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="topbar-user">
      <span title={user.email}>{user.email}</span>
      <button type="button" onClick={handleLogout} className="link">
        Sair
      </button>
    </div>
  );
}
