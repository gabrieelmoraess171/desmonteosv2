import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  KeyRound,
  Loader2,
  LockKeyhole,
  Package,
  Receipt,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { DEFAULT_COMPANY_NAME, STORAGE_KEYS } from '../config/app';

const TOTAL_DIGITOS = 8;
const MINIMO_DIGITOS = 4;

function lerNomeEmpresa(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.companyName) || DEFAULT_COMPANY_NAME;
  } catch {
    return DEFAULT_COMPANY_NAME;
  }
}

export default function Login() {
  const { isAuthenticated, isLoading, pinConfigurado, login, criarPin } = useAuth();
  const location = useLocation();
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [empresa] = useState(lerNomeEmpresa);
  const inputRef = useRef<HTMLInputElement>(null);

  const primeiroAcesso = pinConfigurado === false;
  const destino = { pathname: '/', search: location.search };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const slots = useMemo(
    () =>
      Array.from({ length: TOTAL_DIGITOS }, (_, indice) => indice < pin.length),
    [pin]
  );

  const podeEnviar = !enviando;

  if (isLoading) {
    return (
      <main className="flex min-h-[100svh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="sr-only">Carregando</span>
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={destino} replace />;
  }

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!podeEnviar) {
      setErro(
        primeiroAcesso
          ? `Crie um PIN com ${MINIMO_DIGITOS} a ${TOTAL_DIGITOS} dígitos.`
          : `Digite o PIN de ${MINIMO_DIGITOS} a ${TOTAL_DIGITOS} dígitos.`
      );
      return;
    }

    setErro('');
    setEnviando(true);

    try {
      if (primeiroAcesso) {
        await criarPin(pin);
      } else {
        await login(pin);
      }
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : 'Não foi possível abrir o painel agora.'
      );
      setPin('');
      inputRef.current?.focus();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="relative isolate flex min-h-[100svh] w-full overflow-hidden">
      <div className="ambient-blob ambient-blob--blue -left-40 -top-48" />
      <div className="ambient-blob ambient-blob--violet -right-40 top-1/4" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-[1fr_auto] lg:gap-16 lg:py-16">
        <section className="order-2 lg:order-1">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-[13px] font-bold uppercase tracking-[0.22em] text-ink">
                Desmonte OS
              </p>
              <p className="text-xs text-muted">{empresa}</p>
            </div>
          </div>

          <h1 className="mt-8 max-w-lg font-heading text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-ink sm:text-5xl">
            O painel da sua loja, atrás de uma chave só.
          </h1>

          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            Estoque, anúncios, vendas e atendimento do Mercado Livre em um
            lugar. Entre com o seu PIN para continuar de onde parou.
          </p>

          <dl className="mt-10 grid max-w-md grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icone: Package, titulo: 'Estoque', texto: 'Cada peça com ficha' },
              { icone: Receipt, titulo: 'Vendas', texto: 'Fechamento do dia' },
              { icone: ShieldCheck, titulo: 'Acesso', texto: 'Somente você' },
            ].map(({ icone: Icone, titulo, texto }) => (
              <div
                key={titulo}
                className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3.5"
              >
                <Icone className="h-4 w-4 text-cyan" />
                <dt className="mt-2.5 text-sm font-semibold text-ink">{titulo}</dt>
                <dd className="mt-0.5 text-xs text-muted">{texto}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="order-1 lg:order-2">
          <div className="glass-panel w-full rounded-[2rem] p-6 shadow-glass sm:p-8 lg:w-[26rem]">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                  primeiroAcesso
                    ? 'border-warning/25 bg-warningSoft text-warning'
                    : 'border-white/10 bg-white/[0.05] text-accent'
                }`}
              >
                {primeiroAcesso ? (
                  <KeyRound className="h-5 w-5" />
                ) : (
                  <LockKeyhole className="h-5 w-5" />
                )}
              </span>
              <div>
                <h2 className="font-heading text-xl font-bold tracking-[-0.02em] text-ink">
                  {primeiroAcesso ? 'Crie seu PIN' : 'Entrar'}
                </h2>
                <p className="text-xs text-muted">
                  {primeiroAcesso
                    ? 'É o primeiro acesso a este painel.'
                    : 'Digite o PIN do proprietário.'}
                </p>
              </div>
            </div>

            <form onSubmit={enviar} className="mt-7">
              <label htmlFor="pin" className="sr-only">
                PIN do proprietário
              </label>
              <input
                ref={inputRef}
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={TOTAL_DIGITOS}
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, '').slice(0, TOTAL_DIGITOS));
                  setErro('');
                }}
                className="sr-only"
              />

              <div
                className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-shadow focus-within:border-accent/50 focus-within:shadow-[0_0_0_2px_rgba(76,157,255,0.35)]"
                onClick={() => inputRef.current?.focus()}
              >
                {slots.map((preenchido, indice) => (
                  <div
                    key={indice}
                    className={`flex h-12 flex-1 items-center justify-center rounded-xl border text-xl font-semibold transition-colors ${
                      preenchido
                        ? 'border-accent/40 bg-accentSoft text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                        : 'border-white/10 bg-white/[0.02] text-muted/40'
                    }`}
                  >
                    {preenchido ? '•' : ''}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>
                  {pin.length < MINIMO_DIGITOS
                    ? `Mínimo de ${MINIMO_DIGITOS} dígitos`
                    : `${pin.length} de ${TOTAL_DIGITOS}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPin('');
                    setErro('');
                    inputRef.current?.focus();
                  }}
                  className="rounded-lg px-2 py-1 transition-colors hover:text-ink"
                >
                  Limpar
                </button>
              </div>

              {erro && (
                <p
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-dangerSoft px-3.5 py-3 text-sm text-danger"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={!podeEnviar}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_-20px_rgba(76,157,255,0.95)] transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Abrindo o painel
                  </>
                ) : (
                  <>
                    {primeiroAcesso ? 'Criar PIN e abrir' : 'Abrir painel'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs leading-relaxed text-muted">
              {primeiroAcesso
                ? 'Guarde este PIN em segurança. Sem ele não é possível abrir o painel.'
                : 'O PIN fica salvo apenas como hash, com criptografia, no servidor.'}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
