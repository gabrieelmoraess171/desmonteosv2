import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Lightbulb,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export interface InsightDashboard {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: 'alta' | 'media' | 'baixa';
  destino?: string;
  cta?: string;
}

interface InsightsPanelProps {
  insights: InsightDashboard[];
  onNavigate?: (destino: string) => void;
}

const PRIORIDADE = {
  alta: {
    label: 'Prioridade alta',
    className: 'border-danger/20 bg-dangerSoft text-danger',
    icon: AlertTriangle,
  },
  media: {
    label: 'Oportunidade',
    className: 'border-warning/20 bg-warningSoft text-warning',
    icon: Lightbulb,
  },
  baixa: {
    label: 'Boa prática',
    className: 'border-success/20 bg-successSoft text-success',
    icon: BadgeCheck,
  },
};

export default function InsightsPanel({
  insights,
  onNavigate,
}: InsightsPanelProps) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Análise automática
          </p>
          <h2 className="mt-1 text-xl font-bold">Sugestões para vender mais</h2>
          <p className="text-sm text-muted">
            Melhorias priorizadas a partir do estoque, anúncios e atendimento
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accentSoft px-3 py-1.5 text-xs font-medium text-accent">
          <TrendingUp className="h-3.5 w-3.5" />
          {insights.length} ação(ões)
        </span>
      </div>

      {insights.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 text-center">
          <BadgeCheck className="h-8 w-8 text-success" />
          <p className="mt-3 text-sm font-medium">Tudo em ordem por aqui</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
            Nenhuma pendência crítica encontrada. Continue acompanhando as vendas
            e mantenha a ficha técnica atualizada.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {insights.map((insight) => {
            const prioridade =
              PRIORIDADE[insight.prioridade] || PRIORIDADE.baixa;
            const Icone = prioridade.icon;

            return (
              <li
                key={insight.id}
                className="group rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.045]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${prioridade.className}`}
                  >
                    <Icone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">
                        {insight.titulo}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${prioridade.className}`}
                      >
                        {prioridade.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {insight.descricao}
                    </p>
                    {insight.cta && insight.destino && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate(insight.destino || 'dashboard')}
                        className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-cyan"
                      >
                        {insight.cta}
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
