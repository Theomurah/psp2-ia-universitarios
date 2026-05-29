/**
 * Sistema de Toast leve, sem dependências externas.
 *
 * Uso:
 *   const toast = useToast();
 *   toast.success('Login realizado');
 *   toast.error('Senha incorreta');
 *   toast.info('Enviamos um email de confirmação');
 *   toast.warning('Conexão Realtime perdida');
 *
 * Opcional — botão de ação inline (ex: "Desfazer"):
 *   toast.success('Arquivado', 'Movido pra arquivados.', {
 *     action: { label: 'Desfazer', onClick: () => unarchive() },
 *   });
 *
 * Wrap a app:
 *   <ToastProvider><App /></ToastProvider>
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOpts {
  action?: ToastAction;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  action?: ToastAction;
}

interface ToastApi {
  success: (title: string, description?: string, opts?: ToastOpts) => void;
  error: (title: string, description?: string, opts?: ToastOpts) => void;
  info: (title: string, description?: string, opts?: ToastOpts) => void;
  warning: (title: string, description?: string, opts?: ToastOpts) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000,
};

// Toasts com action ficam mais tempo (pra usuário ter tempo de clicar)
const ACTION_DURATION_MS = 7000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string, opts?: ToastOpts) => {
      idRef.current += 1;
      const id = idRef.current;
      setItems((prev) => [...prev, { id, kind, title, description, action: opts?.action }]);
      const duration = opts?.action ? ACTION_DURATION_MS : DURATION_MS[kind];
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, d, o) => push('success', t, d, o),
      error: (t, d, o) => push('error', t, d, o),
      info: (t, d, o) => push('info', t, d, o),
      warning: (t, d, o) => push('warning', t, d, o),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return ctx;
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="toast-viewport" role="region" aria-label="Notificações">
      {items.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const duration = item.action ? ACTION_DURATION_MS : DURATION_MS[item.kind];
    const t = window.setTimeout(() => setLeaving(true), duration - 300);
    return () => window.clearTimeout(t);
  }, [item.kind, item.action]);

  return (
    <div
      className={`toast toast-${item.kind} ${leaving ? 'toast-leaving' : ''}`}
      role={item.kind === 'error' ? 'alert' : 'status'}
    >
      <span className="toast-icon" aria-hidden>
        {item.kind === 'success' && '✓'}
        {item.kind === 'error' && '✕'}
        {item.kind === 'warning' && '!'}
        {item.kind === 'info' && 'i'}
      </span>
      <div className="toast-body">
        <strong>{item.title}</strong>
        {item.description && <p>{item.description}</p>}
      </div>
      {item.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            item.action!.onClick();
            onDismiss();
          }}
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        className="toast-close"
        onClick={onDismiss}
        aria-label="Fechar notificação"
      >
        ×
      </button>
    </div>
  );
}
