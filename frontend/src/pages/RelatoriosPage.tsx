import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  FileText,
  Package,
  Percent,
  Printer,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import axios from 'axios';
import VendaDetalheModal from '../components/VendaDetalheModal';
import type { SidebarKey } from '../components/Sidebar';

type PeriodoRelatorio = 'hoje' | '7' | '15' | '30' | 'custom';
type StatusRelatorio = 'todas' | 'concluidas' | 'andamento' | 'canceladas';
type ModoValor = 'bruto' | 'liquido';

interface ItemVenda {
  sku: string;
  descricao?: string | null;
  quantidade: number;
  preco_unitario: number;
}

interface VendaRelatorio {
  id: number;
  order_id?: string | null;
  valor: number;
  valor_bruto: number;
  taxa_ml: number;
  valor_liquido: number;
  plataforma: string;
  cliente?: string | null;
  cliente_cpf?: string | null;
  cliente_email?: string | null;
  cliente_fone?: string | null;
  cliente_endereco?: string | null;
  metodo_pagamento?: string | null;
  metodo_pagamento_label?: string | null;
  status: string;
  status_grupo: 'concluida' | 'andamento' | 'cancelada' | string;
  cancelada: boolean;
  recebido: boolean;
  is_ml: boolean;
  data_venda: string;
  data_recebimento?: string | null;
  itens_count: number;
  itens: ItemVenda[];
  peca_nome?: string | null;
  peca_sku?: string | null;
  peca_imagem?: string | null;
}

interface ResumoRelatorio {
  totalRegistros: number;
  vendasValidas: number;
  cancelamentos: number;
  faturamentoBruto: number;
  taxaMl: number;
  faturamentoLiquido: number;
  recebidoLiquido: number;
  aReceberLiquido: number;
  valorCancelado: number;
  taxaMlCancelada: number;
  ticketMedioBruto: number;
  ticketMedioLiquido: number;
  ticketMedioCancelado: number;
  itens: number;
  itensValidos: number;
  clientes: number;
  clientesValidos: number;
  participacaoCancelamento: number;
  ultimoRecebimento?: string | null;
}

interface GrupoStatus {
  vendas: number;
  valorBruto: number;
  taxaMl: number;
  valorLiquido: number;
  valorCancelado: number;
}

interface PontoSerie {
  data: string;
  label: string;
  vendas: number;
  faturamentoBruto: number;
  taxaMl: number;
  faturamentoLiquido: number;
  valorCancelado: number;
  cancelamentos: number;
}

interface PlataformaRelatorio {
  plataforma: string;
  vendas: number;
  faturamentoBruto: number;
  taxaMl: number;
  faturamentoLiquido: number;
  cancelamentos: number;
  valorCancelado: number;
}

interface PagamentoRelatorio {
  metodo: string;
  vendas: number;
  faturamentoBruto: number;
  taxaMl: number;
  faturamentoLiquido: number;
}

interface Relatorio {
  periodo: {
    chave: string;
    label: string;
    dias: number;
    descricao: string;
    inicio: string;
    fim: string;
  };
  filtroStatus: string;
  taxaMl: number;
  resumo: ResumoRelatorio;
  porStatus: {
    concluidas: GrupoStatus;
    andamento: GrupoStatus;
    canceladas: GrupoStatus;
  };
  serie: PontoSerie[];
  plataformas: PlataformaRelatorio[];
  pagamentos: PagamentoRelatorio[];
  vendas: VendaRelatorio[];
}

const PERIODOS: Array<{ chave: PeriodoRelatorio; label: string }> = [
  { chave: 'hoje', label: 'Hoje' },
  { chave: '7', label: '7 dias' },
  { chave: '15', label: '15 dias' },
  { chave: '30', label: '30 dias' },
  { chave: 'custom', label: 'Personalizado' },
];

const STATUS_TABS: Array<{
  chave: StatusRelatorio;
  label: string;
  icon: LucideIcon;
}> = [
  { chave: 'todas', label: 'Todas', icon: FileText },
  { chave: 'concluidas', label: 'Concluídas', icon: CheckCircle2 },
  { chave: 'andamento', label: 'Em andamento', icon: Clock },
  { chave: 'canceladas', label: 'Canceladas', icon: XCircle },
];

const GRUPO_VAZIO: GrupoStatus = {
  vendas: 0,
  valorBruto: 0,
  taxaMl: 0,
  valorLiquido: 0,
  valorCancelado: 0,
};

const RESUMO_VAZIO: ResumoRelatorio = {
  totalRegistros: 0,
  vendasValidas: 0,
  cancelamentos: 0,
  faturamentoBruto: 0,
  taxaMl: 0,
  faturamentoLiquido: 0,
  recebidoLiquido: 0,
  aReceberLiquido: 0,
  valorCancelado: 0,
  taxaMlCancelada: 0,
  ticketMedioBruto: 0,
  ticketMedioLiquido: 0,
  ticketMedioCancelado: 0,
  itens: 0,
  itensValidos: 0,
  clientes: 0,
  clientesValidos: 0,
  participacaoCancelamento: 0,
  ultimoRecebimento: null,
};

const relatorioInicial: Relatorio = {
  periodo: {
    chave: '30',
    label: '30 dias',
    dias: 30,
    descricao: 'Últimos 30 dias',
    inicio: '',
    fim: '',
  },
  filtroStatus: 'todas',
  taxaMl: 17,
  resumo: RESUMO_VAZIO,
  porStatus: {
    concluidas: GRUPO_VAZIO,
    andamento: GRUPO_VAZIO,
    canceladas: GRUPO_VAZIO,
  },
  serie: [],
  plataformas: [],
  pagamentos: [],
  vendas: [],
};

