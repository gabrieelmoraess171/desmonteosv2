import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowRight, ChevronDown, ImageOff, Layers, Loader2, Trophy } from 'lucide-react';
import { API_URL } from '../../config/api';
import VendaDetalheModal, { type VendaDetalheRelatorio } from '../VendaDetalheModal';

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
  periodoLabel,
  onViewAll,
}: TopTiposPecaProps) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<'7' | '14' | '30' | 'custom'>('7');
  const [datas, setDatas] = useState(() => intervalo(7));
  const [tipos, setTipos] = useState(tiposIniciais.slice(0, 10));
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [vendaDetalhe, setVendaDetalhe] = useState<VendaDetalheRelatorio | null>(null);
  const [abrindoVendaId, setAbrindoVendaId] = useState<number | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState('');
  const [limitesVendidos, setLimitesVendidos] = useState<Record<string, number>>({});
  const detalhes = useRef(new Map<number, { venda: VendaDetalheRelatorio; expiraEm: number }>());
  const consultaDetalhe = useRef<AbortController | null>(null);

  useEffect(() => () => consultaDetalhe.current?.abort(), []);

  useEffect(() => {
    if (periodo === '7' && /\b7\b/.test(periodoLabel)) setTipos(tiposIniciais.slice(0, 10));
  }, [tiposIniciais, periodoLabel, periodo]);

  useEffect(() => {
    if (!datas.inicio || !datas.fim || datas.inicio > datas.fim) {
      setErro('Informe uma data inicial e final válidas.');
      setCarregando(false);
      return;
    }
    const controller = new AbortController();
    setCarregando(true);
    setErro('');
    setAberto(null);
    setLimitesVendidos({});
    axios.get<TipoPecaRanking[]>('/api/dashboard/ranking', {
      params: { periodo: '7', rankingInicio: datas.inicio, rankingFim: datas.fim },
      signal: controller.signal,
      timeout: 20000,
    }).then(({ data }) => {
      if (!controller.signal.aborted) setTipos(Array.isArray(data) ? data.slice(0, 10) : []);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setErro('Não foi possível atualizar o ranking. Tente novamente.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setCarregando(false);
    });
    return () => controller.abort();
  }, [datas.inicio, datas.fim]);

  const abrirVenda = async (id: number) => {
    consultaDetalhe.current?.abort();
    setErroDetalhe('');
    const salva = detalhes.current.get(id);
    if (salva && salva.expiraEm > Date.now()) {
      setAbrindoVendaId(null);
      setVendaDetalhe(salva.venda);
      return;
    }
    const controller = new AbortController();
    consultaDetalhe.current = controller;
    setAbrindoVendaId(id);
    try {
      const { data } = await axios.get<VendaDetalheRelatorio>(`/api/vendas/${id}`, {
        signal: controller.signal,
        timeout: 20000,
      });
      if (controller.signal.aborted) return;
      const cancelada = data.status_grupo === 'cancelada';
      const bruto = Number(data.valor_bruto ?? data.valor) || 0;
      const taxa = Number(data.taxa_ml) || 0;
      const imagem = data.peca_imagem;
      const venda = {
        ...data,
        valor_bruto: bruto,
        valor_liquido: cancelada ? 0 : Number(data.valor_liquido ?? (bruto - taxa)),
        cancelada,
        recebido: data.status_grupo === 'concluida',
        is_ml: /ml|mercado\s*livre/i.test(data.plataforma || ''),
        itens: Array.isArray(data.itens) ? data.itens : [],
        peca_imagem: imagem?.startsWith('/') ? `${API_URL}${imagem}` : imagem,
      };
      detalhes.current.set(id, { venda, expiraEm: Date.now() + 30000 });
      setVendaDetalhe(venda);
    } catch {
      if (!controller.signal.aborted) setErroDetalhe('Não foi possível abrir os dados desta venda. Tente novamente.');
    } finally {
      if (!controller.signal.aborted) setAbrindoVendaId(null);
    }
  };

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
            Agrupado pelo primeiro nome da peça, sem misturar acessórios
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
      {erroDetalhe && <p role="alert" className="mb-4 text-sm text-danger">{erroDetalhe}</p>}
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
            const vendidos = item.vendidos || [];
            const limite = limitesVendidos[item.tipo] || 20;

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
                    {vendidos.slice(0, limite).map((venda, indice) => (
                      <button key={`${venda.vendaId}-${indice}`} type="button" onClick={() => void abrirVenda(venda.vendaId)}
                        aria-label={`Ver dados da venda ${venda.pedido || venda.vendaId}: ${venda.nome || item.tipo}`}
                        aria-busy={abrindoVendaId === venda.vendaId}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-xs transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-muted">
                          <ImageOff className="h-4 w-4" aria-hidden="true" />
                          {venda.imagem && <img src={venda.imagem.startsWith('/') ? `${API_URL}${venda.imagem}` : venda.imagem} alt={`Foto de ${venda.nome || item.tipo}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                        </span>
                        <span className="min-w-0 flex-1 text-muted">
                          <span className="block font-medium text-ink">{venda.nome || item.tipo}</span>
                          <span className="block">Pedido {venda.pedido || venda.vendaId} • {venda.cliente} • {venda.quantidade} un.</span>
                          {venda.data && <span className="mt-1 block text-[10px]">{new Date(venda.data.replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1 font-medium">
                          {formatarMoeda(venda.valor)}
                          {abrindoVendaId === venda.vendaId ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <span className="inline-flex items-center gap-1 text-[10px] text-accent">Ver venda <ArrowRight className="h-3 w-3" aria-hidden="true" /></span>}
                        </span>
                      </button>
                    ))}
                    {vendidos.length > limite && (
                      <button type="button" onClick={() => setLimitesVendidos(atual => ({ ...atual, [item.tipo]: limite + 20 }))}
                        className="py-2 text-xs font-medium text-accent hover:text-cyan">
                        Mostrar mais vendas ({vendidos.length - limite} restante(s))
                      </button>
                    )}
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
      <VendaDetalheModal venda={vendaDetalhe} onClose={() => setVendaDetalhe(null)} />
    </section>
  );
}
