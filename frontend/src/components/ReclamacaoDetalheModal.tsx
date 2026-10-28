import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Send,
  ShieldAlert,
  Truck,
  UserRound,
  X,
} from 'lucide-react';
import axios from 'axios';

interface ItemVenda {
  sku: string;
  descricao?: string | null;
  quantidade: number;
  preco_unitario: number;
  imagem?: string | null;
}

interface ReclamacaoDetalhe {
  id: number;
  peca_id?: number | null;
  pedido_id?: string | null;
  motivo: string;
  descricao?: string | null;
  status: string;
  data_reclamacao: string;
  resolvido_em?: string | null;
  ml_claim_id?: string | null;
  ml_status?: string | null;
}

interface EnvioDetalhe {
  status?: string | null;
  status_label?: string | null;
  rastreio?: string | null;
  transportadora?: string | null;
  modalidade?: string | null;
  custo?: number;
  endereco?: string | null;
  previsao?: string | null;
  atualizado_em?: string | null;
}

interface PagamentoDetalhe {
  metodo?: string | null;
  tipo?: string | null;
  parcelas?: number;
  valor?: number;
  status?: string | null;
  aprovado_em?: string | null;
}

interface VendaDetalhe {
  id: number;
  order_id?: string | null;
  valor: number;
  status: string;
  status_label?: string | null;
  cliente?: string | null;
  cliente_email?: string | null;
  cliente_fone?: string | null;
  cliente_cpf?: string | null;
  cliente_endereco?: string | null;
  metodo_pagamento?: string | null;
  data_venda?: string | null;
  itens_count?: number;
  envio?: EnvioDetalhe | null;
  pagamento?: PagamentoDetalhe | null;
  itens: ItemVenda[];
}

interface PecaDetalhe {
  id?: number | null;
  nome?: string | null;
  sku?: string | null;
  carro?: string | null;
  descricao?: string | null;
  preco?: number | null;
  imagem?: string | null;
}

interface EventoTimeline {
  tipo: string;
  titulo: string;
  descricao?: string | null;
  data?: string | null;
}

interface MensagemMl {
  id: string | number;
  remetente: string;
  destinatario?: string;
  mensagem: string;
  data?: string | null;
  anexos?: Array<{ nome: string; url: string }>;
}

interface JogadorClaim {
  role?: string;
  type?: string;
  user_id?: number;
  available_actions?: Array<{ action?: string; mandatory?: boolean }>;
}

interface ReclamacaoMl {
  status?: string | null;
  stage?: string | null;
  type?: string | null;
  reason_id?: string | null;
  claimed_quantity?: number;
  date_created?: string | null;
  last_updated?: string | null;
  players?: JogadorClaim[];
}

interface ResolucaoEsperada {
  player_role?: string;
  expected_resolution?: string;
  status?: string;
}

interface RespostaDetalhe {
  reclamacao: ReclamacaoDetalhe;
  reclamacaoMl?: ReclamacaoMl | null;
  peca: PecaDetalhe | null;
  venda: VendaDetalhe | null;
  mensagens?: MensagemMl[];
  resolucoesEsperadas?: ResolucaoEsperada[];
  podeResponder?: boolean;
  avisos?: string[];
  timeline: EventoTimeline[];
}

