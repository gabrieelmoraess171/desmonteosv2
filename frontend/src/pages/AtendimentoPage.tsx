import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Store,
} from 'lucide-react';
import axios from 'axios';
import ReclamacaoDetalheModal from '../components/ReclamacaoDetalheModal';
import PecaDetalheModal from '../components/PecaDetalheModal';

interface Pergunta {
  id: number;
  peca_id?: number | null;
  pergunta: string;
  resposta?: string | null;
  sugestao_ia?: string | null;
  sugestao_fonte?: 'freellmapi' | 'gemini' | 'fallback' | '' | null;
  respondida: number;
  ml_question_id?: string | null;
  ml_item_id?: string | null;
  ml_buyer_id?: string | null;
  ml_status?: string | null;
  data_resposta?: string | null;
  data_pergunta: string;
  peca_nome?: string | null;
  peca_sku?: string | null;
  peca_carro?: string | null;
  peca_imagem?: string | null;
  peca_preco?: number | null;
  peca_ml_permalink?: string | null;
  peca_descricao?: string | null;
  peca_garantia?: string | null;
}

interface PerguntaHistorico {
  id: number;
  pergunta: string;
  resposta?: string | null;
  data_pergunta: string;
  data_resposta?: string | null;
}

interface Reclamacao {
  id: number;
  peca_id?: number | null;
  pedido_id?: string | null;
  motivo: string;
  descricao?: string | null;
  status: string;
  data_reclamacao: string;
  peca_nome?: string | null;
  peca_sku?: string | null;
  peca_carro?: string | null;
  peca_imagem?: string | null;
  comprador?: string | null;
  valor_pedido?: number | null;
}

interface RespostaAtendimento {
  perguntas: Pergunta[];
  reclamacoes: Reclamacao[];
  resumo: {
    perguntasPendentes: number;
    reclamacoesAbertas: number;
  };
}

interface RespostaSugestao {
  sugestao: string;
  fonte: 'freellmapi' | 'gemini' | 'fallback';
  aviso?: string;
}

