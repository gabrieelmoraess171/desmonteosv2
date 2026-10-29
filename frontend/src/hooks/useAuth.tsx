import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { SESSION_KEYS, STORAGE_KEYS } from '../config/app';

interface AuthUser {
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUser(): AuthUser | null {
  try {
    const saved: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.authUser) || 'null'
    );
    if (
      saved &&
      typeof saved === 'object' &&
      'username' in saved &&
      typeof saved.username === 'string' &&
      saved.username.trim()
    ) {
      return { username: saved.username.trim().slice(0, 40) };
    }
  } catch {
    // Dados inválidos ou armazenamento indisponível exigem um novo login.
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUser);

  useEffect(() => {
    const syncUser = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.authUser || event.key === null) {
        setUser(readUser());
      }
    };
    window.addEventListener('storage', syncUser);
    return () => window.removeEventListener('storage', syncUser);
  }, []);

  const login = useCallback((username: string, password: string) => {
    const name = username.trim().slice(0, 40);
    if (!name || !password.trim()) {
      throw new Error('Preencha o nome de usuário e a senha.');
    }

    const nextUser: AuthUser = { username: name };
    try {
      // Login de demonstração: somente o nome é persistido, nunca a senha.
      window.localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(nextUser));
    } catch {
      throw new Error(
        'Não foi possível salvar sua sessão. Permita o armazenamento neste navegador e tente novamente.'
      );
    }
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEYS.authUser);
    } catch {
      // A sessão em memória também é encerrada quando o navegador bloqueia o acesso.
    }
    try {
      window.sessionStorage.removeItem(SESSION_KEYS.ownerToken);
    } catch {
      // O token do proprietário deixa de ser utilizado ao desmontar o painel.
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: user !== null, login, logout }),
    [user, login, logout]
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
