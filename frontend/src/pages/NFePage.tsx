import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck,
  Check,
  CheckSquare,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Send,
  ShoppingBag,
  Square,
  Wallet,
  X,
} from 'lucide-react';
import axios from 'axios';

interface ItemVenda {
  sku?: string | null;
  descricao?: string | null;
  quantidade?: number;
  precoUnitario?: number;
}

interface VendaMlHoje {
  id: number;
  order_id?: string | null;
  valor: number;
  plataforma: string;
  cliente?: string | null;
  cliente_email?: string | null;
  cliente_fone?: string | null;
  cliente_cpf?: string | null;
  cliente_endereco?: string | null;
  metodo_pagamento?: string | null;
  status: string;
  data_venda: string;
  financeiro_status?: string | null;
  financeiro_agendada_para?: string | null;
  data_prevista_recebimento?: string | null;
  enviada_financeiro?: number | null;
  enviada_financeiro_em?: string | null;
  peca_nome?: string | null;
  peca_carro?: string | null;
  peca_sku?: string | null;
  itens: ItemVenda[];
}

interface RespostaVendasMl {
  data: string;
  vendas: VendaMlHoje[];
  totais: {
    vendas: number;
    faturamento: number;
  };
  pendentes?: {
    vendas: number;
    faturamento: number;
  };
}

