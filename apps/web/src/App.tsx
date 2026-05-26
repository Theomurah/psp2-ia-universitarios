import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './routes/DashboardPage';
import SettingsPage from './routes/SettingsPage';
import LoginPage from './routes/LoginPage';
import OnboardingPage from './routes/OnboardingPage';
import PromptsPage from './routes/PromptsPage';
import AtividadePage from './routes/AtividadePage';
import PrivacidadePage from './routes/PrivacidadePage';
import TermosPage from './routes/TermosPage';
import NotFoundPage from './routes/NotFoundPage';
import RequireAuth from './components/RequireAuth';
import TopbarUser from './components/TopbarUser';
import UnbLogo from './components/UnbLogo';
import { ToastProvider } from './components/Toast';

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
  if (STANDALONE_ROUTES.has(pathname)) return null;
  return (
    <nav className="topbar">
      <NavLink to="/" className="brand">
        <UnbLogo size={36} />
      </NavLink>
      <div className="topbar-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Dashboard</NavLink>
        <NavLink to="/prompts" className={({ isActive }) => (isActive ? 'active' : '')}>Prompts</NavLink>
        <NavLink to="/atividade" className={({ isActive }) => (isActive ? 'active' : '')}>Atividade</NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Configurações</NavLink>
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
              path="/atividade"
              element={
                <RequireAuth requireOnboarding>
                  <AtividadePage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
