import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Barcode,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  FileUp,
  Info,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  PackageCheck,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Square,
  SlidersHorizontal,
  Truck,
  UserRound,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import axios from 'axios';
import type { VendaAba } from '../types/vendas';

type FiltroRapido = 'todos' | 'nfe' | 'atrasados' | 'rastreio';
type Ordenacao = 'prazo' | 'recente' | 'valor';

interface EnvioItem {
  item_id?: string | null;
  sku?: string | null;
  descricao?: string | null;
  quantidade: number;
  preco_unitario: number;
}

interface EnvioMl {
  id: number;
  shipment_id: string;
  order_id?: string | null;
  pack_id?: string | null;
  venda_id?: number | null;
  status: string;
  substatus?: string | null;
  status_label: string;
  aba: VendaAba;
  logistic_type?: string | null;
  logistic_label: string;
  tracking_method?: string | null;
  tracking_number?: string | null;
  pay_before?: string | null;
  prazo_despacho?: string | null;
  data_original_despacho?: string | null;
  estimated_delivery?: string | null;
  date_created?: string | null;
  date_ready_to_ship?: string | null;
  date_shipped?: string | null;
  date_delivered?: string | null;
  date_cancelled?: string | null;
  dia?: string | null;
  dia_label: string;
  receiver_name?: string | null;
  receiver_address?: string | null;
  receiver_city?: string | null;
  receiver_state?: string | null;
  receiver_zip?: string | null;
  destino?: string | null;
  titulo: string;
  sku?: string | null;
  cliente?: string | null;
  valor: number;
  imagem?: string | null;
  ml_item_id?: string | null;
  metodo_pagamento?: string | null;
  itens: EnvioItem[];
  itens_count: number;
  nfe_pendente: boolean;
  liberado_hoje?: boolean;
  nfe_xml_disponivel?: boolean;
  nfe_xml_nome?: string | null;
  nfe_xml_enviado_em?: string | null;
  etiqueta_disponivel?: boolean;
  etiqueta_emitida?: boolean;
  etiqueta_emitida_em?: string | null;
  combinar_comprador?: boolean;
  atrasado: boolean;
  sincronizado_em?: string | null;
}

interface ResumoEnvios {
  paraEnviar: number;
  nfePendente: number;
  atrasados: number;
  prazoHoje?: string | null;
  proximoPrazoHoje?: string | null;
  proximoDia?: string | null;
}

interface RespostaEnvios {
  conectado: boolean;
  totalGeral: number;
  sincronizadoEm?: string | null;
  contagens: Record<VendaAba, number>;
  resumo: ResumoEnvios;
  envios: EnvioMl[];
  aviso?: string;
}

interface ArquivoXmlLote {
  file: File;
}

interface XmlEnviado {
  order_id: string;
  nfe_xml_disponivel: boolean;
  nfe_xml_nome: string;
  nfe_xml_enviado_em: string;
}

interface VendasPageProps {
  vendaInicialId?: number | null;
  aba?: VendaAba;
  onAbaChange?: (aba: VendaAba) => void;
  onOpenMarketplaces?: () => void;
}

const ABAS: Array<{
  chave: VendaAba;
  label: string;
  icon: LucideIcon;
}> = [
  { chave: 'hoje', label: 'Envios de hoje', icon: Truck },
  { chave: 'proximos', label: 'Próximos dias', icon: CalendarClock },
  { chave: 'combinar', label: 'A combinar com o comprador', icon: MessageSquare },
  { chave: 'transito', label: 'Em trânsito', icon: Navigation },
  { chave: 'finalizadas', label: 'Finalizadas', icon: PackageCheck },
  { chave: 'cancelados', label: 'Cancelados', icon: XCircle },
];

const PERIODOS = [
  { valor: 30, label: 'Últimos 30 dias' },
  { valor: 60, label: 'Últimos 2 meses' },
  { valor: 90, label: 'Últimos 3 meses' },
  { valor: 180, label: 'Últimos 6 meses' },
];

const FILTROS: Array<{
  chave: FiltroRapido;
  label: string;
  descricao: string;
}> = [
  {
    chave: 'todos',
    label: 'Todos os envios',
    descricao: 'Sem filtro adicional',
  },
  {
    chave: 'nfe',
    label: 'NF-e pendente',
    descricao: 'Envios que ainda precisam de nota fiscal',
  },
  {
    chave: 'atrasados',
    label: 'Atrasados',
    descricao: 'Prazo de despacho já vencido',
  },
  {
    chave: 'rastreio',
    label: 'Com rastreio',
    descricao: 'Envios que já têm código de rastreio',
  },
];

const ORDENS: Array<{ valor: Ordenacao; label: string }> = [
  { valor: 'prazo', label: 'Por prazo' },
  { valor: 'recente', label: 'Mais recentes' },
  { valor: 'valor', label: 'Maior valor' },
];

const CONTAGENS_VAZIAS: Record<VendaAba, number> = {
  hoje: 0,
  proximos: 0,
  combinar: 0,
  transito: 0,
  finalizadas: 0,
  cancelados: 0,
};

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatarMoeda(valor?: number | null): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function formatarData(
  valor?: string | null,
  opcoes?: Intl.DateTimeFormatOptions
): string {
  if (!valor) return '—';

  const data = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00` : valor
  );

  if (Number.isNaN(data.getTime())) return '—';

  return new Intl.DateTimeFormat(
    'pt-BR',
    opcoes || {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  ).format(data);
}

function formatarDataHora(valor?: string | null): string {
  return formatarData(valor, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarHora(valor?: string | null): string {
  if (!valor || /^\d{4}-\d{2}-\d{2}$/.test(valor)) return '—';

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function formatarDiaMes(valor?: string | null): string {
  return formatarData(valor, {
    day: '2-digit',
    month: 'short',
  });
}

function formatarChaveDia(chave?: string | null): string {
  if (!chave) return '—';

  const data = new Date(`${chave}T12:00:00`);

  if (Number.isNaN(data.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(data);
}

function tempoRelativo(valor?: string | null): string {
  if (!valor) return 'Ainda não sincronizado';

  const data = new Date(valor).getTime();

  if (!Number.isFinite(data)) return 'Ainda não sincronizado';

  const diferenca = Math.max(0, Date.now() - data);
  const minutos = Math.floor(diferenca / 60000);

  if (minutos < 1) return 'Atualizado agora';
  if (minutos < 60) return `Atualizado há ${minutos} min`;

  const horas = Math.floor(minutos / 60);

  if (horas < 24) return `Atualizado há ${horas} h`;

  return `Atualizado há ${Math.floor(horas / 24)} d`;
}

function timestamp(valor?: string | null): number | null {
  if (!valor) return null;

  const data = new Date(valor).getTime();

  return Number.isFinite(data) ? data : null;
}

function temHorario(valor?: string | null): boolean {
  return Boolean(valor && /T\d{2}:\d{2}/.test(valor));
}

function compararAscendente(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compararDescendente(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function ordenarEnvios(
  lista: EnvioMl[],
  ordem: Ordenacao,
  aba: VendaAba
): EnvioMl[] {
  return [...lista].sort((a, b) => {
    if (ordem === 'valor') {
      return b.valor - a.valor || b.id - a.id;
    }

    if (ordem === 'recente') {
      return (
        compararDescendente(
          timestamp(a.date_created),
          timestamp(b.date_created)
        ) || b.id - a.id
      );
    }

    if (aba === 'finalizadas') {
      return compararDescendente(
        timestamp(
          a.date_delivered ||
            a.date_cancelled ||
            a.date_shipped ||
            a.date_created
        ),
        timestamp(
          b.date_delivered ||
            b.date_cancelled ||
            b.date_shipped ||
            b.date_created
        )
      );
    }

    if (aba === 'transito') {
      return compararAscendente(
        timestamp(a.estimated_delivery || a.date_shipped),
        timestamp(b.estimated_delivery || b.date_shipped)
      );
    }

    return compararAscendente(
      timestamp(a.prazo_despacho || a.pay_before || a.estimated_delivery),
      timestamp(b.prazo_despacho || b.pay_before || b.estimated_delivery)
    );
  });
}

function estiloStatus(envio: EnvioMl): {
  label: string;
  className: string;
  dot: string;
} {
  if (envio.aba === 'combinar') {
    return {
      label: 'A combinar com o comprador',
      className: 'border-warning/30 bg-warningSoft text-warning',
      dot: 'bg-warning',
    };
  }

  if (envio.aba === 'cancelados') {
    return {
      label: 'Cancelado',
      className: 'border-danger/30 bg-dangerSoft text-danger',
      dot: 'bg-danger',
    };
  }

  if (envio.aba === 'finalizadas') {
    if (envio.status === 'delivered') {
      return {
        label: envio.status_label,
        className: 'border-success/30 bg-successSoft text-success',
        dot: 'bg-success',
      };
    }

    if (envio.status === 'cancelled' || envio.status === 'canceled') {
      return {
        label: envio.status_label,
        className: 'border-danger/30 bg-dangerSoft text-danger',
        dot: 'bg-danger',
      };
    }

    return {
      label: envio.status_label,
      className: 'border-warning/30 bg-warningSoft text-warning',
      dot: 'bg-warning',
    };
  }

  if (envio.aba === 'transito') {
    return {
      label: envio.status_label,
      className: 'border-cyan/30 bg-cyanSoft text-cyan',
      dot: 'bg-cyan',
    };
  }

  if (envio.atrasado) {
    return {
      label: envio.substatus === 'in_packing_list' ? 'Aguardando confirmação do despacho no ML' : 'Atrasado',
      className: 'border-danger/30 bg-dangerSoft text-danger',
      dot: 'bg-danger',
    };
  }

  if (envio.nfe_pendente || envio.status === 'pending') {
    return {
      label: envio.status_label,
      className: 'border-warning/30 bg-warningSoft text-warning',
      dot: 'bg-warning',
    };
  }

  return {
    label: envio.status_label,
    className: 'border-ml/30 bg-ml/10 text-ml',
    dot: 'bg-ml',
  };
}

function StatusPill({ envio }: { envio: EnvioMl }) {
  const estilo = estiloStatus(envio);

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${estilo.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${estilo.dot}`} />
      {estilo.label}
    </span>
  );
}

