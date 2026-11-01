import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Package,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import axios from 'axios';
import ModalCadastroPeca, {
  type PecaCompleta,
} from './ModalCadastroPeca';
import PecaDetalheModal from './PecaDetalheModal';
import NotaMlBadge from './NotaMlBadge';
import { CATEGORIAS_PECA } from '../config/categorias';

interface Peca extends PecaCompleta {
  quantidade: number;
  preco: number;
  ml_ativo: number;
  ml_status?: string | null;
  tipo_anuncio?: string | null;
  imagem_principal?: string | null;
  imagens_count?: number;
  ml_thumbnail?: string | null;
  ml_permalink?: string | null;
  vendas_count?: number | null;
  ml_vendas_count?: number | null;
  status?: 'inativo' | 'revisar' | 'pronto';
  motivos?: string[];
  aplicacao?: string | null;
  aplicacao_origem?: string | null;
  ml_publicado_em?: string | null;
}

type StatusFiltro =
  | 'todos'
  | 'ativos'
  | 'pronto'
  | 'revisar'
  | 'inativo'
  | 'sem-estoque';

interface PecasTableProps {
  limit?: number;
  onChange?: () => void;
  onViewAll?: () => void;
  initialStatusFiltro?: StatusFiltro;
  initialSearch?: string;
  searchRequestId?: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  pronto: {
    label: 'Pronto',
    className: 'bg-successSoft text-success border-success/20',
    dot: 'bg-success',
  },
  revisar: {
    label: 'Revisar',
    className: 'bg-warningSoft text-warning border-warning/20',
    dot: 'bg-warning',
  },
  inativo: {
    label: 'Pausado',
    className: 'bg-white/[0.06] text-muted border-white/10',
    dot: 'bg-muted',
  },
};

const CONDICAO_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  novo: {
    label: 'Novo',
    className: 'border-cyan/30 bg-cyan/10 text-cyan',
  },
  usado: {
    label: 'Usado',
    className: 'border-white/10 bg-white/[0.05] text-muted',
  },
  recondicionado: {
    label: 'Recondicionado',
    className: 'border-accent/30 bg-accentSoft text-accent',
  },
};

