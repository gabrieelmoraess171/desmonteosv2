import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import axios from 'axios';

interface Aprovacao {
  id: number;
  peca_id: number;
  peca_nome: string;
  sku?: string | null;
  ml_item_id?: string | null;
  ml_thumbnail?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  preco?: number | null;
  quantidade?: number | null;
  ml_ativo?: number | null;
  observacao?: string | null;
  status: string;
  criado_em: string;
  titulo_atual?: string | null;
  descricao_atual?: string | null;
  preco_atual?: number | null;
  quantidade_atual?: number | null;
  ml_ativo_atual?: number | null;
}

interface RespostaAprovacoes {
  aprovacoes: Aprovacao[];
  resumo: {
    pendentes: number;
    aprovadas: number;
    rejeitadas: number;
  };
}

interface FilaAprovacaoPageProps {
  onOpenEditor?: () => void;
}

interface Mudanca {
  label: string;
  atual: string;
  novo: string;
}

function formatarMoeda(valor?: number | null): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function formatarData(valor?: string | null): string {
  if (!valor) return '—';

  const data = new Date(String(valor).replace(' ', 'T'));

  if (Number.isNaN(data.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function statusAnuncio(valor?: number | null): string {
  return Number(valor) ? 'Ativo' : 'Pausado';
}

function mudancasDaAprovacao(aprovacao: Aprovacao): Mudanca[] {
  const mudancas: Mudanca[] = [];
  const tituloAtual = aprovacao.titulo_atual || aprovacao.peca_nome || '—';
  const descricaoAtual = aprovacao.descricao_atual || '—';

  if (
    aprovacao.titulo !== null &&
    aprovacao.titulo !== undefined &&
    aprovacao.titulo !== tituloAtual
  ) {
    mudancas.push({
      label: 'Título',
      atual: tituloAtual,
      novo: aprovacao.titulo,
    });
  }

  if (
    aprovacao.descricao !== null &&
    aprovacao.descricao !== undefined &&
    aprovacao.descricao !== descricaoAtual
  ) {
    mudancas.push({
      label: 'Descrição',
      atual: descricaoAtual,
      novo: aprovacao.descricao,
    });
  }

  if (
    aprovacao.preco !== null &&
    aprovacao.preco !== undefined &&
    Number(aprovacao.preco) !== Number(aprovacao.preco_atual)
  ) {
    mudancas.push({
      label: 'Preço',
      atual: formatarMoeda(aprovacao.preco_atual),
      novo: formatarMoeda(aprovacao.preco),
    });
  }

  if (
    aprovacao.quantidade !== null &&
    aprovacao.quantidade !== undefined &&
    Number(aprovacao.quantidade) !== Number(aprovacao.quantidade_atual)
  ) {
    mudancas.push({
      label: 'Estoque',
      atual: String(aprovacao.quantidade_atual ?? 0),
      novo: String(aprovacao.quantidade),
    });
  }

  if (
    aprovacao.ml_ativo !== null &&
    aprovacao.ml_ativo !== undefined &&
    Number(aprovacao.ml_ativo) !== Number(aprovacao.ml_ativo_atual)
  ) {
    mudancas.push({
      label: 'Status do anúncio',
      atual: statusAnuncio(aprovacao.ml_ativo_atual),
      novo: statusAnuncio(aprovacao.ml_ativo),
    });
  }

  return mudancas;
}

export default function FilaAprovacaoPage({
  onOpenEditor,
}: FilaAprovacaoPageProps) {
  const [dados, setDados] = useState<RespostaAprovacoes>({
    aprovacoes: [],
    resumo: { pendentes: 0, aprovadas: 0, rejeitadas: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [processando, setProcessando] = useState<{
    id: number;
    acao: 'aprovar' | 'rejeitar';
  } | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setErro('');

    try {
      const { data } = await axios.get<RespostaAprovacoes>('/api/aprovacoes', {
        timeout: 15000,
      });

      setDados(data);
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível carregar a fila de aprovação.'
        );
      } else {
        setErro('Não foi possível carregar a fila de aprovação.');
      }
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const decidir = async (
    aprovacao: Aprovacao,
    acao: 'aprovar' | 'rejeitar'
  ) => {
    const confirmado = window.confirm(
      acao === 'aprovar'
        ? `Aprovar e aplicar as alterações em "${aprovacao.peca_nome}"?${
            aprovacao.ml_item_id
              ? ' O anúncio será atualizado no Mercado Livre.'
              : ''
          }`
        : `Rejeitar as alterações de "${aprovacao.peca_nome}"?`
    );

    if (!confirmado) return;

    setProcessando({ id: aprovacao.id, acao });
    setErro('');
    setAviso('');

    try {
      const { data } = await axios.post<{ mensagem?: string }>(
        `/api/aprovacoes/${aprovacao.id}/${acao}`,
        {},
        { timeout: 30000 }
      );

      setAviso(
        data.mensagem ||
          (acao === 'aprovar'
            ? 'Alterações aprovadas e aplicadas.'
            : 'Alterações rejeitadas.')
      );
      await carregar(true);
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível concluir a aprovação.'
        );
      } else {
        setErro('Não foi possível concluir a aprovação.');
      }
    } finally {
      setProcessando(null);
    }
  };

  const resumo = [
    {
      label: 'Pendentes',
      valor: dados.resumo.pendentes,
      icon: Clock,
      cor: 'text-warning',
      fundo: 'bg-warningSoft border-warning/20',
    },
    {
      label: 'Aprovadas',
      valor: dados.resumo.aprovadas,
      icon: CheckCircle2,
      cor: 'text-success',
      fundo: 'bg-successSoft border-success/20',
    },
    {
      label: 'Rejeitadas',
      valor: dados.resumo.rejeitadas,
      icon: XCircle,
      cor: 'text-danger',
      fundo: 'bg-dangerSoft border-danger/20',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-success/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-successSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              Revisão antes de publicar
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Fila de aprovação
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Tudo o que o editor de anúncios propõe chega aqui. Aprove para
              aplicar no Mercado Livre ou rejeite para descartar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenEditor && (
              <button
                type="button"
                onClick={onOpenEditor}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/[0.09] hover:text-ink"
              >
                <Send className="h-4 w-4" />
                Abrir editor
              </button>
            )}
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {resumo.map((item) => {
          const Icone = item.icon;

          return (
            <div
              key={item.label}
              className={`rounded-2xl border p-4 shadow-lg shadow-black/20 ${item.fundo}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {item.label}
                  </p>
                  <p className={`mt-2 text-3xl font-bold leading-none ${item.cor}`}>
                    {item.valor}
                  </p>
                </div>
                <Icone className={`h-5 w-5 ${item.cor}`} />
              </div>
            </div>
          );
        })}
      </div>

      {(erro || aviso) && (
        <div
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
            erro
              ? 'border-danger/25 bg-dangerSoft text-danger'
              : 'border-success/25 bg-successSoft text-success'
          }`}
        >
          {erro ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{erro || aviso}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-card py-16 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          Carregando aprovações...
        </div>
      ) : dados.aprovacoes.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center shadow-lg shadow-black/20">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h3 className="mt-3 text-xl font-bold">Nenhuma aprovação pendente</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Quando você enviar alterações pelo editor de anúncios, elas aparecem
            aqui para revisão antes de chegar ao Mercado Livre.
          </p>
          {onOpenEditor && (
            <button
              type="button"
              onClick={onOpenEditor}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              <Send className="h-4 w-4" />
              Abrir editor de anúncios
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {dados.aprovacoes.map((aprovacao) => {
            const mudancas = mudancasDaAprovacao(aprovacao);
            const ocupado = processando?.id === aprovacao.id;

            return (
              <article
                key={aprovacao.id}
                className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-secondary">
                      {aprovacao.ml_thumbnail ? (
                        <img
                          src={aprovacao.ml_thumbnail}
                          alt={aprovacao.peca_nome}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-bold text-ink">
                          {aprovacao.peca_nome}
                        </h3>
                        <span className="rounded-full border border-warning/20 bg-warningSoft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-warning">
                          Pendente
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {aprovacao.sku || 'Sem SKU'} •{' '}
                        {aprovacao.ml_item_id || 'Sem vínculo ML'} • enviado em{' '}
                        {formatarData(aprovacao.criado_em)}
                      </p>
                      {aprovacao.observacao && (
                        <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-muted">
                          <span className="font-semibold text-ink">
                            Observação:
                          </span>{' '}
                          {aprovacao.observacao}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void decidir(aprovacao, 'aprovar')}
                      disabled={Boolean(processando)}
                      className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {ocupado && processando?.acao === 'aprovar' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Aprovar e aplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => void decidir(aprovacao, 'rejeitar')}
                      disabled={Boolean(processando)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-muted transition hover:border-danger/30 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {ocupado && processando?.acao === 'rejeitar' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      Rejeitar
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Alterações propostas
                  </p>

                  {mudancas.length === 0 ? (
                    <p className="mt-2 rounded-xl border border-dashed border-line p-4 text-xs text-muted">
                      Nenhuma diferença em relação ao anúncio atual. Você pode
                      aprovar para registrar a revisão ou rejeitar.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {mudancas.map((mudanca) => (
                        <div
                          key={mudanca.label}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                            {mudanca.label}
                          </p>
                          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted/70">
                                Atual
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
                                {mudanca.atual}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-success">
                                Proposto
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink">
                                {mudanca.novo}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
