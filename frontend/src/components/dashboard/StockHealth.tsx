import {
  AlertTriangle,
  BadgeCheck,
  Megaphone,
} from 'lucide-react';

export interface EstoqueResumo {
  pecas: number;
  unidades: number;
  valor: number;
  disponiveis: number;
  esgotadas: number;
  anuncios: number;
  anunciosDisponiveis?: number;
  anunciosEsgotados?: number;
  foraML?: number;
  anunciosRevisar?: number;
}

interface StockHealthProps {
  estoque: EstoqueResumo;
  vendasHojeML: number;
}

const RAIO = 52;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

export default function StockHealth({
  estoque,
  vendasHojeML,
}: StockHealthProps) {
  const total = Math.max(estoque.pecas, 0);
  const disponiveis = Math.min(Math.max(estoque.disponiveis, 0), total);
  const esgotadas = Math.max(total - disponiveis, 0);
  const fracaoDisponivel = total > 0 ? disponiveis / total : 0;
  const comprimentoDisponivel = CIRCUNFERENCIA * fracaoDisponivel;
  const comprimentoEsgotado = CIRCUNFERENCIA - comprimentoDisponivel;
  const anuncios = Number(estoque.anuncios || 0);
  const coberturaAnuncios = total > 0 ? Math.round((anuncios / total) * 100) : 0;
  const revisar = Number(estoque.anunciosRevisar || 0);

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Estoque Mercado Livre
        </p>
        <h2 className="mt-1 text-xl font-bold">Todos os anúncios</h2>
        <p className="text-sm text-muted">
          Cada peça conta como um anúncio individual
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6">
        <div className="relative h-40 w-40 shrink-0">
          <svg
            viewBox="0 0 140 140"
            className="h-full w-full"
            role="img"
            aria-label={`${disponiveis} itens disponíveis e ${esgotadas} esgotados`}
          >
            <circle
              cx="70"
              cy="70"
              r={RAIO}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="14"
            />
            {total > 0 && (
              <g transform="rotate(-90 70 70)">
                <circle
                  cx="70"
                  cy="70"
                  r={RAIO}
                  fill="none"
                  className="stock-ring-in"
                  stroke="#30D158"
                  strokeWidth="14"
                  strokeDasharray={`${comprimentoDisponivel} ${CIRCUNFERENCIA}`}
                  strokeLinecap="round"
                />
                {esgotadas > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={RAIO}
                    fill="none"
                    stroke="#FF453A"
                    strokeWidth="14"
                    strokeDasharray={`${Math.max(comprimentoEsgotado - 4, 0)} ${CIRCUNFERENCIA}`}
                    strokeDashoffset={-comprimentoDisponivel}
                    strokeLinecap="round"
                  />
                )}
              </g>
            )}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold leading-none">{total}</span>
            <span className="mt-1 text-[11px] uppercase tracking-wider text-muted">
              itens
            </span>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-success" />
            <span className="text-muted">Disponíveis</span>
            <span className="font-semibold">{disponiveis}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-danger" />
            <span className="text-muted">Esgotados</span>
            <span className="font-semibold">{esgotadas}</span>
          </div>
          <div className="border-t border-line pt-2">
            <p className="text-2xl font-bold">{anuncios}</p>
            <p className="text-xs text-muted">anúncios ativos no ML</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted">Cobertura de anúncios ML</span>
          <span className="font-semibold">{coberturaAnuncios}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="stock-bar-in h-full rounded-full bg-gradient-to-r from-cyan to-accent transition-all duration-700"
            style={{ width: `${coberturaAnuncios}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Megaphone className="h-3.5 w-3.5" />
            Anúncios ativos
          </div>
          <p className="mt-1 text-sm font-bold">{anuncios}</p>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <BadgeCheck className="h-3.5 w-3.5" />
            Vendas ML hoje
          </div>
          <p className="mt-1 text-sm font-bold">{vendasHojeML}</p>
        </div>
      </div>

      {revisar > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-warning/20 bg-warningSoft px-3 py-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {revisar} anúncio(s) com pendências para revisar
        </div>
      )}
    </section>
  );
}
