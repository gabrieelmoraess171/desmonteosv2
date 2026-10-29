import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, LockKeyhole, Package, UserRound } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const destination = { pathname: '/', search: location.search };

  if (isAuthenticated) return <Navigate to={destination} replace />;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      login(username, password);
      setPassword('');
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar. Tente novamente.');
    }
  };

  return (
    <main className="flex min-h-screen min-h-[100svh] items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/30 bg-accentSoft text-accent">
            <Package className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">DESMONTE OS</span>
        </div>

        <section className="rounded-3xl border border-white/10 bg-card/90 p-6 shadow-glass backdrop-blur-xl sm:p-9" aria-labelledby="login-title">
          <span className="mb-5 inline-flex rounded-full border border-accent/25 bg-accentSoft px-3 py-1 text-xs font-medium text-accent">
            Acesso ao painel
          </span>
          <h1 id="login-title" className="text-3xl font-bold text-ink">Bem-vindo de volta</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">Entre para acompanhar seu estoque, vendas e atendimento.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
            <div>
              <label htmlFor="login-username" className="mb-2 block text-sm font-medium text-ink">Nome de Usuário</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-muted" aria-hidden="true" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={40}
                  required
                  value={username}
                  onChange={(event) => { setUsername(event.target.value); setError(''); }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                  placeholder="Digite seu usuário"
                  className="w-full rounded-xl border border-line py-3 pl-11 pr-4 text-base transition-shadow"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-ink">Senha</label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-muted" aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(''); }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                  placeholder="Digite sua senha"
                  className="w-full rounded-xl border border-line py-3 pl-11 pr-12 text-base transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1 rounded-lg p-2.5 text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div id="login-error" role="alert" className="flex items-start gap-2 rounded-xl border border-danger/25 bg-dangerSoft p-3 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              Entrar
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>

          <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed text-muted">
            Modo demonstração: use qualquer usuário e senha preenchidos.
            Sua sessão fica salva neste navegador.
          </p>
        </section>
        <p className="mt-6 text-center text-xs text-muted">Desmonte OS · Gestão de peças e vendas</p>
      </div>
    </main>
  );
}
