import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { obterSupabase, supabaseAuthConfigured } from '../config/supabase';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(user: User | null): AuthUser | null {
  if (!user?.id || !user.email) return null;

  const metadata = user.user_metadata || {};
  const name = String(metadata.full_name || metadata.name || '').trim();

  return {
    id: user.id,
    email: user.email,
    username: name || user.email.split('@')[0],
  };
}

function authError(message: string): Error {
  return new Error(message);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabaseAuthConfigured) {
      setIsLoading(false);
      return undefined;
    }

    let ativo = true;
    let cancelarInscricao: (() => void) | null = null;

    void obterSupabase()
      .then((supabase) => {
        if (!ativo || !supabase) return;

        void supabase.auth.getSession().then(({ data, error }) => {
          if (!ativo) return;
          if (error) console.error('Falha ao restaurar a sessão:', error);
          setUser(mapUser(data.session?.user || null));
          setIsLoading(false);

          const { data: inscricao } = supabase.auth.onAuthStateChange(
            (_event, session) => {
              if (ativo) setUser(mapUser(session?.user || null));
            }
          );
          cancelarInscricao = () => inscricao.subscription.unsubscribe();
        });
      })
      .catch((error) => {
        if (!ativo) return;
        console.error('Falha ao carregar a autenticação:', error);
        setIsLoading(false);
      });

    return () => {
      ativo = false;
      cancelarInscricao?.();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!supabaseAuthConfigured) {
      throw authError('A autenticação ainda não foi configurada neste ambiente.');
    }
    if (!normalizedEmail || !password) {
      throw authError('Preencha o e-mail e a senha.');
    }

    const supabase = await obterSupabase();

    if (!supabase) {
      throw authError('A autenticação ainda não foi configurada neste ambiente.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        throw authError('E-mail ou senha inválidos.');
      }
      throw authError(error.message);
    }

    setUser(mapUser(data.user));
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!supabaseAuthConfigured) {
      throw authError('A autenticação ainda não foi configurada neste ambiente.');
    }
    if (!normalizedName || !normalizedEmail || !password) {
      throw authError('Preencha nome, e-mail e senha.');
    }
    if (normalizedName.length < 2) {
      throw authError('Digite seu nome completo.');
    }
    if (password.length < 8) {
      throw authError('A senha precisa ter pelo menos 8 caracteres.');
    }

    const supabase = await obterSupabase();

    if (!supabase) {
      throw authError('A autenticação ainda não foi configurada neste ambiente.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { full_name: normalizedName } },
    });

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        throw authError('Este e-mail já está cadastrado.');
      }
      throw authError(error.message);
    }

    setUser(mapUser(data.user));
    return !data.session;
  }, []);

  const logout = useCallback(async () => {
    const supabase = await obterSupabase();

    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw authError(error.message);
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      signUp,
      logout,
    }),
    [user, isLoading, login, signUp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return context;
}
