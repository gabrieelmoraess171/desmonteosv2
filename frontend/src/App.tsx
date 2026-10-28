import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  AlertTriangle,
  DollarSign,
  ExternalLink,
  ImagePlus,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react';
import PecasTable from './components/PecasTable';
import ImportLotPage from './pages/ImportLotPage';
import ConfiguracoesPage from './pages/ConfiguracoesPage';
import NFePage from './pages/NFePage';
import AtendimentoPage from './pages/AtendimentoPage';
import NovaPecaPage from './pages/NovaPecaPage';
import RelatoriosPage from './pages/RelatoriosPage';
import MarketplacesPage from './pages/MarketplacesPage';
import AnaliseIaPage from './pages/AnaliseIaPage';
import EditorAnunciosPage from './pages/EditorAnunciosPage';
import FilaAprovacaoPage from './pages/FilaAprovacaoPage';
import ConnectionMonitor from './components/ConnectionMonitor';
import Onboarding from './components/Onboarding';
import DashboardCard from './components/DashboardCard';
import DashboardGreeting from './components/DashboardGreeting';
import RevenueChart, {
  type PeriodoDashboard,
  type SeriePonto,
} from './components/dashboard/RevenueChart';
import StockHealth, {
  type EstoqueResumo,
} from './components/dashboard/StockHealth';
import TopTiposPeca, {
  type TipoPecaRanking,
} from './components/dashboard/TopTiposPeca';
import ReputacaoMl, {
  type ReputacaoMlData,
} from './components/dashboard/ReputacaoMl';
import InsightsPanel, {
  type InsightDashboard,
} from './components/dashboard/InsightsPanel';
import Sidebar, { NAV_ITEMS, type SidebarKey } from './components/Sidebar';
import {
  DEFAULT_COMPANY_NAME,
  OWNER_HEADER,
  SESSION_KEYS,
  STORAGE_KEYS,
} from './config/app';
import axios from 'axios';

interface DashboardStats {
  totalPecas: number;
  totalVendas: number;
  vendasHoje: number;
  faturamentoHoje: number;
  valorTotal: number;
  vendasML: number;
  faturamentoML: number;
  faturamentoMLTaxas: number;
  faturamentoMLLiquido: number;
  faturamentoMLCancelado: number;
  vendasMLCanceladas: number;
  vendasHojeML: number;
  anunciosAtivos: number;
  anunciosRevisar: number;
  perguntasPendentes: number;
  perguntasHoje: number;
  reclamacoesAbertas: number;
  reclamacoesHoje: number;
}

const initialStats: DashboardStats = {
  totalPecas: 0,
  totalVendas: 0,
  vendasHoje: 0,
  faturamentoHoje: 0,
  valorTotal: 0,
  vendasML: 0,
  faturamentoML: 0,
  faturamentoMLTaxas: 0,
  faturamentoMLLiquido: 0,
  faturamentoMLCancelado: 0,
  vendasMLCanceladas: 0,
  vendasHojeML: 0,
  anunciosAtivos: 0,
  anunciosRevisar: 0,
  perguntasPendentes: 0,
  perguntasHoje: 0,
  reclamacoesAbertas: 0,
  reclamacoesHoje: 0,
};

interface AnalyticsData {
  periodo: {
    chave: string;
    label: string;
    dias: number;
    descricao: string;
  };
  periodoDias: number;
  serie: SeriePonto[];
  totais: {
    faturamentoPeriodo: number;
    vendasPeriodo: number;
    ticketMedioPeriodo: number;
    variacaoFaturamento: number | null;
    variacaoVendas: number | null;
    variacaoTicketMedio: number | null;
  };
  hoje: {
    vendas: number;
    faturamento: number;
  };
  estoque: EstoqueResumo;
  topTiposPeca: TipoPecaRanking[];
  reputacao: ReputacaoMlData;
  recentes: Array<{
    id: number;
    order_id?: string | null;
    valor: number;
    status: string;
    data_venda: string;
    plataforma?: string | null;
    cliente?: string | null;
    peca_nome?: string | null;
  }>;
  insights: InsightDashboard[];
}

