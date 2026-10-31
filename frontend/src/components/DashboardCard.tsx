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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="dashboard-card__label text-xs font-medium text-muted">
            {title}
          </p>
          <p className="dashboard-card__value mt-1 font-heading text-2xl font-bold leading-tight tracking-tight text-ink">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{subtitle}</p>
          )}
        </div>
        <div className="dashboard-card__icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white" aria-hidden="true">
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
