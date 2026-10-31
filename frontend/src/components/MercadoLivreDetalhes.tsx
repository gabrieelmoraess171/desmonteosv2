import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Car, Loader2, PackageCheck, Truck } from 'lucide-react';
import axios from 'axios';

interface MercadoLivreAtributo {
  id?: string;
  name?: string;
  value_id?: string | null;
  value_name?: string | null;
}

interface MercadoLivreCompatibilidade {
  attributes?: MercadoLivreAtributo[];
  note?: string | null;
  restrictions?: unknown[];
}

interface MercadoLivreDetalhesData {
  id?: string;
  site_id?: string;
  title?: string;
  listing_type_id?: string;
  tipo_anuncio?: string;
  category_id?: string;
  price?: number;
  original_price?: number | null;
  base_price?: number | null;
  currency_id?: string;
  initial_quantity?: number;
  available_quantity?: number;
  sold_quantity?: number;
  condition?: string;
  status?: string;
  buying_mode?: string;
  permalink?: string;
  catalog_listing?: boolean;
  catalog_product_id?: string;
  family_name?: string;
  family_id?: number | string;
  user_product_id?: string;
  expiration_time?: string;
  tags?: string[];
  sale_terms?: Array<{ id?: string; name?: string; value_name?: string }>;
  shipping?: Record<string, unknown>;
  attributes?: MercadoLivreAtributo[];
  pictures?: unknown[];
  variations?: unknown[];
  descricao_ml?: string;
  compatibilidades?: MercadoLivreCompatibilidade[];
}

interface MercadoLivreDetalhesProps {
  pecaId: number;
  compact?: boolean;
}

function textoTipo(valor?: string): string {
  const tipo = String(valor || '').toLowerCase().replace(/[-\s]+/g, '_');
  if (['gold_pro', 'gold_premium', 'premium'].includes(tipo)) return 'Premium';
  if (['free', 'gratis', 'grátis'].includes(tipo)) return 'Grátis';
  return 'Clássico';
}

function valorAtributo(atributo: MercadoLivreAtributo): string {
  return String(atributo.value_name || atributo.value_id || '').trim();
}

function nomeAtributo(atributo: MercadoLivreAtributo): string {
  return String(atributo.name || atributo.id || 'Atributo').trim();
}

function valorGenerico(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return String(valor);
}