const initialAnalytics: AnalyticsData = {
  periodo: { chave: '7', label: '7 dias', dias: 7, descricao: 'Últimos 7 dias' },
  periodoDias: 7,
  serie: [],
  totais: {
    faturamentoPeriodo: 0,
    vendasPeriodo: 0,
    ticketMedioPeriodo: 0,
    variacaoFaturamento: null,
    variacaoVendas: null,
    variacaoTicketMedio: null,
  },
  hoje: { vendas: 0, faturamento: 0 },
  estoque: {
    pecas: 0,
    unidades: 0,
    valor: 0,
    disponiveis: 0,
    esgotadas: 0,
    anuncios: 0,
    anunciosDisponiveis: 0,
    anunciosEsgotados: 0,
    foraML: 0,
    anunciosRevisar: 0,
  },
  topTiposPeca: [],
  reputacao: {
    score: 0,
    nivel: 'Sem dados',
    cor: 'warning',
    termometro: 0,
    mensagem:
      'Ainda não há dados suficientes para calcular a reputação do Mercado Livre.',
    periodoDias: 60,
    atualizadoEm: '',
    metricas: [],
  },
  recentes: [],
  insights: [],
};

const TITULOS: Partial<Record<SidebarKey, { titulo: string; subtitulo: string }>> = {
  dashboard: {
    titulo: 'Dashboard',
    subtitulo: 'Visão do dia, desempenho e estoque do Mercado Livre',
  },
  nova: {
    titulo: 'Nova peça',
    subtitulo: 'Cadastro completo no padrão Mercado Livre',
  },
  importar: {
    titulo: 'Importar lote',
    subtitulo: 'Fotos, ZIPs e agrupamento automático',
  },
  lotes: {
    titulo: 'Estoque',
    subtitulo: 'Todos os itens e anúncios cadastrados',
  },
  ia: {
    titulo: 'Análise com IA',
    subtitulo: 'Plano de ação com base nos dados reais do catálogo',
  },
  editor: {
    titulo: 'Editor de anúncios',
    subtitulo: 'Título, descrição, preço e estoque antes de publicar',
  },
  aprovacao: {
    titulo: 'Fila de aprovação',
    subtitulo: 'Revise e aplique as alterações propostas',
  },
  marketplaces: {
    titulo: 'Marketplaces',
    subtitulo: 'Conexão e sincronização com o Mercado Livre',
  },
  atendimento: {
    titulo: 'Atendimento',
    subtitulo: 'Perguntas e reclamações do Mercado Livre',
  },
  pedidos: {
    titulo: 'NF-e',
    subtitulo: 'Vendas pendentes de envio ao financeiro',
  },
  relatorios: {
    titulo: 'Relatórios',
    subtitulo: 'Faturamento, cancelamentos e desempenho financeiro',
  },
  config: {
    titulo: 'Configurações',
    subtitulo: 'Perfil, empresa, WhatsApp e credenciais do Mercado Livre',
  },
};

function readStored(key: string): string {
  try {
    return window.localStorage.getItem(key)?.trim() ?? '';
  } catch {
    return '';
  }
}

