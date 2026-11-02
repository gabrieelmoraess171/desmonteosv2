import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  KeyRound,
  Link2,
  Loader2,
  MessageSquare,
  Package,
  Plug,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Unplug,
  XCircle,
  Zap,
} from 'lucide-react';
import ReputacaoMl, {
  type ReputacaoMlData,
} from '../components/dashboard/ReputacaoMl';

interface Sincronizacao {
  id: number;
  recurso: string;
  status: string;
  itens: number;
  criados: number;
  atualizados: number;
  ignorados: number;
  mensagem?: string | null;
  iniciado_em?: string | null;
  finalizado_em?: string | null;
}

interface StatusMercadoLivre {
  configurado: boolean;
  origemConfiguracao: 'env' | 'banco' | null;
  clientId: string;
  clientSecretConfigurado: boolean;
  redirectUri: string;
  redirectUriLocal?: boolean;
  webhookUrl: string;
  siteId: string;
  conectado: boolean;
  conta: {
    user_id: string;
    nickname: string;
    email: string;
    site_id: string;
    conectado_em: string;
    atualizado_em: string;
    expires_at: string;
    expirado: boolean;
    erro?: string | null;
  } | null;
  contagens: {
    anuncios: number;
    pedidos: number;
    perguntasPendentes: number;
    reclamacoesAbertas: number;
  };
  reputacaoAtualizadaEm: string | null;
  ultimaSincronizacao: Sincronizacao | null;
  historico: Sincronizacao[];
  ultimasPorRecurso?: Sincronizacao[];
}

interface ResultadoSincronizacao {
  recurso: string;
  status: string;
  itens?: number;
  criados?: number;
  atualizados?: number;
  ignorados?: number;
  mensagem?: string;
}

const RECURSOS = [
  {
    chave: 'pecas',
    label: 'Anúncios e estoque',
    descricao: 'Títulos, preços, quantidade e status dos anúncios.',
    icon: Package,
  },
  {
    chave: 'vendas',
    label: 'Pedidos e vendas',
    descricao: 'Pedidos dos últimos 30 dias, comprador, frete e taxas.',
    icon: ShoppingBag,
  },
  {
    chave: 'perguntas',
    label: 'Perguntas',
    descricao: 'Perguntas novas e atualização das já respondidas.',
    icon: MessageSquare,
  },
  {
    chave: 'reclamacoes',
    label: 'Reclamações',
    descricao: 'Mediações e disputas abertas no pós-venda.',
    icon: AlertTriangle,
  },
  {
    chave: 'reputacao',
    label: 'Reputação',
    descricao: 'Termômetro, selos e métricas reais do vendedor.',
    icon: ShieldCheck,
  },
];

const LABEL_RECURSO: Record<string, string> = {
  pecas: 'Anúncios',
  vendas: 'Pedidos',
  envios: 'Envios',
  perguntas: 'Perguntas',
  reclamacoes: 'Reclamações',
  reputacao: 'Reputação',
};

const LABEL_STATUS: Record<string, string> = {
  sucesso: 'Concluída',
  erro: 'Erro',
  ignorado: 'Ignorada',
  executando: 'Em andamento',
};

function formatarData(valor?: string | null) {
  if (!valor) return '—';

  const data = new Date(String(valor).replace(' ', 'T'));

  if (Number.isNaN(data.getTime())) return String(valor);

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarNumero(valor?: number | null) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

function corStatus(status?: string) {
  if (status === 'sucesso') return 'success';
  if (status === 'erro') return 'danger';
  if (status === 'executando') return 'accent';
  return 'warning';
}

function BadgeStatus({ status }: { status?: string }) {
  const cor = corStatus(status);
  const classes =
    cor === 'success'
      ? 'border-success/20 bg-successSoft text-success'
      : cor === 'danger'
        ? 'border-danger/20 bg-dangerSoft text-danger'
        : cor === 'accent'
          ? 'border-accent/20 bg-accentSoft text-accent'
          : 'border-warning/20 bg-warningSoft text-warning';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${classes}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABEL_STATUS[status || ''] || status || 'Pendente'}
    </span>
  );
}

