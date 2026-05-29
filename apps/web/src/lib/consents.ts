/**
 * Helpers LGPD — registra consentimento + exporta + deleta conta.
 *
 * As versões dos termos são fixadas aqui: ao alterar política, bumpar a
 * versão e re-pedir aceite ao usuário (futuro).
 */

import { supabase } from './supabase';

export const TOS_VERSION = '2026.05.26';
export const PRIVACY_VERSION = '2026.05.26';

export type ConsentType = 'tos' | 'privacy' | 'lgpd' | 'marketing';

export interface ConsentEntry {
  type: ConsentType;
  version: string;
}

/**
 * Registra um ou mais consentimentos no banco.
 * Best-effort: falha silenciosa via .catch() — não bloqueia signup.
 */
export async function recordConsent(userId: string, entries: ConsentEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({
    user_id: userId,
    consent_type: e.type,
    version: e.version,
    accepted: true,
    user_agent: navigator.userAgent.slice(0, 500),
  }));
  const { error } = await supabase
    .from('user_consents')
    .upsert(rows, { onConflict: 'user_id,consent_type,version' });
  if (error) throw error;
}

/**
 * Exporta TODOS os dados do usuário em JSON (Art. 18 II e V LGPD).
 * Chama a RPC `public.export_user_data()`.
 */
export async function exportUserData(): Promise<unknown> {
  const { data, error } = await supabase.rpc('export_user_data');
  if (error) throw error;
  return data;
}

/**
 * Deleta conta + todos os dados do usuário (Art. 18 VI LGPD).
 * Chama RPC `public.delete_my_account()` que apaga `auth.users` em cascade.
 * Depois faz logout local.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  // Limpa sessão local — o usuário já não existe.
  await supabase.auth.signOut().catch(() => {/* sessão pode já ter sido invalidada */});
}

/**
 * Faz download de um Blob como arquivo.
 */
export function downloadAsFile(content: string, filename: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