function formatarData(valor: string): string {
  const data = new Date(String(valor || '').replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function formatarMoeda(valor?: number | null): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function urlAnuncio(permalink?: string | null, itemId?: string | null): string | null {
  if (permalink) return permalink;
  if (!itemId) return null;
  return `https://www.mercadolivre.com.br/p/${encodeURIComponent(itemId)}`;
}

function alertaTempoPergunta(dataPergunta: string): {
  label: string;
  className: string;
} {
  const inicio = new Date(String(dataPergunta || '').replace(' ', 'T')).getTime();
  const horas = Number.isFinite(inicio) ? Math.max(0, (Date.now() - inicio) / 3_600_000) : 0;

  if (horas >= 8) {
    return { label: `${Math.floor(horas)}h sem resposta`, className: 'border-danger/30 bg-dangerSoft text-danger' };
  }
  if (horas >= 4) {
    return { label: `${Math.floor(horas)}h sem resposta`, className: 'border-warning/30 bg-warningSoft text-warning' };
  }
  if (horas >= 1) {
    return { label: `${Math.floor(horas)}h sem resposta`, className: 'border-warning/20 bg-warningSoft/60 text-warning' };
  }
  return { label: 'Nova pergunta', className: 'border-success/20 bg-successSoft text-success' };
}

type FocoAtendimento = 'perguntas' | 'reclamacoes';

interface AtendimentoPageProps {
  foco?: FocoAtendimento | null;
}

export default function AtendimentoPage({ foco }: AtendimentoPageProps) {
  const perguntasRef = useRef<HTMLElement | null>(null);
  const reclamacoesRef = useRef<HTMLElement | null>(null);
  const [dados, setDados] = useState<RespostaAtendimento>({
    perguntas: [],
    reclamacoes: [],
    resumo: { perguntasPendentes: 0, reclamacoesAbertas: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [fontes, setFontes] = useState<Record<number, 'freellmapi' | 'gemini' | 'fallback'>>(
    {}
  );
  const [enviandoId, setEnviandoId] = useState<number | null>(null);
  const [gerandoId, setGerandoId] = useState<number | null>(null);
  const [reclamacaoAberta, setReclamacaoAberta] = useState<number | null>(null);
  const [pecaAberta, setPecaAberta] = useState<number | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<number | null>(null);
  const [historicos, setHistoricos] = useState<Record<number, PerguntaHistorico[]>>({});
  const [carregandoHistorico, setCarregandoHistorico] = useState<number | null>(null);

  useEffect(() => {
    if (!foco || loading) return;

    const alvo =
      foco === 'reclamacoes'
        ? reclamacoesRef.current
        : perguntasRef.current;

    if (!alvo) return;

    const timer = window.setTimeout(() => {
      const topo =
        alvo.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, topo), behavior: 'smooth' });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [foco, loading]);

  const carregar = async (silencioso = false) => {
    if (!silencioso) {
      setLoading(true);
      setErro('');
      setAviso('');
    }

    try {
      const { data } = await axios.get<RespostaAtendimento>('/api/atendimento', {
        timeout: 12000,
      });
      setDados(data);
      setRespostas((atual) => {
        const proximo = { ...atual };
        data.perguntas.forEach((pergunta) => {
          if (!proximo[pergunta.id]) {
            proximo[pergunta.id] = pergunta.sugestao_ia || '';
          }
        });
        return proximo;
      });
      setFontes((atual) => {
        const proximo = { ...atual };
        data.perguntas.forEach((pergunta) => {
          if (
            pergunta.sugestao_ia &&
            (pergunta.sugestao_fonte === 'freellmapi' ||
              pergunta.sugestao_fonte === 'gemini' ||
              pergunta.sugestao_fonte === 'fallback') &&
            !proximo[pergunta.id]
          ) {
            proximo[pergunta.id] = pergunta.sugestao_fonte;
          }
        });
        return proximo;
      });
    } catch (error) {
      if (silencioso) return;
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível carregar o atendimento.'
        );
      } else {
        setErro('Não foi possível carregar o atendimento.');
      }
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  // Atualiza as perguntas/reclamações sozinho quando algo muda no Mercado Livre.
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
  }, []);

  const gerarSugestao = async (pergunta: Pergunta) => {
    setGerandoId(pergunta.id);
    setErro('');
    setAviso('');

    try {
      const { data } = await axios.post<RespostaSugestao>(
        `/api/atendimento/perguntas/${pergunta.id}/sugestao`,
        {},
        { timeout: 45000 }
      );

      setDados((atual) => ({
        ...atual,
        perguntas: atual.perguntas.map((item) =>
          item.id === pergunta.id
            ? { ...item, sugestao_ia: data.sugestao }
            : item
        ),
      }));
      setFontes((atual) => ({ ...atual, [pergunta.id]: data.fonte }));
      setRespostas((atual) => {
        if ((atual[pergunta.id] || '').trim()) return atual;
        return { ...atual, [pergunta.id]: data.sugestao };
      });
      if (data.aviso) setAviso(data.aviso);
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível gerar a sugestão agora.'
        );
      } else {
        setErro('Não foi possível gerar a sugestão agora.');
      }
    } finally {
      setGerandoId(null);
    }
  };

  const usarSugestao = (pergunta: Pergunta) => {
    if (!pergunta.sugestao_ia) return;
    setRespostas((atual) => ({
      ...atual,
      [pergunta.id]: pergunta.sugestao_ia || '',
    }));
  };

  const responder = async (pergunta: Pergunta) => {
    const resposta = (respostas[pergunta.id] || '').trim();

    if (!resposta) {
      setErro('Escreva uma resposta ou gere uma sugestão com a IA.');
      return;
    }

    setEnviandoId(pergunta.id);
    setErro('');
    setAviso('');

    try {
      await axios.patch(
        `/api/atendimento/perguntas/${pergunta.id}/respondida`,
        {
          respondida: true,
          resposta,
        }
      );
      setDados((atual) => ({
        ...atual,
        perguntas: atual.perguntas.filter((item) => item.id !== pergunta.id),
        resumo: {
          ...atual.resumo,
          perguntasPendentes: Math.max(0, atual.resumo.perguntasPendentes - 1),
        },
      }));
      setRespostas((atual) => ({ ...atual, [pergunta.id]: '' }));
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error || 'Não foi possível responder a pergunta.'
        );
      }
    } finally {
      setEnviandoId(null);
    }
  };

  const alternarHistorico = async (pergunta: Pergunta) => {
    if (historicoAberto === pergunta.id) {
      setHistoricoAberto(null);
      return;
    }
    setHistoricoAberto(pergunta.id);
    if (historicos[pergunta.id]) return;
    setCarregandoHistorico(pergunta.id);
    try {
      const { data } = await axios.get<{ historico: PerguntaHistorico[] }>(
        '/api/atendimento/perguntas/historico',
        { params: { peca_id: pergunta.peca_id, ml_item_id: pergunta.ml_item_id, ml_buyer_id: pergunta.ml_buyer_id } }
      );
      setHistoricos((atual) => ({ ...atual, [pergunta.id]: data.historico || [] }));
    } catch {
      setHistoricos((atual) => ({ ...atual, [pergunta.id]: [] }));
    } finally {
      setCarregandoHistorico(null);
    }
  };

  const abrirAnuncio = (pergunta: Pergunta) => {
    const url = urlAnuncio(pergunta.peca_ml_permalink, pergunta.ml_item_id);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (pergunta.peca_id) setPecaAberta(pergunta.peca_id);
  };

  const abrirProduto = (pergunta: Pergunta) => {
    if (pergunta.peca_id) setPecaAberta(pergunta.peca_id);
  };

  const handleResolvida = (id: number) => {
    setDados((atual) => ({
      ...atual,
      reclamacoes: atual.reclamacoes.filter((item) => item.id !== id),
      resumo: {
        ...atual.resumo,
        reclamacoesAbertas: Math.max(0, atual.resumo.reclamacoesAbertas - 1),
      },
    }));
  };

  return (
    <div className="space-y-6">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              <MessageSquare className="h-3.5 w-3.5" />
              Central de atendimento
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Perguntas e reclamações
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Veja a foto do anúncio, gere uma sugestão com IA e resolva cada
              caso no padrão do Mercado Livre.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-warning/20 bg-warningSoft px-3 py-1.5 text-xs font-medium text-warning">
              {dados.resumo.perguntasPendentes} pergunta(s)
            </span>
            <span className="rounded-full border border-danger/20 bg-dangerSoft px-3 py-1.5 text-xs font-medium text-danger">
              {dados.resumo.reclamacoesAbertas} reclamação(ões)
            </span>
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium transition-colors hover:bg-white/[0.09] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
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

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-card py-16 text-sm text-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Carregando atendimento...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section
            ref={perguntasRef}
            className={`rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 transition-shadow sm:p-6 ${
              foco === 'perguntas' ? 'ring-2 ring-warning/40' : ''
            }`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Mercado Livre
                </p>
                <h3 className="mt-1 flex items-center gap-2 text-xl font-bold">
                  <MessageSquare className="h-5 w-5 text-warning" />
                  Perguntas sem resposta
                </h3>
              </div>
              <span className="rounded-full bg-warningSoft px-2.5 py-1 text-xs font-semibold text-warning">
                {dados.perguntas.length}
              </span>
            </div>

            {dados.perguntas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                <p className="mt-3 text-sm font-medium">
                  Todas as perguntas respondidas
                </p>
                <p className="mt-1 text-xs text-muted">
                  Continue respondendo rápido para manter a reputação.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {dados.perguntas.map((pergunta) => {
                  const sugestao = pergunta.sugestao_ia || '';
                  const fonte = fontes[pergunta.id];
                  const alertaTempo = alertaTempoPergunta(pergunta.data_pergunta);

                  return (
                    <li
                      key={pergunta.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => abrirProduto(pergunta)}
                          disabled={!pergunta.peca_id && !pergunta.ml_item_id}
                          title="Abrir produto no nosso site"
                          className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-secondary transition-all hover:border-accent/50 hover:shadow-lg disabled:cursor-default"
                        >
                          {pergunta.peca_imagem ? (
                            <img
                              src={pergunta.peca_imagem}
                              alt={pergunta.peca_nome || 'Foto do anúncio'}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                          {pergunta.peca_id ? (
                            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                              Abrir produto
                            </span>
                          ) : null}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-relaxed">
                            “{pergunta.pergunta}”
                          </p>
                          <button
                            type="button"
                            onClick={() => abrirAnuncio(pergunta)}
                            disabled={!urlAnuncio(pergunta.peca_ml_permalink, pergunta.ml_item_id)}
                            className="mt-1 block max-w-full truncate text-left text-[11px] text-muted underline decoration-transparent underline-offset-2 transition hover:text-ml hover:decoration-ml disabled:no-underline"
                            title="Abrir anúncio no Mercado Livre"
                          >
                            {pergunta.peca_nome || 'Peça não vinculada'}
                            {pergunta.peca_sku ? ` • ${pergunta.peca_sku}` : ''}
                            {pergunta.peca_carro
                              ? ` • ${pergunta.peca_carro}`
                              : ''}{' '}
                            • {formatarData(pergunta.data_pergunta)}
                          </button>
                          {pergunta.peca_preco ? (
                            <p className="mt-1 text-[11px] font-semibold text-success">
                              {formatarMoeda(pergunta.peca_preco)}
                            </p>
                          ) : null}
                          {pergunta.ml_question_id && (
                            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-ml/25 bg-ml/10 px-2 py-0.5 text-[10px] font-semibold text-ml">
                              <Store className="h-3 w-3" />
                              Mercado Livre
                            </span>
                          )}
                          <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${alertaTempo.className}`}>
                            <Clock3 className="h-3 w-3" />
                            {alertaTempo.label}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void alternarHistorico(pergunta)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent/30 hover:text-accent"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {carregandoHistorico === pergunta.id
                            ? 'Consultando histórico...'
                            : historicoAberto === pergunta.id
                              ? 'Ocultar histórico'
                              : 'Ver histórico do anúncio'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void gerarSugestao(pergunta)}
                          disabled={gerandoId === pergunta.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-accent/25 bg-accentSoft px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
                        >
                          {gerandoId === pergunta.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {gerandoId === pergunta.id
                            ? 'Gerando sugestão...'
                            : sugestao
                              ? 'Gerar outra sugestão'
                              : 'Gerar sugestão com IA'}
                        </button>
                        {sugestao && (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-muted">
                            {fonte === 'freellmapi'
                              ? 'FreeLLMAPI'
                              : fonte === 'gemini'
                                ? 'Gemini'
                                : fonte === 'fallback'
                                  ? 'Sugestão local'
                                  : 'Sugestão salva'}
                          </span>
                        )}
                      </div>

                      {historicoAberto === pergunta.id ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                            {pergunta.ml_buyer_id
                              ? 'Perguntas anteriores respondidas por este comprador'
                              : 'Perguntas anteriores respondidas neste anúncio'}
                          </p>
                          {(historicos[pergunta.id] || []).length === 0 ? (
                            <p className="mt-2 text-xs text-muted">
                              Nenhuma pergunta respondida encontrada para este anúncio.
                            </p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {(historicos[pergunta.id] || []).map((item) => (
                                <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                                  <p className="text-xs text-ink">“{item.pergunta}”</p>
                                  <p className="mt-1 text-xs text-success">Resposta: {item.resposta || 'Respondida no Mercado Livre'}</p>
                                  <p className="mt-1 text-[10px] text-muted">{formatarData(item.data_pergunta)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}

                      {sugestao && (
                        <div className="mt-3 rounded-xl border border-accent/20 bg-accentSoft/60 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs leading-relaxed text-ink">
                              <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-accent" />
                              {sugestao}
                            </p>
                            <button
                              type="button"
                              onClick={() => usarSugestao(pergunta)}
                              className="shrink-0 rounded-lg border border-accent/30 px-2.5 py-1.5 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/20"
                            >
                              Usar sugestão
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <textarea
                          rows={2}
                          value={respostas[pergunta.id] || ''}
                          onChange={(event) =>
                            setRespostas((atual) => ({
                              ...atual,
                              [pergunta.id]: event.target.value,
                            }))
                          }
                          placeholder="Escreva a resposta ou use a sugestão da IA..."
                          className="min-w-0 flex-1 resize-y rounded-xl border px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void responder(pergunta)}
                          disabled={enviandoId === pergunta.id}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50 sm:self-start"
                        >
                          <Send className="h-4 w-4" />
                          {enviandoId === pergunta.id
                            ? 'Enviando...'
                            : pergunta.ml_question_id
                              ? 'Responder no ML'
                              : 'Responder'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            ref={reclamacoesRef}
            className={`rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 transition-shadow sm:p-6 ${
              foco === 'reclamacoes' ? 'ring-2 ring-danger/40' : ''
            }`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Pós-venda
                </p>
                <h3 className="mt-1 flex items-center gap-2 text-xl font-bold">
                  <ShieldAlert className="h-5 w-5 text-danger" />
                  Reclamações abertas
                </h3>
              </div>
              <span className="rounded-full bg-dangerSoft px-2.5 py-1 text-xs font-semibold text-danger">
                {dados.reclamacoes.length}
              </span>
            </div>

            {dados.reclamacoes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                <p className="mt-3 text-sm font-medium">
                  Nenhuma reclamação aberta
                </p>
                <p className="mt-1 text-xs text-muted">
                  A reputação está protegida neste momento.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {dados.reclamacoes.map((reclamacao) => (
                  <li key={reclamacao.id}>
                    <button
                      type="button"
                      onClick={() => setReclamacaoAberta(reclamacao.id)}
                      className="group w-full rounded-2xl border border-danger/20 bg-dangerSoft p-4 text-left transition-all hover:-translate-y-0.5 hover:border-danger/40 hover:bg-dangerSoft/80"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-secondary">
                          {reclamacao.peca_imagem ? (
                            <img
                              src={reclamacao.peca_imagem}
                              alt={reclamacao.peca_nome || 'Produto'}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-semibold">
                              {reclamacao.motivo}
                            </p>
                            <span className="text-[10px] uppercase tracking-wide text-muted">
                              {reclamacao.status}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                            {reclamacao.descricao || 'Sem descrição informada.'}
                          </p>
                          <p className="mt-1 text-[11px] text-muted">
                            {reclamacao.pedido_id
                              ? `Pedido ${reclamacao.pedido_id}`
                              : reclamacao.peca_nome || 'Pedido não vinculado'}
                            {reclamacao.peca_sku
                              ? ` • ${reclamacao.peca_sku}`
                              : ''}{' '}
                            • {formatarData(reclamacao.data_reclamacao)}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                            {reclamacao.comprador && (
                              <span>{reclamacao.comprador}</span>
                            )}
                            {reclamacao.valor_pedido ? (
                              <span className="font-semibold text-success">
                                {formatarMoeda(reclamacao.valor_pedido)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <ChevronRight className="mt-6 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-danger" />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-ink transition-colors group-hover:bg-white/[0.09]">
                          Ver reclamação
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            setReclamacaoAberta(reclamacao.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.stopPropagation();
                              setReclamacaoAberta(reclamacao.id);
                            }
                          }}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-success/25 bg-successSoft px-3 py-2 text-xs font-semibold text-success transition-colors hover:bg-success/20"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Resolver
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <ReclamacaoDetalheModal
        reclamacaoId={reclamacaoAberta}
        onClose={() => setReclamacaoAberta(null)}
        onResolved={handleResolvida}
      />

      <PecaDetalheModal
        pecaId={pecaAberta}
        onClose={() => setPecaAberta(null)}
      />
    </div>
  );
}
