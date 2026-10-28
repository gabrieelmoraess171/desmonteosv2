import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Barcode,
  CalendarDays,
  CreditCard,
  ExternalLink,
  MapPin,
  Package,
  Percent,
  ShoppingBag,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';

interface ItemVenda {
  sku: string;
  descricao?: string | null;
  quantidade: number;
  preco_unitario: number;
}

export interface VendaDetalheRelatorio {
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
  itens: ItemVenda[];
  peca_nome?: string | null;
  peca_sku?: string | null;
  peca_imagem?: string | null;
}

interface VendaDetalheModalProps {
  venda: VendaDetalheRelatorio | null;
  onClose: () => void;
}

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

export default function VendaDetalheModal({
  venda,
  onClose,
}: VendaDetalheModalProps) {
  useEffect(() => {
    if (!venda) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [venda, onClose]);

  if (!venda) return null;

  const statusLabel = venda.cancelada
    ? 'Cancelada'
    : venda.status_grupo === 'concluida'
      ? 'Concluída'
      : 'Em andamento';
  const statusClasse = venda.cancelada
    ? 'border-danger/25 bg-dangerSoft text-danger'
    : venda.status_grupo === 'concluida'
      ? 'border-success/25 bg-successSoft text-success'
      : 'border-warning/25 bg-warningSoft text-warning';
  const pedido = venda.order_id || `#${venda.id}`;
  const itens = venda.itens || [];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="venda-detalhe-titulo"
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Detalhe da venda
            </p>
            <h2
              id="venda-detalhe-titulo"
              className="mt-1 truncate font-mono text-lg font-bold text-accent"
            >
              {pedido}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <span
                className={`rounded-full border px-2 py-0.5 font-semibold ${statusClasse}`}
              >
                {statusLabel}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {formatarDataHora(venda.data_venda)}
              </span>
              <span>{venda.plataforma || 'Mercado Livre'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhe da venda"
            className="rounded-full p-2 text-muted transition-colors hover:bg-white/10 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          <section className="rounded-xl border border-line bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-secondary">
                {venda.peca_imagem ? (
                  <img
                    src={venda.peca_imagem}
                    alt={venda.peca_nome || 'Produto'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted">
                    <Package className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-ink">
                  {venda.peca_nome ||
                    itens[0]?.descricao ||
                    'Produto do anúncio'}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Barcode className="h-3 w-3" />
                    {venda.peca_sku || itens[0]?.sku || 'Sem SKU'}
                  </span>
                  {itens.length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <ShoppingBag className="h-3 w-3" />
                      {itens.length} item(ns)
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 text-xl font-bold text-success">
                  {formatarMoeda(venda.valor_bruto)}
                </p>
              </div>
            </div>

            {itens.length > 0 ? (
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                {itens.map((item, indice) => (
                  <div
                    key={`${item.sku}-${indice}`}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <span className="text-muted">
                      {item.quantidade}x {item.descricao || item.sku}
                      <span className="ml-1 text-[10px] text-muted/70">
                        ({item.sku})
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-ink">
                      {formatarMoeda(item.quantidade * item.preco_unitario)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-line bg-white/[0.02] p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <UserRound className="h-4 w-4 text-accent" />
                Comprador
              </h3>
              <dl className="mt-3 space-y-2.5 text-xs">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted">
                    Nome
                  </dt>
                  <dd className="mt-0.5 text-sm text-ink">
                    {venda.cliente || 'Não informado'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted">
                    CPF
                  </dt>
                  <dd className="mt-0.5 text-sm text-ink">
                    {venda.cliente_cpf || 'Não informado'}
                  </dd>
                </div>
                {venda.cliente_email ? (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted">
                      E-mail
                    </dt>
                    <dd className="mt-0.5 break-all text-sm text-ink">
                      {venda.cliente_email}
                    </dd>
                  </div>
                ) : null}
                {venda.cliente_fone ? (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted">
                      Telefone
                    </dt>
                    <dd className="mt-0.5 text-sm text-ink">
                      {venda.cliente_fone}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted">
                    Endereço
                  </dt>
                  <dd className="mt-0.5 flex items-start gap-1.5 text-sm leading-relaxed text-ink">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    {venda.cliente_endereco || 'Não informado'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-line bg-white/[0.02] p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <Wallet className="h-4 w-4 text-success" />
                Valores
              </h3>
              <dl className="mt-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-muted">
                    <CreditCard className="h-3.5 w-3.5" />
                    Pagamento
                  </dt>
                  <dd className="text-right text-sm text-ink">
                    {venda.metodo_pagamento_label ||
                      rotuloPagamento(venda.metodo_pagamento)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Valor bruto</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {formatarMoeda(venda.valor_bruto)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-muted">
                    <Percent className="h-3.5 w-3.5" />
                    Taxa Mercado Livre
                  </dt>
                  <dd className="text-sm font-semibold text-warning">
                    {venda.taxa_ml > 0
                      ? `- ${formatarMoeda(venda.taxa_ml)}`
                      : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
                  <dt className="text-muted">Valor líquido</dt>
                  <dd className="text-base font-bold text-success">
                    {venda.cancelada ? '—' : formatarMoeda(venda.valor_liquido)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">
                    {venda.recebido
                      ? 'Recebido em'
                      : venda.cancelada
                        ? 'Situação'
                        : 'Previsão'}
                  </dt>
                  <dd className="text-right text-sm text-ink">
                    {venda.recebido
                      ? formatarDataHora(venda.data_recebimento)
                      : venda.cancelada
                        ? 'Pedido cancelado'
                        : 'A receber'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-white/[0.02] px-5 py-3 sm:px-6">
          <a
            href={
              venda.order_id
                ? `https://www.mercadolivre.com.br/vendas/${venda.order_id}`
                : 'https://www.mercadolivre.com.br/vendas'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir no Mercado Livre
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-white/[0.09]"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
