import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileText,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { getGreetingPeriod, getInitials } from '../utils/greeting';

interface OnboardingProps {
  defaultCompany: string;
  onComplete: (nome: string) => void;
}

const RECURSOS = [
  {
    icon: Package,
    title: 'Estoque organizado',
    description: 'Cada peça pronta para virar um anúncio.',
  },
  {
    icon: MessageCircle,
    title: 'Atendimento em dia',
    description: 'Perguntas e reclamações em um só lugar.',
  },
  {
    icon: FileText,
    title: 'Fechamento sem atrito',
    description: 'Vendas do dia prontas para o financeiro.',
  },
];

export default function Onboarding({
  defaultCompany,
  onComplete,
}: OnboardingProps) {
  const [nome, setNome] = useState('');
  const nomeLimpo = nome.replace(/\s+/g, ' ').trim().slice(0, 40);
  const nomeValido = nomeLimpo.length > 0;
  const iniciais = getInitials(nomeLimpo || 'Operador');
  const saudacao = getGreetingPeriod();
  const dataAtual = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date());
  const dataFormatada =
    dataAtual.charAt(0).toUpperCase() + dataAtual.slice(1);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!nomeValido) return;
    onComplete(nomeLimpo);
  };

  return (
    <main className="onboarding-screen relative isolate flex min-h-screen min-h-[100svh] w-full items-center justify-center overflow-hidden px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
      <div
        className="pointer-events-none fixed inset-0 -z-20 overflow-hidden"
        aria-hidden="true"
      >
        <div className="ambient-blob ambient-blob--blue onboarding-blob-left" />
        <div className="ambient-blob ambient-blob--violet onboarding-blob-right" />
        <div className="ambient-blob ambient-blob--teal onboarding-blob-bottom" />
        <div className="onboarding-grid" />
      </div>

      <div className="relative z-10 w-full max-w-6xl">
        <header className="onboarding-rise flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_44px_-22px_rgba(76,157,255,0.95)] backdrop-blur-2xl">
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/30 via-transparent to-cyan/20" />
              <span className="relative h-3 w-3 rounded-full bg-gradient-to-br from-white to-cyan shadow-[0_0_18px_rgba(100,210,255,0.9)]" />
            </span>
            <div>
              <p className="bg-gradient-to-r from-white via-[#e4f2ff] to-[#8cc8ff] bg-clip-text text-lg font-bold tracking-tight text-transparent sm:text-xl">
                DESMONTE OS
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                {defaultCompany}
              </p>
            </div>
          </div>

          <span className="glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Primeiro acesso
          </span>
        </header>

        <div className="mt-7 grid gap-4 sm:mt-9 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
          <section className="onboarding-rise onboarding-delay-1 glass-panel relative flex flex-col justify-between overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
            <div
              className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em]">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1.5 text-accent">
                  <Sparkles className="h-3.5 w-3.5" />
                  {saudacao.label}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-muted">
                  {dataFormatada}
                </span>
              </div>

              <h1 className="mt-7 max-w-2xl font-heading text-[2.6rem] font-bold leading-[0.98] tracking-[-0.055em] text-ink sm:text-5xl lg:text-[3.7rem]">
                Sua operação começa{' '}
                <span className="bg-gradient-to-r from-[#dceeff] via-[#9ed0ff] to-[#62b5ff] bg-clip-text text-transparent">
                  aqui.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                Um espaço só seu para acompanhar estoque, atendimento e o
                fechamento do dia. Antes de entrar, só precisamos saber como
                chamar você.
              </p>
            </div>

            <div className="relative mt-8 grid gap-2.5 sm:mt-10 sm:grid-cols-3 lg:grid-cols-1">
              {RECURSOS.map((recurso) => (
                <div
                  key={recurso.title}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-accent">
                    <recurso.icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {recurso.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {recurso.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-7 flex items-center gap-2 text-xs text-muted">
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              Seus dados ficam salvos apenas neste navegador.
            </div>
          </section>

          <section className="onboarding-rise onboarding-delay-2 glass-panel relative flex flex-col justify-center overflow-hidden rounded-[2rem] p-5 sm:p-8 lg:p-9">
            <div
              className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan/10 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-successSoft px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
                <BadgeCheck className="h-3.5 w-3.5" />
                Boas-vindas
              </span>

              <h2 className="mt-5 text-2xl font-bold leading-tight tracking-[-0.035em] text-ink sm:text-3xl">
                Como você gostaria
                <br className="hidden sm:block" /> de ser chamado?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Vamos usar seu nome na saudação e na sugestão de SKU das peças.
              </p>

              <form onSubmit={handleSubmit} className="mt-6">
                <label
                  htmlFor="onboarding-nome"
                  className="block text-sm font-medium text-ink"
                >
                  Seu nome
                </label>

                <div className="relative mt-3">
                  <span
                    className="pointer-events-none absolute left-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-white/15 bg-gradient-to-br from-accent via-[#6c7dff] to-cyan text-xs font-bold text-white shadow-[0_12px_28px_-16px_rgba(76,157,255,0.9)]"
                    aria-hidden="true"
                  >
                    {nomeLimpo ? iniciais : <UserRound className="h-4 w-4" />}
                  </span>
                  <input
                    id="onboarding-nome"
                    name="nome"
                    type="text"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    maxLength={40}
                    autoComplete="given-name"
                    autoFocus
                    placeholder="Ex: Gabriel"
                    aria-describedby="onboarding-nome-ajuda"
                    className="w-full rounded-2xl border border-white/10 py-4 pl-16 pr-4 text-base text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  />
                </div>
                <p
                  id="onboarding-nome-ajuda"
                  className="mt-2 text-xs leading-relaxed text-muted"
                >
                  Pode ser seu primeiro nome ou um apelido.
                </p>

                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-cyan">
                    <Building2 className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                      Sua empresa
                    </p>
                    <p className="truncate text-sm font-semibold text-ink">
                      {defaultCompany}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-muted">
                    Padrão
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  Você pode alterar o nome da empresa depois em Configurações.
                </p>

                <button
                  type="submit"
                  disabled={!nomeValido}
                  className={`group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all duration-300 ${
                    nomeValido
                      ? 'bg-accent text-white shadow-[0_18px_44px_-20px_rgba(76,157,255,0.95)] hover:-translate-y-0.5 hover:brightness-110'
                      : 'cursor-not-allowed border border-white/10 bg-white/[0.05] text-muted'
                  }`}
                >
                  Entrar no painel
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </button>
              </form>

              <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                Esta etapa aparece apenas na primeira visita. Suas preferências
                podem ser alteradas a qualquer momento.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
