import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import axios from 'axios';
import { OWNER_HEADER, SESSION_KEYS } from '../config/app';

interface StatusProprietario {
  configurado: boolean;
  autenticado: boolean;
}

interface AuthContextValue {
  token: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  pinConfigurado: boolean | null;
  login: (pin: string) => Promise<void>;
  criarPin: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function lerToken(): string {
  try {
    return window.sessionStorage.getItem(SESSION_KEYS.ownerToken) || '';
  } catch {
    return '';
  }
}

function salvarToken(token: string) {
  try {
    if (token) {
      window.sessionStorage.setItem(SESSION_KEYS.ownerToken, token);
    } else {
      window.sessionStorage.removeItem(SESSION_KEYS.ownerToken);
    }
  } catch {
    // A sessão continua válida mesmo sem sessionStorage.
  }
}

export function normalizarPin(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 8);
}

export function pinTemTamanhoValido(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

function mensagemDoErro(error: unknown, padrao: string): string {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error || padrao;
  }
  return padrao;
}

async function chamarRota<T>(rota: string, dados: unknown, token = '') {
  const { data } = await axios.post<T>(rota, dados, {
    headers: token ? { [OWNER_HEADER]: token } : undefined,
    timeout: 15000,
  });
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(lerToken);
  const [isLoading, setIsLoading] = useState(true);
  const [pinConfigurado, setPinConfigurado] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;
    const atual = lerToken();

    axios
      .get<StatusProprietario>('/api/proprietario/status', {
        headers: atual ? { [OWNER_HEADER]: atual } : undefined,
        timeout: 15000,
      })
      .then(({ data }) => {
        if (!ativo) return;

        setPinConfigurado(data.configurado);

        if (data.autenticado && atual) {
          setToken(atual);
        } else {
          setToken('');
          salvarToken('');
        }
      })
      .catch(() => {
        // Sem resposta do servidor a sessão guardada é descartada:
        // o token só vale enquanto o backend confirmar que está ativo.
        if (!ativo) return;
        setToken('');
        salvarToken('');
      })
      .finally(() => {
        if (ativo) setIsLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const login = useCallback(async (pin: string) => {
    const limpo = normalizarPin(pin);

    if (!pinTemTamanhoValido(limpo)) {
      throw new Error('O PIN precisa ter de 4 a 8 dígitos.');
    }

    try {
      const data = await chamarRota<{ token: string }>(
        '/api/proprietario/entrar',
        { pin: limpo }
      );

      setToken(data.token);
      salvarToken(data.token);
      setPinConfigurado(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setPinConfigurado(false);
      }
      throw new Error(
        mensagemDoErro(error, 'Não foi possível validar o PIN agora.')
      );
    }
  }, []);

  const criarPin = useCallback(async (pin: string) => {
    const limpo = normalizarPin(pin);

    if (!pinTemTamanhoValido(limpo)) {
      throw new Error('O PIN precisa ter de 4 a 8 dígitos.');
    }

    try {
      const data = await chamarRota<{ token: string }>(
        '/api/proprietario/configurar',
        { pin: limpo }
      );

      setToken(data.token);
      salvarToken(data.token);
      setPinConfigurado(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setPinConfigurado(true);
      }
      throw new Error(
        mensagemDoErro(error, 'Não foi possível criar o PIN agora.')
      );
    }
  }, []);

  const logout = useCallback(async () => {
    const atual = lerToken();

    // A sessão local sai antes da rede: o painel não pode ficar preso
    // esperando o servidor para sair.
    setToken('');
    salvarToken('');

    if (!atual) return;

    try {
      await chamarRota('/api/proprietario/sair', {}, atual);
    } catch {
      // O token expira sozinho no servidor; localmente já saiu.
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: token !== '',
      isLoading,
      pinConfigurado,
      login,
      criarPin,
      logout,
    }),
    [token, isLoading, pinConfigurado, login, criarPin, logout]
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
