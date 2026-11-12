import { AlertTriangle, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';

export interface ResumoFichaIa {
  nome: string;
  ml_titulo: string;
  categoria: string;
  categoria_ml: string;
  lado: string;
  acionamento: string;
  veiculo: string;
  marca: string;
  modelo: string;
  ano: string;
  preco: string;
  peso: string;
  medidas: string;
  descricao: string;
  numero_oem: string;
  gtin: string;
  atributosMl: number;
}

interface FichaRevisaoIaProps {
  resumo: ResumoFichaIa;
  estimados: string[];
  fonte: string;
  aviso: string;
  imagensAnalisadas?: number;
  ocupado: boolean;
  onRepetir: () => void;
  onRevisar: () => void;
}

function estaEstimado(estimados: string[], rotulo: string): boolean {
  const alvo = rotulo.toLowerCase();
  return estimados.some((item) => item.toLowerCase().includes(alvo));
}

function Linha({
  rotulo,
  valor,
  estimado,
  largo = false,
}: {
  rotulo: string;
  valor: string;
  estimado: boolean;
  largo?: boolean;
}) {
  return (
    <div className={largo ? 'sm:col-span-2' : ''}>
      <dt className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {rotulo}
        {estimado && (
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-warning">
            <AlertTriangle className="h-2.5 w-2.5" />
            estimado
          </span>
        )}
      </dt>
      <dd
        className={`mt-0.5 text-sm ${
          valor ? 'text-ink' : 'text-muted italic'
        } ${largo ? 'line-clamp-3' : 'truncate'}`}
      >
        {valor || 'não identificado'}
      </dd>
    </div>
  );
}

export default function FichaRevisaoIa({
  resumo,
  estimados,
  fonte,
  aviso,
  imagensAnalisadas,
  ocupado,
  onRepetir,
  onRevisar,
}: FichaRevisaoIaProps) {
  const identificacao = [resumo.lado, resumo.acionamento]
    .filter(Boolean)
    .join(' · ');
  const veiculo = [resumo.marca, resumo.modelo, resumo.ano]
    .filter(Boolean)
    .join(' · ');

  return (
    <section
      aria-label="Revisão do que a IA identificou"
      className="rounded-xl border border-accent/30 bg-accentSoft/60 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            <Sparkles className="h-3 w-3" />
            A IA identificou · revise
          </p>
          <p className="mt-1 text-base font-semibold text-ink">
            {resumo.nome || resumo.categoria || 'Peça identificada'}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {[resumo.categoria, identificacao].filter(Boolean).join(' · ') ||
              'Categoria não identificada'}
            {veiculo ? ` · ${veiculo}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRepetir}
            disabled={ocupado}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${ocupado ? 'animate-spin' : ''}`} />
            Identificar novamente
          </button>
          <button
            type="button"
            onClick={onRevisar}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-all hover:brightness-110"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Revisar campos
          </button>
        </div>
      </div>

      <dl className="mt-3 grid gap-x-4 gap-y-2.5 rounded-xl border border-white/10 bg-black/10 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <Linha
          rotulo="Título"
          valor={resumo.ml_titulo}
          estimado={estaEstimado(estimados, 'título') || estaEstimado(estimados, 'titulo')}
          largo
        />
        <Linha
          rotulo="Categoria ML"
          valor={resumo.categoria_ml}
          estimado={estaEstimado(estimados, 'categoria')}
        />
        <Linha
          rotulo="Preço"
          valor={resumo.preco}
          estimado={estaEstimado(estimados, 'preço') || estaEstimado(estimados, 'preco')}
        />
        <Linha rotulo="OEM" valor={resumo.numero_oem} estimado={estaEstimado(estimados, 'oem')} />
        <Linha rotulo="GTIN / EAN" valor={resumo.gtin} estimado={estaEstimado(estimados, 'gtin')} />
        <Linha rotulo="Peso" valor={resumo.peso} estimado={estaEstimado(estimados, 'peso')} />
        <Linha
          rotulo="Medidas"
          valor={resumo.medidas}
          estimado={estaEstimado(estimados, 'medida') || estaEstimado(estimados, 'dimens')}
        />
        <Linha
          rotulo="Descrição"
          valor={resumo.descricao}
          estimado={estaEstimado(estimados, 'descri')}
          largo
        />
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {resumo.atributosMl > 0 && (
          <span className="font-semibold text-success">
            {resumo.atributosMl} atributo(s) do Mercado Livre preenchidos
          </span>
        )}
        {estimados.length > 0 && (
          <span className="font-semibold text-warning">
            {estimados.length} campo(s) estimado(s) — confira antes de salvar
          </span>
        )}
        {imagensAnalisadas ? <span>{imagensAnalisadas} foto(s) lida(s)</span> : null}
        {fonte ? <span>fonte: {fonte}</span> : null}
      </div>

      {aviso && <p className="mt-2 text-[11px] leading-relaxed text-muted">{aviso}</p>}
    </section>
  );
}
