/**
 * Route guard:
 *  - sem sessão → redireciona pra /login
 *  - com sessão mas sem onboarding completo (e requireOnboarding=true) → redireciona pra /onboarding
 *
 * [extra] Gate de onboarding obrigatório pós-cadastro.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';

interface Props {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export default function RequireAuth({ children, requireOnboarding = false }: Props) {
  const { loading, session } = useAuth();
  const location = useLocation();
  const { data: profile, isLoading: profileLoading } = useProfile();

  if (loading) {
    return (
      <div className="full-page-loader">
        <span className="spinner" />
        <span>Carregando…</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireOnboarding) {
    if (profileLoading) {
      return (
        <div className="full-page-loader">
          <span className="spinner" />
          <span>Carregando perfil…</span>
        </div>
      );
    }
    const completed = isOnboardingComplete(profile);
    if (!completed) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
}

function isOnboardingComplete(profile: ReturnType<typeof useProfile>['data']): boolean {
  if (!profile) return false;
  if (!profile.full_name || profile.full_name.trim().length < 2) return false;
  if (!profile.semestre_atual) return false;
  if (!profile.materias || profile.materias.length === 0) return false;
  return true;
}