function PrazoEnvio({ envio }: { envio: EnvioMl }) {
  const prazo = envio.prazo_despacho || envio.pay_before;

  if (envio.liberado_hoje) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {envio.aba === 'proximos' ? 'Pode antecipar o envio · prazo' : 'Liberado hoje · prazo original'}{' '}
        {envio.data_original_despacho
          ? formatarData(envio.data_original_despacho, {
              day: '2-digit',
              month: '2-digit',
            })
          : 'não informado'}
      </span>
    );
  }

  if (envio.aba === 'combinar') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-warning">
        <MessageSquare className="h-3.5 w-3.5" />
        Combine a entrega diretamente com o comprador
      </span>
    );
  }

  if (envio.aba === 'cancelados') {
    return (
      <span className="inline-flex items-center gap-1 text-danger">
        <XCircle className="h-3.5 w-3.5" />
        {envio.date_cancelled
          ? `Cancelado em ${formatarDiaMes(envio.date_cancelled)}`
          : 'Venda cancelada'}
      </span>
    );
  }

  if (envio.aba === 'hoje') {
    if (envio.atrasado) {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-danger">
          <AlertTriangle className="h-3.5 w-3.5" />
          {envio.substatus === 'in_packing_list' ? 'Prazo vencido no ML · despacho ainda não confirmado' : 'Atrasado'}
          {prazo
            ? ` desde ${formatarDiaMes(prazo)}${
                temHorario(prazo)
                  ? ` às ${formatarHora(prazo)}`
                  : ''
              }`
            : ''}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 font-semibold text-warning">
        <Clock3 className="h-3.5 w-3.5" />
        {prazo
          ? temHorario(prazo)
            ? `Enviar até ${formatarHora(prazo)}`
            : `Enviar em ${formatarDiaMes(prazo)}`
          : 'Sem prazo definido'}
      </span>
    );
  }

  if (envio.aba === 'proximos') {
    return (
      <span className="inline-flex items-center gap-1 text-muted">
        <Clock3 className="h-3.5 w-3.5" />
        {prazo
          ? temHorario(prazo)
            ? `Enviar até ${formatarHora(prazo)}`
            : `Enviar em ${formatarDiaMes(prazo)}`
          : 'Sem prazo definido'}
      </span>
    );
  }

  if (envio.aba === 'transito') {
    const previsao = timestamp(envio.estimated_delivery);
    const vencida = previsao !== null && previsao < Date.now();

    return (
      <span
        className={`inline-flex items-center gap-1 ${
          vencida ? 'font-semibold text-warning' : 'text-cyan'
        }`}
      >
        {vencida ? (
          <AlertTriangle className="h-3.5 w-3.5" />
        ) : (
          <CalendarDays className="h-3.5 w-3.5" />
        )}
        {envio.estimated_delivery
          ? `${vencida ? 'Previsão vencida em' : 'Previsão'} ${formatarDiaMes(
              envio.estimated_delivery
            )}`
          : 'Previsão não informada'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-success">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {envio.date_delivered
        ? `Entregue em ${formatarDiaMes(envio.date_delivered)}`
        : envio.date_cancelled
          ? `Cancelado em ${formatarDiaMes(envio.date_cancelled)}`
          : envio.status_label}
    </span>
  );
}

