import {
  AlertTriangle,
  BadgeCheck,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  TrendingDown,
  XCircle,
} from 'lucide-react';

export interface MetricaReputacao {
  chave: string;
  label: string;
  valor: string;
  detalhe: string;
  meta: string;
  status: 'success' | 'warning' | 'danger' | string;
}

export interface ReputacaoMlData {
  score: number;
  nivel: string;
  cor: 'success' | 'warning' | 'danger' | string;
  termometro: number;
  mensagem: string;
  periodoDias: number;
  atualizadoEm: string;
  fonte?: 'ml' | 'local' | string;
  metricas: MetricaReputacao[];
}

interface ReputacaoMlProps {
  reputacao: ReputacaoMlData;
  onMetricClick?: (chave: string) => void;
}

const TONS: Record<
  string,
  {
    texto: string;
    fundo: string;
    borda: string;
    barra: string;
    hex: string;
  }
> = {
  success: {
    texto: 'text-success',
    fundo: 'bg-successSoft',
    borda: 'border-success/20',
    barra: 'bg-success',
    hex: '#30d158',
  },
  warning: {
    texto: 'text-warning',
    fundo: 'bg-warningSoft',
    borda: 'border-warning/20',
    barra: 'bg-warning',
    hex: '#ffd60a',
  },
  danger: {
    texto: 'text-danger',
    fundo: 'bg-dangerSoft',
    borda: 'border-danger/20',
    barra: 'bg-danger',
    hex: '#ff453a',
  },
};

const ICONES: Record<string, typeof AlertTriangle> = {
  reclamacoes: AlertTriangle,
  cancelamentos: XCircle,
  perguntas: MessageSquare,
  vendas: ShoppingBag,
};

function tom(valor?: string) {
  return TONS[valor || 'warning'] || TONS.warning;
}

function formatarPercentual(valor: number): string {
  return `${Number(valor || 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })}%`;
}

const RAIO = 38;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

export default function ReputacaoMl({
  reputacao,
  onMetricClick,
}: ReputacaoMlProps) {
  const cor = tom(reputacao.cor);
  const score = Math.max(0, Math.min(100, Number(reputacao.score) || 0));
  const mensagemPositiva = score >= 80;
  const IconeMensagem = mensagemPositiva ? BadgeCheck : AlertTriangle;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
      <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-ml/10 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-ml" />
            Mercado Livre
          </p>
          <h2 className="mt-1 text-xl font-bold">Reputação do vendedor</h2>
          <p className="text-sm text-muted">
            {reputacao.fonte === 'ml'
              ? 'Dados reais do Mercado Livre'
              : `Termômetro estimado com base nos últimos ${
                  reputacao.periodoDias || 60
                } dias`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            {reputacao.fonte === 'ml' ? 'API Mercado Livre' : 'Estimativa local'}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${cor.borda} ${cor.fundo} ${cor.texto}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cor.barra}`} />
            {reputacao.nivel}
          </span>
        </div>
      </div>

      <div className="relative mt-5 flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
              <circle
                cx="50"
                cy="50"
                r={RAIO}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r={RAIO}
                fill="none"
                stroke={cor.hex}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={CIRCUNFERENCIA}
                strokeDashoffset={CIRCUNFERENCIA * (1 - score / 100)}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold leading-none text-ink">
                {score}
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                de 100
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <p className={`text-sm font-semibold ${cor.texto}`}>
              Termômetro {Number(reputacao.termometro || 0).toFixed(1)} de 5
            </p>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: 5 }, (_, indice) => {
                const ativo = indice < Math.round(Number(reputacao.termometro) || 0);
                return (
                  <span
                    key={indice}
                    className={`h-2 w-6 rounded-full ${
                      ativo ? cor.barra : 'bg-white/[0.08]'
                    }`}
                  />
                );
              })}
            </div>
            <p className="mt-2 max-w-[170px] text-[11px] leading-relaxed text-muted">
              Reclamações, cancelamentos e perguntas sem resposta puxam o
              termômetro para baixo.
            </p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {reputacao.metricas.map((metrica) => {
            const tomMetrica = tom(metrica.status);
            const Icone = ICONES[metrica.chave] || TrendingDown;

            return (
              <button
                key={metrica.chave}
                type="button"
                onClick={() => onMetricClick?.(metrica.chave)}
                disabled={!onMetricClick}
                title={`${metrica.detalhe} • ${metrica.meta}`}
                aria-label={`Abrir detalhes de ${metrica.label}`}
                className={`rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition-all ${
                  onMetricClick
                    ? 'cursor-pointer hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
                    : 'cursor-default'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    <Icone className={`h-3.5 w-3.5 shrink-0 ${tomMetrica.texto}`} />
                    <span className="truncate">{metrica.label}</span>
                  </span>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tomMetrica.barra}`} />
                </div>
                <p className={`mt-1.5 text-lg font-bold ${tomMetrica.texto}`}>
                  {metrica.valor}
                </p>
                <p className="truncate text-[10px] text-muted">
                  {metrica.detalhe}
                </p>
                <p className="mt-0.5 text-[10px] text-muted/70">{metrica.meta}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`relative mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${
          mensagemPositiva
            ? 'border-success/20 bg-successSoft text-success'
            : 'border-warning/20 bg-warningSoft text-warning'
        }`}
      >
        <IconeMensagem className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{reputacao.mensagem}</p>
      </div>
    </section>
  );
}
