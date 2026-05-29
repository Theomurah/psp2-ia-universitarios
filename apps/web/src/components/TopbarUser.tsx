/**
 * Mostra avatar + email do usuário logado + botão de logout.
 * Se não estiver logado, não renderiza nada (a topbar continua aparecendo na /login mesmo assim).
 *
 * [extra] Avatar com inicial, toast de feedback no logout, tratamento de erro
 * (antes o handleLogout dava throw sem try/catch — botão parecia "não funcionar").
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, signOut } from '../hooks/useAuth';
import { useToast } from './Toast';
import { createLogger } from '../lib/log';

const log = createLogger('topbar-user');

function initialFrom(email: string | null | undefined, name?: string | null) {
  if (name && name.trim()) return name.trim()[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return '?';
}

export default function TopbarUser() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (loading || !user) return null;

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '';
  const initial = initialFrom(user.email, displayName);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      log.info('signout_succeeded', { user_id: user.id });
      toast.success('Você saiu', 'Até a próxima!');
      navigate('/login', { replace: true });
    } catch (err) {
      log.error('signout_failed', { user_id: user.id, ...log.fromError(err) });
      const msg = (err as Error).message ?? 'Não foi possível sair.';
      toast.error('Erro ao sair', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="topbar-user">
      <span className="user-avatar" aria-hidden>{initial}</span>
      <span className="user-email" title={user.email ?? ''}>{user.email}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="ghost"
        disabled={busy}
        aria-label="Sair da conta"
      >
        {busy ? 'Saindo…' : 'Sair'}
      </button>
    </div>
  );
}