interface ReclamacaoDetalheModalProps {
  reclamacaoId: number | null;
  onClose: () => void;
  onResolved: (id: number) => void;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function formatarData(valor?: string | null, comAno = true): string {
  if (!valor) return '—';
  const data = new Date(String(valor).replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return String(valor);

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(comAno ? { year: 'numeric' as const } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function rotuloStatus(status?: string | null): string {
  const valor = String(status || '').toLowerCase();
  if (valor === 'aberta') return 'Aberta';
  if (valor === 'em_analise') return 'Em análise';
  if (['resolvida', 'resolvido', 'fechada', 'closed'].includes(valor)) {
    return 'Resolvida';
  }
  return valor || 'Aberta';
}

function rotuloPagamento(metodo?: string | null): string {
  const chave = String(metodo || '').toLowerCase();
  const mapa: Record<string, string> = {
    pix: 'Pix',
    visa: 'Cartão Visa',
    master: 'Cartão Mastercard',
    mastercard: 'Cartão Mastercard',
    elo: 'Cartão Elo',
    amex: 'Cartão American Express',
    hipercard: 'Cartão Hipercard',
    debito: 'Cartão de débito',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
    account_money: 'Saldo Mercado Pago',
    bolbradesco: 'Boleto',
    boleto: 'Boleto',
    pec: 'Pix',
    ted: 'Transferência bancária',
  };

  return mapa[chave] || metodo || 'Não informado';
}

function rotuloResolucao(valor?: string | null): string {
  const chave = String(valor || '').toLowerCase();
  const mapa: Record<string, string> = {
    return_product: 'Devolução do produto',
    return_label: 'Etiqueta de devolução',
    refund: 'Reembolso',
    partial_refund: 'Reembolso parcial',
    open_dispute: 'Abrir disputa',
    send_message: 'Enviar mensagem',
  };

  return mapa[chave] || valor || 'Aguardando definição';
}

function rotuloEtapa(valor?: string | null): string {
  const chave = String(valor || '').toLowerCase();
  const mapa: Record<string, string> = {
    dispute: 'Em disputa',
    claim: 'Reclamação',
    mediation: 'Em mediação',
    opened: 'Aberta',
    closed: 'Fechada',
  };

  return mapa[chave] || valor || 'Em análise';
}

const MODELOS_RESPOSTA = [
  {
    titulo: 'Produto conforme',
    texto:
      'Olá! O produto enviado corresponde exatamente ao anunciado, com as medidas e a aplicação informadas na descrição. Permaneço à disposição para esclarecer qualquer dúvida e ajudar na instalação.',
  },
  {
    titulo: 'Enviar etiqueta',
    texto:
      'Olá! Autorizo a devolução do produto. Por favor, o Mercado Livre pode disponibilizar a etiqueta de devolução para que o comprador envie a peça de volta? Assim que recebida, farei a conferência e o reembolso.',
  },
  {
    titulo: 'Pedir fotos',
    texto:
      'Olá! Para analisar o caso com precisão, pode enviar fotos da peça recebida, da etiqueta de envio e do local onde ela não encaixou? Com essas imagens consigo verificar a aplicação e resolver da melhor forma.',
  },
];

function iconeTimeline(tipo: string) {
  if (tipo === 'pedido') return Package;
  if (tipo === 'pagamento') return CheckCircle2;
  if (tipo === 'envio') return Truck;
  if (tipo === 'resolucao') return Check;
  return AlertTriangle;
}

export default function ReclamacaoDetalheModal({
  reclamacaoId,
  onClose,
  onResolved,
}: ReclamacaoDetalheModalProps) {
  const [dados, setDados] = useState<RespostaDetalhe | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [resolvendo, setResolvendo] = useState(false);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const mensagensRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!reclamacaoId) {
      setDados(null);
      return;
    }

    let ativo = true;
    setLoading(true);
    setErro('');
    setErroAcao('');
    setSucesso('');
    setResposta('');

    axios
      .get<RespostaDetalhe>(
        `/api/atendimento/reclamacoes/${reclamacaoId}`,
        { timeout: 12000 }
      )
      .then(({ data }) => {
        if (ativo) setDados(data);
      })
      .catch((error: unknown) => {
        if (!ativo) return;
        if (axios.isAxiosError<{ error?: string }>(error)) {
          setErro(
            error.response?.data?.error ||
              'Não foi possível carregar a reclamação.'
          );
        } else {
          setErro('Não foi possível carregar a reclamação.');
        }
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [reclamacaoId]);

  useEffect(() => {
    const lista = mensagensRef.current;
    if (!lista) return;
    lista.scrollTop = lista.scrollHeight;
  }, [dados?.mensagens?.length]);

  useEffect(() => {
    if (!reclamacaoId) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [reclamacaoId, onClose]);

  if (!reclamacaoId) return null;

  const resolver = async () => {
    if (!dados || !window.confirm('Marcar esta reclamação como resolvida?')) {
      return;
    }

    setResolvendo(true);
    setErroAcao('');

    try {
      await axios.patch(
        `/api/atendimento/reclamacoes/${dados.reclamacao.id}/resolver`
      );
      onResolved(dados.reclamacao.id);
      onClose();
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErroAcao(
          error.response?.data?.error ||
            'Não foi possível resolver a reclamação.'
        );
      }
    } finally {
      setResolvendo(false);
    }
  };

  const enviarResposta = async () => {
    const mensagem = resposta.trim();

    if (!mensagem || enviando || !dados) return;

    setEnviando(true);
    setErroAcao('');
    setSucesso('');

    try {
      const { data } = await axios.post<{ mensagem?: string }>(
        `/api/atendimento/reclamacoes/${dados.reclamacao.id}/responder`,
        { mensagem }
      );

      setDados((atual) =>
        atual
          ? {
              ...atual,
              mensagens: [
                ...(atual.mensagens || []),
                {
                  id: `local-${Date.now()}`,
                  remetente: 'respondent',
                  destinatario: 'mediator',
                  mensagem,
                  data: new Date().toISOString(),
                },
              ],
            }
          : atual
      );
      setResposta('');
      setSucesso(
        data?.mensagem ||
          'Mensagem enviada ao Mercado Livre. O caso continua em análise.'
      );
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErroAcao(
          error.response?.data?.error ||
            'Não foi possível enviar a mensagem ao Mercado Livre.'
        );
      } else {
        setErroAcao('Não foi possível enviar a mensagem ao Mercado Livre.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const reclamacao = dados?.reclamacao;
  const venda = dados?.venda;
  const peca = dados?.peca;
  const resolvida = ['resolvida', 'resolvido', 'fechada', 'closed'].includes(
    String(reclamacao?.status || '').toLowerCase()
  );
  const quantidade = venda?.itens?.reduce(
    (total, item) => total + Number(item.quantidade || 0),
    0
  );
  const envio = venda?.envio;
  const pagamento = venda?.pagamento;
  const etapa = rotuloEtapa(dados?.reclamacaoMl?.stage);
  const resolucaoEsperada = dados?.resolucoesEsperadas?.find(
    (item) => item.expected_resolution
  );

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reclamacao-detalhe-titulo"
        className="modal-panel flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-[#f5f5f5] text-[#333] shadow-2xl sm:max-h-[92vh] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 bg-[#fff159] px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3483fa] text-white">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-[#333]">
                Central de reclamações
              </p>
              <p className="truncate text-[11px] text-[#5f5f5f]">
                Mercado Livre • Pedido {reclamacao?.pedido_id || 'não vinculado'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar reclamação"
            className="rounded-full p-2 text-[#333] transition-colors hover:bg-black/10"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-[#666]">
              <Loader2 className="h-5 w-5 animate-spin text-[#3483fa]" />
              Carregando reclamação...
            </div>
          ) : erro ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {erro}
            </div>
          ) : dados && reclamacao ? (
            <div className="space-y-4">
              {dados.avisos && dados.avisos.length > 0 && (
                <div className="space-y-2">
                  {dados.avisos.map((aviso) => (
                    <div
                      key={aviso}
                      className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{aviso}</span>
                    </div>
                  ))}
                </div>
              )}

              <section className="rounded-xl border border-[#e0e0e0] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#777]">
                      Reclamação #{reclamacao.id}
                    </span>
                    <h2
                      id="reclamacao-detalhe-titulo"
                      className="mt-1 text-xl font-bold leading-tight text-[#333]"
                    >
                      {reclamacao.motivo}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        resolvida
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {rotuloStatus(reclamacao.status)}
                    </span>
                    {dados.reclamacaoMl && (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#3483fa]">
                        {etapa}
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-[#555]">
                  {reclamacao.descricao || 'Sem descrição informada.'}
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#eee] bg-[#fafafa] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">
                      Pedido no Mercado Livre
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-[#333]">
                      {reclamacao.pedido_id || 'Não vinculado'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#eee] bg-[#fafafa] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">
                      O comprador pediu
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-[#333]">
                      {resolucaoEsperada
                        ? rotuloResolucao(resolucaoEsperada.expected_resolution)
                        : 'Aguardando definição do Mercado Livre'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#777]">
                  <span>Aberta em {formatarData(reclamacao.data_reclamacao)}</span>
                  {reclamacao.resolvido_em && (
                    <span>
                      Resolvida em {formatarData(reclamacao.resolvido_em)}
                    </span>
                  )}
                  {venda?.data_venda && (
                    <span>Pedido em {formatarData(venda.data_venda)}</span>
                  )}
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-xl border border-[#e0e0e0] bg-white p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#333]">
                    <Package className="h-4 w-4 text-[#3483fa]" />
                    Produto do pedido
                  </h3>

                  <div className="mt-3 flex gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#eee] bg-[#f7f7f7]">
                      {peca?.imagem ? (
                        <img
                          src={peca.imagem}
                          alt={peca.nome || 'Produto'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#bbb]">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug text-[#333]">
                        {peca?.nome ||
                          venda?.itens?.[0]?.descricao ||
                          'Produto do anúncio'}
                      </p>
                      <p className="mt-1 text-xs text-[#777]">
                        {peca?.sku || venda?.itens?.[0]?.sku || 'Sem SKU'}
                        {peca?.carro ? ` • ${peca.carro}` : ''}
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#333]">
                        {formatarMoeda(venda?.valor ?? peca?.preco ?? 0)}
                      </p>
                      {Boolean(quantidade) && (
                        <p className="text-xs text-[#777]">
                          {quantidade} unidade(s)
                        </p>
                      )}
                    </div>
                  </div>

                  {venda?.itens && venda.itens.length > 1 && (
                    <div className="mt-3 space-y-2 border-t border-[#eee] pt-3">
                      {venda.itens.map((item) => (
                        <div
                          key={`${item.sku}-${item.descricao}`}
                          className="flex items-start justify-between gap-3 text-xs"
                        >
                          <span className="text-[#555]">
                            {item.quantidade}x {item.descricao || item.sku}
                          </span>
                          <span className="shrink-0 font-medium text-[#333]">
                            {formatarMoeda(
                              item.quantidade * item.preco_unitario
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-[#e0e0e0] bg-white p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#333]">
                    <UserRound className="h-4 w-4 text-[#3483fa]" />
                    Dados do comprador
                  </h3>

                  <div className="mt-3 space-y-3 text-xs">
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-[#999]">
                        Nome
                      </p>
                      <p className="mt-0.5 text-sm text-[#333]">
                        {venda?.cliente || 'Comprador não identificado'}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-[#999]">
                        CPF
                      </p>
                      <p className="mt-0.5 text-sm text-[#333]">
                        {venda?.cliente_cpf || 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-[#999]">
                        E-mail
                      </p>
                      <p className="mt-0.5 break-all text-sm text-[#333]">
                        {venda?.cliente_email || 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-[#999]">
                        Telefone
                      </p>
                      <p className="mt-0.5 text-sm text-[#333]">
                        {venda?.cliente_fone || 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-[#999]">
                        Endereço
                      </p>
                      <p className="mt-0.5 flex items-start gap-1.5 text-sm leading-relaxed text-[#333]">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3483fa]" />
                        {venda?.cliente_endereco || 'Endereço não informado'}
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <section className="rounded-xl border border-[#e0e0e0] bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#333]">
                  <Truck className="h-4 w-4 text-[#3483fa]" />
                  Pedido, pagamento e entrega
                </h3>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-[#eee] bg-[#fafafa] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">
                      Pedido
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#333]">
                      {venda?.order_id || reclamacao.pedido_id || '—'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#777]">
                      {venda?.status_label || venda?.status || 'Sem status'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#eee] bg-[#fafafa] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">
                      Pagamento
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#333]">
                      {rotuloPagamento(
                        pagamento?.metodo || venda?.metodo_pagamento
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#777]">
                      {formatarMoeda(pagamento?.valor ?? venda?.valor ?? 0)}
                      {Number(pagamento?.parcelas || 1) > 1
                        ? ` • ${pagamento?.parcelas}x`
                        : ''}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#eee] bg-[#fafafa] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">
                      Envio
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#333]">
                      {envio?.status_label || 'Sem envio registrado'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#777]">
                      {envio?.transportadora ||
                        envio?.modalidade ||
                        'Mercado Envios'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#eee] bg-[#fafafa] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">
                      Rastreio
                    </p>
                    <p className="mt-1 break-all text-xs font-semibold text-[#333]">
                      {envio?.rastreio || 'Não informado'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#777]">
                      {envio?.previsao
                        ? `Previsão ${formatarData(envio.previsao, false)}`
                        : envio?.modalidade || 'Sem previsão'}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-[#e0e0e0] bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#333]">
                  <MessageSquare className="h-4 w-4 text-[#3483fa]" />
                  Conversa da reclamação
                </h3>
                <p className="mt-1 text-xs text-[#777]">
                  Mensagens trocadas entre comprador, vendedor e Mercado Livre.
                </p>

                {dados.mensagens && dados.mensagens.length > 0 ? (
                  <ul
                    ref={mensagensRef}
                    className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[420px]"
                  >
                    {dados.mensagens.map((mensagem) => {
                      const remetente = String(
                        mensagem.remetente || ''
                      ).toLowerCase();
                      const doVendedor = remetente === 'respondent';
                      const doMediador = remetente === 'mediator';

                      return (
                        <li
                          key={mensagem.id}
                          className={`flex ${
                            doVendedor ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                              doVendedor
                                ? 'rounded-br-sm bg-[#e3f2fd] text-[#1a3a5c]'
                                : doMediador
                                  ? 'rounded-bl-sm border border-[#ffe08a] bg-[#fff8dd] text-[#5c4a00]'
                                  : 'rounded-bl-sm bg-[#f1f1f1] text-[#333]'
                            }`}
                          >
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                              {doVendedor
                                ? 'Você (vendedor)'
                                : doMediador
                                  ? 'Mercado Livre'
                                  : 'Comprador'}
                              {mensagem.data
                                ? ` • ${formatarData(mensagem.data, false)}`
                                : ''}
                            </p>
                            <p className="whitespace-pre-line leading-relaxed">
                              {mensagem.mensagem}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-lg bg-[#f7f7f7] px-3 py-2 text-xs text-[#777]">
                    Nenhuma mensagem trocada até agora. Use o campo abaixo para
                    falar com o mediador do Mercado Livre.
                  </p>
                )}

                {erroAcao && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{erroAcao}</span>
                  </div>
                )}

                {sucesso && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{sucesso}</span>
                  </div>
                )}

                {dados.podeResponder ? (
                  <div className="mt-3 rounded-xl border border-[#e0e0e0] bg-[#fafafa] p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {MODELOS_RESPOSTA.map((modelo) => (
                        <button
                          key={modelo.titulo}
                          type="button"
                          onClick={() => setResposta(modelo.texto)}
                          className="rounded-full border border-[#ddd] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#555] transition-colors hover:border-[#3483fa] hover:text-[#3483fa]"
                        >
                          {modelo.titulo}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={resposta}
                      onChange={(event) => setResposta(event.target.value)}
                      rows={4}
                      maxLength={4000}
                      placeholder="Escreva sua resposta ao mediador do Mercado Livre..."
                      className="mt-2 w-full resize-y rounded-lg border border-[#ddd] bg-white p-2.5 text-xs leading-relaxed text-[#333] outline-none transition-colors focus:border-[#3483fa] focus:ring-2 focus:ring-[#3483fa]/20"
                    />

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-[#999]">
                        {resposta.length}/4000 • enviado ao mediador do Mercado
                        Livre
                      </span>
                      <button
                        type="button"
                        onClick={() => void enviarResposta()}
                        disabled={!resposta.trim() || enviando}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#3483fa] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2968c8] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {enviando ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {enviando ? 'Enviando...' : 'Enviar ao Mercado Livre'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg border border-[#e0e0e0] bg-[#fafafa] px-3 py-2 text-xs text-[#777]">
                    O Mercado Livre não liberou o envio de mensagens para este
                    caso agora. Acompanhe a decisão pela Central de
                    reclamações.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-[#e0e0e0] bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#333]">Histórico do caso</h3>

                <ol className="mt-4 space-y-4">
                  {dados.timeline.map((evento, indice) => {
                    const Icone = iconeTimeline(evento.tipo);
                    const ultimo = indice === dados.timeline.length - 1;

                    return (
                      <li key={`${evento.tipo}-${indice}`} className="relative flex gap-3">
                        {!ultimo && (
                          <span className="absolute left-[15px] top-8 h-[calc(100%+4px)] w-px bg-[#e0e0e0]" />
                        )}
                        <span
                          className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            evento.tipo === 'resolucao'
                              ? 'bg-green-100 text-green-700'
                              : evento.tipo === 'reclamacao'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-50 text-[#3483fa]'
                          }`}
                        >
                          <Icone className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 pb-1">
                          <p className="text-sm font-semibold text-[#333]">
                            {evento.titulo}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#666]">
                            {evento.descricao}
                          </p>
                          <p className="mt-1 text-[11px] text-[#999]">
                            {formatarData(evento.data)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-[#e0e0e0] bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={
                reclamacao?.pedido_id
                  ? `https://www.mercadolivre.com.br/vendas/${reclamacao.pedido_id}`
                  : 'https://www.mercadolivre.com.br/vendas'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#3483fa] hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir no Mercado Livre
            </a>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#ddd] bg-white px-4 py-2 text-sm font-semibold text-[#555] transition-colors hover:bg-[#f5f5f5]"
              >
                Fechar
              </button>
              {!resolvida && (
                <button
                  type="button"
                  onClick={() => void resolver()}
                  disabled={resolvendo}
                  title="Marca a reclamação como resolvida apenas no site. O caso continua no Mercado Livre."
                  className="inline-flex items-center gap-2 rounded-lg bg-[#3483fa] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2968c8] disabled:opacity-60"
                >
                  {resolvendo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {resolvendo ? 'Registrando...' : 'Registrar resolução no site'}
                </button>
              )}
            </div>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-[#999]">
            A resolução registrada aqui organiza o atendimento no site. O
            encerramento, reembolso ou devolução oficial continua sendo
            decidido pelo Mercado Livre na Central de reclamações.
          </p>
        </footer>
      </div>
    </div>,
    document.body
  );
}