function saveStored(key: string, valor: string) {
  try {
    const limpo = valor.trim();
    if (limpo) {
      window.localStorage.setItem(key, limpo);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // A sessão continua válida mesmo sem localStorage.
  }
}

function App() {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [analytics, setAnalytics] = useState<AnalyticsData>(initialAnalytics);
  const [periodo, setPeriodo] = useState<PeriodoDashboard>('7');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [userName, setUserName] = useState(() =>
    readStored(STORAGE_KEYS.userName)
  );
  const [companyName, setCompanyName] = useState(() => {
    return readStored(STORAGE_KEYS.companyName) || DEFAULT_COMPANY_NAME;
  });
  const [financeWhatsApp, setFinanceWhatsApp] = useState(() =>
    readStored(STORAGE_KEYS.financeWhatsApp)
  );
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const nomeSalvo = readStored(STORAGE_KEYS.userName);
    const onboardingConcluido =
      readStored(STORAGE_KEYS.onboardingCompleted) === '1';

    return !nomeSalvo && !onboardingConcluido;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<SidebarKey>('dashboard');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [focoAtendimento, setFocoAtendimento] = useState<
    'perguntas' | 'reclamacoes' | null
  >(null);
  const [statusInicialRelatorios, setStatusInicialRelatorios] = useState<
    'todas' | 'concluidas' | 'andamento' | 'canceladas' | null
  >(null);

  // Garante que toda troca de aba comece no topo, mesmo quando a aba anterior
  // estava rolada para baixo. O efeito roda depois da renderização da nova tela.
  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeView]);

  const activeItem =
    NAV_ITEMS.find((item) => item.key === activeView) ?? NAV_ITEMS[0];
  const ActiveIcon = activeItem.icon;
  const headerInfo = TITULOS[activeView];

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashboardRes, analyticsRes] = await Promise.all([
        axios.get<DashboardStats>('/api/dashboard', { timeout: 12000 }),
        axios.get<AnalyticsData>(
          `/api/dashboard/analytics?periodo=${periodo}`,
          { timeout: 12000 }
        ),
      ]);

      setStats({ ...initialStats, ...dashboardRes.data });
      setAnalytics({ ...initialAnalytics, ...analyticsRes.data });
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Erro ao buscar dashboard:', error);
    }
  }, [periodo]);

  useEffect(() => {
    if (!showOnboarding) {
      void fetchDashboard();
    }
  }, [fetchDashboard, showOnboarding]);

  // Atualiza o painel sozinho enquanto ele está aberto, para refletir venda,
  // pergunta ou reclamação nova sem precisar clicar em Atualizar.
  useEffect(() => {
    if (showOnboarding) return;

    let ativo = true;

    const atualizar = () => {
      if (!ativo || document.visibilityState !== 'visible') return;
      if (activeView !== 'dashboard') return;
      void fetchDashboard();
    };

    const intervalo = window.setInterval(atualizar, 30000);
    document.addEventListener('visibilitychange', atualizar);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [activeView, fetchDashboard, showOnboarding]);

  // O callback OAuth do Mercado Livre volta para a raiz com ?ml=...
  // A página de Marketplaces lê a mensagem e limpa a URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('ml')) {
      setActiveView('marketplaces');
    }
  }, []);

  const handleNavigate = (key: SidebarKey) => {
    setFocoAtendimento(null);
    setStatusInicialRelatorios(null);
    setActiveView(key);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const handleInsightNavigate = (destino: string) => {
    const chave = NAV_ITEMS.some((item) => item.key === destino)
      ? (destino as SidebarKey)
      : 'lotes';
    setFocoAtendimento(null);
    setStatusInicialRelatorios(null);
    setActiveView(chave);
    window.scrollTo(0, 0);
  };

  const handleAnaliseNavigate = (
    key: SidebarKey,
    foco: 'perguntas' | 'reclamacoes' | null = null
  ) => {
    setStatusInicialRelatorios(null);
    setFocoAtendimento(key === 'atendimento' ? foco : null);
    setActiveView(key);
    window.scrollTo(0, 0);
  };

  const handleReputacaoMetric = (chave: string) => {
    setFocoAtendimento(null);
    setStatusInicialRelatorios(null);

    if (chave === 'reclamacoes' || chave === 'perguntas') {
      setFocoAtendimento(chave);
      setActiveView('atendimento');
    } else if (chave === 'cancelamentos') {
      setStatusInicialRelatorios('canceladas');
      setActiveView('relatorios');
    } else {
      setStatusInicialRelatorios('todas');
      setActiveView('relatorios');
    }

    window.scrollTo(0, 0);
  };

  const handleSaveSettings = (dados: {
    userName: string;
    companyName: string;
    financeWhatsApp: string;
  }) => {
    const nome = dados.userName.replace(/\s+/g, ' ').trim().slice(0, 40);
    const empresa =
      dados.companyName.replace(/\s+/g, ' ').trim().slice(0, 60) ||
      DEFAULT_COMPANY_NAME;
    const whatsapp = dados.financeWhatsApp.trim().slice(0, 30);

    setUserName(nome);
    setCompanyName(empresa);
    setFinanceWhatsApp(whatsapp);
    saveStored(STORAGE_KEYS.userName, nome);
    saveStored(STORAGE_KEYS.companyName, empresa);
    saveStored(STORAGE_KEYS.financeWhatsApp, whatsapp);
  };

  const handleCompleteOnboarding = (nomeInformado: string) => {
    const nome = nomeInformado.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!nome) return;

    const empresa = companyName.trim() || DEFAULT_COMPANY_NAME;

    setUserName(nome);
    setCompanyName(empresa);
    saveStored(STORAGE_KEYS.userName, nome);
    saveStored(STORAGE_KEYS.companyName, empresa);
    saveStored(STORAGE_KEYS.onboardingCompleted, '1');
    setShowOnboarding(false);
    window.scrollTo(0, 0);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);

    let ownerToken = '';

    try {
      ownerToken = window.sessionStorage.getItem(SESSION_KEYS.ownerToken) || '';
      window.sessionStorage.removeItem(SESSION_KEYS.ownerToken);
    } catch {
      // Sem sessionStorage, a próxima tela ainda pode ser exibida.
    }

    if (ownerToken) {
      void axios
        .post(
          '/api/proprietario/sair',
          {},
          {
            headers: { [OWNER_HEADER]: ownerToken },
            timeout: 5000,
          }
        )
        .catch(() => {
          // O token local já foi removido; o servidor expira a sessão sozinho.
        });
    }

    setUserName('');
    saveStored(STORAGE_KEYS.userName, '');
    saveStored(STORAGE_KEYS.onboardingCompleted, '');
    setActiveView('dashboard');
    setShowOnboarding(true);
    window.scrollTo(0, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value) || 0);
  };

  const handlePecasChanged = () => {
    void fetchDashboard();
  };

  if (showOnboarding) {
    return (
      <Onboarding
        defaultCompany={companyName || DEFAULT_COMPANY_NAME}
        onComplete={handleCompleteOnboarding}
      />
    );
  }

  return (
    <div className="app-shell relative isolate flex min-h-screen">
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="ambient-blob ambient-blob--blue" />
        <div className="ambient-blob ambient-blob--violet" />
        <div className="ambient-blob ambient-blob--teal" />
      </div>

      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        activeKey={activeView}
        onNavigate={handleNavigate}
        onLogout={() => setShowLogoutConfirm(true)}
        userName={userName}
        companyName={companyName}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-sidebar shadow-[0_1px_0_rgba(255,255,255,0.04),0_18px_50px_-30px_rgba(0,0,0,0.9)]">
          <div className="px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Abrir menu"
                  className="shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-muted transition-colors hover:text-ink lg:hidden"
                >
                  <Menu className="h-6 w-6" />
                </button>
                <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  <ActiveIcon className="h-6 w-6 text-accent" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-bold text-ink">
                    {headerInfo?.titulo || activeItem.label}
                  </h1>
                  <p className="truncate text-sm text-muted">
                    {headerInfo?.subtitulo ||
                      (companyName
                        ? `${companyName} • operação online`
                        : 'Operação • estoque, anúncios e vendas')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <ConnectionMonitor onStatusChange={setApiOnline} />
                {lastUpdated && (
                  <span className="hidden text-xs text-muted lg:inline">
                    Atualizado às{' '}
                    {lastUpdated.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void fetchDashboard()}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-secondary px-3 py-1.5 text-sm text-ink transition-colors hover:bg-line"
                  title="Atualizar dados do painel"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('config')}
                  className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-110"
                >
                  Configurações
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="relative mx-auto w-full max-w-7xl flex-1 p-5 sm:p-6">
          <div key={activeView} className="view-enter">
            {activeView === 'dashboard' && (
              <div className="dashboard-stack space-y-6">
                <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
                  <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-cyan/10 blur-3xl" />

                  <div className="relative flex flex-col justify-between gap-8 xl:flex-row xl:items-center">
                    <div className="max-w-2xl">
                      <DashboardGreeting userName={userName} />

                      <div className="mt-6 flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-successSoft px-3 py-1.5 font-medium text-success shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          {stats.vendasHoje} venda(s) hoje •{' '}
                          {formatCurrency(stats.faturamentoHoje)}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1.5 font-medium text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                          <Sparkles className="h-3.5 w-3.5" />
                          {analytics.estoque.anuncios} anúncio(s) ML ativo(s)
                        </span>
                        {companyName && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 font-medium text-muted">
                            <Store className="h-3.5 w-3.5" />
                            {companyName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid w-full max-w-lg grid-cols-2 gap-3 xl:w-[420px] xl:shrink-0">
                      <button
                        type="button"
                        onClick={() => handleNavigate('nova')}
                        className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white/[0.09]"
                      >
                        <Package className="h-4 w-4 text-accent transition-transform group-hover:scale-110" />
                        Cadastrar peça
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavigate('pedidos')}
                        className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white/[0.09]"
                      >
                        <ShoppingBag className="h-4 w-4 text-success transition-transform group-hover:scale-110" />
                        Fechar NF-e
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavigate('importar')}
                        className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white/[0.09]"
                      >
                        <ImagePlus className="h-4 w-4 text-cyan transition-transform group-hover:scale-110" />
                        Importar lote
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavigate('atendimento')}
                        className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white/[0.09]"
                      >
                        <MessageSquare className="h-4 w-4 text-warning transition-transform group-hover:scale-110" />
                        Atendimento
                      </button>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <DashboardCard
                    title="Vendas do dia"
                    value={stats.vendasHoje}
                    icon={<DollarSign className="h-5 w-5 text-success" />}
                    subtitle={`${formatCurrency(
                      stats.faturamentoHoje
                    )} faturados hoje`}
                    onClick={() => handleNavigate('pedidos')}
                  />

                  <DashboardCard
                    title="Perguntas"
                    value={stats.perguntasPendentes}
                    icon={<MessageSquare className="h-5 w-5 text-accent" />}
                    subtitle={`${stats.perguntasHoje} pergunta(s) hoje • responda rápido`}
                    onClick={() => handleNavigate('atendimento')}
                  />

                  <DashboardCard
                    title="Reclamações"
                    value={stats.reclamacoesAbertas}
                    icon={<AlertTriangle className="h-5 w-5 text-danger" />}
                    subtitle={`${stats.reclamacoesHoje} aberta(s) hoje • proteja a reputação`}
                    onClick={() => handleNavigate('atendimento')}
                  />

                  <DashboardCard
                    title="Anúncios a revisar"
                    value={stats.anunciosRevisar}
                    icon={<ExternalLink className="h-5 w-5 text-warning" />}
                    subtitle={`${stats.anunciosAtivos} anúncio(s) ML ativo(s)`}
                    onClick={() => handleNavigate('lotes')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    <RevenueChart
                      serie={analytics.serie}
                      periodoDias={analytics.periodoDias}
                      periodo={periodo}
                      onPeriodChange={setPeriodo}
                    />
                  </div>
                  <StockHealth
                    estoque={analytics.estoque}
                    vendasHojeML={stats.vendasHojeML}
                  />
                </div>

                <ReputacaoMl
                  reputacao={analytics.reputacao}
                  onMetricClick={handleReputacaoMetric}
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <TopTiposPeca
                    tipos={analytics.topTiposPeca}
                    periodoLabel={
                      periodo === 'hoje'
                        ? 'Hoje'
                        : `Últimos ${analytics.periodoDias} dias`
                    }
                    onViewAll={() => handleNavigate('lotes')}
                  />
                  <InsightsPanel
                    insights={analytics.insights}
                    onNavigate={handleInsightNavigate}
                  />
                </div>

                <PecasTable
                  limit={5}
                  onChange={handlePecasChanged}
                  onViewAll={() => handleNavigate('lotes')}
                />
              </div>
            )}

            {activeView === 'importar' && <ImportLotPage />}

            {activeView === 'lotes' && (
              <PecasTable onChange={handlePecasChanged} />
            )}

            {activeView === 'nova' && (
              <NovaPecaPage onSuccess={handlePecasChanged} />
            )}

            {activeView === 'pedidos' && (
              <NFePage
                financeWhatsApp={financeWhatsApp}
                companyName={companyName}
                onOpenSettings={() => handleNavigate('config')}
              />
            )}

            {activeView === 'ia' && (
              <AnaliseIaPage onNavigate={handleAnaliseNavigate} />
            )}

            {activeView === 'editor' && (
              <EditorAnunciosPage
                onOpenApproval={() => handleNavigate('aprovacao')}
                onOpenNew={() => handleNavigate('nova')}
              />
            )}

            {activeView === 'aprovacao' && (
              <FilaAprovacaoPage
                onOpenEditor={() => handleNavigate('editor')}
              />
            )}

            {activeView === 'marketplaces' && (
              <MarketplacesPage
                onOpenSettings={() => handleNavigate('config')}
                onNavigate={handleNavigate}
                onMetricClick={handleReputacaoMetric}
              />
            )}

            {activeView === 'atendimento' && (
              <AtendimentoPage foco={focoAtendimento} />
            )}

            {activeView === 'relatorios' && (
              <RelatoriosPage
                statusInicial={statusInicialRelatorios}
                onNavigate={handleNavigate}
              />
            )}

            {activeView === 'config' && (
              <ConfiguracoesPage
                userName={userName}
                companyName={companyName}
                financeWhatsApp={financeWhatsApp}
                onSaveSettings={handleSaveSettings}
                onOpenMarketplaces={() => handleNavigate('marketplaces')}
              />
            )}
          </div>
        </main>

        <footer className="mt-auto border-t border-line bg-white/[0.015] backdrop-blur-xl">
          <div className="mx-auto max-w-7xl p-6 text-center text-sm text-muted">
            <p>
              {companyName ? `${companyName} • ` : 'Sistema Desmonte • '}
              {new Date().getFullYear()} • Backend:{' '}
              <span
                className={
                  apiOnline === null
                    ? 'text-muted'
                    : apiOnline
                      ? 'text-success'
                      : 'text-danger'
                }
              >
                {apiOnline === null ? '...' : apiOnline ? 'online' : 'offline'}
              </span>
              {userName ? ` • ${userName}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
              <span>Peças: {stats.totalPecas}</span>
              <span>•</span>
              <span>Vendas: {stats.totalVendas}</span>
              <span>•</span>
              <span>Faturamento ML: {formatCurrency(stats.faturamentoML)}</span>
              <span>•</span>
              <span>WhatsApp financeiro: {financeWhatsApp || 'não configurado'}</span>
            </div>
          </div>
        </footer>
      </div>

      {showLogoutConfirm && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowLogoutConfirm(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sair-titulo"
            className="modal-panel glass-panel w-full max-w-md rounded-2xl p-6"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-danger/25 bg-dangerSoft text-danger">
              <LogOut className="h-5 w-5" />
            </div>
            <h2 id="sair-titulo" className="mt-4 text-xl font-bold text-ink">
              Sair do painel?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Você voltará para a tela de boas-vindas e o acesso do proprietário
              será bloqueado. O nome da empresa e o WhatsApp financeiro serão
              mantidos.
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