export default function MercadoLivreDetalhes({
  pecaId,
  compact = false,
}: MercadoLivreDetalhesProps) {
  const [dados, setDados] = useState<MercadoLivreDetalhesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro('');
    setDados(null);

    axios
      .get<{ mercado_livre?: MercadoLivreDetalhesData | null }>(
        `/api/mercadolivre/pecas/${pecaId}/detalhes`,
        { timeout: 30000 }
      )
      .then(({ data }) => {
        if (ativo) setDados(data.mercado_livre || null);
      })
      .catch((error: unknown) => {
        if (!ativo) return;
        setErro(
          axios.isAxiosError<{ error?: string }>(error)
            ? error.response?.data?.error || 'Não foi possível carregar os dados atuais do Mercado Livre.'
            : 'Não foi possível carregar os dados atuais do Mercado Livre.'
        );
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [pecaId]);

  const atributos = useMemo(
    () =>
      (dados?.attributes || [])
        .map((atributo) => ({
          nome: nomeAtributo(atributo),
          valor: valorAtributo(atributo),
        }))
        .filter((item) => item.valor),
    [dados?.attributes]
  );

  const compatibilidades = dados?.compatibilidades || [];
  const shipping = dados?.shipping || {};

  if (loading) {
    return (
      <section className="rounded-2xl border border-accent/20 bg-accentSoft/40 p-3.5 text-xs text-muted">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Carregando dados atuais do Mercado Livre...
        </div>
      </section>
    );
  }

  if (erro) {
    return (
      <section className="flex items-start gap-2 rounded-2xl border border-warning/25 bg-warningSoft p-3.5 text-xs leading-relaxed text-warning">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{erro}</span>
      </section>
    );
  }

  if (!dados) return null;

  return (
    <section className="rounded-2xl border border-cyan/20 bg-cyan/5 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan">
            Dados atuais do Mercado Livre
          </p>
          {!compact && dados.title && (
            <p className="mt-1 text-sm font-semibold text-ink">{dados.title}</p>
          )}
        </div>
        <span className="rounded-full border border-cyan/25 bg-cyan/10 px-2.5 py-1 text-[11px] font-bold text-cyan">
          {textoTipo(dados.listing_type_id || dados.tipo_anuncio)}
        </span>
      </div>

      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['ID do anúncio', dados.id],
          ['Status', dados.status],
          ['Preço ML', dados.price ? `R$ ${Number(dados.price).toFixed(2).replace('.', ',')}` : '—'],
          ['Preço original', dados.original_price ? `R$ ${Number(dados.original_price).toFixed(2).replace('.', ',')}` : '—'],
          ['Disponível', dados.available_quantity],
          ['Vendidos', dados.sold_quantity],
          ['Estoque inicial', dados.initial_quantity],
          ['Categoria', dados.category_id],
          ['Modo de compra', dados.buying_mode],
          ['Moeda', dados.currency_id],
          ['Catálogo', dados.catalog_listing ? 'Sim' : 'Não'],
          ['Fotos no ML', dados.pictures?.length || 0],
          ['Variações', dados.variations?.length || 0],
        ].map(([label, valor]) => (
          <div key={label}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
            <p className="mt-1 break-words font-medium text-ink">{valorGenerico(valor)}</p>
          </div>
        ))}
      </div>

      {dados.descricao_ml && (
        <details className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <summary className="cursor-pointer text-xs font-semibold text-ink">Descrição atual do ML</summary>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">{dados.descricao_ml}</p>
        </details>
      )}

      {atributos.length > 0 && (
        <details open={!compact} className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <summary className="cursor-pointer text-xs font-semibold text-ink">Atributos atuais ({atributos.length})</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {atributos.map((atributo) => (
              <div key={`${atributo.nome}-${atributo.valor}`}>
                <p className="text-[10px] uppercase tracking-[0.1em] text-muted">{atributo.nome}</p>
                <p className="mt-0.5 break-words text-xs text-ink">{atributo.valor}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {compatibilidades.length > 0 && (
        <details open={!compact} className="mt-3 rounded-xl border border-success/20 bg-successSoft/40 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
            <Car className="h-3.5 w-3.5 text-success" />
            Compatibilidades atuais ({compatibilidades.length})
          </summary>
          <div className="mt-3 space-y-2">
            {compatibilidades.map((grupo, indice) => {
              const texto = (grupo.attributes || [])
                .map((atributo) => `${nomeAtributo(atributo)}: ${valorAtributo(atributo)}`)
                .filter(Boolean)
                .join(' • ');
              return (
                <div key={`${texto}-${indice}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs text-muted">
                  {texto || `Grupo de compatibilidade ${indice + 1}`}
                  {grupo.note ? <span className="mt-1 block text-ink">{grupo.note}</span> : null}
                </div>
              );
            })}
          </div>
        </details>
      )}

      <details className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
          <PackageCheck className="h-3.5 w-3.5 text-accent" />
          Termos, logística e dados completos
        </summary>
        <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
          <p><Truck className="mr-1 inline h-3.5 w-3.5 text-cyan" />Frete: {valorGenerico(shipping.mode)}</p>
          <p>Frete grátis: {valorGenerico(shipping.free_shipping)}</p>
          <p>Produto catálogo: {valorGenerico(dados.catalog_product_id)}</p>
          <p>Família: {valorGenerico(dados.family_name)}</p>
        </div>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-2 text-[10px] leading-relaxed text-muted">
          {JSON.stringify(dados, null, 2)}
        </pre>
      </details>
    </section>
  );
}
