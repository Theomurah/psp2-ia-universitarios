import { createClient } from '@supabase/supabase-js';

// NOTA: este módulo NÃO usa o logger (lib/log.ts) DE PROPÓSITO. O log.ts importa
// `supabase` daqui pra persistir em activity_logs; se supabase.ts dependesse do
// log.ts criaria um ciclo de import. Por isso o guard de bootstrap usa
// `console.error` direto — é a única exceção justificada à regra "sem console
// cru" (mesmo padrão do app Kawi). Mensagem estática, sem PII/segredo.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[supabase-client] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
