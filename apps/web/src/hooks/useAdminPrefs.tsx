/**
 * Preferências do painel /admin, compartilhadas entre as páginas.
 *
 * Hoje guarda só `includeTest` — se as RPCs admin devem incluir os perfis
 * is_test=true (seed 0016) ou mostrar apenas dados reais (default).
 * Persiste em localStorage pra sobreviver a reloads.
 */

import { createContext, useContext, useState, useCallback } from 'react';

const STORAGE_KEY = 'psp2:admin_include_test';

interface AdminPrefs {
  includeTest: boolean;
  setIncludeTest: (v: boolean) => void;
}

const AdminPrefsContext = createContext<AdminPrefs | null>(null);

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function AdminPrefsProvider({ children }: { children: React.ReactNode }) {
  const [includeTest, setIncludeTestState] = useState<boolean>(readInitial);

  const setIncludeTest = useCallback((v: boolean) => {
    setIncludeTestState(v);
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* localStorage indisponível (modo privado) — só não persiste */
    }
  }, []);

  return (
    <AdminPrefsContext.Provider value={{ includeTest, setIncludeTest }}>
      {children}
    </AdminPrefsContext.Provider>
  );
}

export function useAdminPrefs(): AdminPrefs {
  const ctx = useContext(AdminPrefsContext);
  if (!ctx) throw new Error('useAdminPrefs precisa estar dentro de <AdminPrefsProvider>');
  return ctx;
}
