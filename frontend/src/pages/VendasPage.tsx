import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  CalendarDays,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  UserRound,
  Wallet,
} from 'lucide-react';
import axios from 'axios';

type StatusFiltro = 'todas' | 'andamento' | 'concluidas' | 'canceladas';
type FiltroEnvio = 'todas' | 'hoje' | 'agendadas';
type AbaDetalhe = 'detalhe' | 'chat';

interface ItemVenda {
  sku: string;
  descricao?: string | null;
  quantidade: number;
  preco_unitario: number;
}

interface ReclamacaoVenda {
  id: number;
  pedido_id?: string | null;
  motivo?: string | null;
  descricao?: string | null;
  status: string;
  data_reclamacao: string;
}

interface VendaMl {
  id: number;
  order_id?: string | null;
  titulo: string;
  sku: string;
  valor: number;
  taxa_ml: number;
  plataforma: string;
  cliente: string;
  cliente_email?: string | null;
  cliente_fone?: string | null;
  cliente_cpf?: string | null;
  cliente_endereco?: string | null;
  ml_buyer_nickname?: string | null;
  metodo_pagamento_label?: string | null;
  status: string;
  status_grupo: 'concluida' | 'andamento' | 'cancelada' | string;
  ml_status?: string | null;
  data_venda: string;
  data_prevista_recebimento?: string | null;
  financeiro_status?: 'pendente' | 'disponivel' | 'agendada' | 'enviada' | string;
  financeiro_agendada_para?: string | null;
  enviada_financeiro?: number | null;
  peca_imagem?: string | null;
  peca_carro?: string | null;
  reclamacoes_abertas: number;
  itens: ItemVenda[];
  reclamacoes?: ReclamacaoVenda[];
}

interface MensagemChat {
  id: string;
  papel: 'vendedor' | 'comprador' | string;
  texto: string;
  data?: string | null;
}

interface VendasPageProps {
  vendaInicialId?: number | null;
  onOpenAtendimento?: () => void;
}

const STATUS_FILTRO: Array<{ chave: StatusFiltro; label: string }> = [
  { chave: 'todas', label: 'Todas' },
  { chave: 'andamento', label: 'Em andamento' },
  { chave: 'concluidas', label: 'Concluídas' },
  { chave: 'canceladas', label: 'Canceladas' },
];

const STATUS_VISUAL: Record<
  string,
  { label: string; className: string }
> = {
  concluida: {
    label: 'Concluída',
    className: 'border-success/25 bg-successSoft text-success',
  },
  andamento: {
    label: 'Em andamento',
    className: 'border-warning/25 bg-warningSoft text-warning',
  },
  cancelada: {
    label: 'Cancelada',
    className: 'border-danger/25 bg-dangerSoft text-danger',
  },
};

const STATUS_FINANCEIRO_LABEL: Record<string, string> = {
  pendente: 'Fora da fila',
  disponivel: 'Disponível hoje',
  agendada: 'Agendada',
  enviada: 'Enviada ao financeiro',
};

