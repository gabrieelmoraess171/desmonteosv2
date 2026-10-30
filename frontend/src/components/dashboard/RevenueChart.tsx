import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckSquare, Percent, Square, TrendingUp } from 'lucide-react';

export type PeriodoDashboard = 'hoje' | '7' | '15' | '30';

export const PERIODOS_DASHBOARD: Array<{
  chave: PeriodoDashboard;
  label: string;
}> = [
  { chave: 'hoje', label: 'Hoje' },
  { chave: '7', label: '7 dias' },
  { chave: '15', label: '15 dias' },
  { chave: '30', label: '30 dias' },
];

export interface SeriePonto {
  data: string;
  label: string;
  vendas: number;
  faturamento: number;
  faturamentoBruto?: number;
  taxaMl?: number;
  faturamentoLiquido?: number;
  cancelamentos?: number;
  valorCancelado?: number;
}

interface RevenueChartProps {
  serie: SeriePonto[];
  periodoDias: number;
  periodo: PeriodoDashboard;
  onPeriodChange: (periodo: PeriodoDashboard) => void;
}

type ModoValor = 'bruto' | 'liquido';

const LARGURA = 760;
const ALTURA = 300;
const MARGEM = { top: 24, right: 24, bottom: 40, left: 70 };
const LARGURA_INTERNA = LARGURA - MARGEM.left - MARGEM.right;
const ALTURA_INTERNA = ALTURA - MARGEM.top - MARGEM.bottom;

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function formatarCompacto(valor: number): string {
  if (valor >= 1000000) {
    return `R$ ${(valor / 1000000).toFixed(1).replace('.', ',')} mi`;
  }

  if (valor >= 1000) {
    return `R$ ${(valor / 1000).toFixed(1).replace('.', ',')} mil`;
  }

  return `R$ ${Math.round(valor)}`;
}

function caminhoSuave(pontos: Array<{ x: number; y: number }>): string {
  if (pontos.length === 0) return '';
  if (pontos.length === 1) return `M ${pontos[0].x} ${pontos[0].y}`;

  let caminho = `M ${pontos[0].x} ${pontos[0].y}`;

  for (let indice = 0; indice < pontos.length - 1; indice += 1) {
    const anterior = pontos[indice - 1] || pontos[indice];
    const atual = pontos[indice];
    const proximo = pontos[indice + 1];
    const depois = pontos[indice + 2] || proximo;

    const controle1x = atual.x + (proximo.x - anterior.x) / 6;
    const controle1y = atual.y + (proximo.y - anterior.y) / 6;
    const controle2x = proximo.x - (depois.x - atual.x) / 6;
    const controle2y = proximo.y - (depois.y - atual.y) / 6;

    caminho += ` C ${controle1x} ${controle1y}, ${controle2x} ${controle2y}, ${proximo.x} ${proximo.y}`;
  }

  return caminho;
}

