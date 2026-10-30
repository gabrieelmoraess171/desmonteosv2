import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Package, UserRound } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { isAuthenticated, isLoading, login, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const destination = { pathname: '/', search: location.search };

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to={destination} replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      if (isRegistering) {
        const precisaConfirmarEmail = await signUp(name, email, password);
        if (precisaConfirmarEmail) {
          setNotice('Cadastro realizado. Verifique seu e-mail para confirmar a conta e depois entre.');
          setIsRegistering(false);
          setPassword('');
        } else {
          navigate(destination, { replace: true });
        }
      } else {
        await login(email, password);
        setPassword('');
        navigate(destination, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir. Tente novamente.');
    } finally {
      setSubmitting(false);
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
            {isRegistering ? 'Criar acesso' : 'Acesso ao painel'}
          </span>
          <h1 id="login-title" className="text-3xl font-bold text-ink">
            {isRegistering ? 'Crie sua conta' : 'Bem-vindo de volta'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {isRegistering ? 'Cadastre seu nome, e-mail e uma senha segura.' : 'Entre para acompanhar seu estoque, vendas e atendimento.'}
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
            {isRegistering && (
              <div>
                <label htmlFor="login-name" className="mb-2 block text-sm font-medium text-ink">Nome completo</label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-muted" aria-hidden="true" />
                  <input id="login-name" name="name" type="text" autoComplete="name" maxLength={80} required value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Digite seu nome completo" className="w-full rounded-xl border border-line py-3 pl-11 pr-4 text-base transition-shadow" />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-ink">E-mail</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-muted" aria-hidden="true" />
                <input id="login-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="voce@empresa.com" className="w-full rounded-xl border border-line py-3 pl-11 pr-4 text-base transition-shadow" />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-ink">Senha</label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-muted" aria-hidden="true" />
                <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegistering ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} placeholder={isRegistering ? 'Mínimo de 8 caracteres' : 'Digite sua senha'} className="w-full rounded-xl border border-line py-3 pl-11 pr-12 text-base transition-shadow" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-1 top-1 rounded-lg p-2.5 text-muted hover:text-ink">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/25 bg-dangerSoft p-3 text-sm text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{error}</span></div>}
            {notice && <div role="status" className="rounded-xl border border-accent/25 bg-accentSoft p-3 text-sm text-accent">{notice}</div>}

            <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
              {submitting ? 'Aguarde...' : isRegistering ? 'Criar conta' : 'Entrar'}
              {!submitting && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
            </button>
          </form>

          <button type="button" onClick={() => { setIsRegistering((value) => !value); setError(''); setNotice(''); }} className="mt-6 w-full text-center text-sm font-medium text-accent hover:underline">
            {isRegistering ? 'Já tenho uma conta' : 'Ainda não tenho uma conta'}
          </button>
        </section>
        <p className="mt-6 text-center text-xs text-muted">Desmonte OS · Gestão de peças e vendas</p>
      </div>
    </main>
  );
}
