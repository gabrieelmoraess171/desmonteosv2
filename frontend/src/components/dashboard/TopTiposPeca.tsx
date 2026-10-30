import { useState } from 'react';
import { ArrowRight, ChevronDown, Layers, Trophy } from 'lucide-react';

interface ProdutoVendido {
  vendaId: number;
  pedido?: string | null;
  cliente: string;
  data: string;
  quantidade: number;
  valor: number;
}

export interface TipoPecaRanking {
  tipo: string;
  vendas: number;
  unidades: number;
  faturamento: number;
  vendidos: ProdutoVendido[];
}

interface TopTiposPecaProps {
  tipos: TipoPecaRanking[];
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

export default function TopTiposPeca({
  tipos,
  periodoLabel,
  onViewAll,
}: TopTiposPecaProps) {
  const [aberto, setAberto] = useState<string | null>(null);
  const maior = Math.max(1, ...tipos.map((item) => item.unidades));

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Termômetro de produtos Mercado Livre
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-bold">
            <Trophy className="h-5 w-5 text-warning" />
            O que mais está vendendo
          </h2>
          <p className="text-sm text-muted">
            {periodoLabel} • produtos reais vendidos, sem agrupar por categoria
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-muted">
          <Layers className="h-3.5 w-3.5" />
          {tipos.length} produto(s)
        </span>
      </div>

      {tipos.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 text-center">
          <Trophy className="h-8 w-8 text-muted" />
          <p className="mt-3 text-sm font-medium">Ainda sem ranking no período</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
            Quando as vendas forem registradas, o nome do produto sobe
            automaticamente no termômetro.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {tipos.map((item, indice) => {
            const percentual = Math.max(5, Math.round((item.unidades / maior) * 100));
            const expandido = aberto === item.tipo;

            return (
              <li key={item.tipo} className="rounded-xl transition-colors hover:bg-white/[0.03]">
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? null : item.tipo)}
                  className="flex w-full items-start gap-3 p-2 text-left"
                  aria-expanded={expandido}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-xs font-bold text-muted">
                    {indice + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.tipo}</p>
                        <p className="truncate text-xs text-muted">
                          {item.vendas} venda(s) • {item.unidades} unidade(s)
                        </p>
                      </div>
                      <span className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-success">
                        {formatarMoeda(item.faturamento)}
                        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${expandido ? 'rotate-180' : ''}`} />
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full origin-left animate-[grow_700ms_ease-out] rounded-full bg-gradient-to-r ${CORES[indice % CORES.length]}`}
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                  </div>
                </button>
                {expandido && (
                  <div className="ml-12 mr-2 space-y-2 border-l border-line pb-2 pl-3">
                    {(item.vendidos || []).map((venda) => (
                      <div key={`${venda.vendaId}-${venda.quantidade}`} className="flex justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate text-muted">
                          Pedido {venda.pedido || venda.vendaId} • {venda.cliente} • {venda.quantidade} un.
                        </span>
                        <span className="shrink-0 font-medium">{formatarMoeda(venda.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
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
          Ver estoque completo
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}
