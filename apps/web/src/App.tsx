import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './routes/DashboardPage';
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

// Code-split (WEB-ROUTES-07): Login/Onboarding/Settings são os únicos
// consumidores de react-hook-form + @hookform/resolvers — lazy tira as duas
// libs do chunk inicial. O /admin segue o mesmo padrão (só admins pagam por ele).
const LoginPage = lazy(() => import('./routes/LoginPage'));
const OnboardingPage = lazy(() => import('./routes/OnboardingPage'));
const SettingsPage = lazy(() => import('./routes/SettingsPage'));
// Flashcards é uma seção pesada (KaTeX, futuros charts/parser .apkg) — lazy
// pra não inflar o chunk inicial. Home + fluxo de estudo separados.
const FlashcardsPage = lazy(() => import('./routes/FlashcardsPage'));
const FlashcardStudyPage = lazy(() => import('./routes/FlashcardStudyPage'));
const FlashcardDeckPage = lazy(() => import('./routes/FlashcardDeckPage'));
const FlashcardImportPage = lazy(() => import('./routes/FlashcardImportPage'));
const FlashcardAnalyticsPage = lazy(() => import('./routes/FlashcardAnalyticsPage'));
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

/** Título por rota (WCAG 2.4.2) — o <title> estático do index.html era único pro app todo. */
function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Meus documentos';
  if (pathname.startsWith('/materias')) return 'Matérias';
  if (pathname.startsWith('/flashcards')) return 'Flashcards';
  if (pathname.startsWith('/prompts')) return 'Prompts';
  if (pathname.startsWith('/settings')) return 'Configurações';
  if (pathname.startsWith('/admin/prompts')) return 'Admin — Prompts';
  if (pathname.startsWith('/admin/modelos')) return 'Admin — Modelos';
  if (pathname.startsWith('/admin/feedback')) return 'Admin — Feedback';
  if (pathname.startsWith('/admin')) return 'Admin — Visão geral';
  if (pathname === '/login') return 'Entrar';
  if (pathname === '/onboarding') return 'Configurar perfil';
  if (pathname === '/privacidade') return 'Política de privacidade';
  if (pathname === '/termos') return 'Termos de uso';
  return 'Página não encontrada';
}

/**
 * A11y por rota (WEB-ROUTES-08): atualiza o document.title e move o foco pro
 * container principal a cada navegação — sem isso, usuários de leitor de tela
 * não percebem que a página mudou ao clicar num NavLink.
 */
function RouteA11y() {
  const { pathname } = useLocation();
  const firstRenderRef = useRef(true);
  useEffect(() => {
    document.title = `${pageTitle(pathname)} · PSP2`;
    if (firstRenderRef.current) {
      // No primeiro load não rouba o foco (deixa o navegador no padrão).
      firstRenderRef.current = false;
      return;
    }
    document.getElementById('main')?.focus();
  }, [pathname]);
  return null;
}

/**
 * Skip-link (WCAG 2.4.1): visually-hidden até receber foco por teclado.
 * Estilos inline (com tokens via CSS vars) porque o index.css está fora do
 * escopo desta frente da auditoria — mover pra classe .skip-link depois.
 */
function SkipLink() {
  const [focused, setFocused] = useState(false);
  return (
    <a
      href="#main"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={
        focused
          ? {
              position: 'fixed',
              top: 8,
              left: 8,
              zIndex: 1000,
              background: 'var(--bg-elevated)',
              color: 'var(--primary)',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-strong)',
              boxShadow: 'var(--shadow)',
              fontWeight: 600,
            }
          : {
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }
      }
    >
      Pular para o conteúdo
    </a>
  );
}

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
    <>
      <SkipLink />
      <nav className="topbar">
        <NavLink to="/" className="brand">
          <UnbLogo size={36} />
        </NavLink>
        <div className={`topbar-links${menuOpen ? ' open' : ''}`} id="topbar-nav">
          <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
          <NavLink to="/materias" className={linkClass}>Matérias</NavLink>
          <NavLink to="/flashcards" className={linkClass}>Flashcards</NavLink>
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
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <RouteA11y />
          <Topbar />
          {/* Alvo do skip-link + foco programático na troca de rota */}
          <div id="main" tabIndex={-1} style={{ outline: 'none' }}>
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
                  path="/flashcards"
                  element={
                    <RequireAuth requireOnboarding>
                      <FlashcardsPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/flashcards/study/:deckId"
                  element={
                    <RequireAuth requireOnboarding>
                      <FlashcardStudyPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/flashcards/decks/:deckId"
                  element={
                    <RequireAuth requireOnboarding>
                      <FlashcardDeckPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/flashcards/import"
                  element={
                    <RequireAuth requireOnboarding>
                      <FlashcardImportPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/flashcards/analytics"
                  element={
                    <RequireAuth requireOnboarding>
                      <FlashcardAnalyticsPage />
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
          </div>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
