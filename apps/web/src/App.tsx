import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './routes/DashboardPage';
import SettingsPage from './routes/SettingsPage';
import LoginPage from './routes/LoginPage';
import OnboardingPage from './routes/OnboardingPage';
import PromptsPage from './routes/PromptsPage';
import HorariosPage from './routes/HorariosPage';
import PrivacidadePage from './routes/PrivacidadePage';
import TermosPage from './routes/TermosPage';
import NotFoundPage from './routes/NotFoundPage';
import RequireAuth from './components/RequireAuth';
import RequireAdmin from './components/RequireAdmin';
import TopbarUser from './components/TopbarUser';
import ThemeToggle from './components/ThemeToggle';
import UnbLogo from './components/UnbLogo';
import { ToastProvider } from './components/Toast';
import { useIsAdmin } from './hooks/useIsAdmin';

// Code-split: o painel /admin (4 páginas + charts) só é usado por 1-2 admins.
// Carregar sob demanda mantém o bundle do aluno leve.
const AdminLayout = lazy(() => import('./routes/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./routes/admin/AdminDashboard'));
const AdminPrompts = lazy(() => import('./routes/admin/AdminPrompts'));
const AdminModelos = lazy(() => import('./routes/admin/AdminModelos'));
const AdminFeedback = lazy(() => import('./routes/admin/AdminFeedback'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const STANDALONE_ROUTES = new Set(['/login', '/onboarding', '/privacidade', '/termos']);

function Topbar() {
  const { pathname } = useLocation();
  const { data: isAdmin } = useIsAdmin();
  const [menuOpen, setMenuOpen] = useState(false);

  // Fecha o menu mobile sempre que a rota muda (ex.: clicou num link).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Esc fecha o menu mobile.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  if (STANDALONE_ROUTES.has(pathname)) return null;

  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

  return (
    <nav className="topbar">
      <NavLink to="/" className="brand">
        <UnbLogo size={36} />
      </NavLink>
      <div className={`topbar-links${menuOpen ? ' open' : ''}`} id="topbar-nav">
        <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
        <NavLink to="/materias" className={linkClass}>Matérias</NavLink>
        <NavLink to="/prompts" className={linkClass}>Prompts</NavLink>
        <NavLink to="/settings" className={linkClass}>Configurações</NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active admin-link' : 'admin-link')}>
            Admin
          </NavLink>
        )}
      </div>
      <ThemeToggle />
      <TopbarUser />
      <button
        type="button"
        className="topbar-burger"
        aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuOpen}
        aria-controls="topbar-nav"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span aria-hidden>{menuOpen ? '✕' : '☰'}</span>
      </button>
    </nav>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Topbar />
          <Suspense
            fallback={
              <div className="full-page-loader">
                <span className="spinner" />
                <span>Carregando…</span>
              </div>
            }
          >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/privacidade" element={<PrivacidadePage />} />
            <Route path="/termos" element={<TermosPage />} />
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <OnboardingPage />
                </RequireAuth>
              }
            />
            <Route
              path="/"
              element={
                <RequireAuth requireOnboarding>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth requireOnboarding>
                  <SettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/prompts"
              element={
                <RequireAuth requireOnboarding>
                  <PromptsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/materias"
              element={
                <RequireAuth requireOnboarding>
                  <HorariosPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <AdminLayout />
                  </RequireAdmin>
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="prompts" element={<AdminPrompts />} />
              <Route path="modelos" element={<AdminModelos />} />
              <Route path="feedback" element={<AdminFeedback />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
