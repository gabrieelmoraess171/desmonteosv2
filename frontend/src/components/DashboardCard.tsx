import type { KeyboardEvent, ReactNode } from 'react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
}

export default function DashboardCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  onClick,
}: DashboardCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`dashboard-card group relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 transition-all ${
        onClick
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
          : ''
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent via-cyan to-transparent opacity-50 transition-opacity group-hover:opacity-100" />
      <div className="dashboard-card__sheen pointer-events-none absolute -inset-y-20 -left-1/2 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {title}
          </p>
          <p className="mt-2 font-heading text-3xl font-bold leading-none tracking-wide text-ink">
            {value}
          </p>
          {subtitle && (
            <p className="mt-2 text-xs text-muted leading-relaxed">{subtitle}</p>
          )}
        </div>
        <div className="shrink-0 rounded-xl border border-line bg-secondary/80 p-2.5 transition-colors group-hover:border-accent/40">
          {icon}
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              trend.isPositive
                ? 'bg-successSoft text-success'
                : 'bg-dangerSoft text-danger'
            }`}
          >
            {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value).toFixed(1)}%
          </span>
          <span className="text-xs text-muted">vs. 30 dias anteriores</span>
        </div>
      )}
    </div>
  );
}