function formatarMoeda(valor?: number | null): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function formatarDataHora(valor?: string | null): string {
  if (!valor) return '—';
  const data = new Date(String(valor).replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return String(valor);

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function hojeLocalISO(): string {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function dataEnvio(venda: VendaMl): string {
  const status =
    venda.financeiro_status ||
    (venda.enviada_financeiro ? 'enviada' : 'pendente');
  if (status === 'agendada') {
    return String(venda.financeiro_agendada_para || '').slice(0, 10);
  }
  return String(venda.financeiro_agendada_para || venda.data_venda || '').slice(
    0,
    10
  );
}

function rotuloEnvio(venda: VendaMl, hoje: string): string {
  const status = venda.financeiro_status ||
    (venda.enviada_financeiro ? 'enviada' : 'pendente');
  const data = dataEnvio(venda);
  if (
    (status === 'disponivel' || status === 'agendada') &&
    data === hoje
  ) {
    return 'Informe a NF-e já emitida';
  }
  if (
    (status === 'agendada' || status === 'disponivel') &&
    data &&
    data > hoje
  ) {
    const dataFormatada = new Date(`${data}T00:00:00`).toLocaleDateString(
      'pt-BR',
      { day: 'numeric', month: 'long' }
    );
    return `Para enviar no dia ${dataFormatada}`;
  }
  if (status === 'agendada' && !data) return 'Agendamento sem data';
  if (status === 'agendada' && data < hoje) {
    const dataFormatada = new Date(`${data}T00:00:00`).toLocaleDateString(
      'pt-BR'
    );
    return `Agendamento vencido • ${dataFormatada}`;
  }
  return STATUS_FINANCEIRO_LABEL[status] || 'Fora da fila';
}

function rotuloStatusFinanceiro(venda: VendaMl, hoje: string): string {
  const status =
    venda.financeiro_status ||
    (venda.enviada_financeiro ? 'enviada' : 'pendente');
  const data = dataEnvio(venda);
  if (
    status === 'disponivel' &&
    data &&
    data > hoje
  ) {
    return 'Programada';
  }
  if (status === 'agendada' && data && data < hoje) return 'Reagendar';
  return STATUS_FINANCEIRO_LABEL[status] || 'Fora da fila';
}

export default function VendasPage({
  vendaInicialId = null,
  onOpenAtendimento,
}: VendasPageProps) {
  const [busca, setBusca] = useState('');
  const [buscaDebounce, setBuscaDebounce] = useState('');
  const [status, setStatus] = useState<StatusFiltro>('todas');
  const [filtroEnvio, setFiltroEnvio] = useState<FiltroEnvio>('todas');
  const [vendas, setVendas] = useState<VendaMl[]>([]);
  const [resumo, setResumo] = useState({
    total: 0,
    hoje: 0,
    concluidas: 0,
    andamento: 0,
    canceladas: 0,
  });
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState('');
  const [vendaId, setVendaId] = useState<number | null>(vendaInicialId);
  const [detalhe, setDetalhe] = useState<VendaMl | null>(null);
  const [aba, setAba] = useState<AbaDetalhe>('detalhe');
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [avisoChat, setAvisoChat] = useState('');
  const [chatDisponivel, setChatDisponivel] = useState(false);
  const [carregandoChat, setCarregandoChat] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [rascunho, setRascunho] = useState('');
  const [statusFinanceiro, setStatusFinanceiro] = useState('pendente');
  const [dataFinanceiro, setDataFinanceiro] = useState('');
  const [salvandoFinanceiro, setSalvandoFinanceiro] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaDebounce(busca.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [busca]);

  const carregarLista = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setCarregando(true);
      setErro('');
    }

    try {
      const { data } = await axios.get('/api/vendas', {
        params: {
          q: buscaDebounce || undefined,
          status,
          limite: 500,
        },
        timeout: 20000,
      });

      const lista = Array.isArray(data?.vendas) ? data.vendas : [];
      setVendas(lista);
      setResumo({
        total: Number(data?.resumo?.total) || lista.length,
        hoje: Number(data?.resumo?.hoje) || 0,
        concluidas: Number(data?.resumo?.concluidas) || 0,
        andamento: Number(data?.resumo?.andamento) || 0,
        canceladas: Number(data?.resumo?.canceladas) || 0,
      });

      setVendaId((atual) => {
        if (atual && lista.some((item: VendaMl) => item.id === atual)) {
          return atual;
        }

        return lista[0]?.id ?? null;
      });
    } catch (error) {
      setErro(
        axios.isAxiosError(error)
          ? error.response?.data?.error || 'Não foi possível carregar as vendas.'
          : 'Não foi possível carregar as vendas.'
      );
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, [buscaDebounce, status]);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      if (!ativo || document.visibilityState !== 'visible') return;
      void carregarLista(true);
    };
    const intervalo = window.setInterval(atualizar, 20000);
    document.addEventListener('visibilitychange', atualizar);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [carregarLista]);

  useEffect(() => {
    if (vendaInicialId) setVendaId(vendaInicialId);
  }, [vendaInicialId]);

  const carregarDetalhe = useCallback(async (id: number) => {
    const { data } = await axios.get<VendaMl>(`/api/vendas/${id}`, {
      timeout: 15000,
    });
    setDetalhe(data);
  }, []);

  const carregarChat = useCallback(async (id: number) => {
    setCarregandoChat(true);
    setAvisoChat('');

    try {
      const { data } = await axios.get(`/api/vendas/${id}/mensagens`, {
        timeout: 20000,
      });
      setMensagens(Array.isArray(data?.mensagens) ? data.mensagens : []);
      setChatDisponivel(Boolean(data?.conversaDisponivel));
      setAvisoChat(String(data?.aviso || ''));
    } catch (error) {
      setMensagens([]);
      setChatDisponivel(false);
      setAvisoChat(
        axios.isAxiosError(error)
          ? error.response?.data?.error || 'Não foi possível abrir o chat.'
          : 'Não foi possível abrir o chat.'
      );
    } finally {
      setCarregandoChat(false);
    }
  }, []);

  useEffect(() => {
    if (!vendaId) {
      setDetalhe(null);
      setMensagens([]);
      return;
    }

    void carregarDetalhe(vendaId).catch(() => {
      setDetalhe(vendas.find((item) => item.id === vendaId) || null);
    });
    void carregarChat(vendaId);
  }, [carregarChat, carregarDetalhe, vendaId, vendas]);

  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [mensagens, aba]);

  const sincronizar = async () => {
    setSincronizando(true);
    setErro('');

    try {
      await axios.post('/api/vendas/sincronizar', { dias: 30 }, { timeout: 60000 });
      await carregarLista();
    } catch (error) {
      setErro(
        axios.isAxiosError(error)
          ? error.response?.data?.error ||
            'Não foi possível sincronizar as vendas do Mercado Livre.'
          : 'Não foi possível sincronizar as vendas do Mercado Livre.'
      );
    } finally {
      setSincronizando(false);
    }
  };

  const enviarMensagem = async () => {
    if (!vendaId || !rascunho.trim()) return;

    setEnviando(true);
    setAvisoChat('');

    try {
      const { data } = await axios.post(
        `/api/vendas/${vendaId}/mensagens`,
        { mensagem: rascunho.trim() },
        { timeout: 20000 }
      );
      setMensagens(Array.isArray(data?.mensagens) ? data.mensagens : []);
      setChatDisponivel(Boolean(data?.conversaDisponivel ?? true));
      setRascunho('');
    } catch (error) {
      setAvisoChat(
        axios.isAxiosError(error)
          ? error.response?.data?.error || 'Não foi possível enviar a mensagem.'
          : 'Não foi possível enviar a mensagem.'
      );
    } finally {
      setEnviando(false);
    }
  };

  const venda = detalhe || vendas.find((item) => item.id === vendaId) || null;

  useEffect(() => {
    setStatusFinanceiro(
      venda?.financeiro_status ||
        (venda?.enviada_financeiro ? 'enviada' : 'pendente')
    );
    setDataFinanceiro(
      String(venda?.financeiro_agendada_para || '').slice(0, 10)
    );
  }, [venda?.financeiro_agendada_para, venda?.financeiro_status, venda?.id, venda?.enviada_financeiro]);

  const salvarAgendamentoFinanceiro = async () => {
    if (!venda) return;
    if (statusFinanceiro === 'agendada' && !dataFinanceiro) {
      setErro('Informe o dia em que esta venda deve ser enviada ao financeiro.');
      return;
    }

    setSalvandoFinanceiro(true);
    setErro('');
    try {
      const { data } = await axios.patch(
        `/api/vendas/${venda.id}/agendamento-financeiro`,
        { status: statusFinanceiro, data: dataFinanceiro || null },
        { timeout: 12000 }
      );
      const atualizarVenda = (item: VendaMl): VendaMl =>
        item.id === venda.id
          ? {
              ...item,
              financeiro_status: data.status,
              financeiro_agendada_para: data.data,
              enviada_financeiro: data.enviada_financeiro,
            }
          : item;
      setVendas((atual) => atual.map(atualizarVenda));
      setDetalhe((atual) => (atual ? atualizarVenda(atual) : atual));
    } catch (error) {
      setErro(
        axios.isAxiosError(error)
          ? error.response?.data?.error ||
              'Não foi possível salvar o agendamento financeiro.'
          : 'Não foi possível salvar o agendamento financeiro.'
      );
    } finally {
      setSalvandoFinanceiro(false);
    }
  };
  const statusVenda = venda
    ? STATUS_VISUAL[venda.status_grupo] || STATUS_VISUAL.andamento
    : null;

  const contagens = useMemo(
    () => [
      { label: 'Hoje', valor: resumo.hoje },
      { label: 'Em andamento', valor: resumo.andamento },
      { label: 'Concluídas', valor: resumo.concluidas },
      { label: 'Canceladas', valor: resumo.canceladas },
    ],
    [resumo]
  );
  const hoje = hojeLocalISO();
  const vendasVisiveis = useMemo(() => {
    if (filtroEnvio === 'hoje') {
      return vendas.filter((item) => {
        const statusAtual =
          item.financeiro_status ||
          (item.enviada_financeiro ? 'enviada' : 'pendente');
        return (
          ['disponivel', 'agendada'].includes(statusAtual) &&
          dataEnvio(item) === hoje
        );
      });
    }
    if (filtroEnvio === 'agendadas') {
      return vendas
        .filter((item) => {
          const statusAtual =
            item.financeiro_status ||
            (item.enviada_financeiro ? 'enviada' : 'pendente');
          const data = dataEnvio(item);
          return (
            ['disponivel', 'agendada'].includes(statusAtual) &&
            data > hoje
          );
        })
        .sort(
          (a, b) =>
            dataEnvio(a).localeCompare(dataEnvio(b)) ||
            b.data_venda.localeCompare(a.data_venda)
        );
    }
    return vendas;
  }, [filtroEnvio, hoje, vendas]);
  const enviosHoje = useMemo(
    () =>
      vendas.filter((item) => {
        const statusAtual =
          item.financeiro_status ||
          (item.enviada_financeiro ? 'enviada' : 'pendente');
        return (
          ['disponivel', 'agendada'].includes(statusAtual) &&
          dataEnvio(item) === hoje
        );
      }).length,
    [hoje, vendas]
  );
  const enviosAgendados = useMemo(
    () =>
      vendas.filter(
        (item) => {
          const statusAtual =
            item.financeiro_status ||
            (item.enviada_financeiro ? 'enviada' : 'pendente');
          return (
            ['disponivel', 'agendada'].includes(statusAtual) &&
            dataEnvio(item) > hoje
          );
        }
      ).length,
    [hoje, vendas]
  );

  useEffect(() => {
    if (carregando && vendas.length === 0) return;
    if (vendasVisiveis.some((item) => item.id === vendaId)) return;
    setVendaId(vendasVisiveis[0]?.id ?? null);
    setDetalhe(null);
  }, [carregando, vendaId, vendas.length, vendasVisiveis]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-ml/20 bg-ml/5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ml">
              Mercado Livre
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink">Vendas</h2>
            <p className="mt-1 text-sm text-muted">
              Pedidos, comprador, SKU e chat da venda, no mesmo fluxo do Mercado
              Livre.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {contagens.map((item) => (
              <span
                key={item.label}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted"
              >
                <span className="font-semibold text-ink">{item.valor}</span>{' '}
                {item.label}
              </span>
            ))}
            <button
              type="button"
              onClick={() => void sincronizar()}
              disabled={sincronizando}
              className="inline-flex items-center gap-2 rounded-xl bg-ml px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:brightness-110 disabled:opacity-60"
            >
              {sincronizando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar
            </button>
          </div>
        </div>
      </section>

      {erro ? (
        <p className="rounded-xl border border-danger/25 bg-dangerSoft px-4 py-3 text-sm text-danger">
          {erro}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section
          className={`min-w-0 overflow-hidden rounded-2xl border border-line bg-card ${
            venda && aba ? 'hidden xl:block' : ''
          }`}
        >
          <div className="space-y-3 border-b border-line p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar título, SKU, pedido ou comprador"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTRO.map((item) => (
                <button
                  key={item.chave}
                  type="button"
                  onClick={() => setStatus(item.chave)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    status === item.chave
                      ? 'border-ml/40 bg-ml/15 text-ml'
                      : 'border-white/10 text-muted hover:bg-white/[0.05] hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 border-t border-line/70 pt-3">
              {[
                { chave: 'todas' as FiltroEnvio, label: 'Todas', total: vendas.length },
                { chave: 'hoje' as FiltroEnvio, label: 'Envios de hoje', total: enviosHoje },
                {
                  chave: 'agendadas' as FiltroEnvio,
                  label: 'Agendadas para outros dias',
                  total: enviosAgendados,
                },
              ].map((item) => (
                <button
                  key={item.chave}
                  type="button"
                  onClick={() => setFiltroEnvio(item.chave)}
                  aria-pressed={filtroEnvio === item.chave}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filtroEnvio === item.chave
                      ? 'border-success/35 bg-successSoft text-success'
                      : 'border-white/10 text-muted hover:bg-white/[0.05] hover:text-ink'
                  }`}
                >
                  {item.label}
                  <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[10px]">
                    {item.total}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {carregando ? (
              <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando vendas...
              </p>
            ) : vendasVisiveis.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted">
                {filtroEnvio === 'hoje'
                  ? 'Nenhum envio liberado para hoje.'
                  : filtroEnvio === 'agendadas'
                    ? 'Nenhum envio agendado para outros dias.'
                    : 'Nenhuma venda do Mercado Livre encontrada.'}
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {vendasVisiveis.map((item) => {
                  const visual =
                    STATUS_VISUAL[item.status_grupo] || STATUS_VISUAL.andamento;
                  const ativa = item.id === vendaId;
                  const statusFinanceiroAtual =
                    item.financeiro_status ||
                    (item.enviada_financeiro ? 'enviada' : 'pendente');

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setVendaId(item.id);
                          setAba('detalhe');
                        }}
                        className={`flex w-full gap-3 px-4 py-3 text-left transition-colors ${
                          ativa
                            ? 'bg-white/[0.07]'
                            : 'hover:bg-white/[0.035]'
                        }`}
                      >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-secondary">
                          {item.peca_imagem ? (
                            <img
                              src={item.peca_imagem}
                              alt={item.titulo}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted">
                              <Package className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold text-accent">
                              {item.order_id || `#${item.id}`}
                            </span>
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${visual.className}`}
                            >
                              {visual.label}
                            </span>
                            <span className="rounded-full border border-accent/20 bg-accentSoft px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                              {rotuloStatusFinanceiro(item, hoje)}
                            </span>
                            {item.reclamacoes_abertas > 0 ? (
                              <span className="rounded-full border border-danger/25 bg-dangerSoft px-1.5 py-0.5 text-[9px] font-semibold text-danger">
                                Reclamação
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-sm font-medium text-ink">
                            {item.titulo}
                          </p>
                          <p className="truncate text-[11px] text-muted">
                            {item.sku || 'Sem SKU'} •{' '}
                            {item.cliente || item.ml_buyer_nickname || 'Comprador'}
                          </p>
                          {(statusFinanceiroAtual === 'disponivel' ||
                            statusFinanceiroAtual === 'agendada') && (
                            <p
                              className={`mt-1 truncate text-[10px] font-semibold ${
                                dataEnvio(item) === hoje
                                  ? 'text-success'
                                  : 'text-warning'
                              }`}
                            >
                              {rotuloEnvio(item, hoje)}
                            </p>
                          )}
                          <p className="mt-1 text-xs font-semibold text-success">
                            {formatarMoeda(item.valor)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-card">
          {!venda ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center p-8 text-center">
              <ShoppingCart className="h-10 w-10 text-muted" />
              <p className="mt-3 text-sm font-medium text-ink">
                Selecione uma venda
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted">
                O detalhe do pedido, os dados do comprador e o chat aparecem
                aqui, como no painel do Mercado Livre.
              </p>
            </div>
          ) : (
            <>
              <header className="border-b border-line px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setVendaId(null)}
                    className="rounded-xl border border-white/10 p-2 text-muted xl:hidden"
                    aria-label="Voltar para a lista"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-secondary">
                    {venda.peca_imagem ? (
                      <img
                        src={venda.peca_imagem}
                        alt={venda.titulo}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted">
                        <Package className="h-7 w-7" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-accent">
                      Venda {venda.order_id || `#${venda.id}`}
                    </p>
                    <h3 className="mt-0.5 text-lg font-bold leading-snug text-ink">
                      {venda.titulo}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Barcode className="h-3 w-3" />
                        {venda.sku || 'Sem SKU'}
                      </span>
                      {statusVenda ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 font-semibold ${statusVenda.className}`}
                        >
                          {statusVenda.label}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatarDataHora(venda.data_venda)}
                      </span>
                    </div>
                  </div>
                  <p className="shrink-0 text-right text-lg font-bold text-success">
                    {formatarMoeda(venda.valor)}
                  </p>
                </div>

                <div className="mt-4 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => setAba('detalhe')}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                      aba === 'detalhe'
                        ? 'bg-white/[0.08] text-ink'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    Detalhe
                  </button>
                  <button
                    type="button"
                    onClick={() => setAba('chat')}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${
                      aba === 'chat'
                        ? 'bg-white/[0.08] text-ink'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Chat
                    {mensagens.length > 0 ? (
                      <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">
                        {mensagens.length}
                      </span>
                    ) : null}
                  </button>
                </div>
              </header>

              {['disponivel', 'agendada'].includes(
                venda.financeiro_status ||
                  (venda.enviada_financeiro ? 'enviada' : 'pendente')
              ) && (
                <p
                  className={`border-b border-line px-4 py-2.5 text-xs font-semibold sm:px-5 ${
                    dataEnvio(venda) === hoje
                      ? 'bg-successSoft/60 text-success'
                      : 'bg-warningSoft/50 text-warning'
                  }`}
                >
                  {rotuloEnvio(venda, hoje)}
                </p>
              )}

              {aba === 'detalhe' ? (
                <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
                  <section className="rounded-xl border border-line bg-white/[0.02] p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
                      <UserRound className="h-4 w-4 text-accent" />
                      Comprador
                    </h4>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted">
                          Nome
                        </dt>
                        <dd className="text-ink">
                          {venda.cliente || venda.ml_buyer_nickname || 'Não informado'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted">
                          CPF
                        </dt>
                        <dd className="text-ink">
                          {venda.cliente_cpf || 'Não informado'}
                        </dd>
                      </div>
                      {venda.cliente_fone ? (
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-muted">
                            Telefone
                          </dt>
                          <dd className="text-ink">{venda.cliente_fone}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted">
                          Endereço
                        </dt>
                        <dd className="flex items-start gap-1.5 leading-relaxed text-ink">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                          {venda.cliente_endereco || 'Não informado'}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-xl border border-line bg-white/[0.02] p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
                      <Wallet className="h-4 w-4 text-success" />
                      Pedido
                    </h4>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">ID da venda</dt>
                        <dd className="font-mono text-ink">
                          {venda.order_id || venda.id}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">SKU</dt>
                        <dd className="text-ink">{venda.sku || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Pagamento</dt>
                        <dd className="text-ink">
                          {venda.metodo_pagamento_label || 'Não informado'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Taxa ML</dt>
                        <dd className="text-warning">
                          {venda.taxa_ml > 0
                            ? `- ${formatarMoeda(venda.taxa_ml)}`
                            : '—'}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4 space-y-2 border-t border-line pt-3">
                      {(venda.itens || []).map((item, indice) => (
                        <div
                          key={`${item.sku}-${indice}`}
                          className="flex justify-between gap-3 text-xs"
                        >
                          <span className="text-muted">
                            {item.quantidade}x {item.descricao || item.sku}
                          </span>
                          <span className="font-medium text-ink">
                            {formatarMoeda(
                              item.quantidade * item.preco_unitario
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-accent/20 bg-accentSoft/30 p-4 lg:col-span-2">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
                      <Wallet className="h-4 w-4 text-accent" />
                      Envio ao financeiro
                    </h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                      <label className="space-y-1 text-xs text-muted">
                        <span>Status da venda</span>
                        <select
                          value={statusFinanceiro}
                          onChange={(event) =>
                            setStatusFinanceiro(event.target.value)
                          }
                          className="w-full rounded-xl border border-white/10 bg-card px-3 py-2.5 text-sm text-ink"
                        >
                          <option value="pendente">Fora da fila</option>
                          <option value="disponivel">Disponível para hoje</option>
                          <option value="agendada">Agendada</option>
                          <option value="enviada">Enviada ao financeiro</option>
                        </select>
                      </label>
                      {statusFinanceiro === 'agendada' ? (
                        <label className="space-y-1 text-xs text-muted">
                          <span>Enviar em</span>
                          <input
                            type="date"
                            value={dataFinanceiro}
                            onChange={(event) =>
                              setDataFinanceiro(event.target.value)
                            }
                            className="w-full rounded-xl border border-white/10 bg-card px-3 py-2.5 text-sm text-ink"
                          />
                        </label>
                      ) : (
                        <p className="text-xs leading-relaxed text-muted">
                          {statusFinanceiro === 'disponivel'
                            ? 'Esta venda aparecerá na NF-e de hoje.'
                            : statusFinanceiro === 'enviada'
                              ? 'Esta venda já foi enviada ao financeiro.'
                              : 'Vendas fora da fila não aparecem na NF-e.'}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void salvarAgendamentoFinanceiro()}
                        disabled={salvandoFinanceiro}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {salvandoFinanceiro ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Salvar
                      </button>
                    </div>
                  </section>

                  {venda.reclamacoes && venda.reclamacoes.length > 0 ? (
                    <section className="rounded-xl border border-danger/20 bg-dangerSoft/40 p-4 lg:col-span-2">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-danger">
                        <AlertTriangle className="h-4 w-4" />
                        Reclamações desta venda
                      </h4>
                      <ul className="mt-3 space-y-2">
                        {venda.reclamacoes.map((item) => (
                          <li
                            key={item.id}
                            className="rounded-lg border border-danger/15 bg-black/20 px-3 py-2 text-sm"
                          >
                            <p className="font-medium text-ink">
                              {item.motivo || 'Reclamação'}
                            </p>
                            <p className="text-xs text-muted">
                              {item.status} • {formatarDataHora(item.data_reclamacao)}
                            </p>
                          </li>
                        ))}
                      </ul>
                      {onOpenAtendimento ? (
                        <button
                          type="button"
                          onClick={onOpenAtendimento}
                          className="mt-3 text-sm font-semibold text-accent hover:underline"
                        >
                          Abrir em Atendimento
                        </button>
                      ) : null}
                    </section>
                  ) : null}

                  <a
                    href={
                      venda.order_id
                        ? `https://www.mercadolivre.com.br/vendas/${venda.order_id}`
                        : 'https://www.mercadolivre.com.br/vendas'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline lg:col-span-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir no Mercado Livre
                  </a>
                </div>
              ) : (
                <div className="flex h-[min(70vh,640px)] flex-col">
                  <div
                    ref={chatRef}
                    className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,230,0,0.08),transparent_42%)] p-4"
                  >
                    {carregandoChat ? (
                      <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando conversa...
                      </p>
                    ) : mensagens.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted">
                        {avisoChat ||
                          'Nenhuma mensagem ainda. Escreva para o comprador abaixo.'}
                      </p>
                    ) : (
                      mensagens.map((mensagem) => {
                        const propria = mensagem.papel === 'vendedor';

                        return (
                          <div
                            key={mensagem.id}
                            className={`flex ${
                              propria ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-lg ${
                                propria
                                  ? 'rounded-br-md bg-accent text-white'
                                  : 'rounded-bl-md border border-white/10 bg-white/[0.08] text-ink'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{mensagem.texto}</p>
                              <p
                                className={`mt-1 text-[10px] ${
                                  propria ? 'text-white/70' : 'text-muted'
                                }`}
                              >
                                {formatarDataHora(mensagem.data)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {avisoChat && mensagens.length > 0 ? (
                      <p className="text-center text-[11px] text-warning">
                        {avisoChat}
                      </p>
                    ) : null}
                  </div>

                  <form
                    className="flex gap-2 border-t border-line p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void enviarMensagem();
                    }}
                  >
                    <input
                      value={rascunho}
                      onChange={(event) => setRascunho(event.target.value)}
                      placeholder={
                        chatDisponivel
                          ? `Mensagem para ${
                              venda.cliente || venda.ml_buyer_nickname || 'o comprador'
                            }`
                          : 'Chat indisponível até conectar o Mercado Livre'
                      }
                      disabled={!chatDisponivel || enviando}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!chatDisponivel || enviando || !rascunho.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {enviando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
