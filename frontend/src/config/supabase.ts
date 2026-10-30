import { createClient } from '@supabase/supabase-js';

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const publishableKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase =
  url && publishableKey ? createClient(url, publishableKey) : null;

export const supabaseAuthConfigured = Boolean(supabase);
