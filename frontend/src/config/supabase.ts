import { createClient } from '@supabase/supabase-js';

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const publishableKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          // Mantém a sessão no navegador entre recargas e novas visitas.
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const supabaseAuthConfigured = Boolean(supabase);
