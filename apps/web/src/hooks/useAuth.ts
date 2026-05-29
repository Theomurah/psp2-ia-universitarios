import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { createLogger } from '../lib/log';

const log = createLogger('auth');

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
}

/**
 * Hook que observa o estado da sessão Supabase em tempo real.
 * Reage a sign-in, sign-out, refresh de token e mudanças entre tabs.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
  });

  useEffect(() => {
    // Estado inicial
    supabase.auth.getSession().then(({ data }) => {
      setState({
        loading: false,
        session: data.session,
        user: data.session?.user ?? null,
      });
    });

    // Listener de mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Loga o tipo de evento + se há usuário (nunca email/token).
      log.info('auth_state_change', { event, has_session: !!session, user_id: session?.user?.id });
      setState({
        loading: false,
        session,
        user: session?.user ?? null,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
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
}
