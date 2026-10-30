import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRight, ChevronDown, ImageOff, Layers, Trophy } from 'lucide-react';
import { API_URL } from '../../config/api';

interface ProdutoVendido {
  vendaId: number;
  nome?: string;
  imagem?: string | null;
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

function dataLocal(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function intervalo(dias: number) {
  const fim = new Date();
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - dias + 1);
  return { inicio: dataLocal(inicio), fim: dataLocal(fim) };
}

export default function TopTiposPeca({
  tipos: tiposIniciais,
  onViewAll,
}: TopTiposPecaProps) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<'7' | '14' | '30' | 'custom'>('7');
  const [datas, setDatas] = useState(() => intervalo(7));
  const [tipos, setTipos] = useState(tiposIniciais);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!datas.inicio || !datas.fim || datas.inicio > datas.fim) return;
    const controller = new AbortController();
    setCarregando(true);
    setErro('');
    axios.get('/api/dashboard/analytics', {
      params: { periodo: '7', rankingInicio: datas.inicio, rankingFim: datas.fim },
      signal: controller.signal,
      timeout: 20000,
    }).then(({ data }) => {
      if (!controller.signal.aborted) setTipos(data.topTiposPeca || []);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setTipos([]);
        setErro('Não foi possível atualizar o ranking. Tente novamente.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setCarregando(false);
    });
    return () => controller.abort();
  }, [datas.inicio, datas.fim]);

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
            Peças agrupadas pelo nome, independentemente do lado
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-muted">
          <Layers className="h-3.5 w-3.5" />
          {tipos.length} produto(s)
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Período do ranking">
        {(['7', '14', '30', 'custom'] as const).map((opcao) => (
          <button key={opcao} type="button" aria-pressed={periodo === opcao} onClick={() => {
            setPeriodo(opcao);
            if (opcao !== 'custom') setDatas(intervalo(Number(opcao)));
          }} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${periodo === opcao ? 'border-accent/40 bg-accentSoft text-accent' : 'border-white/10 text-muted hover:text-ink'}`}>
            {opcao === 'custom' ? 'Escolher datas' : `${opcao} dias`}
          </button>
        ))}
      </div>
      {periodo === 'custom' && <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted">
        <label>De <input type="date" value={datas.inicio} max={datas.fim || undefined} onChange={(event) => setDatas((atual) => ({ ...atual, inicio: event.target.value }))} className="ml-1 rounded-lg border border-line px-2 py-1.5" /></label>
        <label>Até <input type="date" value={datas.fim} min={datas.inicio || undefined} onChange={(event) => setDatas((atual) => ({ ...atual, fim: event.target.value }))} className="ml-1 rounded-lg border border-line px-2 py-1.5" /></label>
      </div>}
      {erro && <p role="alert" className="mb-4 text-sm text-danger">{erro}</p>}
      {carregando && <p role="status" className="mb-4 text-xs text-muted">Atualizando ranking…</p>}

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
                    {(item.vendidos || []).map((venda, indice) => (
                      <div key={`${venda.vendaId}-${indice}`} className="flex items-center gap-3 text-xs">
                        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-muted">
                          <ImageOff className="h-4 w-4" aria-hidden="true" />
                          {venda.imagem && <img src={venda.imagem.startsWith('/') ? `${API_URL}${venda.imagem}` : venda.imagem} alt={`Foto de ${venda.nome || item.tipo}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                        </span>
                        <span className="min-w-0 flex-1 text-muted">
                          <span className="block font-medium text-ink">{venda.nome || item.tipo}</span>
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