const STATUS_VENDA: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  concluida: {
    label: 'Concluída',
    className: 'border-success/20 bg-successSoft text-success',
    dot: 'bg-success',
  },
  andamento: {
    label: 'Em andamento',
    className: 'border-warning/20 bg-warningSoft text-warning',
    dot: 'bg-warning',
  },
  cancelada: {
    label: 'Cancelada',
    className: 'border-danger/20 bg-dangerSoft text-danger',
    dot: 'bg-danger',
  },
};

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function formatarData(valor?: string | null): string {
  if (!valor) return '—';
  const texto = String(valor);
  const data = /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? new Date(`${texto}T12:00:00`)
    : new Date(texto.replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return texto;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data);
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

function dataLocalISO(data = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function diasAtras(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return dataLocalISO(data);
}

function percentual(valor: number): string {
  return `${(Number(valor) || 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })}%`;
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
  if (!chave) return 'Não informado';

  return chave
    .replace(/[_-]+/g, ' ')
    .replace(/(^|\s)(\p{L})/gu, (_trecho, espaco, letra) => espaco + letra.toUpperCase());
}

function formatarMoedaEixo(valor: number): string {
  const numero = Number(valor) || 0;
  if (numero >= 1000) {
    return `R$ ${(numero / 1000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} mil`;
  }
  return `R$ ${Math.round(numero)}`;
}

function csvCampo(valor: unknown): string {
  const texto = String(valor ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${texto.replace(/"/g, '""')}"`;
}

function exportarCsv(relatorio: Relatorio, status: StatusRelatorio) {
  const cabecalho = [
    'Pedido',
    'Data da venda',
    'Cliente',
    'CPF',
    'Itens',
    'Plataforma',
    'Pagamento',
    'Status',
    'Valor bruto',
    'Taxa Mercado Livre',
    'Valor liquido',
    'Recebido',
    'Data de recebimento',
  ];

  const linhas = relatorio.vendas.map((venda) => [
    venda.order_id || venda.id,
    venda.data_venda,
    venda.cliente || '',
    venda.cliente_cpf || '',
    venda.itens
      .map((item) => `${item.quantidade}x ${item.descricao || item.sku}`)
      .join(' | '),
    venda.plataforma || '',
    venda.metodo_pagamento_label ||
      rotuloPagamento(venda.metodo_pagamento) ||
      '',
    venda.cancelada
      ? 'Cancelada'
      : venda.status_grupo === 'concluida'
        ? 'Concluída'
        : 'Em andamento',
    Number(venda.valor_bruto).toFixed(2).replace('.', ','),
    Number(venda.taxa_ml).toFixed(2).replace('.', ','),
    Number(venda.valor_liquido).toFixed(2).replace('.', ','),
    venda.recebido ? 'Sim' : 'Não',
    venda.data_recebimento || ''
  ]);

  const conteudo = [cabecalho, ...linhas]
    .map((linha) => linha.map(csvCampo).join(';'))
    .join('\r\n');

  const blob = new Blob([`\uFEFF${conteudo}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-financeiro-${relatorio.periodo.inicio || 'periodo'}-a-${
    relatorio.periodo.fim || 'hoje'
  }-${status}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function IndicadorCard({
  indicador,
  onClick,
  tituloAcao,
}: {
  indicador: {
    label: string;
    valor: string;
    detalhe: string;
    icon: LucideIcon;
    cor: string;
    destaque?: boolean;
  };
  onClick?: () => void;
  tituloAcao?: string;
}) {
  const Icone = indicador.icon;
  const classe = `rounded-2xl border p-5 shadow-lg shadow-black/10 ${
    indicador.destaque
      ? 'border-success/25 bg-successSoft'
      : 'border-line bg-card'
  } ${
    onClick
      ? 'group w-full cursor-pointer text-left transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-black/20'
      : ''
  }`;
  const conteudo = (
    <>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        <Icone className={`h-4 w-4 ${indicador.cor}`} />
        <span className="min-w-0">{indicador.label}</span>
        {onClick && (
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        )}
      </div>
      <p className={`mt-2 text-2xl font-bold ${indicador.cor}`}>
        {indicador.valor}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {indicador.detalhe}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={tituloAcao}
        className={classe}
      >
        {conteudo}
      </button>
    );
  }

  return <div className={classe}>{conteudo}</div>;
}

interface RelatoriosPageProps {
  statusInicial?: StatusRelatorio | null;
  onNavigate?: (key: SidebarKey) => void;
}

export default function RelatoriosPage({
  statusInicial,
  onNavigate,
}: RelatoriosPageProps) {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>('30');
  const [status, setStatus] = useState<StatusRelatorio>(
    statusInicial || 'todas'
  );
  const [inicio, setInicio] = useState(() => diasAtras(29));
  const [fim, setFim] = useState(() => dataLocalISO());
  const [taxaTexto, setTaxaTexto] = useState('17');
  const [taxaMl, setTaxaMl] = useState(17);
  const modoValor: ModoValor = 'liquido';
  const [relatorio, setRelatorio] = useState<Relatorio>(relatorioInicial);
  const [vendaAberta, setVendaAberta] = useState<VendaRelatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (statusInicial) setStatus(statusInicial);
  }, [statusInicial]);

  const periodoValido =
    periodo !== 'custom' || (Boolean(inicio) && Boolean(fim) && inicio <= fim);

  const carregar = useCallback(async (silencioso = false) => {
    if (!periodoValido) return;

    if (!silencioso) {
      setLoading(true);
      setErro('');
    }

    try {
      const params = new URLSearchParams();
      if (periodo === 'custom') {
        params.set('inicio', inicio);
        params.set('fim', fim);
      } else {
        params.set('periodo', periodo);
      }
      params.set('status', status);
      params.set('taxa_ml', String(taxaMl));

      const { data } = await axios.get<Relatorio>(
        `/api/relatorios?${params.toString()}`,
        { timeout: 15000 }
      );
      setRelatorio(data);
    } catch (error) {
      if (silencioso) return;
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível gerar o relatório financeiro.'
        );
      } else {
        setErro('Não foi possível gerar o relatório financeiro.');
      }
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [fim, inicio, periodo, periodoValido, status, taxaMl]);

  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregar();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [carregar]);

  // Venda nova no Mercado Livre entra no relatório sem precisar clicar em
  // Atualizar. A atualização silenciosa mantém filtros e o modal aberto.
  useEffect(() => {
    let ativo = true;

    const atualizar = () => {
      if (!ativo || document.visibilityState !== 'visible') return;
      void carregarRef.current(true);
    };

    const intervalo = window.setInterval(atualizar, 45000);
    document.addEventListener('visibilitychange', atualizar);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, []);

  const totalGeral = useMemo(() => {
    const { concluidas, andamento, canceladas } = relatorio.porStatus;
    return (
      concluidas.vendas + andamento.vendas + canceladas.vendas
    );
  }, [relatorio.porStatus]);

  const indicadoresPrincipais = useMemo(() => {
    const resumo = relatorio.resumo;
    const taxaLabel = `Taxa estimada de ${relatorio.taxaMl}% sobre vendas no Mercado Livre`;

    if (status === 'canceladas') {
      return [
        {
          label: 'Cancelamentos',
          valor: String(resumo.cancelamentos),
          detalhe: `${percentual(
            resumo.participacaoCancelamento
          )} dos pedidos do período`,
          icon: XCircle,
          cor: 'text-danger',
        },
        {
          label: 'Valor cancelado',
          valor: formatarMoeda(resumo.valorCancelado),
          detalhe: 'Valor bruto dos pedidos cancelados',
          icon: TrendingDown,
          cor: 'text-danger',
        },
        {
          label: 'Taxa ML evitada',
          valor: formatarMoeda(resumo.taxaMlCancelada),
          detalhe: 'Estimativa que não será cobrada',
          icon: Percent,
          cor: 'text-warning',
        },
        {
          label: 'Ticket médio cancelado',
          valor: formatarMoeda(resumo.ticketMedioCancelado),
          detalhe: `${resumo.clientes} cliente(s) envolvido(s)`,
          icon: ShoppingBag,
          cor: 'text-muted',
        },
      ];
    }

    if (status === 'concluidas') {
      return [
        {
          label: 'Vendas concluídas',
          valor: String(resumo.vendasValidas),
          detalhe: `${resumo.itensValidos} item(ns) • ${resumo.clientesValidos} cliente(s)`,
          icon: CheckCircle2,
          cor: 'text-success',
        },
        {
          label: 'Faturamento bruto',
          valor: formatarMoeda(resumo.faturamentoBruto),
          detalhe: 'Valor cheio antes da taxa do Mercado Livre',
          icon: Wallet,
          cor: 'text-ink',
        },
        {
          label: 'Taxa Mercado Livre',
          valor: `- ${formatarMoeda(resumo.taxaMl)}`,
          detalhe: taxaLabel,
          icon: Percent,
          cor: 'text-warning',
        },
        {
          label: 'Recebido líquido',
          valor: formatarMoeda(resumo.recebidoLiquido),
          detalhe: resumo.ultimoRecebimento
            ? `Último recebimento em ${formatarData(resumo.ultimoRecebimento)}`
            : 'Nenhum recebimento no período',
          icon: CheckCircle2,
          cor: 'text-success',
          destaque: true,
        },
      ];
    }

    if (status === 'andamento') {
      return [
        {
          label: 'Vendas em andamento',
          valor: String(resumo.vendasValidas),
          detalhe: `${resumo.itensValidos} item(ns) aguardando conclusão`,
          icon: Clock,
          cor: 'text-warning',
        },
        {
          label: 'Faturamento bruto',
          valor: formatarMoeda(resumo.faturamentoBruto),
          detalhe: 'Pedidos ainda não recebidos',
          icon: Wallet,
          cor: 'text-ink',
        },
        {
          label: 'Taxa Mercado Livre',
          valor: `- ${formatarMoeda(resumo.taxaMl)}`,
          detalhe: taxaLabel,
          icon: Percent,
          cor: 'text-warning',
        },
        {
          label: 'A receber líquido',
          valor: formatarMoeda(resumo.aReceberLiquido),
          detalhe: 'Previsão após o desconto da taxa ML',
          icon: Clock,
          cor: 'text-cyan',
          destaque: true,
        },
      ];
    }

    return [
      {
        label: 'Vendas válidas',
        valor: String(resumo.vendasValidas),
        detalhe: `${resumo.cancelamentos} cancelada(s) • ${resumo.totalRegistros} pedido(s)`,
        icon: ShoppingBag,
        cor: 'text-accent',
      },
      {
        label: 'Faturamento bruto',
        valor: formatarMoeda(resumo.faturamentoBruto),
        detalhe: `${resumo.itensValidos} item(ns) vendido(s)`,
        icon: Wallet,
        cor: 'text-ink',
      },
      {
        label: 'Taxa Mercado Livre',
        valor: `- ${formatarMoeda(resumo.taxaMl)}`,
        detalhe: taxaLabel,
        icon: Percent,
        cor: 'text-warning',
      },
      {
        label: 'Faturamento líquido',
        valor: formatarMoeda(resumo.faturamentoLiquido),
        detalhe: 'Bruto menos a taxa estimada do Mercado Livre',
        icon: TrendingUp,
        cor: 'text-success',
        destaque: true,
      },
    ];
  }, [relatorio.resumo, relatorio.taxaMl, status]);

  const indicadoresFinanceiros = useMemo(() => {
    const resumo = relatorio.resumo;

    if (status === 'concluidas' || status === 'andamento') {
      return [
        {
          label: 'Ticket médio líquido',
          valor: formatarMoeda(resumo.ticketMedioLiquido),
          detalhe: 'Média por venda, já sem a taxa ML',
          icon: BarChart3,
          cor: 'text-cyan',
        },
        {
          label: 'Clientes',
          valor: String(resumo.clientesValidos),
          detalhe: `${resumo.vendasValidas} venda(s) no filtro`,
          icon: Users,
          cor: 'text-accent',
        },
        {
          label: 'Itens vendidos',
          valor: String(resumo.itensValidos),
          detalhe: 'Unidades nas vendas filtradas',
          icon: ShoppingBag,
          cor: 'text-ink',
        },
        {
          label: 'Cancelamentos no período',
          valor: formatarMoeda(resumo.valorCancelado),
          detalhe: `${resumo.cancelamentos} pedido(s) cancelado(s)`,
          icon: XCircle,
          cor: 'text-danger',
        },
      ];
    }

    return [
      {
        label: 'Recebido líquido',
        valor: formatarMoeda(resumo.recebidoLiquido),
        detalhe: resumo.ultimoRecebimento
          ? `Último recebimento em ${formatarData(resumo.ultimoRecebimento)}`
          : 'Sem vendas concluídas no período',
        icon: CheckCircle2,
        cor: 'text-success',
      },
      {
        label: 'A receber líquido',
        valor: formatarMoeda(resumo.aReceberLiquido),
        detalhe: 'Vendas em andamento, já sem a taxa ML',
        icon: Clock,
        cor: 'text-warning',
      },
      {
        label: 'Cancelamentos',
        valor: formatarMoeda(resumo.valorCancelado),
        detalhe: `${resumo.cancelamentos} pedido(s) • ${percentual(
          resumo.participacaoCancelamento
        )} do total`,
        icon: XCircle,
        cor: 'text-danger',
      },
      {
        label: 'Ticket médio líquido',
        valor: formatarMoeda(resumo.ticketMedioLiquido),
        detalhe: `${resumo.clientesValidos} cliente(s) nas vendas válidas`,
        icon: BarChart3,
        cor: 'text-cyan',
      },
    ];
  }, [relatorio.resumo, status]);

  const cartoesStatus = useMemo(
    () => [
      {
        chave: 'concluidas' as StatusRelatorio,
        label: 'Concluídas',
        descricao: 'Pagas e recebidas',
        dados: relatorio.porStatus.concluidas,
        valor: relatorio.porStatus.concluidas.valorLiquido,
        rotuloValor: 'líquido recebido',
        icon: CheckCircle2,
        cor: 'text-success',
        borda: 'border-success/20 bg-successSoft',
        ponto: 'bg-success',
      },
      {
        chave: 'andamento' as StatusRelatorio,
        label: 'Em andamento',
        descricao: 'Aguardando conclusão',
        dados: relatorio.porStatus.andamento,
        valor: relatorio.porStatus.andamento.valorLiquido,
        rotuloValor: 'a receber',
        icon: Clock,
        cor: 'text-warning',
        borda: 'border-warning/20 bg-warningSoft',
        ponto: 'bg-warning',
      },
      {
        chave: 'canceladas' as StatusRelatorio,
        label: 'Canceladas',
        descricao: 'Pedidos cancelados',
        dados: relatorio.porStatus.canceladas,
        valor: relatorio.porStatus.canceladas.valorCancelado,
        rotuloValor: 'valor cancelado',
        icon: XCircle,
        cor: 'text-danger',
        borda: 'border-danger/20 bg-dangerSoft',
        ponto: 'bg-danger',
      },
    ],
    [relatorio.porStatus]
  );

  const valorDoPonto = useCallback(
    (ponto: PontoSerie) => {
      if (status === 'canceladas') return ponto.valorCancelado;
      return modoValor === 'liquido'
        ? ponto.faturamentoLiquido
        : ponto.faturamentoBruto;
    },
    [modoValor, status]
  );

  const maxPagamento = useMemo(
    () =>
      Math.max(
        1,
        ...relatorio.pagamentos.map((pagamento) =>
          modoValor === 'liquido'
            ? pagamento.faturamentoLiquido
            : pagamento.faturamentoBruto
        )
      ),
    [modoValor, relatorio.pagamentos]
  );

  const totalSerie = useMemo(
    () =>
      relatorio.serie.reduce((total, ponto) => total + valorDoPonto(ponto), 0),
    [relatorio.serie, valorDoPonto]
  );

  const graficoSerie = useMemo(() => {
    const pontos = relatorio.serie;
    const largura = 920;
    const altura = 260;
    const margem = { topo: 18, direita: 14, baixo: 30, esquerda: 66 };
    const max = Math.max(1, ...pontos.map(valorDoPonto));
    const baseY = altura - margem.baixo;
    const escalaX = (indice: number) =>
      margem.esquerda +
      (indice / Math.max(1, pontos.length - 1)) *
        (largura - margem.esquerda - margem.direita);
    const escalaY = (valor: number) =>
      baseY - (valor / max) * (baseY - margem.topo);
    const coords = pontos.map((ponto, indice) => ({
      x: escalaX(indice),
      y: escalaY(valorDoPonto(ponto)),
      ponto,
    }));
    const linha = coords
      .map(
        (coord, indice) =>
          `${indice === 0 ? 'M' : 'L'} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`
      )
      .join(' ');
    const area =
      coords.length > 0
        ? `${linha} L ${coords[coords.length - 1].x.toFixed(1)} ${baseY} L ${coords[0].x.toFixed(1)} ${baseY} Z`
        : '';
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((fracao) => ({
      valor: max * fracao,
      y: escalaY(max * fracao),
    }));
    const passoLabel = Math.max(1, Math.ceil(pontos.length / 8));
    const labels = coords.filter(
      (_, indice) =>
        indice % passoLabel === 0 || indice === pontos.length - 1
    );
    const melhor = pontos.reduce<PontoSerie | null>(
      (atual, ponto) =>
        !atual || valorDoPonto(ponto) > valorDoPonto(atual) ? ponto : atual,
      null
    );
    const cor =
      status === 'canceladas'
        ? '#f87171'
        : modoValor === 'liquido'
          ? '#34d399'
          : '#60a5fa';

    return { largura, altura, margem, baseY, max, coords, linha, area, ticks, labels, melhor, cor };
  }, [relatorio.serie, valorDoPonto, status, modoValor]);

  const totaisTabela = useMemo(() => {
    const resumo = relatorio.resumo;

    return {
      bruto:
        status === 'canceladas'
          ? resumo.valorCancelado
          : resumo.faturamentoBruto,
      taxa: resumo.taxaMl,
      liquido: resumo.faturamentoLiquido,
      recebido: resumo.recebidoLiquido,
    };
  }, [relatorio.resumo, status]);

  const aplicarTaxa = (valor: string) => {
    setTaxaTexto(valor);
    const numero = Number(valor.replace(',', '.'));
    if (valor.trim() !== '' && Number.isFinite(numero)) {
      setTaxaMl(Math.min(100, Math.max(0, numero)));
    }
  };

  const handleExportar = () => {
    if (relatorio.vendas.length === 0) {
      setErro('Não há vendas no período para exportar.');
      return;
    }
    exportarCsv(relatorio, status);
  };

  const legendaSerie =
    status === 'canceladas'
      ? 'Valor cancelado'
      : modoValor === 'liquido'
        ? 'Faturamento líquido'
        : 'Faturamento bruto';

  const destinoIndicador = (
    label: string
  ): SidebarKey | 'canceladas' | null => {
    if (/cancel|taxa ml evitada/i.test(label)) return 'canceladas';
    if (label === 'Taxa Mercado Livre') return 'marketplaces';
    if (label === 'Clientes') return 'atendimento';
    if (label === 'Itens vendidos') return 'lotes';
    if (/venda|faturamento|recebido|a receber|ticket médio/i.test(label)) {
      return 'pedidos';
    }
    return null;
  };

  const abrirIndicador = (label: string) => {
    const destino = destinoIndicador(label);

    if (!destino) return;

    if (destino === 'canceladas') {
      setStatus('canceladas');
      return;
    }

    onNavigate?.(destino);
  };

  return (
    <div className="print-report space-y-6">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8 print:border-0 print:bg-white print:p-0 print:shadow-none">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl print:hidden" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent print:border-0 print:bg-transparent print:p-0 print:text-[#555]">
              <BarChart3 className="h-3.5 w-3.5" />
              Relatório financeiro
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-4xl print:text-2xl print:text-black">
              Conferência de vendas
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base print:text-[#555]">
              Vendas, taxas do Mercado Livre, valores recebidos, a receber e
              cancelamentos. O foco é conferir cada venda e o dinheiro que
              realmente entrou.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-white/[0.09] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleExportar}
              disabled={loading || relatorio.vendas.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-white/[0.09] disabled:opacity-50"
            >
              <Download className="h-4 w-4 text-success" />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>
        </div>

        <div className="mt-3 hidden text-xs text-[#666] print:block">
          Período: {formatarData(relatorio.periodo.inicio)} a{' '}
          {formatarData(relatorio.periodo.fim)} • Status:{' '}
          {STATUS_TABS.find((item) => item.chave === status)?.label} • Taxa ML:{' '}
          {relatorio.taxaMl}% • Gerado em{' '}
          {formatarDataHora(new Date().toISOString())}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-4 shadow-lg shadow-black/20 sm:p-5 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODOS.map((item) => {
            const ativo = item.chave === periodo;

            return (
              <button
                key={item.chave}
                type="button"
                onClick={() => setPeriodo(item.chave)}
                aria-pressed={ativo}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  ativo
                    ? 'bg-accent text-white shadow-[0_10px_26px_-14px_rgba(76,157,255,0.9)]'
                    : 'border border-white/10 bg-white/[0.04] text-muted hover:bg-white/[0.08] hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-muted">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatarData(relatorio.periodo.inicio)} a{' '}
            {formatarData(relatorio.periodo.fim)}
          </span>
        </div>

        {periodo === 'custom' && (
          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Início
              <input
                type="date"
                value={inicio}
                max={fim}
                onChange={(event) => setInicio(event.target.value)}
                className="rounded-lg border px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Fim
              <input
                type="date"
                value={fim}
                min={inicio}
                onChange={(event) => setFim(event.target.value)}
                className="rounded-lg border px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-ink"
              />
            </label>
            {!periodoValido && (
              <span className="inline-flex items-center gap-1.5 pb-1 text-[11px] text-danger">
                <AlertTriangle className="h-3.5 w-3.5" />
                Informe um período válido.
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
          {STATUS_TABS.map((item) => {
            const ativo = item.chave === status;
            const Icone = item.icon;
            const quantidade =
              item.chave === 'todas'
                ? totalGeral
                : relatorio.porStatus[item.chave].vendas;

            return (
              <button
                key={item.chave}
                type="button"
                onClick={() => setStatus(item.chave)}
                aria-pressed={ativo}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                  ativo
                    ? 'border-accent/50 bg-accentSoft text-accent'
                    : 'border-white/10 bg-white/[0.03] text-muted hover:bg-white/[0.07] hover:text-ink'
                }`}
              >
                <Icone className="h-3.5 w-3.5" />
                {item.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    ativo ? 'bg-accent/20 text-accent' : 'bg-white/[0.06]'
                  }`}
                >
                  {quantidade}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-line/70 pt-4">
          <label className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              <Percent className="h-3 w-3" />
              Taxa do Mercado Livre
            </span>
            <span className="relative block">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={taxaTexto}
                onChange={(event) => aplicarTaxa(event.target.value)}
                onBlur={() => setTaxaTexto(String(taxaMl))}
                className="w-28 rounded-xl border px-3 py-2 pr-8 text-sm font-semibold"
                aria-label="Percentual da taxa do Mercado Livre"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                %
              </span>
            </span>
          </label>

          <p className="max-w-sm pb-1 text-[11px] leading-relaxed text-muted">
            A taxa padrão é 17% e vale só para vendas do Mercado Livre. Você pode
            alterar acima e clicar em <strong>Atualizar</strong> para recalcular o
            resumo, o gráfico e a tabela. Vendas manuais entram sem desconto.
          </p>
        </div>
      </section>

      {erro && (
        <div className="rounded-2xl border border-danger/30 bg-dangerSoft p-4 text-sm text-danger print:hidden">
          {erro}
        </div>
      )}

      {loading && relatorio.vendas.length === 0 ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-card py-16 text-sm text-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Gerando relatório financeiro...
        </div>
      ) : (
        <>
          <p className="text-xs text-muted print:hidden">
            Clique em um cartão para abrir a página relacionada ao assunto.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {indicadoresPrincipais.map((indicador) => {
              const destino = destinoIndicador(indicador.label);

              return (
                <IndicadorCard
                  key={indicador.label}
                  indicador={indicador}
                  onClick={
                    destino ? () => abrirIndicador(indicador.label) : undefined
                  }
                  tituloAcao={
                    destino === 'canceladas'
                      ? 'Filtrar os cancelamentos deste relatório'
                      : destino
                        ? 'Abrir a página relacionada a este indicador'
                        : undefined
                  }
                />
              );
            })}
          </div>

          {status !== 'canceladas' && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {indicadoresFinanceiros.map((indicador) => {
                const destino = destinoIndicador(indicador.label);

                return (
                  <IndicadorCard
                    key={indicador.label}
                    indicador={indicador}
                    onClick={
                      destino
                        ? () => abrirIndicador(indicador.label)
                        : undefined
                    }
                    tituloAcao={
                      destino === 'canceladas'
                        ? 'Filtrar os cancelamentos deste relatório'
                        : destino
                          ? 'Abrir a página relacionada a este indicador'
                          : undefined
                    }
                  />
                );
              })}
            </div>
          )}

          <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Visão por status
                </p>
                <h3 className="mt-1 text-lg font-bold">
                  Onde está o dinheiro
                </h3>
              </div>
              <span className="text-xs text-muted">
                Clique em um status para filtrar
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {cartoesStatus.map((cartao) => {
                const Icone = cartao.icon;
                const ativo = status === cartao.chave;

                return (
                  <button
                    key={cartao.chave}
                    type="button"
                    onClick={() =>
                      setStatus(ativo ? 'todas' : cartao.chave)
                    }
                    aria-pressed={ativo}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      ativo
                        ? `${cartao.borda} shadow-[0_0_0_1px_rgba(255,255,255,0.08)]`
                        : 'border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
                        <Icone className={`h-4 w-4 ${cartao.cor}`} />
                        {cartao.label}
                      </span>
                      <span className={`h-1.5 w-1.5 rounded-full ${cartao.ponto}`} />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-ink">
                      {cartao.dados.vendas}
                    </p>
                    <p className="text-[11px] text-muted">
                      {cartao.descricao} • {cartao.rotuloValor}
                    </p>
                    <p className={`mt-2 text-sm font-semibold ${cartao.cor}`}>
                      {formatarMoeda(cartao.valor)}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <section className="min-w-0 rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6 xl:col-span-2 print:border-[#ddd] print:shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted print:text-[#777]">
                    Evolução financeira
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-ink print:text-black">
                    {legendaSerie} por{' '}
                    {relatorio.periodo.chave === 'hoje' ? 'hora' : 'dia'}
                  </h3>
                  <p className="text-xs text-muted print:text-[#666]">
                    {relatorio.periodo.label} • {relatorio.vendas.length} venda(s)
                    no filtro
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    status === 'canceladas'
                      ? 'border-danger/20 bg-dangerSoft text-danger'
                      : modoValor === 'liquido'
                        ? 'border-success/20 bg-successSoft text-success'
                        : 'border-accent/20 bg-accentSoft text-accent'
                  }`}
                >
                  {formatarMoeda(totalSerie)}
                </span>
              </div>

              {relatorio.serie.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">
                  Nenhum dado no período.
                </p>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-line/60 bg-white/[0.02] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                        Total no período
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold text-ink">
                        {formatarMoeda(totalSerie)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-line/60 bg-white/[0.02] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                        Média por {relatorio.periodo.chave === 'hoje' ? 'hora' : 'dia'}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold text-ink">
                        {formatarMoeda(
                          totalSerie / Math.max(1, relatorio.serie.length)
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-line/60 bg-white/[0.02] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                        Melhor {relatorio.periodo.chave === 'hoje' ? 'hora' : 'dia'}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold text-success">
                        {graficoSerie.melhor
                          ? `${graficoSerie.melhor.label} • ${formatarMoeda(
                              valorDoPonto(graficoSerie.melhor)
                            )}`
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border border-line/50 bg-white/[0.015] p-2 sm:p-3 print:bg-white">
                    <svg
                      viewBox={`0 0 ${graficoSerie.largura} ${graficoSerie.altura}`}
                      className="h-60 w-full sm:h-72"
                      role="img"
                      aria-label={`Gráfico de ${legendaSerie}`}
                    >
                      <defs>
                        <linearGradient
                          id="relatorio-area-gradiente"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={graficoSerie.cor}
                            stopOpacity="0.4"
                          />
                          <stop
                            offset="100%"
                            stopColor={graficoSerie.cor}
                            stopOpacity="0.02"
                          />
                        </linearGradient>
                      </defs>

                      {graficoSerie.ticks.map((tick) => (
                        <g key={`tick-${tick.y}`}>
                          <line
                            x1={graficoSerie.margem.esquerda}
                            x2={
                              graficoSerie.largura - graficoSerie.margem.direita
                            }
                            y1={tick.y}
                            y2={tick.y}
                            stroke="rgba(148, 163, 184, 0.18)"
                            strokeDasharray="3 5"
                          />
                          <text
                            x={graficoSerie.margem.esquerda - 8}
                            y={tick.y + 3}
                            textAnchor="end"
                            fontSize="10"
                            fill="currentColor"
                            className="text-muted"
                          >
                            {formatarMoedaEixo(tick.valor)}
                          </text>
                        </g>
                      ))}

                      {graficoSerie.area ? (
                        <path
                          d={graficoSerie.area}
                          fill="url(#relatorio-area-gradiente)"
                        />
                      ) : null}

                      {graficoSerie.linha ? (
                        <path
                          d={graficoSerie.linha}
                          fill="none"
                          stroke={graficoSerie.cor}
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      ) : null}

                      {graficoSerie.coords.map((coord) => (
                        <g key={`ponto-${coord.ponto.data}`}>
                          <circle
                            cx={coord.x}
                            cy={coord.y}
                            r={graficoSerie.coords.length > 40 ? 1.8 : 3}
                            fill={graficoSerie.cor}
                            stroke="#0b1220"
                            strokeWidth="1"
                          />
                          <rect
                            x={coord.x - 7}
                            y={graficoSerie.margem.topo}
                            width="14"
                            height={
                              graficoSerie.baseY - graficoSerie.margem.topo
                            }
                            fill="transparent"
                          >
                            <title>
                              {`${coord.ponto.label}: ${formatarMoeda(
                                valorDoPonto(coord.ponto)
                              )} • ${coord.ponto.vendas} venda(s) • Bruto ${formatarMoeda(
                                coord.ponto.faturamentoBruto
                              )} • Taxa ${formatarMoeda(
                                coord.ponto.taxaMl
                              )} • Líquido ${formatarMoeda(
                                coord.ponto.faturamentoLiquido
                              )}`}
                            </title>
                          </rect>
                        </g>
                      ))}

                      {graficoSerie.labels.map((coord) => (
                        <text
                          key={`label-${coord.ponto.data}`}
                          x={coord.x}
                          y={graficoSerie.altura - 8}
                          textAnchor="middle"
                          fontSize="10"
                          fill="currentColor"
                          className="text-muted"
                        >
                          {coord.ponto.label}
                        </text>
                      ))}
                    </svg>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-[10px] text-muted print:text-[#666]">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: graficoSerie.cor }}
                      />
                      {legendaSerie}
                    </span>
                    <span>Passe o mouse nos pontos para ver os detalhes.</span>
                  </div>
                </>
              )}
            </section>

            <section className="min-w-0 rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6 print:border-[#ddd] print:shadow-none">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-cyan" />
                <h3 className="text-lg font-bold text-ink print:text-black">
                  Formas de pagamento
                </h3>
              </div>
              <p className="mt-1 text-xs text-muted print:text-[#666]">
                {modoValor === 'liquido'
                  ? 'Valores líquidos, já sem a taxa ML'
                  : 'Valores brutos antes da taxa ML'}
              </p>

              {relatorio.pagamentos.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">
                  Sem vendas válidas no período.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {relatorio.pagamentos.map((pagamento) => {
                    const valor =
                      modoValor === 'liquido'
                        ? pagamento.faturamentoLiquido
                        : pagamento.faturamentoBruto;

                    return (
                      <div key={pagamento.metodo}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate text-muted print:text-[#555]">
                            {rotuloPagamento(pagamento.metodo)}
                          </span>
                          <span className="shrink-0 font-semibold text-ink print:text-black">
                            {formatarMoeda(valor)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-muted">
                          <span>{pagamento.vendas} venda(s)</span>
                          <span>Taxa {formatarMoeda(pagamento.taxaMl)}</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.05] print:bg-[#eee]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan to-accent print:bg-accent"
                            style={{
                              width: `${Math.max(
                                4,
                                (valor / maxPagamento) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-card shadow-lg shadow-black/20 print:border-[#ddd] print:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5 sm:p-6 print:border-[#eee]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted print:text-[#777]">
                  Por canal de venda
                </p>
                <h3 className="mt-1 text-lg font-bold text-ink print:text-black">
                  Plataformas
                </h3>
              </div>
              <span className="text-xs text-muted print:text-[#666]">
                Bruto, taxa e líquido por plataforma
              </span>
            </div>

            {relatorio.plataformas.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted">
                Nenhuma venda no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[10px] uppercase tracking-[0.12em] text-muted print:text-[#777]">
                      <th className="px-5 py-3 font-semibold sm:px-6">Plataforma</th>
                      <th className="px-3 py-3 text-right font-semibold">Vendas válidas</th>
                      <th className="px-3 py-3 text-right font-semibold">Bruto</th>
                      <th className="px-3 py-3 text-right font-semibold">Taxa ML</th>
                      <th className="px-3 py-3 text-right font-semibold">Líquido</th>
                      <th className="px-5 py-3 text-right font-semibold sm:px-6">
                        Cancelado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.plataformas.map((plataforma) => (
                      <tr
                        key={plataforma.plataforma}
                        className="border-b border-line/60 last:border-0 print:border-[#eee]"
                      >
                        <td className="px-5 py-3 font-medium text-ink sm:px-6 print:text-black">
                          {plataforma.plataforma}
                        </td>
                        <td className="px-3 py-3 text-right text-muted print:text-[#555]">
                          {Math.max(
                            0,
                            plataforma.vendas - plataforma.cancelamentos
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-ink print:text-black">
                          {formatarMoeda(plataforma.faturamentoBruto)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-warning print:text-[#555]">
                          {formatarMoeda(plataforma.taxaMl)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-success print:text-black">
                          {formatarMoeda(plataforma.faturamentoLiquido)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-danger sm:px-6 print:text-[#555]">
                          {plataforma.cancelamentos > 0
                            ? `${plataforma.cancelamentos} • ${formatarMoeda(
                                plataforma.valorCancelado
                              )}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-card shadow-lg shadow-black/20 print:border-[#ddd] print:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5 sm:p-6 print:border-[#eee]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted print:text-[#777]">
                  Detalhamento financeiro
                </p>
                <h3 className="mt-1 text-lg font-bold text-ink print:text-black">
                  Vendas do período
                </h3>
                <p className="mt-1 text-xs text-muted print:text-[#666]">
                  Clique em uma venda para ver o detalhe completo. Canceladas
                  ficam fora do faturamento válido.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted print:border-[#ddd] print:bg-white print:text-[#555]">
                <FileText className="h-3.5 w-3.5" />
                {relatorio.vendas.length} registro(s)
              </span>
            </div>

            {relatorio.vendas.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted">
                Nenhuma venda registrada com esse filtro.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-line/60">
                  {relatorio.vendas.map((venda) => {
                    const statusVenda =
                      STATUS_VENDA[venda.status_grupo] || STATUS_VENDA.andamento;
                    const itensTexto =
                      venda.itens
                        .map(
                          (item) =>
                            `${item.quantidade}x ${item.descricao || item.sku}`
                        )
                        .join(', ') || 'Produto não informado';

                    return (
                      <li key={venda.id}>
                        <button
                          type="button"
                          onClick={() => setVendaAberta(venda)}
                          aria-label={`Ver detalhe da venda ${
                            venda.order_id || venda.id
                          }`}
                          className={`group w-full px-4 py-4 text-left transition-colors focus:outline-none focus-visible:bg-white/[0.04] sm:px-6 ${
                            venda.cancelada
                              ? 'bg-danger/[0.04] hover:bg-danger/[0.07]'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-secondary">
                                {venda.peca_imagem ? (
                                  <img
                                    src={venda.peca_imagem}
                                    alt={venda.peca_nome || itensTexto}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted">
                                    <Package className="h-6 w-6" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-accent group-hover:underline print:text-[#3483fa]">
                                    {venda.order_id || `#${venda.id}`}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusVenda.className}`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${statusVenda.dot}`}
                                    />
                                    {statusVenda.label}
                                  </span>
                                  {venda.is_ml ? (
                                    <span className="rounded-full border border-ml/25 bg-ml/10 px-2 py-0.5 text-[10px] font-semibold text-ml">
                                      Mercado Livre
                                    </span>
                                  ) : null}
                                </div>

                                <p
                                  className="mt-1 truncate text-sm font-medium text-ink print:text-black"
                                  title={itensTexto}
                                >
                                  {venda.peca_nome || itensTexto}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] text-muted print:text-[#666]">
                                  {venda.cliente || 'Comprador'} •{' '}
                                  {venda.cliente_cpf || 'CPF não informado'} •{' '}
                                  {rotuloPagamento(
                                    venda.metodo_pagamento_label ||
                                      venda.metodo_pagamento
                                  )}
                                </p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted print:text-[#777]">
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarDays className="h-3 w-3" />
                                    {formatarDataHora(venda.data_venda)}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                                    Ver detalhe da venda
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[440px]">
                              <div className="rounded-xl border border-line/60 bg-white/[0.02] px-2.5 py-2">
                                <p className="text-[9px] uppercase tracking-wide text-muted">
                                  Bruto
                                </p>
                                <p
                                  className={`mt-0.5 truncate text-xs font-semibold ${
                                    venda.cancelada
                                      ? 'text-danger line-through'
                                      : 'text-ink'
                                  }`}
                                >
                                  {formatarMoeda(venda.valor_bruto)}
                                </p>
                              </div>
                              <div className="rounded-xl border border-line/60 bg-white/[0.02] px-2.5 py-2">
                                <p className="text-[9px] uppercase tracking-wide text-muted">
                                  Taxa ML
                                </p>
                                <p className="mt-0.5 truncate text-xs font-semibold text-warning">
                                  {venda.taxa_ml > 0
                                    ? `- ${formatarMoeda(venda.taxa_ml)}`
                                    : '—'}
                                </p>
                              </div>
                              <div className="rounded-xl border border-line/60 bg-white/[0.02] px-2.5 py-2">
                                <p className="text-[9px] uppercase tracking-wide text-muted">
                                  Líquido
                                </p>
                                <p
                                  className={`mt-0.5 truncate text-xs font-semibold ${
                                    venda.cancelada
                                      ? 'text-muted'
                                      : 'text-success'
                                  }`}
                                >
                                  {venda.cancelada
                                    ? '—'
                                    : formatarMoeda(venda.valor_liquido)}
                                </p>
                              </div>
                              <div className="rounded-xl border border-line/60 bg-white/[0.02] px-2.5 py-2">
                                <p className="text-[9px] uppercase tracking-wide text-muted">
                                  {venda.recebido
                                    ? 'Recebido'
                                    : venda.cancelada
                                      ? 'Situação'
                                      : 'A receber'}
                                </p>
                                <p
                                  className={`mt-0.5 truncate text-xs font-semibold ${
                                    venda.recebido
                                      ? 'text-success'
                                      : venda.cancelada
                                        ? 'text-danger'
                                        : 'text-warning'
                                  }`}
                                >
                                  {venda.recebido
                                    ? formatarMoeda(venda.valor_liquido)
                                    : venda.cancelada
                                      ? 'Cancelada'
                                      : 'Pendente'}
                                </p>
                                <p className="mt-0.5 truncate text-[9px] text-muted">
                                  {venda.recebido && venda.data_recebimento
                                    ? formatarData(venda.data_recebimento)
                                    : venda.cancelada
                                      ? 'Fora do faturamento'
                                      : 'Aguardando conclusão'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="grid grid-cols-2 gap-3 border-t border-line bg-white/[0.02] p-4 sm:grid-cols-4 sm:p-5 print:border-[#ddd] print:bg-[#fafafa]">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Bruto do filtro
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-ink">
                      {formatarMoeda(totaisTabela.bruto)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Taxa ML
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-warning">
                      {formatarMoeda(totaisTabela.taxa)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Líquido
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-success">
                      {formatarMoeda(totaisTabela.liquido)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Recebido
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-success">
                      {formatarMoeda(totaisTabela.recebido)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>

          <VendaDetalheModal
            venda={vendaAberta}
            onClose={() => setVendaAberta(null)}
          />
        </>
      )}
    </div>
  );
}
