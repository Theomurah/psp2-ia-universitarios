/**
 * 404 — rota não encontrada. Antes a app fazia <Navigate to="/" /> em qualquer
 * rota inválida, o que mascarava erros de link. Agora mostra uma página clara.
 */

import { Link, useLocation } from 'react-router-dom';
import UnbLogo from '../components/UnbLogo';

export default function NotFoundPage() {
  const location = useLocation();
  return (
    <div className="container not-found">
      <div className="not-found-card">
        <UnbLogo size={56} />
        <h1>Página não encontrada</h1>
        <p className="hint">
          O endereço <code>{location.pathname}</code> não existe ou foi movido.
        </p>
        <div className="actions-row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="primary" style={{ textDecoration: 'none' }}>
            Voltar pro Dashboard
          </Link>
          <Link to="/prompts" className="secondary" style={{ textDecoration: 'none' }}>
            Biblioteca de Prompts
          </Link>
        </div>
      </div>
    </div>
  );
}
