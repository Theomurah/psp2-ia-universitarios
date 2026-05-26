import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Handlers globais — capturam erros que escapam do React (fora do ciclo de render).
// Auditoria 2026-05-26 (Agente 4 — Observabilidade, achado A1).
window.addEventListener('error', (event) => {
  console.error('[window.error]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', {
    reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
