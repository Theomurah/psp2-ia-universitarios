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
import AdminLayout from './routes/admin/AdminLayout';
import AdminDashboard from './routes/admin/AdminDashboard';
import AdminPrompts from './routes/admin/AdminPrompts';
import AdminModelos from './routes/admin/AdminModelos';
import AdminFeedback from './routes/admin/AdminFeedback';
import RequireAuth from './components/RequireAuth';
import RequireAdmin from './components/RequireAdmin';
import TopbarUser from './components/TopbarUser';
import UnbLogo from './components/UnbLogo';
import { ToastProvider } from './components/Toast';
import { useIsAdmin } from './hooks/useIsAdmin';

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
  if (STANDALONE_ROUTES.has(pathname)) return null;
  return (
    <nav className="topbar">
      <NavLink to="/" className="brand">
        <UnbLogo size={36} />
      </NavLink>
      <div className="topbar-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Dashboard</NavLink>
        <NavLink to="/materias" className={({ isActive }) => (isActive ? 'active' : '')}>Matérias</NavLink>
        <NavLink to="/prompts" className={({ isActive }) => (isActive ? 'active' : '')}>Prompts</NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Configurações</NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active admin-link' : 'admin-link')}>
            Admin
          </NavLink>
        )}
      </div>
      <TopbarUser />
    </nav>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Topbar />
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
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
