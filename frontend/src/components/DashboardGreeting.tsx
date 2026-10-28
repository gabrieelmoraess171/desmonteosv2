import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import {
  getGreetingPeriod,
  pickMotivationalPhrase,
} from '../utils/greeting';

interface DashboardGreetingProps {
  userName: string;
}

export default function DashboardGreeting({
  userName,
}: DashboardGreetingProps) {
  const [phrase, setPhrase] = useState(() => pickMotivationalPhrase());
  const period = getGreetingPeriod();
  const name = userName.trim();
  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date());
  const todayLabel = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl">
          <Sparkles className="h-3.5 w-3.5" />
          Painel operacional
        </span>
        <span className="text-white/25">•</span>
        <span>{todayLabel}</span>
      </div>

      <h2 className="mt-5 font-heading text-4xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
        {period.label}
        {name ? ', ' : ''}
        {name && (
          <span className="bg-gradient-to-r from-white via-[#d7eaff] to-[#7fc0ff] bg-clip-text text-transparent">
            {name}
          </span>
        )}
        <span
          className="ml-2 inline-block align-middle text-3xl drop-shadow-[0_4px_18px_rgba(255,214,10,0.35)] sm:text-4xl"
          role="img"
          aria-label={period.emojiLabel}
        >
          {period.emoji}
        </span>
      </h2>

      <div className="mt-4 flex items-start gap-2.5">
        <p
          className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base"
          aria-live="polite"
        >
          {phrase}
        </p>
        <button
          type="button"
          onClick={() => setPhrase((current) => pickMotivationalPhrase(current))}
          className="group mt-0.5 shrink-0 rounded-full border border-white/10 bg-white/[0.05] p-1.5 text-muted transition-colors hover:bg-white/[0.09] hover:text-ink"
          title="Trocar frase"
          aria-label="Mostrar outra frase motivacional"
        >
          <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180" />
        </button>
      </div>
    </div>
  );
}
