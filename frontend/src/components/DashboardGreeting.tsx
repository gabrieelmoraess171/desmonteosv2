import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
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
    <div className="dashboard-greeting max-w-xl">
      <p className="dashboard-greeting__date text-[11px] leading-relaxed text-muted">
        {todayLabel}
      </p>
      <p className="mt-5 text-sm font-medium text-muted">
        {period.label}
        <span
          className="ml-2 inline-block align-middle text-base"
          role="img"
          aria-label={period.emojiLabel}
        >
          {period.emoji}
        </span>
      </p>
      <h2 className="dashboard-greeting__title mt-1 font-heading text-[28px] font-bold leading-tight tracking-tight text-ink">
        {name || 'Bem-vindo ao painel'}
      </h2>

      <div className="dashboard-greeting__phrase mt-3 flex items-start gap-2">
        <p
          className="max-w-md text-sm leading-relaxed text-muted"
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
