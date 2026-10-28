import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Brain,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import axios from 'axios';
import type { SidebarKey } from '../components/Sidebar';

interface DadosAnalise {
  pecas: {
    total: number;
    ativas: number;
    pausadas: number;
    semEstoque: number;
    semFotos: number;
    descricaoCurta: number;
    valor: number;
  };
  vendas: {
    total: number;
    faturamento: number;
  };
  categorias: Array<{ categoria: string; total: number }>;
  perguntasPendentes: number;
  reclamacoesAbertas: number;
}

interface RespostaAnalise {
  analise: string;
  fonte: 'freellmapi' | 'gemini' | 'local' | string;
  modelo?: string | null;
  geradoEm: string;
  aviso?: string;
  dados: DadosAnalise;
}

interface AnaliseIaPageProps {
  onNavigate?: (
    key: SidebarKey,
    foco?: 'perguntas' | 'reclamacoes' | null
  ) => void;
}

const FONTES: Record<string, { label: string; className: string }> = {
  freellmapi: {
    label: 'FreeLLMAPI',
    className: 'border-accent/20 bg-accentSoft text-accent',
  },
  gemini: {
    label: 'Gemini',
    className: 'border-cyan/20 bg-cyan/10 text-cyan',
  },
  local: {
    label: 'Análise local',
    className: 'border-warning/20 bg-warningSoft text-warning',
  },
};

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function formatarData(valor: string): string {
  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function linhasDaAnalise(texto: string): string[] {
  return String(texto || '')
    .split(/\n+|•/)
    .map((linha) => linha.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

function destinoDaLinha(linha: string): {
  chave: SidebarKey;
  foco: 'perguntas' | 'reclamacoes' | null;
  label: string;
} {
  const texto = linha
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/pergunta|responder|responda|comprador|duvida/.test(texto)) {
    return {
      chave: 'atendimento',
      foco: 'perguntas',
      label: 'Abrir perguntas',
    };
  }

  if (/reclama|disputa|mediacao|reputacao|termometro/.test(texto)) {
    return {
      chave: 'atendimento',
      foco: 'reclamacoes',
      label: 'Abrir reclamações',
    };
  }

  if (/estoque|reponha|rep[oó]r|pause|pausad|parado|encalhad|quantidade/.test(texto)) {
    return {
      chave: 'lotes',
      foco: null,
      label: 'Abrir estoque',
    };
  }

  if (/foto|imagem|descricao|titulo|anuncio|atributo|ficha|categoria/.test(texto)) {
    return {
      chave: 'editor',
      foco: null,
      label: 'Abrir editor de anúncios',
    };
  }

  if (/venda|faturamento|financeiro|receita|preco|margem|ticket/.test(texto)) {
    return {
      chave: 'relatorios',
      foco: null,
      label: 'Abrir relatórios',
    };
  }

  if (/estoque|pausad|pausa|quantidade|repor|parado|encalhad/.test(texto)) {
    return {
      chave: 'lotes',
      foco: null,
      label: 'Abrir estoque',
    };
  }

  return {
    chave: 'lotes',
    foco: null,
    label: 'Abrir estoque',
  };
}

export default function AnaliseIaPage({ onNavigate }: AnaliseIaPageProps) {
  const [resultado, setResultado] = useState<RespostaAnalise | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');

    try {
      const { data } = await axios.get<RespostaAnalise>('/api/ia/analise', {
        timeout: 60000,
      });

      setResultado(data);
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível gerar a análise agora.'
        );
      } else {
        setErro('Não foi possível gerar a análise agora.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const linhas = useMemo(
    () => linhasDaAnalise(resultado?.analise || ''),
    [resultado?.analise]
  );
  const fonte = FONTES[resultado?.fonte || 'local'] || FONTES.local;
  const dados = resultado?.dados;

  const indicadores = dados
    ? [
        {
          label: 'Peças no catálogo',
          valor: String(dados.pecas.total),
          detalhe: `${dados.pecas.ativas} ativa(s) • ${dados.pecas.pausadas} pausada(s)`,
          icon: Package,
          cor: 'text-accent',
          destino: 'lotes' as SidebarKey,
        },
        {
          label: 'Vendas em 30 dias',
          valor: String(dados.vendas.total),
          detalhe: formatarMoeda(dados.vendas.faturamento),
          icon: ShoppingBag,
          cor: 'text-success',
          destino: 'relatorios' as SidebarKey,
        },
        {
          label: 'Perguntas pendentes',
          valor: String(dados.perguntasPendentes),
          detalhe: 'Responda para proteger a reputação',
          icon: MessageSquare,
          cor: 'text-warning',
          destino: 'atendimento' as SidebarKey,
        },
        {
          label: 'Reclamações abertas',
          valor: String(dados.reclamacoesAbertas),
          detalhe: 'Resolva antes que afetem o termômetro',
          icon: AlertTriangle,
          cor: 'text-danger',
          destino: 'atendimento' as SidebarKey,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-cyan/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Brain className="h-3.5 w-3.5" />
              Inteligência do catálogo
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Análise com IA
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Um plano de ação curto, gerado a partir dos dados reais do seu
              catálogo, vendas, perguntas e reputação no Mercado Livre.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {resultado && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${fonte.className}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {fonte.label}
              </span>
            )}
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {loading ? 'Analisando...' : 'Gerar nova análise'}
            </button>
          </div>
        </div>
      </section>

      {erro && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-danger/25 bg-dangerSoft px-4 py-3 text-sm leading-relaxed text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{erro}</p>
            <button
              type="button"
              onClick={() => void carregar()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-danger/25 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-white/[0.08]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {loading && !resultado ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-card py-16 text-sm text-muted">
          <Loader2 className="h-7 w-7 animate-spin text-accent" />
          <p>Lendo catálogo, vendas e reputação...</p>
          <p className="text-xs">
            A IA pode levar alguns segundos. Se ela não responder, o sistema
            monta uma análise local com os mesmos dados.
          </p>
        </div>
      ) : resultado ? (
        <>
          <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                  Plano de ação
                </p>
                <h3 className="mt-1 text-xl font-bold">O que fazer agora</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                Gerado em {formatarData(resultado.geradoEm)}
                {resultado.modelo ? ` • ${resultado.modelo}` : ''}
              </span>
            </div>

            {resultado.aviso && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warningSoft px-3.5 py-3 text-xs leading-relaxed text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{resultado.aviso}</p>
              </div>
            )}

            <ul className="mt-5 space-y-3">
              {linhas.map((linha, indice) => {
                const destino = destinoDaLinha(linha);

                return (
                  <li key={`${indice}-${linha.slice(0, 24)}`}>
                    <button
                      type="button"
                      onClick={() => onNavigate?.(destino.chave, destino.foco)}
                      className="group flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm leading-relaxed text-ink transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white/[0.06]"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accentSoft text-[11px] font-bold text-accent">
                        {indice + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{linha}</span>
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent opacity-80 transition-opacity group-hover:opacity-100">
                          {destino.label}
                          <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {indicadores.map((indicador) => {
              const Icone = indicador.icon;

              return (
                <button
                  key={indicador.label}
                  type="button"
                  onClick={() => onNavigate?.(indicador.destino)}
                  className="group rounded-2xl border border-line bg-card p-4 text-left shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-accent/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                        {indicador.label}
                      </p>
                      <p className="mt-2 text-3xl font-bold leading-none text-ink">
                        {indicador.valor}
                      </p>
                    </div>
                    <span className={`rounded-xl bg-white/[0.05] p-2.5 ${indicador.cor}`}>
                      <Icone className="h-5 w-5" />
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    {indicador.detalhe}
                  </p>
                </button>
              );
            })}
          </div>

          {dados && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Saúde do catálogo
                </p>
                <h3 className="mt-1 text-xl font-bold">Pontos de atenção</h3>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {[
                    {
                      label: 'Sem estoque',
                      valor: dados.pecas.semEstoque,
                      className: 'text-danger',
                    },
                    {
                      label: 'Sem fotos',
                      valor: dados.pecas.semFotos,
                      className: 'text-warning',
                    },
                    {
                      label: 'Descrição curta',
                      valor: dados.pecas.descricaoCurta,
                      className: 'text-warning',
                    },
                    {
                      label: 'Pausadas',
                      valor: dados.pecas.pausadas,
                      className: 'text-muted',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                        {item.label}
                      </p>
                      <p className={`mt-1 text-xl font-bold ${item.className}`}>
                        {item.valor}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-success/20 bg-successSoft px-3.5 py-3">
                  <span className="text-xs font-semibold text-success">
                    Valor em estoque
                  </span>
                  <span className="text-sm font-bold text-success">
                    {formatarMoeda(dados.pecas.valor)}
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Distribuição
                </p>
                <h3 className="mt-1 text-xl font-bold">Categorias do catálogo</h3>

                {dados.categorias.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-line p-8 text-center">
                    <Package className="mx-auto h-7 w-7 text-muted" />
                    <p className="mt-2 text-sm font-medium">
                      Nenhuma categoria cadastrada
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Cadastre ou sincronize peças para ver a distribuição.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {dados.categorias.map((categoria) => {
                      const maior = Math.max(
                        ...dados.categorias.map((item) => item.total),
                        1
                      );
                      const largura = Math.round(
                        (categoria.total / maior) * 100
                      );

                      return (
                        <div key={categoria.categoria}>
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate font-medium text-ink">
                              {categoria.categoria}
                            </span>
                            <span className="shrink-0 text-muted">
                              {categoria.total} peça(s)
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.max(6, largura)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onNavigate?.('editor')}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-white/[0.08] hover:text-ink"
                >
                  <BadgeCheck className="h-4 w-4 text-accent" />
                  Abrir editor de anúncios
                </button>
              </section>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
