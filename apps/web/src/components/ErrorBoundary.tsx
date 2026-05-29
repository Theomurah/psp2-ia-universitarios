/**
 * ErrorBoundary global — captura erros de render que escaparam dos componentes
 * filhos e mostra fallback amigável em vez de tela branca.
 *
 * Auditoria 2026-05-26 (Agente 4 — Observabilidade, achado A1).
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { createLogger } from '../lib/log';

const log = createLogger('error-boundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log estruturado pro DevTools / Supabase Studio quando entrar coletor remoto.
    log.error('react_render_error', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      component_stack: info.componentStack?.split('\n').slice(0, 5).join('\n'),
    });
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
            gap: '1rem',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Algo deu errado</h1>
          <p style={{ maxWidth: '36rem', color: '#555' }}>
            Tivemos um problema inesperado ao carregar essa parte do PSP2.
            Tente recarregar a página. Se o erro persistir, copie a mensagem
            abaixo e mande pra equipe.
          </p>
          {this.state.error && (
            <pre
              style={{
                background: '#f4f4f5',
                border: '1px solid #e4e4e7',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                maxWidth: '36rem',
                overflow: 'auto',
                fontSize: '0.85rem',
                color: '#333',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '0.5rem',
              border: '1px solid #18181b',
              background: '#18181b',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
