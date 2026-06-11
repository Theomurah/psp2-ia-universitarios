import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { createLogger } from '../lib/log';

const log = createLogger('auth');

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
}

// =============================================================================
// Store singleton de auth — UM getSession + UM onAuthStateChange pra app toda.
//
// Antes, cada componente que chamava useAuth (TopbarUser, RequireAuth,
// RequireAdmin, useIsAdmin, OnboardingPage…) criava o próprio listener; no
// supabase-js v2 cada inscrição recebe INITIAL_SESSION, então cada navegação
// gerava N logs `info` duplicados persistidos em activity_logs
// (auditoria 2026-06-10, achado WEB-HOOKS-LIB-04).
// =============================================================================

let authState: AuthState = { loading: true, session: null, user: null };
const stateListeners = new Set<() => void>();
let subscribed = false;
let lastUserId: string | null = null;

/**
 * QueryClient registrado pelos hooks montados (todos vivem sob o mesmo
 * QueryClientProvider). Usado pra limpar o cache no logout / troca de usuário:
 * as queries por usuário (['profile'], ['jobs'], ['user-metrics'], ['activity'])
 * não têm user_id na chave e ficariam "fresh" pro próximo login no mesmo
 * dispositivo (achado WEB-HOOKS-LIB-03 — cenário lab/biblioteca da UnB).
 */
let registeredQueryClient: QueryClient | null = null;

function setAuthState(next: AuthState): void {
  authState = next;
  for (const notify of stateListeners) notify();
}

/**
 * Limpa o cache do React Query FORA do callback de auth (setTimeout 0) —
 * o clear dispara refetch de queries ativas, e chamadas supabase síncronas
 * dentro do callback de onAuthStateChange podem travar no lock interno do
 * supabase-js.
 */
function scheduleQueryCacheClear(): void {
  const qc = registeredQueryClient;
  if (!qc) return;
  setTimeout(() => qc.clear(), 0);
}

function ensureAuthSubscription(): void {
  if (subscribed) return;
  subscribed = true;

  // Estado inicial (uma única vez por aba).
  void supabase.auth.getSession().then(({ data }) => {
    // Se um evento do listener já resolveu o estado, não regride.
    if (!authState.loading) return;
    lastUserId = data.session?.user?.id ?? null;
    setAuthState({ loading: false, session: data.session, user: data.session?.user ?? null });
  });

  // Listener ÚNICO de mudanças — vive pelo tempo de vida da aba.
  supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id ?? null;

    // INITIAL_SESSION/TOKEN_REFRESHED são ruído recorrente → debug (não é
    // persistido em activity_logs). Transições reais (sign-in/sign-out etc)
    // ficam em info pra trilha de auditoria — agora logadas UMA vez por evento.
    // Loga o tipo de evento + se há usuário (nunca email/token).
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
      log.debug('auth_state_change', { event, has_session: !!session, user_id: userId ?? undefined });
    } else {
      log.info('auth_state_change', { event, has_session: !!session, user_id: userId ?? undefined });
    }

    // Logout (inclusive iniciado em outra aba) ou troca de usuário sem logout
    // explícito → zera o cache do React Query pra não vazar dados entre contas.
    const userChanged = userId !== null && lastUserId !== null && userId !== lastUserId;
    if (event === 'SIGNED_OUT' || userChanged) scheduleQueryCacheClear();
    lastUserId = userId;

    setAuthState({ loading: false, session, user: session?.user ?? null });
  });
}

function subscribeToStore(notify: () => void): () => void {
  ensureAuthSubscription();
  stateListeners.add(notify);
  return () => {
    stateListeners.delete(notify);
  };
}

function getSnapshot(): AuthState {
  return authState;
}

/**
 * Hook que observa o estado da sessão Supabase em tempo real.
 * Reage a sign-in, sign-out, refresh de token e mudanças entre tabs.
 *
 * A subscription Supabase é singleton de módulo: N componentes consumidores,
 * 1 listener. A API do hook permanece a mesma (`{ loading, session, user }`).
 */
export function useAuth(): AuthState {
  const queryClient = useQueryClient();
  useEffect(() => {
    registeredQueryClient = queryClient;
  }, [queryClient]);
  return useSyncExternalStore(subscribeToStore, getSnapshot);
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email: string, password: string, fullName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName ?? email } },
  });
  if (error) throw error;
  return data;
}

export async function signInWithMagicLink(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  // Limpa o cache DEPOIS do signOut bem-sucedido (achado WEB-HOOKS-LIB-03).
  // Redundante com o handler de SIGNED_OUT acima — clear() é idempotente e a
  // dupla cobertura garante o cenário de signOut sem listener montado.
  registeredQueryClient?.clear();
}
