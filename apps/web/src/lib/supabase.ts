import { createClient } from '@supabase/supabase-js';
import { createLogger } from './log';

const log = createLogger('supabase-client');

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  log.error('missing_env', { has_url: !!SUPABASE_URL, has_anon_key: !!SUPABASE_ANON_KEY });
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
