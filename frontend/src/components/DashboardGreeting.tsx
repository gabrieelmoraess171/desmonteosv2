import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getGreetingPeriod, pickGreeting } from '../utils/greeting';

export default function DashboardGreeting({ userName }: { userName: string }) {
  const [greeting, setGreeting] = useState(() => pickGreeting(userName));

  useEffect(() => {
    const updatePeriod = () => {
      if (document.visibilityState !== 'visible') return;
      const period = getGreetingPeriod().key;
      setGreeting((current) => current.period === period ? current : pickGreeting(userName));
    };
    const timer = window.setInterval(updatePeriod, 60_000);
    document.addEventListener('visibilitychange', updatePeriod);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updatePeriod);
    };
  }, [userName]);

  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  return (
    <div className="dashboard-greeting">
      <div className="dashboard-greeting__eyebrow">
        <span><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Painel operacional</span>
        <span aria-hidden="true">·</span>
        <time>{today}</time>
      </div>
      <h2 className="dashboard-greeting__title">{greeting.headline}</h2>
      <p className="dashboard-greeting__phrase">{greeting.phrase}</p>
    </div>
  );
}
