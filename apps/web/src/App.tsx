import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './routes/DashboardPage';
import SettingsPage from './routes/SettingsPage';
import LoginPage from './routes/LoginPage';
import RequireAuth from './components/RequireAuth';
import TopbarUser from './components/TopbarUser';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <nav className="topbar">
          <Link to="/" className="brand">PSP2 IA</Link>
          <div className="topbar-links">
            <Link to="/">Dashboard</Link>
            <Link to="/settings">Configurações</Link>
          </div>
          <TopbarUser />
        </nav>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
