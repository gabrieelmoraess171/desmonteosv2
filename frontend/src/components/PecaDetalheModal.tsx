import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Barcode,
  CalendarDays,
  Car,
  CheckCircle2,
  Edit3,
  Image as ImageIcon,
  Layers,
  Loader2,
  Package,
  Ruler,
  ShieldCheck,
  Star,
  Tag,
  X,
  XCircle,
} from 'lucide-react';
import axios from 'axios';
import type { PecaCompleta } from './ModalCadastroPeca';
import {
  camposDaCategoria,
  lerAtributos,
} from '../config/categorias';
import { avaliarQualidadeMl } from '../utils/mlQualidade';

interface ImagemPeca {
  id: number;
  caminho: string;
  nome_arquivo?: string | null;
  is_principal: number;
  ordem: number;
}

export interface PecaDetalhe extends PecaCompleta {
  quantidade: number;
  preco: number;
  ml_ativo: number;
  ml_status?: string | null;
  ml_health?: number | null;
  ml_thumbnail?: string | null;
  ml_permalink?: string | null;
  descricao_len?: number | null;
  created_at?: string | null;
  imagens_count?: number;
  imagem_principal?: string | null;
  imagens?: ImagemPeca[];
}

interface PecaDetalheModalProps {
  pecaId: number | null;
  onClose: () => void;
  onEdit?: (peca: PecaDetalhe) => void;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function formatarData(valor?: string | null): string {
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

function formatarMedida(valor?: number | null): string {
  const numero = Number(valor) || 0;
  return numero > 0 ? `${numero.toLocaleString('pt-BR')} cm` : '—';
}

export default function PecaDetalheModal({
  pecaId,
  onClose,
  onEdit,
}: PecaDetalheModalProps) {
  const [peca, setPeca] = useState<PecaDetalhe | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [imagemAtiva, setImagemAtiva] = useState(0);

  useEffect(() => {
    if (!pecaId) {
      setPeca(null);
      setErro('');
      return;
    }

    let ativo = true;
    setLoading(true);
    setErro('');
    setImagemAtiva(0);

    axios
      .get<PecaDetalhe>(`/api/pecas/${pecaId}`, { timeout: 12000 })
      .then(({ data }) => {
        if (ativo) setPeca(data);
      })
      .catch((error: unknown) => {
        if (!ativo) return;

        if (axios.isAxiosError<{ error?: string }>(error)) {
          setErro(
            error.response?.data?.error || 'Não foi possível abrir a peça.'
          );
        } else {
          setErro('Não foi possível abrir a peça.');
        }
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [pecaId]);

  useEffect(() => {
    if (!pecaId) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pecaId, onClose]);

  const imagens = useMemo(() => {
    if (!peca) return [];
    if (peca.imagens?.length) return peca.imagens;
    if (peca.imagem_principal) {
      return [
        {
          id: 0,
          caminho: peca.imagem_principal,
          is_principal: 1,
          ordem: 0,
        },
      ];
    }
    if (peca.ml_thumbnail) {
      return [
        {
          id: 0,
          caminho: String(peca.ml_thumbnail).replace(/^http:\/\//i, 'https://'),
          is_principal: 1,
          ordem: 0,
        },
      ];
    }
    return [];
  }, [peca]);

  const atributos = useMemo(() => {
    if (!peca) return [];
    const valores = lerAtributos(peca.atributos);

    return camposDaCategoria(peca.categoria)
      .map((campo) => ({
        label: campo.label,
        valor: valores[campo.key] || '',
      }))
      .filter((item) => item.valor);
  }, [peca]);

  const qualidade = useMemo(
    () => (peca ? avaliarQualidadeMl(peca) : null),
    [peca]
  );

  if (!pecaId) return null;

  const statusMl = peca?.ml_ativo
    ? { label: 'Anúncio ativo', cor: 'text-success bg-successSoft border-success/20' }
    : { label: 'Anúncio pausado', cor: 'text-muted bg-white/[0.05] border-white/10' };

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
        aria-labelledby="peca-detalhe-titulo"
        className="modal-panel glass-panel flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-t-3xl border-white/20 sm:max-h-[94vh] sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Package className="h-3 w-3" />
              Ficha completa da peça
            </span>
            <h2
              id="peca-detalhe-titulo"
              className="mt-3 truncate text-2xl font-bold tracking-[-0.03em] text-ink"
            >
              {peca?.nome || 'Carregando peça...'}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-mono text-accent">{peca?.sku || 'Sem SKU'}</span>
              <span>•</span>
              <span>{peca?.categoria || 'Sem categoria'}</span>
              {peca?.carro && (
                <>
                  <span>•</span>
                  <span>{peca.carro}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {peca && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(peca)}
                className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accentSoft px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhes"
              className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-muted transition-colors hover:bg-white/[0.1] hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-muted">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              Carregando ficha completa...
            </div>
          ) : erro ? (
            <div className="rounded-2xl border border-danger/30 bg-dangerSoft p-5 text-sm text-danger">
              {erro}
            </div>
          ) : peca ? (
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-secondary">
                  {imagens.length > 0 ? (
                    <img
                      src={imagens[imagemAtiva]?.caminho}
                      alt={peca.nome}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 text-muted">
                      <ImageIcon className="h-12 w-12" />
                      <p className="text-xs">Nenhuma foto cadastrada</p>
                    </div>
                  )}
                </div>

                {imagens.length > 1 && (
                  <div className="grid grid-cols-5 gap-2">
                    {imagens.map((imagem, indice) => (
                      <button
                        key={imagem.id || indice}
                        type="button"
                        onClick={() => setImagemAtiva(indice)}
                        className={`overflow-hidden rounded-xl border transition-all ${
                          indice === imagemAtiva
                            ? 'border-accent ring-2 ring-accent/30'
                            : 'border-white/10 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={imagem.caminho}
                          alt={`${peca.nome} - foto ${indice + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Preço
                    </p>
                    <p className="mt-1 text-lg font-bold text-success">
                      {formatarMoeda(peca.preco)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Estoque
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {peca.quantidade} un.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Condição
                    </p>
                    <p className="mt-1 text-sm font-semibold capitalize text-cyan">
                      {peca.condicao || 'usado'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Garantia
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {peca.garantia || 'Sem garantia'}
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${statusMl.cor}`}>
                  {peca.ml_ativo ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {statusMl.label}
                  <span className="ml-auto font-normal text-muted">
                    {imagens.length}/20 foto(s)
                  </span>
                </div>

                {qualidade && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                        <Star className="h-3.5 w-3.5 text-warning" />
                        Qualidade no Mercado Livre
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                          qualidade.semAnuncio
                            ? 'border-white/10 bg-white/[0.04] text-muted'
                            : qualidade.badge
                        }`}
                      >
                        {qualidade.semAnuncio
                          ? 'Sem anúncio'
                          : `${qualidade.nota}/100 · ${qualidade.label}`}
                      </span>
                    </div>

                    {!qualidade.semAnuncio && (
                      <>
                        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={`h-full rounded-full ${qualidade.barra}`}
                            style={{ width: `${qualidade.nota ?? 0}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-muted">
                          {qualidade.detalhe}
                        </p>
                        {qualidade.pontos.length > 0 && (
                          <p className="mt-1.5 text-[11px] leading-relaxed text-warning">
                            Para melhorar: {qualidade.pontos.join(' • ')}.
                          </p>
                        )}
                      </>
                    )}

                    {qualidade.semAnuncio && (
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        {qualidade.detalhe}
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs text-muted">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-cyan" />
                    Cadastrada em {formatarData(peca.created_at)}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-accent" />
                    ID interno #{peca.id}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Tag className="h-4 w-4 text-accent" />
                    Anúncio
                  </h3>
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                        Título no Mercado Livre
                      </p>
                      <p className="mt-1 leading-relaxed text-ink">
                        {peca.ml_titulo || peca.nome}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                          Tipo de anúncio
                        </p>
                        <p className="mt-1 capitalize text-ink">
                          {peca.tipo_anuncio || 'Clássico'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                          Categoria ML
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-ink">
                          {peca.categoria_ml || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                          GTIN / EAN
                        </p>
                        <p className="mt-1 font-mono text-xs text-ink">
                          {peca.gtin || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                          Modo de compra
                        </p>
                        <p className="mt-1 text-ink">
                          {peca.modo_compra === 'auction'
                            ? 'Somente anúncio'
                            : 'Comprar agora'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                          Localização
                        </p>
                        <p className="mt-1 text-ink">
                          {peca.localizacao || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                          Vídeo
                        </p>
                        {peca.video_url ? (
                          <a
                            href={peca.video_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                          >
                            Abrir vídeo
                          </a>
                        ) : (
                          <p className="mt-1 text-ink">—</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Car className="h-4 w-4 text-cyan" />
                    Aplicação e identificação
                  </h3>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    {[
                      ['Veículo / aplicação', peca.carro || '—'],
                      ['Marca', peca.marca || '—'],
                      ['Modelo', peca.modelo || '—'],
                      ['Ano', peca.ano || '—'],
                      ['Condição', peca.condicao || '—'],
                      ['Garantia', peca.garantia || '—'],
                      ['Código OEM', peca.numero_oem || '—'],
                      ['Categoria', peca.categoria || '—'],
                    ].map(([label, valor]) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                          {label}
                        </p>
                        <p className="mt-1 text-ink">{valor}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {atributos.length > 0 && (
                  <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Barcode className="h-4 w-4 text-warning" />
                      Ficha técnica
                    </h3>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      {atributos.map((atributo) => (
                        <div key={atributo.label}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                            {atributo.label}
                          </p>
                          <p className="mt-1 text-ink">{atributo.valor}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Ruler className="h-4 w-4 text-success" />
                    Peso e dimensões
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    {[
                      ['Peso', peca.peso_kg ? `${peca.peso_kg} kg` : '—'],
                      ['Comprimento', formatarMedida(peca.comprimento_cm)],
                      ['Largura', formatarMedida(peca.largura_cm)],
                      ['Altura', formatarMedida(peca.altura_cm)],
                    ].map(([label, valor]) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                          {label}
                        </p>
                        <p className="mt-1 text-ink">{valor}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    Descrição do anúncio
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                    {peca.descricao || 'Nenhuma descrição cadastrada.'}
                  </p>
                </section>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