function CartaoEnvio({
  envio,
  onOpen,
  selecionado,
  onAlternarSelecao,
  onImprimir,
  imprimindo,
  onAvisarEntrega,
  avisandoEntrega,
}: {
  envio: EnvioMl;
  onOpen: (envio: EnvioMl) => void;
  selecionado: boolean;
  onAlternarSelecao: (envio: EnvioMl) => void;
  onImprimir: (envio: EnvioMl) => void;
  imprimindo: boolean;
  onAvisarEntrega?: (envio: EnvioMl) => void;
  avisandoEntrega?: boolean;
}) {
  const estilo = estiloStatus(envio);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-card transition-colors ${
        selecionado ? 'border-ml/50' : 'border-line'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(envio)}
        className="group relative block w-full p-4 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ml"
      >
        <span
          className={`absolute inset-y-0 left-0 w-1 ${estilo.dot}`}
          aria-hidden="true"
        />

        <div className="flex gap-3 sm:gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-secondary sm:h-20 sm:w-20">
          {envio.imagem ? (
            <img
              src={envio.imagem}
              alt={envio.titulo}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <Package className="h-7 w-7" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill envio={envio} />
            {envio.nfe_pendente && estilo.label !== 'NF-e pendente' ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-warning/30 bg-warningSoft px-2 py-0.5 text-[10px] font-semibold text-warning">
                NF-e pendente
              </span>
            ) : null}
            <span className="font-mono text-[10px] text-muted">
              #{envio.order_id || envio.shipment_id}
            </span>
          </div>

          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ink">
            {envio.titulo}
          </h3>

          <p className="mt-0.5 truncate text-xs text-muted">
            {envio.cliente || envio.receiver_name || 'Comprador'}
            {envio.sku ? ` • ${envio.sku}` : ''}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate">{envio.destino}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3.5 w-3.5 shrink-0 text-ml" />
              {envio.logistic_label}
            </span>
            {envio.itens_count > 1 ? (
              <span>{envio.itens_count} itens</span>
            ) : null}
            {envio.nfe_xml_disponivel ? (
              <span className="inline-flex items-center gap-1 text-success">
                <FileCheck2 className="h-3.5 w-3.5" />
                XML anexado
              </span>
            ) : null}
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end justify-between gap-2 sm:flex">
          <span className="text-sm font-bold text-success">
            {formatarMoeda(envio.valor)}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent group-hover:underline">
            Detalhes
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px]">
            <PrazoEnvio envio={envio} />
            {envio.tracking_number ? (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted">
                <Barcode className="h-3 w-3 shrink-0" />
                <span className="truncate">{envio.tracking_number}</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <span className="text-sm font-bold text-success">
              {formatarMoeda(envio.valor)}
            </span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </div>
        </div>
      </button>

      {envio.aba === 'combinar' && onAvisarEntrega ? (
        <div className="flex justify-end border-t border-line px-4 py-2.5">
          <button type="button" disabled={avisandoEntrega}
            onClick={() => onAvisarEntrega(envio)}
            className="inline-flex items-center gap-2 rounded-lg bg-successSoft px-3 py-2 text-xs font-semibold text-success disabled:opacity-50">
            {avisandoEntrega ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Avisar entrega
          </button>
        </div>
      ) : null}
      {envio.etiqueta_disponivel || envio.etiqueta_emitida ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            {envio.etiqueta_disponivel ? (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-muted hover:text-ink">
                <input
                  type="checkbox"
                  checked={selecionado}
                  onChange={() => onAlternarSelecao(envio)}
                  disabled={imprimindo}
                  aria-label={`Selecionar etiqueta do pedido ${envio.order_id || envio.shipment_id}`}
                  className="h-4 w-4 rounded border-line accent-ml"
                />
                Selecionar
              </label>
            ) : null}
            {envio.etiqueta_emitida ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-successSoft px-2.5 py-1 text-[11px] font-semibold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Etiqueta emitida
                {envio.etiqueta_emitida_em
                  ? ` · ${formatarDataHora(envio.etiqueta_emitida_em)}`
                  : ' no Mercado Livre'}
              </span>
            ) : null}
          </div>
          {envio.etiqueta_disponivel ? (
            <button
              type="button"
              onClick={() => onImprimir(envio)}
              disabled={imprimindo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ml/25 bg-ml/10 px-2.5 py-1.5 text-xs font-semibold text-ml transition-colors hover:bg-ml/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {imprimindo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Printer className="h-3.5 w-3.5" />
              )}
              {envio.etiqueta_emitida
                ? 'Imprimir novamente'
                : 'Imprimir etiqueta'}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function EstadoVazio({
  aba,
  temFiltro,
  onLimpar,
}: {
  aba: VendaAba;
  temFiltro: boolean;
  onLimpar: () => void;
}) {
  const label = ABAS.find((item) => item.chave === aba)?.label || 'Envios';
  const descricao = temFiltro
    ? 'Tente limpar a busca ou os filtros para ver todos os envios.'
    : aba === 'hoje'
      ? 'Quando houver envios liberados para hoje, eles aparecem aqui.'
      : aba === 'proximos'
        ? 'Os próximos despachos aparecem agrupados por dia.'
        : aba === 'combinar'
          ? 'Vendas que precisam ter a entrega combinada diretamente com o comprador aparecem aqui.'
        : aba === 'transito'
          ? 'Os envios despachados aparecem aqui com o rastreio.'
          : aba === 'cancelados'
            ? 'As vendas canceladas aparecem somente nesta aba.'
            : 'Os envios entregues ou devolvidos aparecem aqui.';

  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/[0.02] px-6 py-14 text-center">
      <Package className="mx-auto h-10 w-10 text-muted" />
      <p className="mt-3 text-sm font-semibold text-ink">
        Nenhum envio em {label.toLowerCase()}
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted">{descricao}</p>
      {temFiltro ? (
        <button
          type="button"
          onClick={onLimpar}
          className="mt-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-ink hover:bg-white/[0.08]"
        >
          Limpar filtros
        </button>
      ) : null}
    </div>
  );
}

function InfoBox({
  label,
  value,
  icon: Icon,
  tone = 'default',
  mono = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'default' | 'danger';
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-medium ${
          tone === 'danger' ? 'text-danger' : 'text-ink'
        } ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

interface MensagemVenda {
  id: string | number;
  papel: 'vendedor' | 'comprador';
  texto: string;
  data?: string | null;
  anexos?: Array<{ id: string; nome: string; tipo: string; url: string | null; bloqueado: boolean }>;
}

const MODELO_MENSAGEM_PERSONALIZADA =
  'Olá {nome}! Agradecemos pela compra! Antes do envio, pedimos que confira se a peça {pedido} é compatível com seu veículo, incluindo modelo, ano, código original, encaixes, fotos e descrição do anúncio. Se notar alguma diferença ou tiver dúvidas, nos avise antes do despacho. Assim evitamos transtornos com a instalação, trocas ou devoluções.';

function preencherModeloMensagem(modelo: string, nome?: string | null, pedido?: string | null) {
  return modelo
    .replace(/\{nome\}/g, String(nome || 'cliente').trim())
    .replace(/\{pedido\}/g, String(pedido || 'comprada').trim());
}

function MensagemVendaModal({
  vendaId,
  orderId,
  cliente,
  peca,
  onClose,
}: {
  vendaId: number;
  orderId?: string | null;
  cliente?: string | null;
  peca?: string | null;
  onClose: () => void;
}) {
  const [mensagens, setMensagens] = useState<MensagemVenda[]>([]);
  const [textoMensagem, setTextoMensagem] = useState(() =>
    preencherModeloMensagem(MODELO_MENSAGEM_PERSONALIZADA, cliente, peca)
  );
  const [carregandoMensagens, setCarregandoMensagens] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [conversaDisponivel, setConversaDisponivel] = useState(true);
  const [limiteMensagem, setLimiteMensagem] = useState(350);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const listaRef = useRef<HTMLDivElement | null>(null);
  const carregandoChatRef = useRef(false);
  const enviandoChatRef = useRef(false);
  const sequenciaChatRef = useRef(0);

  const carregarMensagens = useCallback(async (silencioso = false) => {
    if (carregandoChatRef.current || enviandoChatRef.current) return;
    carregandoChatRef.current = true;
    const sequencia = ++sequenciaChatRef.current;
    if (!silencioso) { setCarregandoMensagens(true); setErro(''); }

    try {
      const { data } = await axios.get<{
        mensagens?: MensagemVenda[];
        conversaDisponivel?: boolean;
        aviso?: string;
        limiteMensagem?: number;
      }>(`/api/vendas/${vendaId}/mensagens`, { timeout: 20000 });
      if (sequencia !== sequenciaChatRef.current) return;
      setMensagens(Array.isArray(data.mensagens) ? data.mensagens : []);
      setConversaDisponivel(data.conversaDisponivel !== false);
      setAviso(data.aviso || '');
      setLimiteMensagem(data.limiteMensagem || 350);
    } catch (error: unknown) {
      if (sequencia !== sequenciaChatRef.current) return;
      setErro(
        axios.isAxiosError<{ error?: string }>(error)
          ? error.response?.data?.error ||
              'Não foi possível carregar as mensagens.'
          : 'Não foi possível carregar as mensagens.'
      );
    } finally {
      if (sequencia === sequenciaChatRef.current) {
        carregandoChatRef.current = false;
        setCarregandoMensagens(false);
      }
    }
  }, [vendaId]);

  useEffect(() => {
    void carregarMensagens();
    const atualizar = () => {
      if (document.visibilityState === 'visible') void carregarMensagens(true);
    };
    const intervalo = window.setInterval(atualizar, 5000);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', atualizar);
      sequenciaChatRef.current++;
      carregandoChatRef.current = false;
    };
  }, [carregarMensagens]);

  useEffect(() => {
    const lista = listaRef.current;
    if (lista && lista.scrollHeight - lista.scrollTop - lista.clientHeight > 200 && lista.scrollTop > 0) return;
    lista?.scrollTo({
      top: lista.scrollHeight,
      behavior: 'smooth',
    });
  }, [mensagens.length]);

  useEffect(() => {
    const fecharComEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !enviando) onClose();
    };
    document.addEventListener('keydown', fecharComEsc);
    return () => document.removeEventListener('keydown', fecharComEsc);
  }, [enviando, onClose]);

  const enviarMensagem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const mensagem = textoMensagem.trim();
    if (!mensagem || enviando) return;

    setEnviando(true);
    enviandoChatRef.current = true;
    sequenciaChatRef.current++;
    setErro('');
    try {
      const { data } = await axios.post<{
        mensagens?: MensagemVenda[];
        conversaDisponivel?: boolean;
        aviso?: string;
        limiteMensagem?: number;
      }>(`/api/vendas/${vendaId}/mensagens`, { mensagem }, { timeout: 30000 });
      setMensagens(Array.isArray(data.mensagens) ? data.mensagens : []);
      setConversaDisponivel(data.conversaDisponivel !== false);
      setAviso(data.aviso || '');
      setLimiteMensagem(data.limiteMensagem || 350);
      setTextoMensagem('');
    } catch (error: unknown) {
      setErro(
        axios.isAxiosError<{ error?: string }>(error)
          ? error.response?.data?.error ||
              'Não foi possível enviar a mensagem.'
          : 'Não foi possível enviar a mensagem.'
      );
    } finally {
      enviandoChatRef.current = false;
      carregandoChatRef.current = false;
      setCarregandoMensagens(false);
      setEnviando(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !enviando) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mensagem-venda-titulo"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-line shadow-2xl sm:rounded-3xl"
        style={{ backgroundColor: 'rgba(7, 15, 28, 0.99)' }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="mensagem-venda-titulo" className="font-bold text-ink">
              Enviar mensagem ao comprador
            </h2>
            <p className="mt-1 text-xs text-muted">
              Pedido {orderId || 'Mercado Livre'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            aria-label="Fechar conversa"
            className="rounded-xl border border-white/10 p-2 text-muted hover:bg-white/[0.06] hover:text-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          ref={listaRef}
          className="min-h-36 flex-1 space-y-3 overflow-y-auto p-4"
          aria-live="polite"
        >
          {carregandoMensagens ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando conversa...
            </p>
          ) : mensagens.length ? (
            mensagens.map((item) => (
              <div
                key={item.id}
                className={`flex ${
                  item.papel === 'vendedor' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    item.papel === 'vendedor'
                      ? 'bg-ml/20 text-ink'
                      : 'border border-white/10 bg-white/[0.06] text-ink'
                  }`}
                >
                  {item.texto && <p className="whitespace-pre-wrap break-words text-sm">
                    {item.texto}
                  </p>}
                  {item.anexos?.map((anexo) => anexo.bloqueado || !anexo.url ? (
                    <p key={anexo.id} className="mt-2 text-xs text-warning">Anexo indisponível: {anexo.nome}</p>
                  ) : (
                    <div key={anexo.id} className="mt-2 space-y-1">
                      <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-line bg-black/10 p-1 text-xs text-accent hover:underline">
                        {/^image\/(jpeg|png|gif|webp)$/.test(anexo.tipo) ? <img src={anexo.url} alt={`Foto enviada pelo ${item.papel}: ${anexo.nome}`} className="max-h-64 max-w-full rounded-md object-contain" /> : <span className="block p-2">Abrir anexo: {anexo.nome}</span>}
                      </a>
                      <a href={`${anexo.url}?download=1`} className="block truncate text-[11px] text-accent hover:underline">Baixar {anexo.nome}</a>
                    </div>
                  ))}
                  {item.data ? (
                    <p className="mt-1 text-right text-[10px] text-muted">
                      {formatarDataHora(item.data)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              A conversa ainda não tem mensagens. Envie uma mensagem ao comprador.
            </p>
          )}
        </div>

        {aviso ? (
          <p className="mx-4 mb-2 rounded-xl border border-warning/20 bg-warningSoft px-3 py-2 text-xs text-warning">
            {aviso}
          </p>
        ) : null}
        {erro ? (
          <p className="mx-4 mb-2 rounded-xl border border-danger/20 bg-dangerSoft px-3 py-2 text-xs text-danger">
            {erro}
          </p>
        ) : null}

        <form
          onSubmit={(event) => void enviarMensagem(event)}
          className="flex items-end gap-2 border-t border-line p-3"
        >
          <textarea
            value={textoMensagem}
            onChange={(event) => setTextoMensagem(event.target.value)}
            maxLength={limiteMensagem}
            rows={2}
            disabled={!conversaDisponivel || enviando}
            placeholder="Escreva sua mensagem..."
            aria-label="Mensagem para o comprador"
            className="min-h-12 flex-1 resize-y rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
          />
          <p className={`absolute mt-14 mr-1 text-[11px] ${textoMensagem.length > limiteMensagem ? 'text-danger' : 'text-muted'}`}>
            {textoMensagem.length}/{limiteMensagem} caracteres
          </p>
          <button
            type="submit"
            disabled={
              !conversaDisponivel || enviando || !textoMensagem.trim() || textoMensagem.length > limiteMensagem
            }
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-ml px-3 py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {enviando ? 'Enviando...' : 'Enviar'}
            </span>
          </button>
        </form>
      </section>
    </div>,
    document.body
  );
}

function DetalheEnvio({
  envio,
  onClose,
  onCopiar,
  copiado,
  onEnviarMensagem,
}: {
  envio: EnvioMl;
  onClose: () => void;
  onCopiar: (codigo: string) => void;
  copiado: boolean;
  onEnviarMensagem: (vendaId: number) => void;
}) {
  const linhaDoTempo = [
    { label: 'Pedido criado', valor: envio.date_created },
    { label: 'Pronto para envio', valor: envio.date_ready_to_ship },
    { label: 'Despachado', valor: envio.date_shipped },
    { label: 'Entregue', valor: envio.date_delivered },
    { label: 'Cancelado', valor: envio.date_cancelled },
  ].filter((item) => Boolean(item.valor));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes do envio ${envio.shipment_id}`}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-line bg-sidebar shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'rgba(7, 15, 28, 0.98)',
          backgroundImage: 'none',
        }}
      >
        <header className="sticky top-0 z-10 border-b border-line bg-sidebar/95 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ml">
                Envio #{envio.shipment_id}
              </p>
              <h2 className="mt-1 truncate text-lg font-bold text-ink">
                {envio.titulo}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusPill envio={envio} />
                <span className="font-mono text-[11px] text-muted">
                  Pedido {envio.order_id || '—'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhes"
              className="rounded-xl border border-white/10 p-2 text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="space-y-4 p-5">
          <div className="flex gap-4 rounded-2xl border border-line bg-white/[0.03] p-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-secondary">
              {envio.imagem ? (
                <img
                  src={envio.imagem}
                  alt={envio.titulo}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted">
                  <Package className="h-7 w-7" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{envio.titulo}</p>
              <p className="mt-0.5 text-xs text-muted">
                SKU {envio.sku || 'não informado'} • {envio.itens_count}{' '}
                {envio.itens_count === 1 ? 'item' : 'itens'}
              </p>
              <p className="mt-2 text-lg font-bold text-success">
                {formatarMoeda(envio.valor)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox
              label="Prazo de despacho"
              value={
                envio.liberado_hoje
                  ? `Liberado hoje · prazo original ${
                      envio.data_original_despacho
                        ? formatarData(envio.data_original_despacho, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : 'não informado'
                    }`
                  : (envio.prazo_despacho || envio.pay_before)
                  ? formatarDataHora(
                      envio.prazo_despacho || envio.pay_before
                    )
                  : 'Não informado'
              }
              icon={Clock3}
              tone={envio.atrasado ? 'danger' : 'default'}
            />
            <InfoBox
              label="Entrega prevista"
              value={
                envio.estimated_delivery
                  ? formatarData(envio.estimated_delivery, {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Não informada'
              }
              icon={CalendarDays}
            />
            <InfoBox
              label="Transportadora"
              value={
                envio.logistic_label ||
                envio.tracking_method ||
                'Mercado Livre'
              }
              icon={Truck}
            />
            <InfoBox
              label="Rastreio"
              value={envio.tracking_number || 'Ainda não gerado'}
              icon={Barcode}
              mono
            />
          </div>

          <section className="rounded-2xl border border-line bg-white/[0.03] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <FileCheck2 className="h-4 w-4 text-accent" />
                  XML da nota fiscal
                </h3>
                <p className="mt-1 truncate text-xs text-muted">
                  {envio.nfe_xml_disponivel
                    ? `${envio.nfe_xml_nome || 'XML anexado'}${
                        envio.nfe_xml_enviado_em
                          ? ` · enviado em ${formatarDataHora(
                              envio.nfe_xml_enviado_em
                            )}`
                          : ''
                      }`
                    : 'Anexe o XML desta venda para manter a nota organizada.'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {envio.nfe_xml_disponivel && envio.order_id ? (
                  <a
                    href={`/api/vendas/envios/${encodeURIComponent(
                      envio.order_id
                    )}/nfe-xml`}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-ink hover:bg-white/[0.07]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Baixar XML
                  </a>
                ) : null}
                {!envio.nfe_xml_disponivel ? (
                  <p className="text-[11px] text-muted">
                    Envie o ZIP pelo lote para identificar o pedido automaticamente.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white/[0.03] p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <UserRound className="h-4 w-4 text-accent" />
              Destino
            </h3>
            <p className="mt-2 text-sm font-medium text-ink">
              {envio.receiver_name || envio.cliente || 'Comprador'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {envio.receiver_address || envio.destino}
            </p>
            <p className="mt-1 text-xs text-muted">
              {envio.receiver_city}
              {envio.receiver_state ? ` • ${envio.receiver_state}` : ''}
              {envio.receiver_zip ? ` • CEP ${envio.receiver_zip}` : ''}
            </p>
          </section>

          {envio.itens.length > 0 ? (
            <section className="rounded-2xl border border-line bg-white/[0.03] p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <Package className="h-4 w-4 text-accent" />
                Itens do envio
              </h3>
              <ul className="mt-3 space-y-2">
                {envio.itens.map((item, indice) => (
                  <li
                    key={`${item.sku || item.item_id || indice}`}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <span className="text-muted">
                      <span className="font-semibold text-ink">
                        {item.quantidade}x
                      </span>{' '}
                      {item.descricao || item.sku || 'Item'}
                    </span>
                    {item.preco_unitario > 0 ? (
                      <span className="shrink-0 font-medium text-ink">
                        {formatarMoeda(
                          item.quantidade * item.preco_unitario
                        )}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {linhaDoTempo.length > 0 ? (
            <section className="rounded-2xl border border-line bg-white/[0.03] p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <Navigation className="h-4 w-4 text-accent" />
                Linha do tempo
              </h3>
              <ol className="mt-3 space-y-2">
                {linhaDoTempo.map((item, indice) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        indice === linhaDoTempo.length - 1
                          ? 'bg-ml'
                          : 'bg-white/25'
                      }`}
                    />
                    <span className="text-muted">{item.label}</span>
                    <span className="ml-auto text-right font-medium text-ink">
                      {formatarDataHora(item.valor)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {envio.tracking_number ? (
              <button
                type="button"
                onClick={() => onCopiar(envio.tracking_number || '')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-white/[0.07]"
              >
                {copiado ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copiado ? 'Rastreio copiado' : 'Copiar rastreio'}
              </button>
            ) : null}
            {envio.venda_id !== null && envio.venda_id !== undefined ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEnviarMensagem(Number(envio.venda_id));
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-white/[0.07]"
              >
                <MessageSquare className="h-4 w-4" />
                Enviar mensagem
              </button>
            ) : null}
            <a
              href={
                envio.order_id
                  ? `https://www.mercadolivre.com.br/vendas/${envio.order_id}`
                  : 'https://www.mercadolivre.com.br/vendas'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-ml px-4 py-2.5 text-sm font-bold text-black transition-all hover:brightness-110"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir no Mercado Livre
            </a>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-center text-[10px] text-muted">
            <Info className="h-3 w-3" />
            Dados sincronizados do Mercado Livre
            {envio.sincronizado_em
              ? ` em ${formatarDataHora(envio.sincronizado_em)}`
              : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VendasPage({
  vendaInicialId = null,
  aba: abaControlada,
  onAbaChange,
  onOpenMarketplaces,
}: VendasPageProps) {
  const [abaLocal, setAbaLocal] = useState<VendaAba>('hoje');
  const aba = abaControlada ?? abaLocal;
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState(60);
  const [filtro, setFiltro] = useState<FiltroRapido>('todos');
  const [ordem, setOrdem] = useState<Ordenacao>('prazo');
  const [menuFiltros, setMenuFiltros] = useState(false);
  const [posicaoFiltros, setPosicaoFiltros] = useState({ top: 0, right: 12 });
  const [dados, setDados] = useState<RespostaEnvios | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [entregaConfirmar, setEntregaConfirmar] = useState<EnvioMl | null>(null);
  const [avisandoEntrega, setAvisandoEntrega] = useState(false);
  const [erro, setErro] = useState('');
  const [detalhe, setDetalhe] = useState<EnvioMl | null>(null);
  const [mensagemVenda, setMensagemVenda] = useState<{
    id: number;
    orderId?: string | null;
  } | null>(null);
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null);
  const [loteXmlAberto, setLoteXmlAberto] = useState(false);
  const [arquivosXml, setArquivosXml] = useState<ArquivoXmlLote[]>([]);
  const [enviandoLoteXml, setEnviandoLoteXml] = useState(false);
  const [resultadoLoteXml, setResultadoLoteXml] = useState('');
  const [falhasLoteXml, setFalhasLoteXml] = useState<
    Array<{ arquivo: string; erro: string }>
  >([]);
  const [copiado, setCopiado] = useState(false);
  const [etiquetasSelecionadas, setEtiquetasSelecionadas] = useState<
    Set<string>
  >(new Set());
  const [imprimindoEtiquetas, setImprimindoEtiquetas] = useState(false);
  const [erroEtiquetas, setErroEtiquetas] = useState('');
  const filtroRef = useRef<HTMLDivElement | null>(null);
  const filtroPopoverRef = useRef<HTMLDivElement | null>(null);
  const requisicaoRef = useRef(0);
  const sincronizandoRef = useRef(false);
  const sincronizandoVendasRef = useRef(false);
  const focoTratadoRef = useRef<number | null>(null);
  const periodoRef = useRef(periodo);
  const quantidadeHojeAnteriorRef = useRef<number | null>(null);

  const atualizarPosicaoFiltros = useCallback(() => {
    const gatilho = filtroRef.current?.getBoundingClientRect();
    if (!gatilho) return;

    const alturaMenu = 360;
    const abrirAcima =
      window.innerHeight - gatilho.bottom < alturaMenu &&
      gatilho.top > alturaMenu;
    setPosicaoFiltros({
      top: Math.max(
        8,
        abrirAcima ? gatilho.top - alturaMenu - 8 : gatilho.bottom + 8
      ),
      right: Math.max(8, window.innerWidth - gatilho.right),
    });
  }, []);

  useEffect(() => {
    periodoRef.current = periodo;
  }, [periodo]);

  useEffect(() => {
    setEtiquetasSelecionadas(new Set());
    setErroEtiquetas('');
  }, [aba, busca, filtro, grupoSelecionado, ordem, periodo]);

  const trocarAba = useCallback(
    (nova: VendaAba) => {
      if (onAbaChange) {
        onAbaChange(nova);
      } else {
        setAbaLocal(nova);
      }

      setGrupoSelecionado(null);
      setMenuFiltros(false);
    },
    [onAbaChange]
  );

  const carregar = useCallback(
    async (silencioso = false) => {
      const sequencia = ++requisicaoRef.current;

      if (!silencioso) {
        setCarregando(true);
        setErro('');
      }

      try {
        const { data } = await axios.get<RespostaEnvios>(
          '/api/vendas/envios',
          {
            params: { periodo: periodoRef.current, _t: Date.now() },
            timeout: 120000,
          }
        );

        if (sequencia !== requisicaoRef.current) return;

        setDados(data);
        setErro(data.aviso || '');
      } catch (error) {
        if (sequencia !== requisicaoRef.current) return;

        setErro(
          axios.isAxiosError(error)
            ? error.response?.data?.error ||
                'Não foi possível carregar os envios do Mercado Livre.'
            : 'Não foi possível carregar os envios do Mercado Livre.'
        );
      } finally {
        if (sequencia === requisicaoRef.current) {
          setCarregando(false);
        }
      }
    },
    [periodo]
  );

  useEffect(() => {
    if (!dados) return;
    const anterior = quantidadeHojeAnteriorRef.current;
    quantidadeHojeAnteriorRef.current = dados.contagens.hoje;
    if (aba === 'hoje' && anterior !== null && anterior > 0 && dados.contagens.hoje === 0 && dados.contagens.proximos > 0) {
      trocarAba('proximos');
    }
  }, [aba, dados, trocarAba]);

  const sincronizar = useCallback(
    async (silencioso = false) => {
      if (sincronizandoRef.current) return;

      sincronizandoRef.current = true;
      setSincronizando(true);

      if (!silencioso) setErro('');

      try {
        const periodoAtual = periodoRef.current;

        await axios.post(
          '/api/vendas/envios/sincronizar',
          {
            dias: periodoAtual,
            limite: Math.min(
              500,
              Math.max(200, Math.ceil(periodoAtual * 6))
            ),
            forcar: !silencioso,
          },
          { timeout: 180000 }
        );
        await carregar(true);
      } catch (error) {
        const mensagem = axios.isAxiosError(error)
          ? error.response?.data?.error ||
            'Não foi possível sincronizar os envios do Mercado Livre.'
          : 'Não foi possível sincronizar os envios do Mercado Livre.';

        setErro(
          silencioso
            ? `Não foi possível atualizar agora. ${mensagem}`
            : mensagem
        );
      } finally {
        sincronizandoRef.current = false;
        setSincronizando(false);
      }
    },
    [carregar, periodo]
  );

  const confirmarEntrega = async () => {
    if (!entregaConfirmar?.order_id || avisandoEntrega) return;
    setAvisandoEntrega(true);
    try {
      await axios.post(`/api/vendas/envios/${entregaConfirmar.order_id}/avisar-entrega`, { confirmada: true });
      setEntregaConfirmar(null);
      setDetalhe(null);
      await carregar(true);
    } catch (error) {
      setErro(axios.isAxiosError(error) ? error.response?.data?.error || 'Não foi possível avisar a entrega.' : 'Não foi possível avisar a entrega.');
      setEntregaConfirmar(null);
    } finally { setAvisandoEntrega(false); }
  };

  const atualizarEnviosComXml = (enviosXml: XmlEnviado[]) => {
    const porPedido = new Map(
      enviosXml.map((item) => [item.order_id, item])
    );

    setDados((atual) =>
      atual
        ? {
            ...atual,
            envios: atual.envios.map((envio) => {
              const xml = envio.order_id
                ? porPedido.get(envio.order_id)
                : undefined;
              return xml ? { ...envio, ...xml } : envio;
            }),
          }
        : atual
    );
    setDetalhe((atual) => {
      if (!atual?.order_id) return atual;
      const xml = porPedido.get(atual.order_id);
      return xml ? { ...atual, ...xml } : atual;
    });
  };

  const enviarLoteXml = async () => {
    if (arquivosXml.length === 0) {
      setResultadoLoteXml('Selecione ao menos um ZIP.');
      return;
    }

    const formulario = new FormData();
    arquivosXml.forEach(({ file }) => {
      formulario.append('files', file);
    });
    setEnviandoLoteXml(true);
    setResultadoLoteXml('');
    setFalhasLoteXml([]);

    try {
      const { data } = await axios.post<{
        enviados: number;
        envios: XmlEnviado[];
        falhas: Array<{ arquivo: string; erro: string }>;
      }>('/api/vendas/envios/nfe-xml/lote', formulario, {
        timeout: 180000,
      });

      atualizarEnviosComXml(data.envios || []);
      if (data.falhas?.length) {
        setFalhasLoteXml(data.falhas);
        setArquivosXml([]);
        setResultadoLoteXml(
          `${data.enviados} XML(s) enviado(s) ao Mercado Livre. Revise as falhas abaixo.`
        );
      } else {
        setArquivosXml([]);
        setResultadoLoteXml(
          `${data.enviados} XML(s) associado(s) e enviado(s) ao Mercado Livre.`
        );
      }
    } catch (error) {
      setResultadoLoteXml(
        axios.isAxiosError(error)
          ? error.response?.data?.error ||
              'Não foi possível enviar os XMLs do lote.'
          : 'Não foi possível enviar os XMLs do lote.'
      );
    } finally {
      setEnviandoLoteXml(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    let ativo = true;

    const atualizar = () => {
      if (!ativo || document.visibilityState !== 'visible') return;
      void carregar(true);
    };

    const intervalo = window.setInterval(atualizar, 20000);
    document.addEventListener('visibilitychange', atualizar);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [carregar]);

  useEffect(() => {
    if (!dados?.conectado) return;

    let ativo = true;
    const atualizarVendas = async () => {
      if (
        !ativo ||
        sincronizandoVendasRef.current ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }

      sincronizandoVendasRef.current = true;
      try {
        await axios.post(
          '/api/vendas/sincronizar',
          // A rotina automática consulta só os pedidos recentes; a carga
          // completa continua disponível no botão de sincronização manual.
          { dias: 2 },
          { timeout: 180000 }
        );
        if (ativo) await sincronizar(true);
      } catch (error: unknown) {
        if (!ativo) return;
        const mensagem = axios.isAxiosError<{ error?: string }>(error)
          ? error.response?.data?.error ||
            'Não foi possível sincronizar as vendas do Mercado Livre.'
          : 'Não foi possível sincronizar as vendas do Mercado Livre.';
        setErro(`Falha na sincronização automática das vendas. ${mensagem}`);
      } finally {
        sincronizandoVendasRef.current = false;
      }
    };

    const inicio = window.setTimeout(() => void atualizarVendas(), 15000);
    const intervalo = window.setInterval(() => void atualizarVendas(), 20000);
    document.addEventListener('visibilitychange', atualizarVendas);

    return () => {
      ativo = false;
      window.clearTimeout(inicio);
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', atualizarVendas);
    };
  }, [sincronizar, dados?.conectado]);

  useEffect(() => {
    if (!menuFiltros) return;

    const aoClicarFora = (event: MouseEvent) => {
      const alvo = event.target as Node;
      if (
        !filtroRef.current?.contains(alvo) &&
        !filtroPopoverRef.current?.contains(alvo)
      ) {
        setMenuFiltros(false);
      }
    };

    document.addEventListener('mousedown', aoClicarFora);
    const reposicionar = () => atualizarPosicaoFiltros();
    window.addEventListener('resize', reposicionar);
    document.addEventListener('scroll', reposicionar, true);

    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      window.removeEventListener('resize', reposicionar);
      document.removeEventListener('scroll', reposicionar, true);
    };
  }, [menuFiltros, atualizarPosicaoFiltros]);

  useEffect(() => {
    if (!detalhe) return;

    const aoPressionar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetalhe(null);
    };

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', aoPressionar);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', aoPressionar);
    };
  }, [detalhe]);

  useEffect(() => {
    if (
      !vendaInicialId ||
      focoTratadoRef.current === vendaInicialId ||
      !dados?.envios?.length
    ) {
      return;
    }

    focoTratadoRef.current = vendaInicialId;
    let ativo = true;

    axios
      .get(`/api/vendas/${vendaInicialId}`, { timeout: 15000 })
      .then(({ data }) => {
        if (!ativo) return;

        const envio = dados.envios.find(
          (item) => String(item.order_id) === String(data?.order_id)
        );

        if (envio) {
          setDetalhe(envio);
          trocarAba(envio.aba);
        }
      })
      .catch(() => {});

    return () => {
      ativo = false;
    };
  }, [dados, trocarAba, vendaInicialId]);

  const contagens = { ...CONTAGENS_VAZIAS, ...dados?.contagens };
  const carregandoInicial =
    (carregando && !dados) || (sincronizando && !dados?.totalGeral);
  const abaInfo = ABAS.find((item) => item.chave === aba) || ABAS[0];
  const periodoLabel =
    PERIODOS.find((item) => item.valor === periodo)?.label ||
    `Últimos ${periodo} dias`;
  const termo = normalizar(busca);
  const temFiltro = Boolean(
    busca.trim() || filtro !== 'todos' || ordem !== 'prazo'
  );

  const filtrados = useMemo(() => {
    let lista = (dados?.envios || []).filter(
      (envio) => envio.aba === aba
    );

    if (termo) {
      lista = lista.filter((envio) => {
        const campos = [
          envio.titulo,
          envio.order_id,
          envio.shipment_id,
          envio.cliente,
          envio.sku,
          envio.tracking_number,
          envio.receiver_name,
          envio.receiver_city,
          envio.receiver_state,
          envio.destino,
          ...envio.itens.map((item) => item.descricao),
          ...envio.itens.map((item) => item.sku),
        ];

        return campos.some((campo) => normalizar(campo).includes(termo));
      });
    }

    if (filtro === 'nfe') {
      lista = lista.filter((envio) => envio.nfe_pendente);
    } else if (filtro === 'atrasados') {
      lista = lista.filter((envio) => envio.atrasado);
    } else if (filtro === 'rastreio') {
      lista = lista.filter((envio) => Boolean(envio.tracking_number));
    }

    return ordenarEnvios(lista, ordem, aba);
  }, [aba, dados, filtro, ordem, termo]);

  const gruposProximos = useMemo(() => {
    if (aba !== 'proximos') return [];

    const mapa = new Map<
      string,
      { chave: string; label: string; envios: EnvioMl[] }
    >();

    for (const envio of filtrados) {
      const chave = envio.dia || 'sem-data';
      const grupo = mapa.get(chave) || {
        chave,
        label: envio.dia_label || 'Sem data',
        envios: [],
      };

      grupo.envios.push(envio);
      mapa.set(chave, grupo);
    }

    return [...mapa.values()].sort((a, b) =>
      a.chave.localeCompare(b.chave)
    );
  }, [aba, filtrados]);

  const gruposResumo = useMemo(() => {
    if (aba !== 'hoje' && aba !== 'proximos') return [];

    const mapa = new Map<
      string,
      {
        chave: string;
        dia: string | null;
        label: string;
        horario: string | null;
        envios: EnvioMl[];
      }
    >();

    for (const envio of filtrados) {
      const prazo = envio.prazo_despacho || envio.pay_before;
      const horario = temHorario(prazo)
        ? formatarHora(prazo)
        : null;
      const dia = aba === 'proximos' ? envio.dia || null : null;
      const chave = `${dia || 'hoje'}|${envio.logistic_label}|${horario || 'sem-prazo'}`;
      const grupo = mapa.get(chave) || {
        chave,
        dia,
        label: `${envio.logistic_label} | ${
          horario ? `Até ${horario} h` : 'Prazo não informado'
        }`,
        horario,
        envios: [],
      };

      grupo.envios.push(envio);
      mapa.set(chave, grupo);
    }

    return [...mapa.values()].sort((a, b) => {
      if (a.dia !== b.dia) {
        return (a.dia || '').localeCompare(b.dia || '');
      }
      if (a.horario !== b.horario) {
        if (!a.horario) return 1;
        if (!b.horario) return -1;
        return a.horario.localeCompare(b.horario);
      }
      return a.label.localeCompare(b.label);
    });
  }, [aba, filtrados]);

  const enviosExibidos =
    grupoSelecionado &&
    gruposResumo.some((grupo) => grupo.chave === grupoSelecionado)
      ? filtrados.filter((envio) => {
          const grupo = gruposResumo.find(
            (item) => item.chave === grupoSelecionado
          );
          return grupo?.envios.some((item) => item.id === envio.id);
        })
      : filtrados;

  const gruposProximosExibidos = useMemo(() => {
    if (!grupoSelecionado) return gruposProximos;

    const grupoAtivo = gruposResumo.find(
      (grupo) => grupo.chave === grupoSelecionado
    );

    if (!grupoAtivo) return gruposProximos;

    const ids = new Set(grupoAtivo.envios.map((envio) => envio.id));

    return gruposProximos
      .map((grupo) => ({
        ...grupo,
        envios: grupo.envios.filter((envio) => ids.has(envio.id)),
      }))
      .filter((grupo) => grupo.envios.length > 0);
  }, [grupoSelecionado, gruposProximos, gruposResumo]);

  const etiquetasVisiveis = enviosExibidos.filter(
    (envio) => Boolean(envio.shipment_id) && envio.etiqueta_disponivel
  );
  const idsEtiquetasVisiveis = etiquetasVisiveis.map((envio) =>
    String(envio.shipment_id)
  );
  const etiquetasVisiveisSelecionadas = etiquetasVisiveis.filter((envio) =>
    etiquetasSelecionadas.has(String(envio.shipment_id))
  );
  const todasEtiquetasVisiveisSelecionadas =
    etiquetasVisiveis.length > 0 &&
    etiquetasVisiveisSelecionadas.length === etiquetasVisiveis.length;

  const limparFiltros = () => {
    setBusca('');
    setFiltro('todos');
    setOrdem('prazo');
  };

  const alternarSelecaoEtiqueta = (envio: EnvioMl) => {
    setErroEtiquetas('');
    setEtiquetasSelecionadas((atual) => {
      const proxima = new Set(atual);
      const id = String(envio.shipment_id);

      if (proxima.has(id)) {
        proxima.delete(id);
      } else {
        proxima.add(id);
      }

      return proxima;
    });
  };

  const alternarSelecaoTodasEtiquetas = () => {
    setErroEtiquetas('');
    setEtiquetasSelecionadas((atual) => {
      const proxima = new Set(atual);

      if (todasEtiquetasVisiveisSelecionadas) {
        idsEtiquetasVisiveis.forEach((id) => proxima.delete(id));
      } else {
        idsEtiquetasVisiveis.forEach((id) => proxima.add(id));
      }

      return proxima;
    });
  };

  const imprimirEtiquetas = async (envios: EnvioMl[]) => {
    const shipmentIds = [
      ...new Set(
        envios
          .map((envio) => String(envio.shipment_id || '').trim())
          .filter(Boolean)
      ),
    ];

    if (shipmentIds.length === 0) {
      setErroEtiquetas('Nenhum envio válido foi selecionado.');
      return;
    }

    if (shipmentIds.length > 50) {
      setErroEtiquetas(
        'O Mercado Livre permite buscar até 50 etiquetas por vez. Selecione no máximo 50 envios.'
      );
      return;
    }

    const janela = window.open('', '_blank');

    if (!janela) {
      setErroEtiquetas(
        'O navegador bloqueou a nova aba. Permita pop-ups para abrir as etiquetas.'
      );
      return;
    }

    janela.document.title = 'Preparando etiquetas';
    janela.document.body.textContent =
      'Carregando etiquetas do Mercado Livre...';
    setErroEtiquetas('');
    setImprimindoEtiquetas(true);

    try {
      const resposta = await axios.post<Blob>(
        '/api/vendas/envios/etiquetas',
        { shipmentIds },
        { responseType: 'blob', timeout: 120000 }
      );
      const emitidaEm =
        resposta.headers['x-etiquetas-emitidas-em'] || new Date().toISOString();
      const pdf = new Blob([resposta.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdf);

      janela.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
      setDados((atual) =>
        atual
          ? {
              ...atual,
              envios: atual.envios.map((envio) =>
                shipmentIds.includes(String(envio.shipment_id))
                  ? {
                      ...envio,
                      etiqueta_emitida: true,
                      etiqueta_emitida_em: emitidaEm,
                      etiqueta_disponivel: true,
                    }
                  : envio
              ),
            }
          : atual
      );
      setDetalhe((atual) =>
        atual && shipmentIds.includes(String(atual.shipment_id))
          ? {
              ...atual,
              etiqueta_emitida: true,
              etiqueta_emitida_em: emitidaEm,
              etiqueta_disponivel: true,
            }
          : atual
      );
      setEtiquetasSelecionadas((atual) => {
        const proxima = new Set(atual);
        shipmentIds.forEach((id) => proxima.delete(id));
        return proxima;
      });
    } catch (error) {
      janela.close();
      let mensagem = 'Não foi possível buscar as etiquetas do Mercado Livre.';

      if (axios.isAxiosError(error)) {
        const resposta = error.response?.data;

        if (resposta instanceof Blob) {
          try {
            const dadosErro = JSON.parse(await resposta.text()) as {
              error?: string;
            };
            mensagem = dadosErro.error || mensagem;
          } catch {
            mensagem = error.message || mensagem;
          }
        } else {
          mensagem = resposta?.error || error.message || mensagem;
        }
      } else if (error instanceof Error) {
        mensagem = error.message;
      }

      setErroEtiquetas(mensagem);
    } finally {
      setImprimindoEtiquetas(false);
    }
  };

  const copiarRastreio = async (codigo: string) => {
    if (!codigo) return;

    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ml/25 bg-ml/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ml">
              <ShoppingBag className="h-3 w-3" />
              Mercado Livre
            </span>
            <span className="text-[10px] text-muted">
              {tempoRelativo(dados?.sincronizadoEm)}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-ink">
            Central de envios
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Veja o que precisa sair hoje, o que está agendado e acompanhe os
            envios em trânsito.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setArquivosXml([]);
              setFalhasLoteXml([]);
              setResultadoLoteXml('');
              setLoteXmlAberto(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-ml/30 bg-ml/10 px-3 py-2.5 text-sm font-semibold text-ml transition-colors hover:bg-ml/15"
          >
            <FileUp className="h-4 w-4" />
            XML em lote
          </button>
          <button
            type="button"
            onClick={() => void sincronizar(false)}
            disabled={sincronizando}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ml px-4 py-2.5 text-sm font-bold text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sincronizando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </section>

      {aba === 'hoje' && dados?.contagens.hoje === 0 && dados.contagens.proximos > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/25 bg-successSoft p-3">
          <p className="text-sm text-success">Os envios de hoje estão concluídos. Os próximos continuam organizados pelo prazo do Mercado Livre.</p>
          <button type="button" onClick={() => trocarAba('proximos')} className="rounded-lg border border-success/30 px-3 py-2 text-xs font-semibold text-success">Ver próximos envios</button>
        </div>
      ) : null}
      {dados && !dados.conectado ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/25 bg-warningSoft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-ink">
                Mercado Livre não conectado
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Conecte sua conta para carregar os envios e os prazos de
                despacho.
              </p>
            </div>
          </div>
          {onOpenMarketplaces ? (
            <button
              type="button"
              onClick={onOpenMarketplaces}
              className="shrink-0 rounded-xl border border-warning/30 bg-black/15 px-3 py-2 text-xs font-semibold text-warning hover:bg-black/25"
            >
              Abrir Marketplaces
            </button>
          ) : null}
        </div>
      ) : null}

      {erro ? (
        <div className="flex flex-col gap-2 rounded-xl border border-danger/25 bg-dangerSoft px-4 py-3 text-sm text-danger sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {erro}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void carregar()}
              className="rounded-lg border border-danger/25 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => setErro('')}
              aria-label="Fechar aviso"
              className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-2 sm:px-3">
          {ABAS.map((item) => {
            const ativa = aba === item.chave;

            return (
              <button
                key={item.chave}
                type="button"
                onClick={() => trocarAba(item.chave)}
                aria-pressed={ativa}
                className={`relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${
                  ativa ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <item.icon
                  className={`h-4 w-4 ${ativa ? 'text-ml' : ''}`}
                />
                <span>{item.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    ativa
                      ? 'bg-ml text-black'
                      : 'bg-white/[0.07] text-muted'
                  }`}
                >
                  {contagens[item.chave]}
                </span>
                {ativa ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ml" />
                ) : null}
              </button>
            );
          })}
        </div>

        {aba === 'hoje' || aba === 'proximos' ? (
          <div className="space-y-3 p-3 sm:p-4">
            {aba === 'proximos' ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                Próximos despachos por dia e modalidade
              </p>
            ) : null}
            {gruposResumo.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {gruposResumo.map((grupo) => {
                  const selecionado = grupoSelecionado === grupo.chave;
                  const nfePendente = grupo.envios.filter(
                    (envio) => envio.nfe_pendente
                  ).length;
                  const atrasados = grupo.envios.filter(
                    (envio) => envio.atrasado
                  ).length;

                  return (
                    <button
                      key={grupo.chave}
                      type="button"
                      onClick={() =>
                        setGrupoSelecionado(selecionado ? null : grupo.chave)
                      }
                      aria-pressed={selecionado}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        selecionado
                          ? 'border-ml/50 bg-ml/10'
                          : 'border-line bg-white/[0.03] hover:border-ml/30 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-warning">
                          {aba === 'hoje' ? 'Para enviar' : grupo.dia
                            ? formatarChaveDia(grupo.dia)
                            : 'Data não informada'}
                        </p>
                        <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-muted">
                          {grupo.envios.length}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-snug text-ink">
                        {grupo.label}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="text-muted">
                          {nfePendente > 0
                            ? `NF-e para gerenciar ${nfePendente}`
                            : 'NF-e em dia'}
                        </span>
                        {atrasados > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-danger">
                            <AlertTriangle className="h-3 w-3" />
                            {atrasados} atrasado{atrasados === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-muted">
                {aba === 'hoje'
                  ? 'Nenhum envio disponível para despacho hoje.'
                  : 'Nenhum envio com prazo futuro informado pelo Mercado Livre.'}
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
            <div className="rounded-xl border border-line bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                {aba === 'combinar'
                  ? 'A combinar com o comprador'
                  : aba === 'cancelados'
                    ? 'Vendas canceladas'
                    : aba === 'finalizadas'
                      ? 'Finalizadas no período'
                      : 'Em trânsito'}
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {contagens[aba]}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                Todos os envios no período
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {dados?.totalGeral || 0}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por pedido, comprador, SKU ou rastreio"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-9 text-sm"
            />
            {busca ? (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>

          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1 sm:flex-none">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <select
                value={periodo}
                onChange={(event) => setPeriodo(Number(event.target.value))}
                className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-8 text-sm sm:w-auto"
              >
                {PERIODOS.map((item) => (
                  <option key={item.valor} value={item.valor}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </label>

            <div className="relative shrink-0" ref={filtroRef}>
              <button
                type="button"
                onClick={() => {
                  if (menuFiltros) {
                    setMenuFiltros(false);
                    return;
                  }
                  atualizarPosicaoFiltros();
                  setMenuFiltros(true);
                }}
                aria-expanded={menuFiltros}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  filtro !== 'todos' || ordem !== 'prazo'
                    ? 'border-ml/30 bg-ml/10 text-ml'
                    : 'border-white/10 bg-white/[0.04] text-muted hover:text-ink'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Filtrar e ordenar</span>
                <span className="sm:hidden">Filtros</span>
                {filtro !== 'todos' || ordem !== 'prazo' ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-ml" />
                ) : null}
              </button>

              {menuFiltros
                ? createPortal(
                    <div
                      ref={filtroPopoverRef}
                      className="fixed z-[100] max-h-[min(70vh,360px)] w-[min(88vw,22rem)] overflow-y-auto rounded-2xl border border-line bg-sidebar p-4 shadow-2xl"
                      style={{
                        top: posicaoFiltros.top,
                        right: posicaoFiltros.right,
                        backgroundColor: 'rgba(7, 15, 28, 0.99)',
                        backgroundImage: 'none',
                      }}
                    >
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                    Filtrar por
                  </p>
                  <div className="mt-2 space-y-1">
                    {FILTROS.map((item) => (
                      <button
                        key={item.chave}
                        type="button"
                        onClick={() => {
                          setFiltro(item.chave);
                          setMenuFiltros(false);
                        }}
                        className={`flex w-full items-start justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                          filtro === item.chave
                            ? 'bg-ml/10 text-ink'
                            : 'text-muted hover:bg-white/[0.05] hover:text-ink'
                        }`}
                      >
                        <span>
                          <span className="block font-medium">
                            {item.label}
                          </span>
                          <span className="block text-[10px] text-muted">
                            {item.descricao}
                          </span>
                        </span>
                        {filtro === item.chave ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ml" />
                        ) : null}
                      </button>
                    ))}
                  </div>

                  <div className="my-3 h-px bg-line" />

                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                    Ordenar por
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ORDENS.map((item) => (
                      <button
                        key={item.valor}
                        type="button"
                        onClick={() => setOrdem(item.valor)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          ordem === item.valor
                            ? 'border-ml/30 bg-ml/10 text-ml'
                            : 'border-white/10 text-muted hover:bg-white/[0.05] hover:text-ink'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      limparFiltros();
                      setMenuFiltros(false);
                    }}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-ink hover:bg-white/[0.07]"
                  >
                    Limpar filtros
                  </button>
                    </div>,
                    document.body
                  )
                : null}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={limparFiltros}
            title={temFiltro ? 'Limpar busca e filtros' : abaInfo.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-ml/25 bg-ml/10 px-2.5 py-1 text-[11px] font-semibold text-ml"
          >
            {abaInfo.label}
            <span className="rounded-full bg-ml/20 px-1.5 text-[10px]">
              {contagens[aba]}
            </span>
            {temFiltro ? <X className="h-3 w-3" /> : null}
          </button>

          {busca.trim() ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accentSoft px-2.5 py-1 text-[11px] font-semibold text-accent">
              “{busca.trim()}”
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Remover busca"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : null}

          {filtro !== 'todos' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/25 bg-warningSoft px-2.5 py-1 text-[11px] font-semibold text-warning">
              {FILTROS.find((item) => item.chave === filtro)?.label}
              <button
                type="button"
                onClick={() => setFiltro('todos')}
                aria-label="Remover filtro"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : null}

          {ordem !== 'prazo' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/25 bg-cyanSoft px-2.5 py-1 text-[11px] font-semibold text-cyan">
              {ORDENS.find((item) => item.valor === ordem)?.label}
              <button
                type="button"
                onClick={() => setOrdem('prazo')}
                aria-label="Remover ordenação"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-ink">{abaInfo.label}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {carregandoInicial
              ? 'Buscando envios no Mercado Livre...'
              : `${enviosExibidos.length} ${
                  enviosExibidos.length === 1 ? 'envio' : 'envios'
                }${
                  busca.trim()
                    ? enviosExibidos.length === 1
                      ? ' encontrado'
                      : ' encontrados'
                    : ''
                } • ${periodoLabel}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {grupoSelecionado ? (
            <button
              type="button"
              onClick={() => setGrupoSelecionado(null)}
              className="text-xs font-semibold text-ml hover:underline"
            >
              Ver todos os envios
            </button>
          ) : null}
          {etiquetasVisiveis.length > 0 ? (
            <>
              <button
                type="button"
                onClick={alternarSelecaoTodasEtiquetas}
                disabled={imprimindoEtiquetas}
                aria-pressed={todasEtiquetasVisiveisSelecionadas}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                {todasEtiquetasVisiveisSelecionadas ? (
                  <CheckSquare className="h-4 w-4 text-ml" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {todasEtiquetasVisiveisSelecionadas
                  ? 'Desmarcar todas'
                  : `Selecionar todas (${etiquetasVisiveis.length})`}
              </button>
              <button
                type="button"
                onClick={() =>
                  void imprimirEtiquetas(etiquetasVisiveisSelecionadas)
                }
                disabled={
                  imprimindoEtiquetas ||
                  etiquetasVisiveisSelecionadas.length === 0 ||
                  etiquetasVisiveisSelecionadas.length > 50
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-ml px-3 py-2 text-xs font-bold text-black transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {imprimindoEtiquetas ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Imprimir etiquetas
                {etiquetasVisiveisSelecionadas.length > 0
                  ? ` (${etiquetasVisiveisSelecionadas.length})`
                  : ''}
              </button>
            </>
          ) : null}
          {sincronizando ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Atualizando dados do Mercado Livre...
            </span>
          ) : null}
        </div>
      </div>

      {etiquetasVisiveisSelecionadas.length > 50 ? (
        <p className="rounded-xl border border-warning/25 bg-warningSoft px-3 py-2 text-xs text-warning">
          Selecione no máximo 50 etiquetas por vez, limite do Mercado Livre.
        </p>
      ) : null}
      {erroEtiquetas ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/25 bg-dangerSoft px-3 py-2 text-xs text-danger"
        >
          {erroEtiquetas}
        </p>
      ) : null}

      {carregandoInicial ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, indice) => (
            <div
              key={indice}
              className="h-40 animate-pulse rounded-2xl border border-line bg-white/[0.03]"
            />
          ))}
        </div>
      ) : enviosExibidos.length === 0 ? (
        <EstadoVazio
          aba={aba}
          temFiltro={temFiltro}
          onLimpar={limparFiltros}
        />
      ) : aba === 'proximos' ? (
        <div className="space-y-6">
          {gruposProximosExibidos.map((grupo) => (
            <section key={grupo.chave}>
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-sm font-bold text-ink">
                  {grupo.label}
                </h3>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-muted">
                  {grupo.envios.length}
                </span>
                <div className="h-px flex-1 bg-line" />
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {grupo.envios.map((envio) => (
                  <CartaoEnvio
                    key={envio.id}
                    envio={envio}
                    onOpen={setDetalhe}
                    selecionado={etiquetasSelecionadas.has(
                      String(envio.shipment_id)
                    )}
                    onAlternarSelecao={alternarSelecaoEtiqueta}
                    onImprimir={(item) => void imprimirEtiquetas([item])}
                    imprimindo={imprimindoEtiquetas}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {enviosExibidos.map((envio) => (
            <CartaoEnvio
              key={envio.id}
              envio={envio}
              onOpen={setDetalhe}
              selecionado={etiquetasSelecionadas.has(
                String(envio.shipment_id)
              )}
              onAlternarSelecao={alternarSelecaoEtiqueta}
              onImprimir={(item) => void imprimirEtiquetas([item])}
              imprimindo={imprimindoEtiquetas}
              onAvisarEntrega={setEntregaConfirmar}
              avisandoEntrega={avisandoEntrega}
            />
          ))}
        </div>
      )}

      {entregaConfirmar ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="confirmar-entrega-titulo" className="w-full max-w-md rounded-2xl border border-line bg-card p-5">
            <h2 id="confirmar-entrega-titulo" className="text-lg font-bold">O comprador já recebeu a peça?</h2>
            <p className="mt-3 text-sm text-muted">Pedido {entregaConfirmar.order_id}. Ao confirmar, o Mercado Livre será avisado de que a entrega foi concluída e o pedido irá para Finalizadas.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={avisandoEntrega} onClick={() => setEntregaConfirmar(null)} className="rounded-lg border border-line px-3 py-2 text-sm">Cancelar</button>
              <button type="button" disabled={avisandoEntrega} onClick={() => void confirmarEntrega()} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{avisandoEntrega ? 'Avisando…' : 'Sim, foi entregue'}</button>
            </div>
          </div>
        </div>
      ) : null}
      {loteXmlAberto ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !enviandoLoteXml) {
              setLoteXmlAberto(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lote-xml-titulo"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-line bg-sidebar p-5 shadow-2xl sm:rounded-3xl"
            style={{
              backgroundColor: 'rgba(7, 15, 28, 0.98)',
              backgroundImage: 'none',
            }}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 id="lote-xml-titulo" className="text-lg font-bold text-ink">
                  Anexar XMLs em lote
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Selecione até 20 arquivos XML ou ZIP e associe cada um ao
                  pedido certo. O XML dentro do ZIP será extraído e armazenado
                  em privado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoteXmlAberto(false)}
                disabled={enviandoLoteXml}
                aria-label="Fechar envio em lote"
                className="rounded-xl border border-white/10 p-2 text-muted hover:bg-white/[0.06] hover:text-ink disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/[0.025] px-4 py-6 text-center hover:border-ml/40">
              <FileUp className="h-6 w-6 text-ml" />
              <span className="mt-2 text-sm font-semibold text-ink">
                Escolher ZIPs de NF-e
              </span>
              <span className="mt-1 text-[11px] text-muted">
                Um ZIP por peça · até 20 MB por arquivo · identificação automática
              </span>
              <input
                type="file"
                accept=".zip,application/zip"
                multiple
                className="sr-only"
                disabled={enviandoLoteXml}
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  event.target.value = '';

                  if (files.length > 20) {
                    setResultadoLoteXml('Selecione no máximo 20 arquivos.');
                    return;
                  }

                  setResultadoLoteXml('');
                  setFalhasLoteXml([]);
                  setArquivosXml(files.map((file) => ({ file })));
                }}
              />
            </label>

            {arquivosXml.length > 0 ? (
              <div className="mt-4 space-y-2">
                {arquivosXml.map((item, indice) => (
                  <div
                    key={`${item.file.name}-${indice}`}
                    className="rounded-xl border border-line bg-white/[0.03] p-3"
                  >
                    <p className="flex min-w-0 items-center gap-2 text-xs text-ink">
                      <FileCheck2 className="h-4 w-4 shrink-0 text-accent" />
                      <span className="truncate" title={item.file.name}>
                        {item.file.name}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {resultadoLoteXml ? (
              <p
                className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                  falhasLoteXml.length
                    ? 'border-warning/25 bg-warningSoft text-warning'
                    : 'border-success/25 bg-successSoft text-success'
                }`}
              >
                {resultadoLoteXml}
              </p>
            ) : null}

            {falhasLoteXml.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-danger">
                {falhasLoteXml.map((falha) => (
                  <li key={falha.arquivo}>
                    {falha.arquivo}: {falha.erro}
                  </li>
                ))}
              </ul>
            ) : null}

            {arquivosXml.length > 0 ? (
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setArquivosXml([]);
                    setResultadoLoteXml('');
                    setFalhasLoteXml([]);
                  }}
                  disabled={enviandoLoteXml}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-muted hover:bg-white/[0.05]"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => void enviarLoteXml()}
                  disabled={
                    enviandoLoteXml || arquivosXml.length === 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-ml px-4 py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enviandoLoteXml ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  {enviandoLoteXml ? 'Enviando...' : 'Enviar XMLs'}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {detalhe ? (
        <DetalheEnvio
          envio={detalhe}
          onClose={() => setDetalhe(null)}
          onCopiar={(codigo) => void copiarRastreio(codigo)}
          copiado={copiado}
          onEnviarMensagem={(id) =>
            setMensagemVenda({ id, orderId: detalhe.order_id })
          }
        />
      ) : null}
      {mensagemVenda ? (
        <MensagemVendaModal
          vendaId={mensagemVenda.id}
          orderId={mensagemVenda.orderId}
          cliente={detalhe?.cliente}
          peca={detalhe?.titulo}
          onClose={() => setMensagemVenda(null)}
        />
      ) : null}
    </div>
  );
}
