import { ArrowRight, Layers, Trophy } from 'lucide-react';

export interface CategoriaRanking {
  categoria: string;
  vendas: number;
  faturamento: number;
  pecas: number;
}

interface TopCategoriasProps {
  categorias: CategoriaRanking[];
  periodoLabel: string;
  onViewAll?: () => void;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

const CORES = [
  'from-accent to-cyan',
  'from-cyan to-success',
  'from-[#a78bfa] to-accent',
  'from-warning to-[#ff9f0a]',
  'from-success to-[#64d2ff]',
  'from-muted to-[#5b718c]',
];

export default function TopCategorias({
  categorias,
  periodoLabel,
  onViewAll,
}: TopCategoriasProps) {
  const maior = Math.max(1, ...categorias.map((item) => item.faturamento));

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Ranking inteligente
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-bold">
            <Trophy className="h-5 w-5 text-warning" />
            Categorias que mais faturam
          </h2>
          <p className="text-sm text-muted">
            {periodoLabel} • agrupado pela categoria da peça
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-muted">
          <Layers className="h-3.5 w-3.5" />
          {categorias.length} categoria(s)
        </span>
      </div>

      {categorias.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 text-center">
          <Trophy className="h-8 w-8 text-muted" />
          <p className="mt-3 text-sm font-medium">Ainda sem ranking no período</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
            Quando as vendas do Mercado Livre forem registradas, a categoria da
            peça sobe automaticamente para o ranking.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {categorias.map((item, indice) => {
            const percentual = Math.max(
              5,
              Math.round((item.faturamento / maior) * 100)
            );

            return (
              <li key={item.categoria}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-xs font-bold text-muted">
                    {indice + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {item.categoria}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {item.vendas} venda(s) • {item.pecas} peça(s) no estoque
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-sm font-semibold text-success">
                        {formatarMoeda(item.faturamento)}
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${CORES[indice % CORES.length]} transition-all duration-700`}
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-5 inline-flex w-full items-center gap-1 border-t border-line pt-4 text-sm font-medium text-accent hover:text-cyan"
        >
          Ver estoque por categoria
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}
