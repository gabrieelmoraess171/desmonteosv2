import type { SupabaseClient } from '@supabase/supabase-js';

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const publishableKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabaseAuthConfigured = Boolean(url && publishableKey);

// O SDK do Supabase pesa mais que o app inteiro, e a maioria das sessões do
// painel nem usa login. Ele só é baixado quando existe configuração e alguém
// realmente chama a autenticação.
let cliente: SupabaseClient | null = null;
let carregamento: Promise<SupabaseClient | null> | null = null;

export function obterSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseAuthConfigured) return Promise.resolve(null);
  if (cliente) return Promise.resolve(cliente);

  if (!carregamento) {
    carregamento = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        cliente = createClient(url, publishableKey, {
          auth: {
            // Mantém a sessão no navegador entre recargas e novas visitas.
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        return cliente;
      })
      .catch((error) => {
        carregamento = null;
        throw error;
      });
  }

  return carregamento;
}