interface NFePageProps {
  financeWhatsApp: string;
  companyName: string;
  onOpenSettings: () => void;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function rotuloPagamento(valor?: string | null): string {
  const chave = String(valor || '')
    .trim()
    .toLowerCase();

  const mapa: Record<string, string> = {
    visa: 'Cartão Visa',
    master: 'Cartão Mastercard',
    mastercard: 'Cartão Mastercard',
    amex: 'Cartão American Express',
    american_express: 'Cartão American Express',
    elo: 'Cartão Elo',
    hipercard: 'Cartão Hipercard',
    debito_mercadopago: 'Cartão de débito Mercado Pago',
    debito: 'Cartão de débito',
    credit_card: 'Cartão de crédito',
    account_money: 'Saldo Mercado Pago',
    mercadopago: 'Saldo Mercado Pago',
    consumer_credits: 'Mercado Crédito',
    mercadocredito: 'Mercado Crédito',
    pix: 'Pix',
    bolbradesco: 'Boleto',
    boleto: 'Boleto',
    pecunia: 'Boleto',
    ticket: 'Boleto',
    dinheiro: 'Dinheiro',
    transferencia: 'Transferência',
  };

  if (mapa[chave]) return mapa[chave];
  if (!chave) return 'Pagamento não informado';

  return chave
    .replace(/[_-]+/g, ' ')
    .replace(/(^|\s)(\p{L})/gu, (_trecho, espaco, letra) => espaco + letra.toUpperCase());
}

function dataLocalISO(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function rotuloEnvioFinanceiro(venda: VendaMlHoje, hoje: string): string {
  if (venda.financeiro_status === 'agendada') {
    const data = String(venda.financeiro_agendada_para || '').slice(0, 10);
    if (!data) return 'Data do envio pendente';
    if (data === hoje) return 'Informe a NF-e já emitida';
    const dataFormatada = new Date(`${data}T00:00:00`).toLocaleDateString(
      'pt-BR',
      { day: 'numeric', month: 'long' }
    );
    return `Para enviar no dia ${dataFormatada}`;
  }
  if (venda.financeiro_status === 'enviada') return 'Enviada hoje';
  return 'Informe a NF-e já emitida';
}

function formatarHora(valor: string): string {
  const data = new Date(String(valor || '').replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function formatarDataHora(valor: string): string {
  const data = new Date(String(valor || '').replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function normalizarWhatsApp(valor: string): string {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  if (digitos.length <= 11) return `55${digitos}`;
  return digitos;
}

function nomeProduto(venda: VendaMlHoje, item?: ItemVenda): string {
  return (
    item?.descricao ||
    item?.sku ||
    venda.peca_nome ||
    venda.peca_sku ||
    'Peça do anúncio'
  );
}

function montarMensagem(venda: VendaMlHoje): string {
  const itens =
    venda.itens.length > 0
      ? venda.itens
      : [
          {
            descricao: venda.peca_nome,
            sku: venda.peca_sku,
            quantidade: 1,
          },
        ];

  const produtos = itens
    .map((item) => {
      const quantidade = Math.max(1, Number(item.quantidade) || 1);
      const unidade = quantidade === 1 ? 'UNIDADE' : 'UNIDADES';
      return `*${nomeProduto(venda, item)} (${quantidade} ${unidade})*`;
    })
    .join('\n');

  return [
    produtos,
    '',
    '*Dados do comprador*',
    '',
    '*Nome*',
    venda.cliente?.trim() || 'Não informado',
    '',
    '*CPF*',
    venda.cliente_cpf?.trim() || 'Não informado',
    '',
    '*Endereço*',
    venda.cliente_endereco?.trim() || 'Não informado',
    '',
    '*Preço total dos produtos*',
    formatarMoeda(venda.valor),
  ].join('\n');
}

function montarResumo(
  dados: RespostaVendasMl,
  companyName: string
): string {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${dados.data}T12:00:00`));

  return [
    `*Fechamento Mercado Livre • ${dataFormatada}*`,
    companyName ? `*${companyName}*` : '',
    '',
    `Vendas: *${dados.totais.vendas}*`,
    `Faturamento: *${formatarMoeda(dados.totais.faturamento)}*`,
    '',
    ...dados.vendas.flatMap((venda, indice) => {
      const pedido = venda.order_id ? `#${venda.order_id}` : `Venda ${venda.id}`;
      return [
        `${indice + 1}. ${pedido} — ${nomeProduto(venda, venda.itens[0])}`,
        `   ${formatarMoeda(venda.valor)} • ${rotuloPagamento(
          venda.metodo_pagamento
        )}`,
      ];
    }),
    '',
    'Resumo gerado pelo DESMONTE OS.'
  ].join('\n');
}

export default function NFePage({
  financeWhatsApp,
  companyName,
  onOpenSettings,
}: NFePageProps) {
  const [dados, setDados] = useState<RespostaVendasMl>({
    data: dataLocalISO(),
    vendas: [],
    totais: { vendas: 0, faturamento: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<'pendentes' | 'todas'>('pendentes');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [copiadoId, setCopiadoId] = useState<number | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [confirmarLote, setConfirmarLote] = useState(false);
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [indiceLote, setIndiceLote] = useState(0);
  const [totalLote, setTotalLote] = useState(0);
  const timerLote = useRef<number | null>(null);
  const versaoEstado = useRef(0);

  const carregar = async (silencioso = false) => {
    const versao = versaoEstado.current;
    if (!silencioso) {
      setLoading(true);
      setErro('');
      setAviso('');
    }

    try {
      const { data } = await axios.get<RespostaVendasMl>(
        `/api/vendas/hoje-ml?data=${dataLocalISO()}`,
        { timeout: 12000 }
      );
      // Se uma venda foi marcada como enviada enquanto esta busca estava em
      // andamento, descarta a resposta antiga para não "ressuscitar" a venda.
      if (versao !== versaoEstado.current) return;
      setDados(data);

      if (silencioso) {
        // Numa atualização automática preserva o que o usuário marcou/desmarcou.
        setSelecionadas((atual) => {
          const ids = new Set(data.vendas.map((venda) => venda.id));
          return new Set([...atual].filter((id) => ids.has(id)));
        });
      } else {
        setSelecionadas(
          new Set(
            data.vendas
              .filter((venda) => !venda.enviada_financeiro)
              .map((venda) => venda.id)
          )
        );
      }
    } catch (error) {
      if (versao !== versaoEstado.current || silencioso) return;
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error || 'Não foi possível carregar as vendas.'
        );
      } else {
        setErro('Não foi possível carregar as vendas.');
      }
    } finally {
      if (!silencioso && versao === versaoEstado.current) setLoading(false);
    }
  };

  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;

  useEffect(() => {
    void carregar();

    return () => {
      if (timerLote.current !== null) {
        window.clearTimeout(timerLote.current);
      }
    };
  }, []);

  // Atualiza a fila sozinha quando uma venda nova chega do Mercado Livre,
  // sem atrapalhar a seleção que o usuário já fez.
  useEffect(() => {
    let ativo = true;

    const atualizar = () => {
      if (!ativo || document.visibilityState !== 'visible') return;
      void carregarRef.current(true);
    };

    const intervalo = window.setInterval(atualizar, 30000);
    document.addEventListener('visibilitychange', atualizar);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, []);

  const numero = normalizarWhatsApp(financeWhatsApp);

  const pendentes = useMemo(
    () => dados.vendas.filter((venda) => !venda.enviada_financeiro),
    [dados.vendas]
  );
  const enviadas = useMemo(
    () => dados.vendas.filter((venda) => Boolean(venda.enviada_financeiro)),
    [dados.vendas]
  );
  const visiveis = modo === 'pendentes' ? pendentes : dados.vendas;
  const totalVisivel = useMemo(
    () =>
      Number(
        visiveis
          .reduce((total, venda) => total + Number(venda.valor || 0), 0)
          .toFixed(2)
      ),
    [visiveis]
  );
  const resumo = useMemo(
    () =>
      montarResumo(
        {
          ...dados,
          vendas: visiveis,
          totais: { vendas: visiveis.length, faturamento: totalVisivel },
        },
        companyName
      ),
    [companyName, dados, totalVisivel, visiveis]
  );
  const comEndereco = pendentes.filter((venda) =>
    Boolean(venda.cliente_endereco?.trim())
  ).length;
  const faturamentoPendente = useMemo(
    () =>
      Number(
        pendentes
          .reduce((total, venda) => total + Number(venda.valor || 0), 0)
          .toFixed(2)
      ),
    [pendentes]
  );
  const selecionaveis = visiveis.filter(
    (venda) => modo === 'pendentes' || !venda.enviada_financeiro
  );
  const selecionadasVisiveis = selecionaveis.filter((venda) =>
    selecionadas.has(venda.id)
  ).length;
  const todasSelecionadas =
    selecionaveis.length > 0 &&
    selecionaveis.every((venda) => selecionadas.has(venda.id));

  const urlWhatsApp = (mensagem: string) =>
    numero
      ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
      : '';

  const abrirWhatsApp = (mensagem: string): boolean => {
    const url = urlWhatsApp(mensagem);
    if (!url) return false;

    const janela = window.open(url, '_blank', 'noopener,noreferrer');
    return Boolean(janela);
  };

  const alternarSelecao = (id: number) => {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  };

  const alternarTodas = () => {
    if (todasSelecionadas) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(selecionaveis.map((venda) => venda.id)));
    }
  };

  const trocarModo = (novo: 'pendentes' | 'todas') => {
    setModo(novo);
    const lista =
      novo === 'pendentes'
        ? pendentes
        : dados.vendas.filter((venda) => !venda.enviada_financeiro);
    setSelecionadas(new Set(lista.map((venda) => venda.id)));
  };

  // Marca a venda como enviada ao financeiro assim que a conversa do WhatsApp
  // é aberta, para ela sair da lista de pendentes e não ser enviada de novo.
  const marcarEnviada = async (id: number, enviada = true) => {
    versaoEstado.current += 1;
    setDados((atual) => ({
      ...atual,
      vendas: atual.vendas.map((venda) =>
        venda.id === id
          ? {
              ...venda,
              enviada_financeiro: enviada ? 1 : 0,
              financeiro_status: enviada ? 'enviada' : 'disponivel',
              enviada_financeiro_em: enviada
                ? new Date().toISOString()
                : null,
            }
          : venda
      ),
    }));
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (enviada) proximo.delete(id);
      return proximo;
    });

    try {
      await axios.patch(`/api/vendas/${id}/enviada-financeiro`, { enviada });
    } catch {
      void carregar();
    }
  };

  const copiar = async (mensagem: string, id?: number) => {
    try {
      await navigator.clipboard.writeText(mensagem);
      if (id) {
        setCopiadoId(id);
        window.setTimeout(() => setCopiadoId(null), 2200);
      } else {
        setAviso('Resumo copiado para a área de transferência.');
      }
    } catch {
      setErro('Não foi possível copiar a mensagem neste navegador.');
    }
  };

  const enviarIndividual = (venda: VendaMlHoje) => {
    setErro('');
    setAviso('');
    const aberto = abrirWhatsApp(montarMensagem(venda));
    if (!aberto) {
      setErro(
        'O navegador bloqueou a janela do WhatsApp. Libere pop-ups para este site e tente novamente.'
      );
      return;
    }

    void marcarEnviada(venda.id);
    setAviso(
      `Venda ${venda.order_id || `#${venda.id}`} marcada como enviada ao financeiro.`
    );
  };

  const iniciarLote = () => {
    if (enviandoLote) return;

    const fila = visiveis.filter(
      (venda) => selecionadas.has(venda.id) && !venda.enviada_financeiro
    );
    if (fila.length === 0) {
      setErro('Selecione pelo menos uma venda para enviar em lote.');
      return;
    }
    if (!numero) {
      setErro('Configure o WhatsApp do financeiro antes de enviar.');
      return;
    }

    setConfirmarLote(false);
    setErro('');
    setAviso('');
    setEnviandoLote(true);
    setIndiceLote(0);
    setTotalLote(fila.length);
    let indice = 0;

    const abrirProxima = () => {
      if (indice >= fila.length) {
        setEnviandoLote(false);
        setAviso(
          `Lote concluído: ${fila.length} conversa(s) aberta(s). Confirme o envio de cada mensagem no WhatsApp.`
        );
        return;
      }

      const venda = fila[indice];
      const aberto = abrirWhatsApp(montarMensagem(venda));
      indice += 1;
      setIndiceLote(indice);

      if (aberto) {
        void marcarEnviada(venda.id);
      } else {
        setAviso(
          'O navegador bloqueou uma ou mais janelas. Libere pop-ups para o DESMONTE OS e tente novamente.'
        );
      }

      if (indice < fila.length) {
        timerLote.current = window.setTimeout(abrirProxima, 3000);
      } else {
        setEnviandoLote(false);
        setAviso(
          `Lote concluído: ${fila.length} conversa(s) aberta(s). Confirme o envio de cada mensagem no WhatsApp.`
        );
      }
    };

    abrirProxima();
  };

  const cancelarLote = () => {
    if (timerLote.current !== null) {
      window.clearTimeout(timerLote.current);
      timerLote.current = null;
    }
    setEnviandoLote(false);
    setAviso('Envio em lote cancelado.');
  };

  return (
    <div className="space-y-6">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-success/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-successSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-success">
              <FileText className="h-3.5 w-3.5" />
              Fechamento do dia
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              NF-e e financeiro
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              A lista contém somente vendas disponíveis para envio ou agendadas
              para hoje. Ao abrir a conversa no WhatsApp, a venda é marcada como
              enviada e sai da fila de pendentes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-ink">
              Agenda de {new Date(`${dados.data}T00:00:00`).toLocaleDateString('pt-BR')}
            </span>
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={loading || enviandoLote}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-ink transition-all hover:-translate-y-0.5 hover:bg-white/[0.09] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar vendas
            </button>
          </div>
        </div>
      </section>

      {erro && (
        <div className="rounded-2xl border border-danger/30 bg-dangerSoft p-4 text-sm text-danger">
          {erro}
        </div>
      )}

      {aviso && (
        <div className="rounded-2xl border border-warning/25 bg-warningSoft p-4 text-sm text-warning">
          {aviso}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <ShoppingBag className="h-4 w-4 text-accent" />
            Vendas pendentes
          </div>
          <p className="mt-2 text-3xl font-bold">{pendentes.length}</p>
          <p className="mt-1 text-xs text-muted">
            {comEndereco}/{pendentes.length} com endereço preenchido
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <Wallet className="h-4 w-4 text-success" />
            Faturamento pendente
          </div>
          <p className="mt-2 text-2xl font-bold text-success">
            {formatarMoeda(faturamentoPendente)}
          </p>
          <p className="mt-1 text-xs text-muted">
            disponíveis ou agendadas para hoje
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <MessageCircle className="h-4 w-4 text-cyan" />
            Financeiro
          </div>
          <p className="mt-2 truncate text-sm font-bold">
            {financeWhatsApp || 'WhatsApp não configurado'}
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-1 text-xs font-medium text-accent hover:text-cyan"
          >
            {financeWhatsApp ? 'Alterar número' : 'Configurar número'}
          </button>
        </div>

        <div className="rounded-2xl border border-success/20 bg-successSoft p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-success">
            <BadgeCheck className="h-4 w-4" />
            Já enviadas
          </div>
          <p className="mt-2 text-3xl font-bold text-success">
            {enviadas.length}
          </p>
          <p className="mt-1 text-xs text-muted">
            de {dados.vendas.length} venda(s) na agenda de hoje
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Mercado Livre
            </p>
            <h3 className="mt-1 text-xl font-bold">
              Mensagens por venda
            </h3>
            <p className="mt-1 text-xs text-muted">
              Agenda de hoje
              {' • '}
              {selecionadasVisiveis} selecionada(s)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => trocarModo('pendentes')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  modo === 'pendentes'
                    ? 'bg-success text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Pendentes ({pendentes.length})
              </button>
              <button
                type="button"
                onClick={() => trocarModo('todas')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  modo === 'todas'
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Todas ({dados.vendas.length})
              </button>
            </div>
            <button
              type="button"
              onClick={alternarTodas}
              disabled={loading || selecionaveis.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-white/[0.09] disabled:opacity-50"
            >
              {todasSelecionadas ? (
                <CheckSquare className="h-4 w-4 text-success" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {todasSelecionadas ? 'Desmarcar todas' : 'Selecionar todas'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmarLote(true)}
              disabled={
                !numero ||
                loading ||
                enviandoLote ||
                selecionadasVisiveis === 0 ||
                pendentes.length === 0
              }
              className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              Enviar em lote
            </button>
            <button
              type="button"
              onClick={() => void copiar(resumo)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-xs font-semibold text-muted transition-colors hover:bg-white/[0.09] hover:text-ink"
            >
              <Copy className="h-4 w-4" />
              Copiar resumo
            </button>
          </div>
        </div>

        {enviandoLote && (
          <div className="mt-4 rounded-xl border border-success/25 bg-successSoft p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-success">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Abrindo conversa {Math.min(indiceLote, totalLote)} de {totalLote}...
              </span>
              <button
                type="button"
                onClick={cancelarLote}
                className="rounded-lg border border-success/30 px-2.5 py-1 text-[11px] font-semibold text-success hover:bg-success/15"
              >
                <X className="mr-1 inline h-3 w-3" />
                Cancelar lote
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Uma conversa é aberta a cada 3 segundos. Confirme o envio no
              WhatsApp antes de fechar a janela.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            Carregando vendas do Mercado Livre...
          </div>
        ) : visiveis.length === 0 ? (
          <div className="py-10 text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-success" />
            <p className="mt-3 font-medium">
              {modo === 'pendentes'
                ? 'Nenhuma venda pendente'
                : 'Nenhuma venda na agenda de hoje'}
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">
              {modo === 'pendentes'
                ? 'Não há vendas pendentes na agenda de hoje. Agende ou marque uma venda como disponível na aba Vendas.'
                : 'As vendas disponíveis ou agendadas para hoje aparecerão aqui prontas para o financeiro.'}
            </p>
            {modo === 'pendentes' && dados.vendas.length > 0 && (
              <button
                type="button"
                onClick={() => trocarModo('todas')}
                className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-ink hover:bg-white/[0.09]"
              >
                Ver todas as vendas ({dados.vendas.length})
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {visiveis.map((venda) => {
              const mensagem = montarMensagem(venda);
              const selecionada = selecionadas.has(venda.id);

              return (
                <article
                  key={venda.id}
                  className={`overflow-hidden rounded-2xl border bg-white/[0.025] transition-colors ${
                    venda.enviada_financeiro
                      ? 'border-white/10 opacity-60'
                      : selecionada
                        ? 'border-success/30'
                        : 'border-white/10 opacity-80'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 p-4">
                    <div className="flex items-start gap-3">
                      {venda.enviada_financeiro ? (
                        <span
                          title="Já enviada ao financeiro"
                          className="mt-0.5 text-success"
                        >
                          <BadgeCheck className="h-5 w-5" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => alternarSelecao(venda.id)}
                          aria-label={
                            selecionada
                              ? `Desmarcar venda ${venda.order_id}`
                              : `Selecionar venda ${venda.order_id}`
                          }
                          className="mt-0.5 text-success transition-transform hover:scale-105"
                        >
                          {selecionada ? (
                            <CheckSquare className="h-5 w-5" />
                          ) : (
                            <Square className="h-5 w-5 text-muted" />
                          )}
                        </button>
                      )}
                      <div>
                        <p className="font-mono text-xs text-accent">
                          {venda.order_id || `#${venda.id}`}
                        </p>
                        <p className="mt-0.5 text-[11px] text-success">
                          {venda.status} • venda em {formatarDataHora(venda.data_venda)}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                          {rotuloEnvioFinanceiro(venda, dados.data)}
                        </p>
                        {venda.enviada_financeiro ? (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-success">
                            Enviada ao financeiro
                            {venda.enviada_financeiro_em
                              ? ` em ${formatarDataHora(venda.enviada_financeiro_em)}`
                              : ''}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted">
                          {venda.cliente || 'Comprador ML'}
                          {venda.metodo_pagamento
                            ? ` • ${rotuloPagamento(venda.metodo_pagamento)}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <p className="text-lg font-bold text-success">
                      {formatarMoeda(venda.valor)}
                    </p>
                  </div>

                  <div className="p-4">
                    <div className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-ink">
                          {nomeProduto(venda, venda.itens[0])}
                        </p>
                        <p className="mt-1 text-[11px] text-muted">
                          {venda.peca_sku || venda.itens[0]?.sku || 'Sem SKU'}
                          {venda.peca_carro ? ` • ${venda.peca_carro}` : ''}
                        </p>
                        <div className="mt-2 grid gap-1 text-[11px] text-muted">
                          <span>
                            <span className="font-semibold text-ink">CPF:</span>{' '}
                            {venda.cliente_cpf || 'não informado'}
                          </span>
                          <span className="flex items-start gap-1">
                            <span className="font-semibold text-ink">
                              Endereço:
                            </span>{' '}
                            {venda.cliente_endereco || 'não informado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <details className="group mt-4 rounded-xl border border-white/10 bg-[#07111f]/60">
                      <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-semibold text-muted transition-colors hover:text-ink">
                        Ver mensagem que será enviada
                      </summary>
                      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words border-t border-white/10 px-3 py-3 font-sans text-xs leading-relaxed text-muted">
                        {mensagem}
                      </pre>
                    </details>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => enviarIndividual(venda)}
                        disabled={!numero || enviandoLote}
                        className="inline-flex items-center gap-2 rounded-xl bg-success px-3.5 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Enviar no WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => void copiar(mensagem, venda.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:bg-white/[0.08] hover:text-ink"
                      >
                        {copiadoId === venda.id ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copiadoId === venda.id ? 'Copiada' : 'Copiar mensagem'}
                      </button>
                      {!venda.enviada_financeiro ? (
                        <button
                          type="button"
                          onClick={() => void marcarEnviada(venda.id)}
                          title="Dar baixa sem abrir o WhatsApp"
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:bg-white/[0.08] hover:text-success"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Já enviei
                        </button>
                      ) : null}
                      {venda.enviada_financeiro ? (
                        <button
                          type="button"
                          onClick={() => void marcarEnviada(venda.id, false)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:bg-white/[0.08] hover:text-warning"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Voltar para pendentes
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!financeWhatsApp && (
          <p className="mt-4 rounded-xl border border-warning/20 bg-warningSoft p-3 text-xs leading-relaxed text-warning">
            Cadastre o WhatsApp do financeiro em Configurações para habilitar o
            envio individual e em lote.
          </p>
        )}
      </section>

      {confirmarLote &&
        createPortal(
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmarLote(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-lote-titulo"
            className="modal-panel glass-panel w-full max-w-lg rounded-2xl p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-successSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
                  <Send className="h-3 w-3" />
                  Envio em lote
                </span>
                <h3
                  id="confirmar-lote-titulo"
                  className="mt-3 text-xl font-bold text-ink"
                >
                  Abrir {selecionadas.size} conversa(s)?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmarLote(false)}
                className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-muted hover:text-ink"
                aria-label="Fechar confirmação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
              <p>
                O DESMONTE OS abrirá uma conversa do WhatsApp por vez, com
                intervalo de <strong className="text-ink">3 segundos</strong>.
              </p>
              <p>
                O WhatsApp não confirma o envio automaticamente. Você precisa
                tocar em <strong className="text-ink">Enviar</strong> em cada
                conversa aberta.
              </p>
              <p className="rounded-xl border border-warning/20 bg-warningSoft p-3 text-xs text-warning">
                Se o navegador bloquear as janelas, libere pop-ups para o
                DESMONTE OS e tente novamente.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmarLote(false)}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-muted hover:bg-white/[0.06] hover:text-ink"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={iniciarLote}
                className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                <Send className="h-4 w-4" />
                Iniciar envio em lote
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