export default function RevenueChart({
  serie,
  periodoDias,
  periodo,
  onPeriodChange,
}: RevenueChartProps) {
  const [indiceAtivo, setIndiceAtivo] = useState<number | null>(null);
  const [modoValor, setModoValor] = useState<ModoValor>('liquido');
  const [incluirCanceladas, setIncluirCanceladas] = useState(false);
  const [graficoVisivel, setGraficoVisivel] = useState(false);
  const graficoRef = useRef<HTMLDivElement | null>(null);
  const gradientId = `receita-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const elemento = graficoRef.current;
    if (!elemento || typeof IntersectionObserver === 'undefined') {
      setGraficoVisivel(true);
      return undefined;
    }

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setGraficoVisivel(true);
          observador.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const totais = useMemo(() => {
    return serie.reduce(
      (acumulado, ponto) => {
        const bruto = Number(ponto.faturamentoBruto ?? ponto.faturamento) || 0;
        const taxa = Number(ponto.taxaMl) || 0;
        const liquido =
          typeof ponto.faturamentoLiquido === 'number'
            ? ponto.faturamentoLiquido
            : Math.max(0, bruto - taxa);

        acumulado.bruto += bruto;
        acumulado.taxaMl += taxa;
        acumulado.liquido += liquido;
        acumulado.vendas += Number(ponto.vendas) || 0;
        acumulado.cancelamentos += Number(ponto.cancelamentos) || 0;
        acumulado.cancelado += Number(ponto.valorCancelado) || 0;
        return acumulado;
      },
      {
        bruto: 0,
        taxaMl: 0,
        liquido: 0,
        vendas: 0,
        cancelamentos: 0,
        cancelado: 0,
      }
    );
  }, [serie]);

  const valorBase = (ponto: SeriePonto) =>
    modoValor === 'liquido'
      ? Number(
          ponto.faturamentoLiquido ??
            Math.max(
              0,
              (Number(ponto.faturamentoBruto ?? ponto.faturamento) || 0) -
                (Number(ponto.taxaMl) || 0)
            )
        )
      : Number(ponto.faturamentoBruto ?? ponto.faturamento) || 0;

  const valorExibido = (ponto: SeriePonto) =>
    valorBase(ponto) +
    (incluirCanceladas ? Number(ponto.valorCancelado) || 0 : 0);

  const total = totais[modoValor];
  const totalExibido =
    total + (incluirCanceladas ? totais.cancelado : 0);
  const totalVendasExibidas =
    totais.vendas + (incluirCanceladas ? totais.cancelamentos : 0);
  const mediaDiaria = serie.length > 0 ? totalExibido / serie.length : 0;
  const melhorDia = useMemo(
    () =>
      serie.reduce<SeriePonto | null>((melhor, ponto) => {
        if (!melhor || valorExibido(ponto) > valorExibido(melhor)) {
          return ponto;
        }
        return melhor;
      }, null),
    [serie, modoValor, incluirCanceladas]
  );

  const maximo = Math.max(10, ...serie.map((ponto) => valorExibido(ponto)));
  const passoX =
    serie.length > 1 ? LARGURA_INTERNA / (serie.length - 1) : LARGURA_INTERNA;

  const pontos = serie.map((ponto, indice) => ({
    ...ponto,
    valor: valorExibido(ponto),
    x: MARGEM.left + indice * passoX,
    y:
      MARGEM.top +
      ALTURA_INTERNA -
      (valorExibido(ponto) / maximo) * ALTURA_INTERNA,
  }));

  const linha = caminhoSuave(pontos);
  const area =
    pontos.length > 0
      ? `${linha} L ${pontos[pontos.length - 1].x} ${
          MARGEM.top + ALTURA_INTERNA
        } L ${pontos[0].x} ${MARGEM.top + ALTURA_INTERNA} Z`
      : '';

  const passoRotulo = Math.max(1, Math.ceil(serie.length / 7));
  const ativo = indiceAtivo !== null ? pontos[indiceAtivo] : null;
  const tooltipLargura = 200;
  const tooltipAltura = 92;
  const mediaRotulo = periodo === 'hoje' ? 'Média por hora' : 'Média por dia';
  const melhorRotulo = periodo === 'hoje' ? 'Melhor hora' : 'Melhor dia';
  const periodoLabel =
    PERIODOS_DASHBOARD.find((item) => item.chave === periodo)?.label || 'Período';
  const rotuloValor = modoValor === 'liquido' ? 'Líquido' : 'Bruto';
  const tooltipX = ativo
    ? Math.min(
        Math.max(ativo.x - tooltipLargura / 2, MARGEM.left),
        LARGURA - MARGEM.right - tooltipLargura
      )
    : 0;
  const tooltipY = ativo
    ? Math.max(ativo.y - tooltipAltura - 12, 8)
    : 0;

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Desempenho
          </p>
          <h2 className="mt-1 text-xl font-bold">
            {periodo === 'hoje' ? 'Faturamento por hora' : 'Faturamento por dia'}
          </h2>
          <p className="text-sm text-muted">
            {periodo === 'hoje'
              ? `Hoje • ${totais.vendas} venda(s)${
                  incluirCanceladas && totais.cancelamentos > 0
                    ? ` • ${totais.cancelamentos} cancelada(s)`
                    : ''
                }`
              : `Últimos ${periodoDias} dias • ${totais.vendas} venda(s)${
                  incluirCanceladas && totais.cancelamentos > 0
                    ? ` • ${totais.cancelamentos} cancelada(s)`
                    : ''
                }`}
          </p>
        </div>

        <div className="min-w-0 text-left sm:text-right">
          <p
            className={`text-2xl font-bold ${
              modoValor === 'liquido' ? 'text-success' : 'text-ink'
            }`}
          >
            {formatarMoeda(totalExibido)}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted sm:justify-end">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
            {mediaRotulo} de {formatarMoeda(mediaDiaria)}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {rotuloValor} • taxa ML {formatarMoeda(totais.taxaMl)}
            {incluirCanceladas
              ? ` • +${formatarMoeda(totais.cancelado)} canceladas`
              : ''}
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex w-full flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:w-fit">
          {PERIODOS_DASHBOARD.map((item) => {
            const ativoPeriodo = item.chave === periodo;

            return (
              <button
                key={item.chave}
                type="button"
                onClick={() => onPeriodChange(item.chave)}
                aria-pressed={ativoPeriodo}
                className={`flex-1 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-300 sm:flex-none ${
                  ativoPeriodo
                    ? 'bg-accent text-white shadow-[0_8px_22px_-12px_rgba(76,157,255,0.9)]'
                    : 'text-muted hover:bg-white/[0.06] hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setModoValor('bruto')}
              aria-pressed={modoValor === 'bruto'}
              className={`rounded-md px-2.5 py-1.5 transition-colors ${
                modoValor === 'bruto'
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Bruto
            </button>
            <button
              type="button"
              onClick={() => setModoValor('liquido')}
              aria-pressed={modoValor === 'liquido'}
              className={`rounded-md px-2.5 py-1.5 transition-colors ${
                modoValor === 'liquido'
                  ? 'bg-success text-white'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Líquido
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIncluirCanceladas((valor) => !valor)}
            aria-pressed={incluirCanceladas}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              incluirCanceladas
                ? 'border-warning/30 bg-warningSoft text-warning'
                : 'border-white/10 bg-white/[0.04] text-muted hover:text-ink'
            }`}
          >
            {incluirCanceladas ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            Incluir canceladas ({totais.cancelamentos})
          </button>
        </div>
      </div>

      <div
        key={`${periodo}-${serie.map((ponto) => `${ponto.data}-${ponto.vendas}-${ponto.faturamento}`).join('|')}`}
        ref={graficoRef}
        className={`liquid-chart-shell relative min-w-0 overflow-hidden rounded-xl border border-white/[0.06] p-2 sm:p-3 ${graficoVisivel ? 'chart-in-view' : ''}`}
      >
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          className="h-[18rem] w-full overflow-visible sm:h-[24rem]"
          role="img"
          aria-label={`Gráfico de faturamento ${rotuloValor.toLowerCase()} • ${periodoLabel}`}
          onMouseLeave={() => setIndiceAtivo(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={modoValor === 'liquido' ? '#30D158' : '#4C9DFF'}
                stopOpacity="0.35"
              />
              <stop
                offset="100%"
                stopColor={modoValor === 'liquido' ? '#30D158' : '#4C9DFF'}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3, 4].map((linhaGrade) => {
            const y = MARGEM.top + (ALTURA_INTERNA / 4) * linhaGrade;
            const valor = maximo - (maximo / 4) * linhaGrade;

            return (
              <g key={linhaGrade}>
                <line
                  x1={MARGEM.left}
                  y1={y}
                  x2={LARGURA - MARGEM.right}
                  y2={y}
                  stroke="rgba(178,205,237,0.13)"
                  strokeWidth="1"
                  strokeDasharray={linhaGrade === 4 ? '0' : '4 6'}
                />
                <text
                  x={MARGEM.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#A7B9CE"
                >
                  {formatarCompacto(valor)}
                </text>
              </g>
            );
          })}

          {serie.length > 0 && (
            <>
              <path className="chart-area-enter" d={area} fill={`url(#${gradientId})`} />
              <path
                className="chart-line-enter"
                d={linha}
                fill="none"
                stroke={modoValor === 'liquido' ? '#30D158' : '#4C9DFF'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {pontos.map((ponto, indice) => (
            <g key={ponto.data}>
              {(indice % passoRotulo === 0 || indice === pontos.length - 1) && (
                <text
                  x={ponto.x}
                  y={ALTURA - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#A7B9CE"
                >
                  {ponto.label}
                </text>
              )}
              {ponto.valor > 0 && (
                <circle
                  className="chart-point-enter"
                  style={{ animationDelay: `${indice * 35}ms` }}
                  cx={ponto.x}
                  cy={ponto.y}
                  r={indiceAtivo === indice ? 6 : 4}
                  fill="#050A14"
                  stroke="#64D2FF"
                  strokeWidth="2.5"
                />
              )}
              <rect
                x={ponto.x - passoX / 2}
                y={MARGEM.top}
                width={Math.max(passoX, 1)}
                height={ALTURA_INTERNA}
                fill="transparent"
                onPointerEnter={() => setIndiceAtivo(indice)}
                onPointerMove={() => setIndiceAtivo(indice)}
                onPointerDown={() => setIndiceAtivo(indice)}
                onFocus={() => setIndiceAtivo(indice)}
                tabIndex={0}
              >
                <title>
                  {ponto.label}: {formatarMoeda(ponto.valor)} •{' '}
                  {ponto.vendas} venda(s)
                </title>
              </rect>
            </g>
          ))}

          {ativo && (
            <g pointerEvents="none">
              <line
                x1={ativo.x}
                y1={MARGEM.top}
                x2={ativo.x}
                y2={MARGEM.top + ALTURA_INTERNA}
                stroke="#64D2FF"
                strokeWidth="1"
                strokeDasharray="4 5"
                opacity="0.6"
              />
              <rect
                x={tooltipX}
                y={tooltipY}
                width={tooltipLargura}
                height={tooltipAltura}
                rx="8"
                fill="#07111F"
                stroke="rgba(178,205,237,0.13)"
              />
              <text
                x={tooltipX + 12}
                y={tooltipY + 18}
                fontSize="11"
                fill="#A7B9CE"
              >
                {ativo.label}
              </text>
              <text
                x={tooltipX + 12}
                y={tooltipY + 38}
                fontSize="14"
                fontWeight="700"
                fill={modoValor === 'liquido' ? '#30D158' : '#64D2FF'}
              >
                {formatarMoeda(ativo.valor)}
              </text>
              <text
                x={tooltipX + 12}
                y={tooltipY + 55}
                fontSize="10"
                fill="#A7B9CE"
              >
                {ativo.vendas} venda(s)
                {Number(ativo.taxaMl) > 0
                  ? ` • taxa ${formatarMoeda(Number(ativo.taxaMl))}`
                  : ''}
              </text>
              <text
                x={tooltipX + 12}
                y={tooltipY + 70}
                fontSize="10"
                fill="#A7B9CE"
              >
                Bruto {formatarMoeda(Number(ativo.faturamentoBruto ?? ativo.faturamento))}
              </text>
              <text
                x={tooltipX + 12}
                y={tooltipY + 84}
                fontSize="10"
                fill="#FFD60A"
              >
                Canceladas {ativo.cancelamentos || 0} •{' '}
                {formatarMoeda(Number(ativo.valorCancelado) || 0)}
              </text>
            </g>
          )}
        </svg>

        {totalExibido === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-line bg-sidebar/90 px-4 py-2 text-sm text-muted">
              Ainda não há vendas neste período
            </div>
          </div>
        )}
      </div>

      {incluirCanceladas && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-warning/20 bg-warningSoft px-3 py-2 text-xs text-warning">
          <Percent className="h-3.5 w-3.5 shrink-0" />
          Canceladas somam {formatarMoeda(totais.cancelado)} em{' '}
          {totais.cancelamentos} pedido(s) no período.
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">{melhorRotulo}</p>
          <p className="mt-1 font-semibold">
            {melhorDia && valorExibido(melhorDia) > 0
              ? `${melhorDia.label} • ${formatarMoeda(valorExibido(melhorDia))}`
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            Média por venda
          </p>
          <p className="mt-1 font-semibold">
            {totalVendasExibidas > 0
              ? formatarMoeda(totalExibido / totalVendasExibidas)
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Taxa ML</p>
          <p className="mt-1 font-semibold text-warning">
            {formatarMoeda(totais.taxaMl)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            Faturamento líquido
          </p>
          <p className="mt-1 font-semibold text-success">
            {formatarMoeda(totais.liquido)}
          </p>
        </div>
      </div>
    </section>
  );
}