function infoCondicao(valor?: string | null) {
  const chave = String(valor || 'usado').toLowerCase();
  return (
    CONDICAO_CONFIG[chave] || {
      label: String(valor || 'Usado'),
      className: 'border-white/10 bg-white/[0.05] text-muted',
    }
  );
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function urlAnuncio(peca: Peca): string | null {
  if (!peca.ml_item_id) return null;
  return (
    peca.ml_permalink ||
    `https://www.mercadolivre.com.br/p/${encodeURIComponent(peca.ml_item_id)}`
  );
}

function normalizarBusca(valor: unknown): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function dataPublicacao(peca: Peca): number | null {
  if (!peca.ml_publicado_em) return null;
  const valor = new Date(peca.ml_publicado_em).getTime();
  return Number.isFinite(valor) ? valor : null;
}

function publicacaoLabel(peca: Peca): string {
  const data = dataPublicacao(peca);
  if (data === null) return peca.ml_item_id ? 'Publicação: data não disponível no ML' : 'Ainda não publicado no ML';
  return `Publicado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data))}`;
}

function aplicacaoLabel(peca: Peca): string {
  return peca.aplicacao || peca.carro || 'Aplicação não disponível';
}

function origemAplicacao(peca: Peca): string {
  return peca.aplicacao_origem === 'titulo_ml' ? 'Aplicação descrita no título do anúncio' : 'Aplicação registrada na ficha ou nas compatibilidades do Mercado Livre';
}

function anuncioVendido(peca: Peca): boolean {
  return (
    Number(peca.vendas_count || 0) > 0 &&
    Number(peca.quantidade || 0) <= 0
  );
}


export default function PecasTable({
  limit,
  onChange,
  onViewAll,
  initialStatusFiltro,
  initialSearch,
  searchRequestId,
}: PecasTableProps) {
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState(initialSearch || '');
  const [buscaDoHeader, setBuscaDoHeader] = useState(initialSearch !== undefined);
  const [ordenacao, setOrdenacao] = useState<'recentes' | 'antigos' | 'nome'>('recentes');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>(
    initialStatusFiltro || 'todos'
  );
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [pecaEmEdicao, setPecaEmEdicao] = useState<Peca | null>(null);
  const [pecaDetalheId, setPecaDetalheId] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);

  const fetchPecas = async () => {
    const params = new URLSearchParams({ resumo: '1' });
    if (limit !== undefined) params.set('limite', String(limit));

    for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
      try {
        const response = await axios.get<Peca[]>(
          `/api/pecas?${params.toString()}`,
          { timeout: 25000 }
        );
        setPecas(response.data);
        setLoading(false);
        return;
      } catch (error) {
        if (tentativa === 3) {
          console.error('Erro ao buscar peças:', error);
          setLoading(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, tentativa * 1500));
      }
    }
  };

  useEffect(() => {
    fetchPecas();
  }, [limit]);

  useEffect(() => {
    if (initialSearch === undefined) return;
    setBusca(initialSearch);
    setBuscaDoHeader(true);
    setStatusFiltro('todos');
    setCategoriaFiltro('todas');
    setPagina(1);
  }, [initialSearch, searchRequestId]);

  // A listagem vem resumida (sem descrição/atributos para ser rápida). Ao
  // editar, busca a ficha completa para não apagar dados ao salvar.
  const abrirEdicao = async (peca: Peca) => {
    try {
      const { data } = await axios.get<Peca>(`/api/pecas/${peca.id}`, {
        timeout: 12000,
      });
      setPecaEmEdicao(data);
    } catch {
      setPecaEmEdicao(peca);
    }
  };

  const handleDelete = async (peca: Peca) => {
    if (!confirm(`Excluir "${peca.nome}" do estoque?`)) return;

    try {
      const response = await axios.delete<{ message: string }>(
        `/api/pecas/${peca.id}`
      );
      alert(response.data.message);
      setPecas((prev) => prev.filter((item) => item.id !== peca.id));
      onChange?.();
    } catch (error: unknown) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        alert(error.response?.data?.error || 'Erro ao excluir peça');
      }
    }
  };

  const handleMLToggle = async (peca: Peca) => {
    const novoStatus = peca.ml_ativo ? 0 : 1;

    try {
      await axios.put(`/api/pecas/${peca.id}`, { ml_ativo: novoStatus });
      await fetchPecas();
      onChange?.();
    } catch (error: unknown) {
      alert(
        axios.isAxiosError<{ error?: string }>(error)
          ? error.response?.data?.error || 'Erro ao alterar status ML'
          : 'Erro ao alterar status ML'
      );
    }
  };

  const handleSuccess = () => {
    void fetchPecas();
    onChange?.();
  };

  const resumo = useMemo(
    () => ({
      total: pecas.length,
      ativos: pecas.filter((peca) => Boolean(peca.ml_ativo)).length,
      revisar: pecas.filter((peca) => peca.status === 'revisar').length,
      pausados: pecas.filter((peca) => !peca.ml_ativo).length,
      valor: pecas.reduce(
        (total, peca) => total + Number(peca.preco || 0) * Number(peca.quantidade || 0),
        0
      ),
    }),
    [pecas]
  );

  const filtradas = useMemo(() => {
    const termos = normalizarBusca(busca).split(' ').filter(Boolean);

    return pecas
      .filter((peca) => {
      const textoBusca = normalizarBusca(
        [peca.nome, peca.sku, peca.carro, peca.aplicacao, peca.categoria, peca.marca, peca.modelo, peca.ano, peca.numero_oem, peca.ml_titulo, peca.ml_item_id]
          .filter(Boolean)
          .join(' ')
      );
      // A busca é por palavras: "lanterna sw4" encontra "lanterna traseira
      // direita hilux sw4", mesmo que os termos não sejam consecutivos.
      const correspondeBusca = termos.every((termo) =>
        textoBusca.includes(termo)
      );

      if (!correspondeBusca) return false;

      if (categoriaFiltro !== 'todas' && peca.categoria !== categoriaFiltro) {
        return false;
      }

      if (statusFiltro === 'sem-estoque') return Number(peca.quantidade) <= 0;
      if (statusFiltro === 'ativos') return Boolean(peca.ml_ativo);
      if (statusFiltro === 'pronto') return peca.status === 'pronto';
      if (statusFiltro === 'revisar') return peca.status === 'revisar';
      if (statusFiltro === 'inativo') return !peca.ml_ativo;

        return true;
      })
      .sort((a, b) => {
        if (ordenacao === 'nome') {
          const porNome = String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
          if (porNome !== 0) return porNome;
        } else {
          const da = dataPublicacao(a), db = dataPublicacao(b);
          if (da !== null && db !== null) {
            if (da !== db) return ordenacao === 'recentes' ? db - da : da - db;
          } else if (da !== null) {
            return -1;
          } else if (db !== null) {
            return 1;
          }
        }

        // Desempates previsíveis: anúncios ativos e com estoque aparecem
        // antes dos inativos/zerados, sem quebrar a ordenação escolhida.
        const ativoA = Boolean(a.ml_ativo);
        const ativoB = Boolean(b.ml_ativo);
        if (ativoA !== ativoB) return ativoA ? -1 : 1;
        const quantidadeA = Math.max(0, Number(a.quantidade) || 0);
        const quantidadeB = Math.max(0, Number(b.quantidade) || 0);
        if (quantidadeA !== quantidadeB) return quantidadeB - quantidadeA;
        const vendidoA = anuncioVendido(a);
        const vendidoB = anuncioVendido(b);
        if (vendidoA !== vendidoB) return vendidoA ? 1 : -1;
        if (ordenacao === 'nome') return b.id - a.id;
        return ordenacao === 'recentes' ? b.id - a.id : a.id - b.id;
      });
  }, [pecas, busca, buscaDoHeader, categoriaFiltro, statusFiltro, ordenacao]);

  const exibidas = limit !== undefined ? filtradas.slice(0, limit) : filtradas;
  const completo = limit === undefined;
  const POR_PAGINA = 60;
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginadas = completo
    ? filtradas.slice(
        (paginaAtual - 1) * POR_PAGINA,
        paginaAtual * POR_PAGINA
      )
    : exibidas;

  useEffect(() => {
    setPagina(1);
  }, [busca, statusFiltro, categoriaFiltro, ordenacao]);

  const aplicarFiltroResumo = (filtro: StatusFiltro) => {
    setStatusFiltro(filtro);
    setBusca('');
    setCategoriaFiltro('todas');
  };

  const limparFiltros = () => {
    setStatusFiltro('todos');
    setBusca('');
    setCategoriaFiltro('todas');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-card py-12 text-sm text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        Carregando estoque...
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-lg shadow-black/20">
      <div className="border-b border-line p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              {completo ? 'Estoque completo' : 'Estoque Mercado Livre'}
            </p>
            <h2 className="mt-1 text-xl font-bold">
              {completo ? 'Todos os anúncios cadastrados' : 'Peças anunciadas'}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Cada peça é um anúncio individual. O estoque mostra todos os itens
              do Mercado Livre, sem agrupar quantidades.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCadastroModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Nova peça
          </button>
        </div>

        {completo && <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {[
            {
              label: 'Itens',
              valor: resumo.total,
              filtro: 'todos' as StatusFiltro,
              cor: 'text-ink',
            },
            {
              label: 'Anúncios ativos',
              valor: resumo.ativos,
              filtro: 'ativos' as StatusFiltro,
              cor: 'text-success',
            },
            {
              label: 'Inativos/Pausados',
              valor: resumo.pausados,
              filtro: 'inativo' as StatusFiltro,
              cor: 'text-muted',
            },
            {
              label: 'A revisar',
              valor: resumo.revisar,
              filtro: 'revisar' as StatusFiltro,
              cor: 'text-warning',
            },
            {
              label: 'Valor em estoque',
              valor: formatarMoeda(resumo.valor),
              filtro: null,
              cor: 'text-accent',
            },
          ].map((item) => {
            const ativo =
              item.filtro !== null &&
              item.filtro !== 'todos' &&
              statusFiltro === item.filtro;
            const clicavel = item.filtro !== null;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() =>
                  item.filtro && aplicarFiltroResumo(item.filtro)
                }
                disabled={!clicavel}
                aria-pressed={ativo}
                title={
                  clicavel
                    ? `Mostrar somente: ${item.label}`
                    : 'Valor total do estoque'
                }
                className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                  ativo
                    ? 'border-accent/60 bg-accentSoft shadow-[0_0_0_1px_rgba(76,157,255,0.25)]'
                    : clicavel
                      ? 'border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-accent/35 hover:bg-white/[0.06]'
                      : 'cursor-default border-white/10 bg-white/[0.03]'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {item.label}
                </p>
                <p className={`mt-1 truncate text-sm font-bold ${item.cor}`}>
                  {item.valor}
                </p>
                {ativo && (
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-accent">
                    Filtro ativo
                  </p>
                )}
              </button>
            );
          })}
        </div>}

        {statusFiltro !== 'todos' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>
              Mostrando <strong className="text-ink">{filtradas.length}</strong>{' '}
              {statusFiltro === 'ativos'
                ? 'anúncio(s) ativo(s)'
                : statusFiltro === 'inativo'
                  ? 'item(ns) inativo(s)/pausado(s)'
                  : statusFiltro === 'revisar'
                    ? 'anúncio(s) com pendência(s)'
                    : statusFiltro === 'pronto'
                      ? 'anúncio(s) pronto(s)'
                      : 'item(ns) sem estoque'}
            </span>
            <button
              type="button"
              onClick={limparFiltros}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-white/[0.08]"
            >
              Limpar filtro
            </button>
          </div>
        )}

        {completo && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_170px_190px_190px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
              <input
                type="search"
                value={busca}
                onChange={(event) => { setBusca(event.target.value); setBuscaDoHeader(false); }}
                placeholder="Buscar por peça, SKU, carro ou categoria..."
                className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"
              />
            </label>

            <select
              value={statusFiltro}
              onChange={(event) =>
                setStatusFiltro(event.target.value as StatusFiltro)
              }
              className="rounded-xl border px-3 py-2.5 text-sm"
              aria-label="Filtrar por status"
            >
              <option value="todos">Todos os status</option>
              <option value="ativos">Anúncios ativos</option>
              <option value="inativo">Inativos/Pausados</option>
              <option value="pronto">Prontos</option>
              <option value="revisar">A revisar</option>
              <option value="sem-estoque">Sem estoque</option>
            </select>

            <select
              value={categoriaFiltro}
              onChange={(event) => setCategoriaFiltro(event.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm"
              aria-label="Filtrar por categoria"
            >
              <option value="todas">Todas as categorias</option>
              {CATEGORIAS_PECA.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
            <select value={ordenacao} onChange={(event) => setOrdenacao(event.target.value as typeof ordenacao)} className="rounded-xl border px-3 py-2.5 text-sm" aria-label="Ordenar anúncios por publicação">
              <option value="recentes">Últimos publicados</option>
              <option value="antigos">Primeiros publicados</option>
              <option value="nome">Nome da peça (A–Z)</option>
            </select>
          </div>
        )}
      </div>

      {exibidas.length === 0 ? (
        <div className="p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 font-medium">
            {pecas.length === 0
              ? 'Nenhuma peça cadastrada ainda'
              : 'Nenhum resultado com esses filtros'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {pecas.length === 0
              ? 'Cadastre a primeira peça para começar o estoque.'
              : 'Ajuste a busca ou os filtros para ver outros anúncios.'}
          </p>
          {pecas.length === 0 && (
            <button
              type="button"
              onClick={() => setShowCadastroModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Cadastrar primeira peça
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto 2xl:block">
            <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-[0.14em] text-muted">
                <th className="px-5 py-3 font-semibold sm:px-6">Peça / anúncio</th>
                <th className="px-3 py-3 font-semibold">Categoria</th>
                <th className="px-3 py-3 font-semibold">Aplicação</th>
                <th className="px-3 py-3 font-semibold">Estoque</th>
                <th className="px-3 py-3 font-semibold">Preço</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">ML / nota</th>
                <th className="px-5 py-3 text-right font-semibold sm:px-6">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {paginadas.map((peca) => {
                const statusKey = peca.status || 'inativo';
                const status = STATUS_CONFIG[statusKey];
                const condicao = infoCondicao(peca.condicao);
                const revisar = statusKey === 'revisar';
                const vendido = anuncioVendido(peca);

                return (
                  <tr
                    key={peca.id}
                    onClick={() => setPecaDetalheId(peca.id)}
                    title="Clique para ver todos os dados da peça"
                    className="cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-white/[0.035]"
                  >
                    <td className="px-5 py-3.5 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-secondary">
                          {peca.imagem_principal ? (
                            <img decoding="async"
                              src={peca.imagem_principal}
                              alt={peca.nome}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="max-w-[260px] truncate font-medium text-ink">
                              {peca.nome}
                            </p>
                            {urlAnuncio(peca) && (
                              <a
                                href={urlAnuncio(peca) || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                title="Abrir anúncio no Mercado Livre"
                                aria-label={`Abrir anúncio de ${peca.nome} no Mercado Livre`}
                                className="inline-flex shrink-0 items-center justify-center rounded-md border border-ml/25 bg-ml/10 p-1 text-ml transition-colors hover:bg-ml/20"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                            <span className="inline-flex rounded-md border border-accent/35 bg-accentSoft px-2 py-1 font-mono text-sm font-bold text-accent">
                              {peca.sku || 'Sem SKU'}
                            </span>
                            <span>•</span>
                            {vendido && (
                              <>
                                <span className="inline-flex rounded-md border border-warning/30 bg-warningSoft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                                  Vendido
                                </span>
                                <span>•</span>
                              </>
                            )}
                            <span
                              className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${condicao.className}`}
                            >
                              {condicao.label}
                            </span>
                            <span>•</span>
                            <span>
                              {Number(peca.imagens_count) > 0
                                ? `${peca.imagens_count}/20 foto(s)`
                                : peca.ml_thumbnail
                                  ? 'Foto do ML'
                                  : 'Sem foto'}
                            </span>
                            {peca.ml_titulo && peca.ml_titulo !== peca.nome && (
                              <>
                                <span>•</span>
                                <span className="max-w-[180px] truncate">
                                  {peca.ml_titulo}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="mt-1 text-[10px] text-muted">{publicacaoLabel(peca)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col items-start gap-1.5">
                          <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-medium">
                          {peca.categoria || 'Sem categoria'}
                        </span>
                        {peca.ml_item_id && (
                          <span className="inline-flex rounded-md border border-accent/20 bg-accentSoft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                            MercadoLivre
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="max-w-[180px] truncate" title={`${origemAplicacao(peca)}: ${aplicacaoLabel(peca)}`}>
                        {aplicacaoLabel(peca)}
                      </p>
                      <p className="text-[11px] text-muted">
                        {[peca.marca, peca.ano].filter(Boolean).join(' • ') ||
                          'Sem marca/ano'}
                      </p>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          peca.quantidade > 0
                            ? 'bg-successSoft text-success'
                            : 'bg-dangerSoft text-danger'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            peca.quantidade > 0 ? 'bg-success' : 'bg-danger'
                          }`}
                        />
                        {peca.quantidade > 0 ? `${peca.quantidade} un.` : vendido ? '0 un. • Vendida' : '0 un. • Sem estoque'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 font-semibold">
                      {formatarMoeda(peca.preco)}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col items-start gap-1.5">
                        {vendido && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warningSoft px-2.5 py-1 text-xs font-bold text-warning">
                            Vendido
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                        >
                          {revisar ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                          )}
                          {status.label}
                        </span>
                      </div>
                      {revisar && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void abrirEdicao(peca);
                          }}
                          title="Clique para corrigir esta peça"
                          className="mt-1.5 block max-w-[210px] text-left text-[10px] leading-relaxed text-warning underline decoration-warning/30 underline-offset-2 transition-colors hover:text-[#ffe45c]"
                        >
                          {peca.motivos?.length
                            ? `Corrigir: ${peca.motivos.join(' • ')}`
                            : 'Corrigir anúncio'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col items-start gap-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleMLToggle(peca);
                          }}
                            className={`inline-flex items-center gap-1.5 rounded-lg border border-ml/40 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            peca.ml_ativo
                              ? 'bg-ml/15 text-ml hover:bg-ml/25'
                              : 'bg-ml/5 text-ml/70 hover:bg-ml/15'
                          }`}
                          title={
                            peca.ml_ativo
                              ? 'Anúncio ativo no Mercado Livre'
                              : 'Anúncio pausado'
                          }
                        >
                          {peca.ml_ativo ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {peca.ml_ativo ? 'Pausar anúncio' : 'Ativar anúncio'}
                        </button>
                        <NotaMlBadge peca={peca} compacto />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 sm:px-6">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPecaDetalheId(peca.id);
                          }}
                          title="Ver todos os dados"
                          aria-label={`Ver detalhes de ${peca.nome}`}
                          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-muted transition-colors hover:border-cyan/30 hover:text-cyan"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void abrirEdicao(peca);
                          }}
                          title="Editar ficha completa"
                          aria-label={`Editar ${peca.nome}`}
                          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-muted transition-colors hover:border-accent/30 hover:text-accent"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDelete(peca);
                          }}
                          title="Excluir peça"
                          aria-label={`Excluir ${peca.nome}`}
                          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-muted transition-colors hover:border-danger/30 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <div className="divide-y divide-line/70 2xl:hidden">
            {paginadas.map((peca) => {
              const statusKey = peca.status || 'inativo';
              const status = STATUS_CONFIG[statusKey];
              const condicao = infoCondicao(peca.condicao);
              const revisar = statusKey === 'revisar';
              const vendido = anuncioVendido(peca);

              return (
                <article
                  key={peca.id}
                  onClick={() => setPecaDetalheId(peca.id)}
                  className="cursor-pointer p-4 transition-colors active:bg-white/[0.05]"
                >
                  <div className="flex gap-3">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-secondary sm:h-28 sm:w-28">
                      {peca.imagem_principal ? (
                        <img decoding="async"
                          src={peca.imagem_principal}
                          alt={peca.nome}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
                            {peca.nome}
                          </p>
                          {urlAnuncio(peca) && (
                            <a
                              href={urlAnuncio(peca) || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              title="Abrir anúncio no Mercado Livre"
                              aria-label={`Abrir anúncio de ${peca.nome} no Mercado Livre`}
                              className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md border border-ml/25 bg-ml/10 p-1 text-ml transition-colors hover:bg-ml/20"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {vendido && (
                            <span className="rounded-full border border-warning/30 bg-warningSoft px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                              Vendido
                            </span>
                          )}
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                        <span className="inline-flex rounded-md border border-accent/35 bg-accentSoft px-2 py-1 font-mono text-xs font-bold text-accent">
                          {peca.sku || 'Sem SKU'}
                        </span>
                        <span
                          className={`inline-flex rounded-md border px-1.5 py-0.5 font-semibold ${condicao.className}`}
                        >
                          {condicao.label}
                        </span>
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
                          {peca.categoria || 'Sem categoria'}
                        </span>
                        {peca.ml_item_id && (
                          <span className="rounded-md border border-accent/20 bg-accentSoft px-1.5 py-0.5 font-semibold text-accent">
                            MercadoLivre
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="mt-2 text-[10px] text-muted">{publicacaoLabel(peca)}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        Aplicação
                      </p>
                      <p className="mt-0.5 truncate font-medium" title={`${origemAplicacao(peca)}: ${aplicacaoLabel(peca)}`}>
                        {aplicacaoLabel(peca)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        Estoque
                      </p>
                      <p
                        className={`mt-0.5 font-medium ${
                          peca.quantidade > 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {peca.quantidade > 0 ? `${peca.quantidade} un.` : vendido ? '0 un. • Vendida' : '0 un. • Sem estoque'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        Preço
                      </p>
                      <p className="mt-0.5 font-semibold">
                        {formatarMoeda(peca.preco)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleMLToggle(peca);
                        }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border border-ml/40 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                          peca.ml_ativo
                            ? 'bg-ml/15 text-ml'
                            : 'bg-ml/5 text-ml/70'
                        }`}
                      >
                        {peca.ml_ativo ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {peca.ml_ativo ? 'Pausar anúncio' : 'Ativar anúncio'}
                      </button>
                      <NotaMlBadge peca={peca} />
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPecaDetalheId(peca.id);
                        }}
                        aria-label={`Ver detalhes de ${peca.nome}`}
                        className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-muted transition-colors hover:text-cyan"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void abrirEdicao(peca);
                        }}
                        aria-label={`Editar ${peca.nome}`}
                        className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-muted transition-colors hover:text-accent"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(peca);
                        }}
                        aria-label={`Excluir ${peca.nome}`}
                        className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-muted transition-colors hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {revisar && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void abrirEdicao(peca);
                      }}
                      className="mt-2 block text-left text-[10px] leading-relaxed text-warning underline decoration-warning/30 underline-offset-2"
                    >
                      {peca.motivos?.length
                        ? `Corrigir: ${peca.motivos.join(' • ')}`
                        : 'Corrigir anúncio'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      {completo && totalPaginas > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
          <p className="text-xs text-muted">
            {filtradas.length} peça(s) • página {paginaAtual} de{' '}
            {totalPaginas}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
              disabled={paginaAtual === 1}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-white/[0.09] disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() =>
                setPagina((atual) => Math.min(totalPaginas, atual + 1))
              }
              disabled={paginaAtual === totalPaginas}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-white/[0.09] disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {!completo && onViewAll && (
        <div className="border-t border-line px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-cyan"
          >
            Ver estoque completo →
          </button>
        </div>
      )}

      <ModalCadastroPeca
        isOpen={showCadastroModal}
        onClose={() => setShowCadastroModal(false)}
        onSuccess={handleSuccess}
      />

      <ModalCadastroPeca
        isOpen={Boolean(pecaEmEdicao)}
        peca={pecaEmEdicao}
        onClose={() => setPecaEmEdicao(null)}
        onSuccess={handleSuccess}
      />

      <PecaDetalheModal
        pecaId={pecaDetalheId}
        onClose={() => setPecaDetalheId(null)}
        onEdit={(peca) => {
          setPecaDetalheId(null);
          setPecaEmEdicao(peca);
        }}
        onChange={handleSuccess}
      />
    </section>
  );
}