function StatCard({
  titulo,
  valor,
  detalhe,
  icon: Icon,
  cor,
  onClick,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  icon: typeof Package;
  cor: 'accent' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  const tons = {
    accent: 'bg-accentSoft text-accent',
    success: 'bg-successSoft text-success',
    warning: 'bg-warningSoft text-warning',
    danger: 'bg-dangerSoft text-danger',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border border-line bg-card p-4 text-left shadow-lg shadow-black/20 transition-all ${
        onClick
          ? 'hover:-translate-y-0.5 hover:border-accent/35 hover:bg-white/[0.045]'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {titulo}
          </p>
          <p className="mt-2 text-3xl font-bold leading-none text-ink">
            {formatarNumero(valor)}
          </p>
        </div>
        <span className={`rounded-xl p-2.5 ${tons[cor]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 flex items-center justify-between gap-2 text-xs leading-relaxed text-muted">
        <span>{detalhe}</span>
        {onClick && (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        )}
      </p>
    </button>
  );
}

interface MarketplacesPageProps {
  onOpenSettings?: () => void;
  onNavigate?: (
    chave: 'editor' | 'pedidos' | 'atendimento' | 'lotes' | 'relatorios'
  ) => void;
  onMetricClick?: (chave: string) => void;
}

export default function MarketplacesPage({
  onOpenSettings,
  onNavigate,
  onMetricClick,
}: MarketplacesPageProps) {
  const [status, setStatus] = useState<StatusMercadoLivre | null>(null);
  const [reputacao, setReputacao] = useState<ReputacaoMlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [sincronizando, setSincronizando] = useState<string | null>(null);
  const [desconectando, setDesconectando] = useState(false);
  const [copiado, setCopiado] = useState('');
  // Motivo devolvido pelo callback OAuth, exibido separado do "erro" para não
  // ser apagado pelo carregamento do status.
  const [motivoOauth, setMotivoOauth] = useState('');

  const carregarStatus = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);

    try {
      const [statusRes, reputacaoRes] = await Promise.all([
        axios.get<StatusMercadoLivre>('/api/mercadolivre/status', {
          timeout: 12000,
        }),
        axios
          .get<{ reputacao: ReputacaoMlData | null }>(
            '/api/mercadolivre/reputacao',
            { timeout: 15000 }
          )
          .catch(() => null),
      ]);

      setStatus(statusRes.data);
      setReputacao(reputacaoRes?.data?.reputacao || null);

      if (!silencioso) setErro('');
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível carregar o status da integração.'
        );
      } else {
        setErro('Não foi possível carregar o status da integração.');
      }
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarStatus();
  }, [carregarStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get('ml');

    if (resultado === 'conectado') {
      setAviso(
        'Conta do Mercado Livre conectada. Clique em "Sincronizar tudo" para importar anúncios, pedidos, perguntas e reputação.'
      );
    } else if (resultado === 'erro') {
      setMotivoOauth(
        params.get('motivo') ||
          'Não foi possível conectar a conta do Mercado Livre.'
      );
    }

    if (resultado) {
      params.delete('ml');
      params.delete('motivo');
      const consulta = params.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${consulta ? `?${consulta}` : ''}`
      );
    }
  }, []);

  const handleConectar = async () => {
    setErro('');
    setAviso('');
    setMotivoOauth('');

    try {
      const { data } = await axios.get<{ url: string }>(
        '/api/mercadolivre/oauth/iniciar',
        { timeout: 12000 }
      );

      window.location.href = data.url;
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível iniciar a conexão com o Mercado Livre.'
        );
      } else {
        setErro('Não foi possível iniciar a conexão com o Mercado Livre.');
      }
    }
  };

  const handleDesconectar = async () => {
    const confirmado = window.confirm(
      'Desconectar a conta do Mercado Livre? Os dados já importados continuam no sistema.'
    );

    if (!confirmado) return;

    setDesconectando(true);
    setErro('');
    setAviso('');

    try {
      const { data } = await axios.post<{
        ok: boolean;
        status: StatusMercadoLivre;
      }>('/api/mercadolivre/desconectar');

      setStatus(data.status);
      setReputacao(null);
      setAviso('Conta desconectada. Você pode conectar novamente quando quiser.');
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível desconectar a conta.'
        );
      } else {
        setErro('Não foi possível desconectar a conta.');
      }
    } finally {
      setDesconectando(false);
    }
  };

  const handleSincronizar = async (recurso?: string) => {
    setSincronizando(recurso || 'tudo');
    setErro('');
    setAviso('');

    try {
      const { data } = await axios.post<{
        ok: boolean;
        resultados?: ResultadoSincronizacao[];
      }>(
        '/api/mercadolivre/sincronizar',
        recurso ? { recursos: [recurso] } : {},
        { timeout: 300000 }
      );

      const resultados = data.resultados || [];
      const falhas = resultados.filter(
        (resultado) => resultado.status === 'erro'
      );

      if (falhas.length > 0) {
        setErro(
          falhas
            .map(
              (falha) =>
                `${LABEL_RECURSO[falha.recurso] || falha.recurso}: ${
                  falha.mensagem || 'erro na sincronização'
                }`
            )
            .join(' • ')
        );
      } else {
        const total = resultados.reduce(
          (soma, resultado) => soma + Number(resultado.itens || 0),
          0
        );
        setAviso(
          `Sincronização concluída: ${formatarNumero(
            total
          )} item(ns) processado(s).`
        );
      }

      await carregarStatus(true);
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível sincronizar com o Mercado Livre.'
        );
      } else {
        setErro('Não foi possível sincronizar com o Mercado Livre.');
      }
    } finally {
      setSincronizando(null);
    }
  };

  const copiar = async (texto: string, chave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      window.setTimeout(() => setCopiado(''), 2000);
    } catch {
      setErro('Não foi possível copiar. Selecione o texto manualmente.');
    }
  };

  if (loading && !status) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-5 py-4 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          Carregando integração com o Mercado Livre...
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-2xl border border-danger/20 bg-dangerSoft p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-danger">
          <XCircle className="h-4 w-4" />
          {erro || 'Não foi possível carregar a integração.'}
        </p>
        <button
          type="button"
          onClick={() => void carregarStatus()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-ink hover:bg-line"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const webhookUrl =
    status.webhookUrl || 'https://desmonteos-backend.onrender.com/api/mercadolivre/webhook';
  const conectado = status.conectado;
  const configurado = status.configurado;
  const credenciaisEnv = status.origemConfiguracao === 'env';
  const ultimaPorRecurso = new Map(
    (status.ultimasPorRecurso?.length
      ? status.ultimasPorRecurso
      : status.historico
    ).map((item) => [item.recurso, item])
  );

  return (
    <div className="space-y-6">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-ml/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-ml/25 bg-ml/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ml">
              <Store className="h-3.5 w-3.5" />
              Integração oficial
            </span>
            <h2 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">
              Mercado Livre
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Conecte sua conta para importar anúncios, pedidos, perguntas e
              reputação. O estoque, o Atendimento e os Relatórios passam a usar
              os dados reais do vendedor.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  conectado
                    ? 'border-success/20 bg-successSoft text-success'
                    : configurado
                      ? 'border-warning/20 bg-warningSoft text-warning'
                      : 'border-danger/20 bg-dangerSoft text-danger'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {conectado
                  ? 'Conta conectada'
                  : configurado
                    ? 'Aguardando conexão'
                    : 'Credenciais pendentes'}
              </span>

              {status.origemConfiguracao && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <KeyRound className="h-3.5 w-3.5" />
                  Credenciais via{' '}
                  {status.origemConfiguracao === 'env' ? '.env' : 'painel'}
                </span>
              )}
            </div>

            {status.redirectUriLocal && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-dangerSoft px-3.5 py-3 text-xs leading-relaxed text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  A Redirect URI configurada é local (
                  <span className="font-mono">{status.redirectUri}</span>) e o
                  Mercado Livre bloqueia esse endereço com{' '}
                  <strong>403 ERROR / Request blocked (CloudFront)</strong>.
                  Exponha o backend em uma URL HTTPS pública (cloudflared ou
                  ngrok), cadastre essa URL no aplicativo do Mercado Livre e
                  salve a mesma URL como Redirect URI em Configurações.
                </span>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[280px]">
            {conectado ? (
              <>
                <div className="rounded-2xl border border-success/20 bg-successSoft/60 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-success">
                    Vendedor conectado
                  </p>
                  <p className="mt-1 truncate text-lg font-bold text-ink">
                    {status.conta?.nickname || 'Conta Mercado Livre'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    ID {status.conta?.user_id} • {status.conta?.site_id}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    Token expira em{' '}
                    {formatarData(status.conta?.expires_at)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSincronizar()}
                  disabled={sincronizando !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sincronizando === 'tudo' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  {sincronizando === 'tudo'
                    ? 'Sincronizando...'
                    : 'Sincronizar tudo'}
                </button>

                <button
                  type="button"
                  onClick={() => void handleDesconectar()}
                  disabled={desconectando}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-muted transition hover:border-danger/30 hover:text-danger disabled:opacity-60"
                >
                  {desconectando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="h-4 w-4" />
                  )}
                  Desconectar conta
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleConectar()}
                  disabled={!configurado}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plug className="h-4 w-4" />
                  Conectar conta
                </button>

                {!configurado && (
                  <div className="space-y-2 text-center">
                    <p className="text-xs leading-relaxed text-muted">
                      As credenciais ficam em Configurações e só aparecem depois
                      de desbloquear com o PIN do proprietário.
                    </p>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="inline-flex items-center gap-2 rounded-lg border border-accent/25 bg-accentSoft px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Abrir Configurações
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {(erro || motivoOauth || aviso) && (
        <div
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
            erro || motivoOauth
              ? 'border-danger/20 bg-dangerSoft text-danger'
              : 'border-success/20 bg-successSoft text-success'
          }`}
        >
          {erro || motivoOauth ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{erro || motivoOauth || aviso}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          titulo="Anúncios vinculados"
          valor={status.contagens.anuncios}
          detalhe="Abrir o editor de anúncios."
          icon={Package}
          cor="accent"
          onClick={() => onNavigate?.('editor')}
        />
        <StatCard
          titulo="Pedidos importados"
          valor={status.contagens.pedidos}
          detalhe="Abrir pedidos e notas fiscais."
          icon={ShoppingBag}
          cor="success"
          onClick={() => onNavigate?.('pedidos')}
        />
        <StatCard
          titulo="Perguntas pendentes"
          valor={status.contagens.perguntasPendentes}
          detalhe="Responder no Atendimento."
          icon={MessageSquare}
          cor="warning"
          onClick={() => onMetricClick?.('perguntas')}
        />
        <StatCard
          titulo="Reclamações abertas"
          valor={status.contagens.reclamacoesAbertas}
          detalhe="Tratar no Atendimento."
          icon={AlertTriangle}
          cor="danger"
          onClick={() => onMetricClick?.('reclamacoes')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 xl:col-span-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                <RefreshCw className="h-3.5 w-3.5 text-accent" />
                Sincronização
              </p>
              <h3 className="mt-1 text-xl font-bold">Importar dados do ML</h3>
              <p className="text-sm text-muted">
                Cada recurso pode ser sincronizado separadamente. Clique no
                recurso para abrir a aba correspondente.
              </p>
            </div>

            {conectado && (
              <button
                type="button"
                onClick={() => void handleSincronizar()}
                disabled={sincronizando !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {sincronizando === 'tudo' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                Sincronizar tudo
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {RECURSOS.map((recurso) => {
              const Icone = recurso.icon;
              const ultima = ultimaPorRecurso.get(recurso.chave);
              const abrirRecurso = () => {
                if (recurso.chave === 'pecas') onNavigate?.('editor');
                else if (recurso.chave === 'vendas') onNavigate?.('pedidos');
                else if (recurso.chave === 'perguntas')
                  onMetricClick?.('perguntas');
                else if (recurso.chave === 'reclamacoes')
                  onMetricClick?.('reclamacoes');
                else onMetricClick?.('reputacao');
              };

              return (
                <div
                  key={recurso.chave}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-accent/30"
                >
                  <button
                    type="button"
                    onClick={abrirRecurso}
                    className="group flex min-w-0 items-start gap-3 text-left"
                  >
                    <span className="rounded-lg bg-accentSoft p-2 text-accent">
                      <Icone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                        {recurso.label}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                      </p>
                      <p className="text-xs leading-relaxed text-muted">
                        {recurso.descricao}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <BadgeStatus status={ultima?.status} />
                        <span className="text-[10px] text-muted">
                          {ultima
                            ? `${formatarNumero(ultima.itens)} item(ns) • ${formatarData(
                                ultima.finalizado_em || ultima.iniciado_em
                              )}`
                            : 'Nunca sincronizado'}
                        </span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSincronizar(recurso.chave)}
                    disabled={!conectado || sincronizando !== null}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent/40 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sincronizando === recurso.chave ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Sincronizar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {reputacao && (
        <ReputacaoMl
          reputacao={reputacao}
          onMetricClick={onMetricClick}
        />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 xl:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                <Clock className="h-3.5 w-3.5 text-cyan" />
                Histórico
              </p>
              <h3 className="mt-1 text-xl font-bold">Últimas sincronizações</h3>
            </div>
          </div>

          {status.historico.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-line p-8 text-center">
              <RefreshCw className="mx-auto h-7 w-7 text-muted" />
              <p className="mt-2 text-sm font-medium">
                Nenhuma sincronização realizada
              </p>
              <p className="mt-1 text-xs text-muted">
                Conecte a conta e clique em “Sincronizar tudo”.
              </p>
            </div>
          ) : (
            <>
            <ul className="mt-4 divide-y divide-white/5 lg:hidden">
              {status.historico.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-medium text-ink">
                      {LABEL_RECURSO[item.recurso] || item.recurso}
                    </p>
                    <BadgeStatus status={item.status} />
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[11px]">
                    <div>
                      <dt className="text-muted">Itens</dt>
                      <dd className="mt-0.5 font-semibold text-ink">
                        {formatarNumero(item.itens)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Novos</dt>
                      <dd className="mt-0.5 font-semibold text-success">
                        {formatarNumero(item.criados)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Atualizados</dt>
                      <dd className="mt-0.5 font-semibold text-accent">
                        {formatarNumero(item.atualizados)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-1.5 text-[11px] text-muted">
                    {formatarData(item.finalizado_em || item.iniciado_em)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-4 hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-muted">
                    <th className="pb-2 font-semibold">Recurso</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Itens</th>
                    <th className="pb-2 text-right font-semibold">Novos</th>
                    <th className="pb-2 text-right font-semibold">Atualizados</th>
                    <th className="pb-2 text-right font-semibold">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {status.historico.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="py-2.5 font-medium text-ink">
                        {LABEL_RECURSO[item.recurso] || item.recurso}
                      </td>
                      <td className="py-2.5">
                        <BadgeStatus status={item.status} />
                      </td>
                      <td className="py-2.5 text-right text-muted">
                        {formatarNumero(item.itens)}
                      </td>
                      <td className="py-2.5 text-right text-success">
                        {formatarNumero(item.criados)}
                      </td>
                      <td className="py-2.5 text-right text-accent">
                        {formatarNumero(item.atualizados)}
                      </td>
                      <td className="py-2.5 text-right text-muted">
                        {formatarData(
                          item.finalizado_em || item.iniciado_em
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {status.ultimaSincronizacao?.mensagem && (
            <p className="mt-3 rounded-lg border border-danger/20 bg-dangerSoft px-3 py-2 text-[11px] leading-relaxed text-danger">
              {status.ultimaSincronizacao.mensagem}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 xl:col-span-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            <Link2 className="h-3.5 w-3.5 text-accent" />
            Como conectar
          </p>
          <h3 className="mt-1 text-xl font-bold">Passo a passo</h3>

          <ol className="mt-4 space-y-3">
            {[
              {
                titulo: 'Crie o aplicativo',
                texto:
                  'Acesse o portal de desenvolvedores do Mercado Livre e crie um aplicativo para o seu vendedor.',
              },
              {
                titulo: 'Configure a Redirect URI',
                texto:
                  'Ela precisa ser uma URL HTTPS pública e idêntica à cadastrada no aplicativo. localhost e 127.0.0.1 são bloqueados pelo Mercado Livre com erro 403 (CloudFront).',
              },
              {
                titulo: 'Salve as credenciais',
                texto:
                  'Abra Configurações, desbloqueie o acesso do proprietário com o PIN e salve o Client ID e o Client Secret. A seção só aparece depois do desbloqueio.',
              },
              {
                titulo: 'Conecte a conta',
                texto:
                  'Clique em “Conectar conta” e autorize o acesso. O token é renovado automaticamente.',
              },
              {
                titulo: 'Sincronize',
                texto:
                  'Clique em “Sincronizar tudo”. Depois, o Atendimento já envia respostas reais ao ML.',
              },
            ].map((passo, indice) => (
              <li key={passo.titulo} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accentSoft text-[11px] font-bold text-accent">
                  {indice + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {passo.titulo}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {passo.texto}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-xl border border-warning/20 bg-warningSoft px-3.5 py-3 text-[11px] leading-relaxed text-warning">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              O Mercado Livre exige HTTPS e recusa Redirect URI em localhost. Para
              conectar em produção, cadastre a URL do backend público
              https://desmonteos-backend.onrender.com com o caminho do callback
              no aplicativo e use a mesma em Configurações →
              Redirect URI.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
