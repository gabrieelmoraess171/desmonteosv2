import { mapearReputacaoMl } from './mlReputacao.js';
import { tipoPeca } from './tipoPeca.js';

const STATUS_INVALIDOS =
  "'cancelada', 'cancelled', 'canceled', 'refunded', 'reembolsada'";
const STATUS_CONCLUIDOS = [
  'concluida',
  'entregue',
  'delivered',
  'paid',
  'completed'
];
const STATUS_ANDAMENTO = ['enviada', 'pendente', 'shipped', 'pending'];
const STATUS_CANCELADOS = [
  'cancelada',
  'cancelled',
  'canceled',
  'refunded',
  'reembolsada'
];

const PERIODOS = {
  hoje: { chave: 'hoje', dias: 1, label: 'Hoje', descricao: 'Hoje • por hora' },
  '7': { chave: '7', dias: 7, label: '7 dias', descricao: 'Últimos 7 dias' },
  '15': {
    chave: '15',
    dias: 15,
    label: '15 dias',
    descricao: 'Últimos 15 dias'
  },
  '30': {
    chave: '30',
    dias: 30,
    label: '30 dias',
    descricao: 'Últimos 30 dias'
  }
};

export function normalizarPeriodo(valor) {
  const chave = String(valor || '').trim();

  if (PERIODOS[chave]) return PERIODOS[chave];

  const dias = Number(chave);
  if (Number.isFinite(dias)) {
    if (dias <= 1) return PERIODOS.hoje;
    if (dias <= 7) return PERIODOS['7'];
    if (dias <= 15) return PERIODOS['15'];
    if (dias <= 30) return PERIODOS['30'];
  }

  return PERIODOS['7'];
}

function condicaoPeriodo(periodo) {
  // As datas são gravadas em UTC pelo SQLite; convertemos para o fuso local
  // antes de comparar para que o "dia" acompanhe o horário de Brasília.
  if (periodo.chave === 'hoje') {
    return {
      atual: "DATE(data_venda, 'localtime') = DATE('now', 'localtime')",
      anterior:
        "DATE(data_venda, 'localtime') = DATE('now', 'localtime', '-1 day')"
    };
  }

  return {
    atual: `DATE(data_venda, 'localtime') >= DATE('now', 'localtime', '-${periodo.dias - 1} days')`,
    anterior: `DATE(data_venda, 'localtime') >= DATE('now', 'localtime', '-${periodo.dias * 2 - 1} days')
      AND DATE(data_venda, 'localtime') < DATE('now', 'localtime', '-${periodo.dias - 1} days')`
  };
}

function numero(valor) {
  return Number.isFinite(Number(valor)) ? Number(valor) : 0;
}

function variacao(atual, anterior) {
  if (!Number.isFinite(anterior) || anterior <= 0) return null;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
}

function dataLocalISO(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function hojeLocal() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

function arredondarValor(valor) {
  return Number(numero(valor).toFixed(2));
}

function normalizarChaveDia(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }

  const texto = String(valor || '').trim();
  return texto.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || texto;
}

function montarPontoSerie(data, label, registro) {
  const vendas = numero(registro?.vendas);
  const faturamentoBruto = arredondarValor(registro?.faturamento);
  const taxaMl = arredondarValor(registro?.taxas_ml);
  const cancelamentos = numero(registro?.cancelamentos);
  const valorCancelado = arredondarValor(registro?.valor_cancelado);

  return {
    data,
    label,
    vendas,
    faturamento: faturamentoBruto,
    faturamentoBruto,
    taxaMl,
    faturamentoLiquido: arredondarValor(
      Math.max(0, faturamentoBruto - taxaMl)
    ),
    cancelamentos,
    valorCancelado
  };
}

function gerarSerieDiaria(rows, dias) {
  const mapa = new Map(
    rows.map((row) => [normalizarChaveDia(row.dia), row])
  );
  const base = hojeLocal();
  const serie = [];

  for (let indice = dias - 1; indice >= 0; indice -= 1) {
    const data = new Date(base);
    data.setDate(data.getDate() - indice);
    const chave = dataLocalISO(data);
    const registro = mapa.get(chave);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');

    serie.push(montarPontoSerie(chave, `${dia}/${mes}`, registro));
  }

  return serie;
}

function gerarSerieHoraria(rows) {
  const mapa = new Map(
    rows.map((row) => [String(row.hora).padStart(2, '0'), row])
  );
  const serie = [];

  for (let hora = 0; hora < 24; hora += 1) {
    const chave = String(hora).padStart(2, '0');
    const registro = mapa.get(chave);

    serie.push(
      montarPontoSerie(`${dataLocalISO()}T${chave}:00`, `${chave}h`, registro)
    );
  }

  return serie;
}

function montarInsights({
  semFoto,
  semDescricao,
  semCategoria,
  semMedidas,
  semEstoque,
  pausados,
  perguntasPendentes,
  reclamacoesAbertas,
  topTipoPeca,
  vendasPeriodo,
  faturamentoPeriodo,
  variacaoFaturamento
}) {
  const insights = [];

  if (semEstoque > 0) {
    insights.push({
      id: 'sem-estoque',
      titulo: `${semEstoque} anúncio(s) sem estoque`,
      descricao:
        'Reponha as peças ou pause os anúncios para não perder posição no Mercado Livre.',
      prioridade: 'alta',
      destino: 'lotes',
      cta: 'Ver estoque'
    });
  }

  if (semFoto > 0) {
    insights.push({
      id: 'sem-foto',
      titulo: `${semFoto} anúncio(s) sem fotos`,
      descricao:
        'Anúncios com fotos claras recebem mais cliques. Adicione até 20 imagens por peça.',
      prioridade: 'alta',
      destino: 'lotes',
      cta: 'Revisar anúncios'
    });
  }

  if (reclamacoesAbertas > 0) {
    insights.push({
      id: 'reclamacoes',
      titulo: `${reclamacoesAbertas} reclamação(ões) em aberto`,
      descricao:
        'Responder rápido reduz o impacto na reputação e ajuda a manter o selo de boa reputação.',
      prioridade: 'alta',
      destino: 'atendimento',
      cta: 'Abrir atendimento'
    });
  }

  if (perguntasPendentes > 0) {
    insights.push({
      id: 'perguntas',
      titulo: `${perguntasPendentes} pergunta(s) sem resposta`,
      descricao:
        'Perguntas respondidas em até 1 hora aumentam a chance de conversão da visita em venda.',
      prioridade: 'alta',
      destino: 'atendimento',
      cta: 'Responder perguntas'
    });
  }

  if (semCategoria > 0) {
    insights.push({
      id: 'sem-categoria',
      titulo: `${semCategoria} peça(s) sem categoria`,
      descricao:
        'A categoria alimenta o ranking inteligente e a ficha técnica sugerida para o anúncio.',
      prioridade: 'media',
      destino: 'lotes',
      cta: 'Completar cadastros'
    });
  }

  if (semDescricao > 0) {
    insights.push({
      id: 'descricao-curta',
      titulo: `${semDescricao} anúncio(s) com descrição curta`,
      descricao:
        'Descreva aplicação, condição, marca e garantia. Uma ficha completa reduz dúvidas e devoluções.',
      prioridade: 'media',
      destino: 'lotes',
      cta: 'Melhorar descrições'
    });
  }

  if (semMedidas > 0) {
    insights.push({
      id: 'sem-medidas',
      titulo: `${semMedidas} anúncio(s) sem peso ou medidas`,
      descricao:
        'Peso e dimensões são usados no cálculo do frete. Preencher evita cobranças e atrasos.',
      prioridade: 'media',
      destino: 'lotes',
      cta: 'Preencher medidas'
    });
  }

  if (topTipoPeca) {
    insights.push({
      id: 'tipo-peca-lider',
      titulo: `${topTipoPeca.tipo} lidera as vendas`,
      descricao: `O tipo de peça soma ${topTipoPeca.vendas} venda(s), ${topTipoPeca.unidades} unidade(s) e ${formatarMoeda(
        topTipoPeca.faturamento
      )} no período. Vale ampliar o estoque de peças semelhantes, independente da marca.`,
      prioridade: 'baixa',
      destino: 'lotes',
      cta: 'Ver estoque'
    });
  }

  if (vendasPeriodo === 0) {
    insights.push({
      id: 'sem-vendas',
      titulo: 'Nenhuma venda no período',
      descricao:
        'Revise títulos, preços e fotos dos anúncios ativos. Também vale responder perguntas e reativar peças pausadas.',
      prioridade: 'media',
      destino: 'lotes',
      cta: 'Revisar anúncios'
    });
  } else if (
    variacaoFaturamento !== null &&
    variacaoFaturamento < -10
  ) {
    insights.push({
      id: 'queda-faturamento',
      titulo: `Faturamento ${Math.abs(variacaoFaturamento)}% menor`,
      descricao:
        'Compare os anúncios com melhor desempenho, ajuste preços e reforce as categorias que mais converteram.',
      prioridade: 'media',
      destino: 'lotes',
      cta: 'Analisar anúncios'
    });
  } else if (faturamentoPeriodo > 0) {
    insights.push({
      id: 'operacao-saudavel',
      titulo: 'Operação saudável',
      descricao:
        'Mantenha fotos, ficha técnica e respostas em dia para preservar o ritmo de vendas.',
      prioridade: 'baixa',
      destino: 'lotes',
      cta: 'Ver estoque'
    });
  }

  if (pausados > 0) {
    insights.push({
      id: 'pausados',
      titulo: `${pausados} peça(s) fora do Mercado Livre`,
      descricao:
        'Peças cadastradas e não publicadas podem ser oportunidades de faturamento adicional.',
      prioridade: 'baixa',
      destino: 'lotes',
      cta: 'Ver peças'
    });
  }

  const peso = { alta: 0, media: 1, baixa: 2 };
  const vistos = new Set();

  return insights
    .filter((item) => {
      if (vistos.has(item.id)) return false;
      vistos.add(item.id);
      return true;
    })
    .sort((a, b) => peso[a.prioridade] - peso[b.prioridade])
    .slice(0, 5);
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numero(valor));
}

function formatarPercentual(valor) {
  return `${Number(valor || 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 1
  })}%`;
}

async function obterReputacaoMl(db) {
  const [vendas, reclamacoes, perguntas] = await Promise.all([
    db.get(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status IN (${STATUS_CONCLUIDOS
           .map((status) => `'${status}'`)
           .join(', ')}) THEN 1 ELSE 0 END), 0) AS concluidas,
         COALESCE(SUM(CASE WHEN status NOT IN (${STATUS_INVALIDOS}) THEN 1 ELSE 0 END), 0) AS validas,
         COALESCE(SUM(CASE WHEN status IN (${STATUS_CANCELADOS
           .map((status) => `'${status}'`)
           .join(', ')}) THEN 1 ELSE 0 END), 0) AS canceladas
       FROM vendas
       WHERE DATE(data_venda, 'localtime') >= DATE('now', 'localtime', '-59 days')`
    ),
    db.get(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE
           WHEN status NOT IN ('resolvida', 'resolvido', 'fechada', 'closed') THEN 1
           ELSE 0
         END), 0) AS abertas
       FROM reclamacoes_ml
       WHERE DATE(data_reclamacao, 'localtime') >= DATE('now', 'localtime', '-59 days')`
    ),
    db.get(
      `SELECT COUNT(*) AS pendentes
       FROM perguntas_ml
       WHERE respondida = 0`
    )
  ]);

  const totalPedidos = numero(vendas?.total);
  const vendasValidas = numero(vendas?.validas);
  const cancelamentos = numero(vendas?.canceladas);
  const reclamacoesTotal = numero(reclamacoes?.total);
  const reclamacoesAbertas = numero(reclamacoes?.abertas);
  const perguntasPendentes = numero(perguntas?.pendentes);
  const taxaReclamacoes =
    vendasValidas > 0 ? (reclamacoesTotal / vendasValidas) * 100 : 0;
  const taxaCancelamentos =
    totalPedidos > 0 ? (cancelamentos / totalPedidos) * 100 : 0;
  const termometro = Number(
    Math.max(
      0,
      Math.min(
        5,
        5 -
          reclamacoesAbertas * 0.15 -
          Math.min(taxaCancelamentos, 20) * 0.08 -
          perguntasPendentes * 0.02
      )
    ).toFixed(1)
  );
  const score = Math.round(termometro * 20);
  const nivel =
    score >= 90
      ? 'Excelente'
      : score >= 80
        ? 'Boa'
        : score >= 65
          ? 'Atenção'
          : 'Crítica';
  const cor = score >= 80 ? 'success' : score >= 65 ? 'warning' : 'danger';
  const statusReclamacoes =
    taxaReclamacoes <= 2
      ? 'success'
      : taxaReclamacoes <= 5
        ? 'warning'
        : 'danger';
  const statusCancelamentos =
    taxaCancelamentos <= 2
      ? 'success'
      : taxaCancelamentos <= 5
        ? 'warning'
        : 'danger';
  const statusPerguntas =
    perguntasPendentes === 0
      ? 'success'
      : perguntasPendentes <= 3
        ? 'warning'
        : 'danger';
  const problemas = [];

  if (reclamacoesAbertas > 0) {
    problemas.push(
      `${reclamacoesAbertas} reclamação(ões) em aberto`
    );
  }

  if (taxaCancelamentos > 2) {
    problemas.push(`cancelamentos em ${formatarPercentual(taxaCancelamentos)}`);
  }

  if (perguntasPendentes > 0) {
    problemas.push(`${perguntasPendentes} pergunta(s) sem resposta`);
  }

  const mensagem =
    problemas.length > 0
      ? `Atenção: ${problemas.join(' • ')}. Resolver essas pendências melhora seu termômetro.`
      : 'Sua reputação está saudável. Continue respondendo rápido e mantendo os anúncios atualizados.';

  return {
    score,
    nivel,
    cor,
    termometro,
    mensagem,
    periodoDias: 60,
    atualizadoEm: new Date().toISOString(),
    metricas: [
      {
        chave: 'reclamacoes',
        label: 'Reclamações',
        valor: formatarPercentual(taxaReclamacoes),
        detalhe: `${reclamacoesTotal} no período • ${reclamacoesAbertas} em aberto`,
        meta: 'Meta: até 2%',
        status: statusReclamacoes
      },
      {
        chave: 'cancelamentos',
        label: 'Cancelamentos',
        valor: formatarPercentual(taxaCancelamentos),
        detalhe: `${cancelamentos} de ${totalPedidos} pedido(s)`,
        meta: 'Meta: até 2%',
        status: statusCancelamentos
      },
      {
        chave: 'perguntas',
        label: 'Perguntas sem resposta',
        valor: String(perguntasPendentes),
        detalhe: 'Responda para proteger a reputação',
        meta: 'Meta: 0',
        status: statusPerguntas
      },
      {
        chave: 'vendas',
        label: 'Vendas válidas',
        valor: String(vendasValidas),
        detalhe: 'Nos últimos 60 dias',
        meta: 'Base da reputação',
        status: 'success'
      }
    ]
  };
}

async function obterReputacaoDashboard(db) {
  const [cache, pendentes] = await Promise.all([
    db.get(
      `SELECT dados,
              datetime(atualizado_em, 'localtime') AS atualizado_em
       FROM ml_reputacao_cache
       WHERE id = 1`
    ),
    db.get(
      'SELECT COUNT(*) AS total FROM perguntas_ml WHERE respondida = 0'
    )
  ]);

  if (cache?.dados) {
    try {
      const mapeada = mapearReputacaoMl(
        {
          ...JSON.parse(cache.dados),
          atualizado_em: cache.atualizado_em
        },
        pendentes?.total
      );

      if (mapeada) return mapeada;
    } catch {
      // Cache inválido: usa o cálculo local abaixo.
    }
  }

  const local = await obterReputacaoMl(db);

  return { ...local, fonte: 'local' };
}

export async function obterResumoDashboard(db) {
  const [pecas, vendas, ml, perguntas, reclamacoes, estoque] = await Promise.all([
    db.get('SELECT COUNT(*) AS total FROM pecas'),
    db.get(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(valor), 0) AS valor_total,
         COALESCE(SUM(CASE WHEN DATE(data_venda, 'localtime') = DATE('now', 'localtime') THEN 1 ELSE 0 END), 0) AS vendas_hoje,
         COALESCE(SUM(CASE WHEN DATE(data_venda, 'localtime') = DATE('now', 'localtime') THEN valor ELSE 0 END), 0) AS faturamento_hoje
       FROM vendas
       WHERE status NOT IN (${STATUS_INVALIDOS})`
    ),
    db.get(
      `SELECT
         COALESCE(SUM(CASE
           WHEN (plataforma LIKE '%ML%' OR plataforma LIKE '%Mercado Livre%')
             AND status NOT IN (${STATUS_INVALIDOS}) THEN 1
           ELSE 0
         END), 0) AS vendas_ml,
         COALESCE(SUM(CASE
           WHEN (plataforma LIKE '%ML%' OR plataforma LIKE '%Mercado Livre%')
             AND status NOT IN (${STATUS_INVALIDOS}) THEN valor
           ELSE 0
         END), 0) AS faturamento_ml,
         COALESCE(SUM(CASE
           WHEN (plataforma LIKE '%ML%' OR plataforma LIKE '%Mercado Livre%')
             AND status NOT IN (${STATUS_INVALIDOS})
           THEN CASE WHEN taxa_ml > 0 THEN taxa_ml ELSE valor * 0.17 END
           ELSE 0
         END), 0) AS taxas_ml,
         COALESCE(SUM(CASE
           WHEN (plataforma LIKE '%ML%' OR plataforma LIKE '%Mercado Livre%')
             AND status IN (${STATUS_INVALIDOS}) THEN 1
           ELSE 0
         END), 0) AS vendas_ml_canceladas,
         COALESCE(SUM(CASE
           WHEN (plataforma LIKE '%ML%' OR plataforma LIKE '%Mercado Livre%')
             AND status IN (${STATUS_INVALIDOS}) THEN valor
           ELSE 0
         END), 0) AS faturamento_ml_cancelado,
         COALESCE(SUM(CASE
           WHEN DATE(data_venda, 'localtime') = DATE('now', 'localtime')
             AND (plataforma LIKE '%ML%' OR plataforma LIKE '%Mercado Livre%')
             AND status NOT IN (${STATUS_INVALIDOS}) THEN 1
           ELSE 0
         END), 0) AS vendas_hoje_ml
       FROM vendas`
    ),
    db.get(
      `SELECT
         COALESCE(SUM(CASE WHEN respondida = 0 THEN 1 ELSE 0 END), 0) AS pendentes,
         COALESCE(SUM(CASE WHEN DATE(data_pergunta, 'localtime') = DATE('now', 'localtime') THEN 1 ELSE 0 END), 0) AS hoje
       FROM perguntas_ml`
    ),
    db.get(
      `SELECT
         COALESCE(SUM(CASE WHEN status NOT IN ('resolvida', 'resolvido', 'fechada', 'closed') THEN 1 ELSE 0 END), 0) AS abertas,
         COALESCE(SUM(CASE WHEN DATE(data_reclamacao, 'localtime') = DATE('now', 'localtime') THEN 1 ELSE 0 END), 0) AS hoje
       FROM reclamacoes_ml`
    ),
    db.get(
      `SELECT
         COALESCE(SUM(CASE WHEN ml_ativo = 1 THEN 1 ELSE 0 END), 0) AS anuncios,
         COALESCE(SUM(CASE
           WHEN ml_ativo = 1 AND (
             quantidade <= 0
             OR TRIM(COALESCE(descricao, '')) = ''
             OR LENGTH(TRIM(COALESCE(descricao, ''))) < 40
             OR TRIM(COALESCE(categoria, '')) = ''
             OR TRIM(COALESCE(sku, '')) = ''
             OR COALESCE(peso_kg, 0) <= 0
             OR COALESCE(comprimento_cm, 0) <= 0
             OR COALESCE(largura_cm, 0) <= 0
             OR COALESCE(altura_cm, 0) <= 0
             OR (
               TRIM(COALESCE(ml_thumbnail, '')) = ''
               AND NOT EXISTS (
                 SELECT 1 FROM peca_imagens pi WHERE pi.peca_id = pecas.id
               )
             )
           ) THEN 1
           ELSE 0
         END), 0) AS revisar
       FROM pecas`
    )
  ]);

  return {
    totalPecas: numero(pecas?.total),
    totalVendas: numero(vendas?.total),
    vendasHoje: numero(vendas?.vendas_hoje),
    faturamentoHoje: numero(vendas?.faturamento_hoje),
    valorTotal: numero(vendas?.valor_total),
    vendasML: numero(ml?.vendas_ml),
    faturamentoML: numero(ml?.faturamento_ml),
    faturamentoMLTaxas: numero(ml?.taxas_ml),
    faturamentoMLLiquido: Number(
      Math.max(0, numero(ml?.faturamento_ml) - numero(ml?.taxas_ml)).toFixed(2)
    ),
    faturamentoMLCancelado: numero(ml?.faturamento_ml_cancelado),
    vendasMLCanceladas: numero(ml?.vendas_ml_canceladas),
    vendasHojeML: numero(ml?.vendas_hoje_ml),
    anunciosAtivos: numero(estoque?.anuncios),
    anunciosRevisar: numero(estoque?.revisar),
    perguntasPendentes: numero(perguntas?.pendentes),
    perguntasHoje: numero(perguntas?.hoje),
    reclamacoesAbertas: numero(reclamacoes?.abertas),
    reclamacoesHoje: numero(reclamacoes?.hoje),
    status: 'online'
  };
}

export async function obterAnalyticsDashboard(db, valorPeriodo, rankingDatas = null) {
  const periodo = normalizarPeriodo(valorPeriodo);
  const condicoes = condicaoPeriodo(periodo);
  const datasRanking = rankingDatas && /^\d{4}-\d{2}-\d{2}$/.test(rankingDatas.inicio || '') && /^\d{4}-\d{2}-\d{2}$/.test(rankingDatas.fim || '') && rankingDatas.inicio <= rankingDatas.fim
    ? [rankingDatas.inicio, rankingDatas.fim, rankingDatas.inicio, rankingDatas.fim] : null;
  const condicaoRanking = datasRanking
    ? "DATE(v.data_venda, 'localtime') BETWEEN DATE(?) AND DATE(?)"
    : condicoes.atual.replaceAll('data_venda', 'v.data_venda');

  const [
    serieRows,
    periodoAtual,
    periodoAnterior,
    hoje,
    estoque,
    itensTipo,
    recentes,
    atendimento,
    qualidade,
    reputacao
  ] = await Promise.all([
    periodo.chave === 'hoje'
      ? db.all(
          `SELECT strftime('%H', data_venda, 'localtime') AS hora,
                  COALESCE(SUM(CASE WHEN status NOT IN (${STATUS_INVALIDOS}) THEN 1 ELSE 0 END), 0) AS vendas,
                  COALESCE(SUM(CASE WHEN status NOT IN (${STATUS_INVALIDOS}) THEN valor ELSE 0 END), 0) AS faturamento,
                  COALESCE(SUM(CASE
                    WHEN (plataforma LIKE '%ML%' OR plataforma LIKE '%Mercado Livre%')
                      AND status NOT IN (${STATUS_INVALIDOS})
                    THEN CASE WHEN taxa_ml > 0 THEN taxa_ml ELSE valor * 0.17 END
                    ELSE 0
                  END), 0) AS taxas_ml,
                  COALESCE(SUM(CASE WHEN status IN (${STATUS_INVALIDOS}) THEN 1 ELSE 0 END), 0) AS cancelamentos,
                  COALESCE(SUM(CASE WHEN status IN (${STATUS_INVALIDOS}) THEN valor ELSE 0 END), 0) AS valor_cancelado
           FROM vendas
           WHERE DATE(data_venda, 'localtime') = DATE('now', 'localtime')
           GROUP BY hora
           ORDER BY hora ASC`
        )
      : db.all(
          `SELECT DATE(data_venda, 'localtime') AS dia,
                  COALESCE(SUM(CASE WHEN status NOT IN (${STATUS_INVALIDOS}) THEN 1 ELSE 0 END), 0) AS vendas,
                  COALESCE(SUM(CASE WHEN status NOT IN (${STATUS_INVALIDOS}) THEN valor ELSE 0 END), 0) AS faturamento,
                  COALESCE(SUM(CASE
                    WHEN (plataforma LIKE '%ML%' OR plataforma LIKE '%Mercado Livre%')
                      AND status NOT IN (${STATUS_INVALIDOS})
                    THEN CASE WHEN taxa_ml > 0 THEN taxa_ml ELSE valor * 0.17 END
                    ELSE 0
                  END), 0) AS taxas_ml,
                  COALESCE(SUM(CASE WHEN status IN (${STATUS_INVALIDOS}) THEN 1 ELSE 0 END), 0) AS cancelamentos,
                  COALESCE(SUM(CASE WHEN status IN (${STATUS_INVALIDOS}) THEN valor ELSE 0 END), 0) AS valor_cancelado
           FROM vendas
           WHERE ${condicoes.atual}
           GROUP BY dia
           ORDER BY dia ASC`
        ),
    db.get(
      `SELECT COUNT(*) AS vendas, COALESCE(SUM(valor), 0) AS faturamento
       FROM vendas
       WHERE status NOT IN (${STATUS_INVALIDOS})
         AND ${condicoes.atual}`
    ),
    db.get(
      `SELECT COUNT(*) AS vendas, COALESCE(SUM(valor), 0) AS faturamento
       FROM vendas
       WHERE status NOT IN (${STATUS_INVALIDOS})
         AND ${condicoes.anterior}`
    ),
    db.get(
      `SELECT COUNT(*) AS vendas, COALESCE(SUM(valor), 0) AS faturamento
       FROM vendas
       WHERE status NOT IN (${STATUS_INVALIDOS})
         AND DATE(data_venda, 'localtime') = DATE('now', 'localtime')`
    ),
    db.get(
      `SELECT
         COUNT(*) AS pecas,
         COALESCE(SUM(quantidade), 0) AS unidades,
         COALESCE(SUM(quantidade * preco), 0) AS valor,
         COALESCE(SUM(CASE WHEN quantidade > 0 THEN 1 ELSE 0 END), 0) AS disponiveis,
         COALESCE(SUM(CASE WHEN quantidade = 0 THEN 1 ELSE 0 END), 0) AS esgotadas,
         COALESCE(SUM(CASE WHEN ml_ativo = 1 THEN 1 ELSE 0 END), 0) AS anuncios,
         COALESCE(SUM(CASE WHEN ml_ativo = 1 AND quantidade > 0 THEN 1 ELSE 0 END), 0) AS anuncios_disponiveis,
         COALESCE(SUM(CASE WHEN ml_ativo = 1 AND quantidade = 0 THEN 1 ELSE 0 END), 0) AS anuncios_esgotados,
         COALESCE(SUM(CASE WHEN ml_ativo = 0 THEN 1 ELSE 0 END), 0) AS fora_ml,
         COALESCE(SUM(CASE
           WHEN ml_ativo = 1 AND (
             quantidade <= 0
             OR TRIM(COALESCE(descricao, '')) = ''
             OR LENGTH(TRIM(COALESCE(descricao, ''))) < 40
             OR TRIM(COALESCE(categoria, '')) = ''
             OR TRIM(COALESCE(sku, '')) = ''
             OR COALESCE(peso_kg, 0) <= 0
             OR COALESCE(comprimento_cm, 0) <= 0
             OR COALESCE(largura_cm, 0) <= 0
             OR COALESCE(altura_cm, 0) <= 0
             OR (
               TRIM(COALESCE(ml_thumbnail, '')) = ''
               AND NOT EXISTS (
                 SELECT 1 FROM peca_imagens pi WHERE pi.peca_id = pecas.id
               )
             )
           ) THEN 1
           ELSE 0
         END), 0) AS anuncios_revisar
       FROM pecas`
    ),
    db.all(
      `SELECT vi.venda_id, v.order_id,
              COALESCE(NULLIF(TRIM(vi.descricao), ''), p.nome, 'Produto sem nome') AS nome,
              vi.quantidade, vi.preco_unitario, v.cliente,
              datetime(v.data_venda, 'localtime') AS data_venda
       FROM venda_itens vi
       INNER JOIN vendas v ON v.id = vi.venda_id
       LEFT JOIN pecas p ON p.sku = vi.sku
       WHERE v.status NOT IN (${STATUS_INVALIDOS})
         AND LOWER(COALESCE(v.plataforma, 'Mercado Livre')) = 'mercado livre'
         AND ${condicaoRanking}

       UNION ALL

       SELECT v.id AS venda_id, v.order_id,
              COALESCE(NULLIF(TRIM(p.nome), ''), 'Produto sem nome') AS nome,
              1 AS quantidade, v.valor AS preco_unitario, v.cliente,
              datetime(v.data_venda, 'localtime') AS data_venda
       FROM vendas v
       INNER JOIN pecas p ON p.id = v.peca_id
       WHERE v.peca_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM venda_itens vi WHERE vi.venda_id = v.id
         )
         AND v.status NOT IN (${STATUS_INVALIDOS})
         AND LOWER(COALESCE(v.plataforma, 'Mercado Livre')) = 'mercado livre'
         AND ${condicaoRanking}`,
      datasRanking || []
    ),
    db.all(
      `SELECT v.id, v.order_id, v.valor, v.status,
              datetime(v.data_venda, 'localtime') AS data_venda,
              v.plataforma, v.cliente, p.nome AS peca_nome
       FROM vendas v
       LEFT JOIN pecas p ON p.id = v.peca_id
       WHERE v.status NOT IN (${STATUS_INVALIDOS})
       ORDER BY v.data_venda DESC, v.id DESC
       LIMIT 6`
    ),
    db.get(
      `SELECT
         (SELECT COUNT(*) FROM perguntas_ml WHERE respondida = 0) AS perguntas,
         (SELECT COUNT(*) FROM reclamacoes_ml
          WHERE status NOT IN ('resolvida', 'resolvido', 'fechada', 'closed')) AS reclamacoes`
    ),
    db.get(
      `SELECT
         COALESCE(SUM(CASE
           WHEN ml_ativo = 1
            AND TRIM(COALESCE(ml_thumbnail, '')) = ''
            AND NOT EXISTS (
              SELECT 1 FROM peca_imagens pi WHERE pi.peca_id = pecas.id
            ) THEN 1 ELSE 0
         END), 0) AS sem_foto,
         COALESCE(SUM(CASE
           WHEN ml_ativo = 1 AND LENGTH(TRIM(COALESCE(descricao, ''))) < 40 THEN 1 ELSE 0
         END), 0) AS sem_descricao,
         COALESCE(SUM(CASE
           WHEN TRIM(COALESCE(categoria, '')) = '' THEN 1 ELSE 0
         END), 0) AS sem_categoria,
         COALESCE(SUM(CASE
           WHEN ml_ativo = 1 AND (
             COALESCE(peso_kg, 0) <= 0
             OR COALESCE(comprimento_cm, 0) <= 0
             OR COALESCE(largura_cm, 0) <= 0
             OR COALESCE(altura_cm, 0) <= 0
           ) THEN 1 ELSE 0
         END), 0) AS sem_medidas,
         COALESCE(SUM(CASE
           WHEN ml_ativo = 1 AND quantidade <= 0 THEN 1 ELSE 0
         END), 0) AS sem_estoque,
         COALESCE(SUM(CASE WHEN ml_ativo = 0 THEN 1 ELSE 0 END), 0) AS pausados
       FROM pecas`
    ),
    obterReputacaoDashboard(db)
  ]);

  const produtosMap = new Map();

  for (const item of itensTipo) {
    const produto = tipoPeca(item.nome);
    const chave = produto.toLocaleLowerCase('pt-BR');
    const atual = produtosMap.get(chave) || {
      tipo: produto,
      vendas: new Set(),
      unidades: 0,
      faturamento: 0,
      vendidos: []
    };
    const quantidade = numero(item.quantidade);
    const valor = quantidade * numero(item.preco_unitario);

    atual.vendas.add(item.venda_id);
    atual.unidades += quantidade;
    atual.faturamento += valor;
    atual.vendidos.push({
      vendaId: item.venda_id,
      nome: item.nome,
      pedido: item.order_id || null,
      cliente: item.cliente || 'Comprador',
      data: item.data_venda,
      quantidade,
      valor: Number(valor.toFixed(2))
    });
    produtosMap.set(chave, atual);
  }

  const topTiposPeca = [...produtosMap.values()]
    .map((item) => ({
      tipo: item.tipo,
      vendas: item.vendas.size,
      unidades: item.unidades,
      faturamento: Number(item.faturamento.toFixed(2)),
      vendidos: item.vendidos.sort((a, b) => String(b.data).localeCompare(String(a.data)))
    }))
    .sort((a, b) => b.unidades - a.unidades || b.vendas - a.vendas || b.faturamento - a.faturamento)
    .slice(0, 6);

  const faturamentoPeriodo = numero(periodoAtual?.faturamento);
  const vendasPeriodo = numero(periodoAtual?.vendas);
  const faturamentoAnterior = numero(periodoAnterior?.faturamento);
  const vendasAnterior = numero(periodoAnterior?.vendas);
  const ticketMedio = vendasPeriodo > 0 ? faturamentoPeriodo / vendasPeriodo : 0;
  const ticketMedioAnterior =
    vendasAnterior > 0 ? faturamentoAnterior / vendasAnterior : 0;
  const variacaoFaturamento = variacao(faturamentoPeriodo, faturamentoAnterior);
  const serie =
    periodo.chave === 'hoje'
      ? gerarSerieHoraria(serieRows)
      : gerarSerieDiaria(serieRows, periodo.dias);

  const insights = montarInsights({
    semFoto: numero(qualidade?.sem_foto),
    semDescricao: numero(qualidade?.sem_descricao),
    semCategoria: numero(qualidade?.sem_categoria),
    semMedidas: numero(qualidade?.sem_medidas),
    semEstoque: numero(qualidade?.sem_estoque),
    pausados: numero(qualidade?.pausados),
    perguntasPendentes: numero(atendimento?.perguntas),
    reclamacoesAbertas: numero(atendimento?.reclamacoes),
    topTipoPeca: topTiposPeca[0],
    vendasPeriodo,
    faturamentoPeriodo,
    variacaoFaturamento
  });

  return {
    periodo,
    periodoDias: periodo.dias,
    serie,
    totais: {
      faturamentoPeriodo,
      vendasPeriodo,
      ticketMedioPeriodo: ticketMedio,
      variacaoFaturamento,
      variacaoVendas: variacao(vendasPeriodo, vendasAnterior),
      variacaoTicketMedio: variacao(ticketMedio, ticketMedioAnterior)
    },
    hoje: {
      vendas: numero(hoje?.vendas),
      faturamento: numero(hoje?.faturamento)
    },
    estoque: {
      pecas: numero(estoque?.pecas),
      unidades: numero(estoque?.unidades),
      valor: numero(estoque?.valor),
      disponiveis: numero(estoque?.disponiveis),
      esgotadas: numero(estoque?.esgotadas),
      anuncios: numero(estoque?.anuncios),
      anunciosDisponiveis: numero(estoque?.anuncios_disponiveis),
      anunciosEsgotados: numero(estoque?.anuncios_esgotados),
      foraML: numero(estoque?.fora_ml),
      anunciosRevisar: numero(estoque?.anuncios_revisar)
    },
    topTiposPeca,
    reputacao,
    recentes,
    insights
  };
}

export async function obterVendasMlHoje(db, dataAlvo = dataLocalISO()) {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(dataAlvo || ''))
    ? String(dataAlvo)
    : dataLocalISO();
  const vendas = await db.all(
    `SELECT v.id, v.order_id, v.valor, v.plataforma, v.cliente,
            v.cliente_email, v.cliente_fone, v.cliente_cpf,
            v.cliente_endereco, v.metodo_pagamento, v.status,
            v.enviada_financeiro, v.enviada_financeiro_em,
            COALESCE(v.financeiro_status,
              CASE WHEN v.enviada_financeiro = 1 THEN 'enviada' ELSE 'pendente' END
            ) AS financeiro_status,
            v.financeiro_agendada_para, v.data_prevista_recebimento,
            datetime(v.data_venda, 'localtime') AS data_venda,
            v.itens_count, p.nome AS peca_nome, p.carro AS peca_carro,
            p.sku AS peca_sku
     FROM vendas v
     LEFT JOIN pecas p ON p.id = v.peca_id
     WHERE (
         (
           COALESCE(v.financeiro_status,
             CASE WHEN v.enviada_financeiro = 1 THEN 'enviada' ELSE 'disponivel' END
           ) IN ('disponivel', 'pendente')
           AND COALESCE(v.enviada_financeiro, 0) = 0
           AND (
             (
               v.financeiro_agendada_para IS NOT NULL
               AND DATE(v.financeiro_agendada_para) = DATE(?)
             )
             OR (
               v.financeiro_agendada_para IS NULL
               AND DATE(v.data_venda, 'localtime') = DATE(?)
             )
             OR EXISTS (
               SELECT 1
                 FROM ml_envios e
                WHERE e.order_id = v.order_id
                  AND LOWER(COALESCE(e.status, '')) = 'ready_to_ship'
                  AND LOWER(COALESCE(e.substatus, '')) = 'invoice_pending'
             )
           )
         )
         OR (
           v.financeiro_status = 'agendada'
           AND DATE(v.financeiro_agendada_para) = DATE(?)
         )
         OR (
           v.financeiro_status = 'enviada'
           AND DATE(v.enviada_financeiro_em, 'localtime') = DATE(?)
         )
       )
       AND (v.plataforma LIKE '%ML%' OR v.plataforma LIKE '%Mercado Livre%')
       AND v.status NOT IN (${STATUS_INVALIDOS})
     ORDER BY CASE
                WHEN v.financeiro_agendada_para IS NOT NULL
                 AND TRIM(v.financeiro_agendada_para) <> ''
                  THEN DATE(v.financeiro_agendada_para)
                ELSE DATE(v.data_venda, 'localtime')
              END ASC,
              v.data_venda DESC, v.id DESC`,
    [data, data, data, data]
  );

  const ids = vendas.map((venda) => venda.id);
  let itens = [];

  if (ids.length > 0) {
    itens = await db.all(
      `SELECT venda_id, sku, descricao, quantidade, preco_unitario
       FROM venda_itens
       WHERE venda_id IN (${ids.map(() => '?').join(', ')})
       ORDER BY id ASC`,
      ids
    );
  }

  const itensPorVenda = new Map();

  for (const item of itens) {
    const lista = itensPorVenda.get(item.venda_id) || [];
    lista.push({
      sku: item.sku,
      descricao: item.descricao,
      quantidade: numero(item.quantidade),
      precoUnitario: numero(item.preco_unitario)
    });
    itensPorVenda.set(item.venda_id, lista);
  }

  const vendasComItens = vendas.map((venda) => ({
    ...venda,
    valor: numero(venda.valor),
    enviada_financeiro: Number(venda.enviada_financeiro) || 0,
    financeiro_status: venda.financeiro_status || 'pendente',
    financeiro_agendada_para: venda.financeiro_agendada_para || null,
    data_prevista_recebimento: venda.data_prevista_recebimento || null,
    itens: itensPorVenda.get(venda.id) || []
  }));

  const somarFaturamento = (lista) =>
    Number(
      lista.reduce((total, venda) => total + venda.valor, 0).toFixed(2)
    );
  const pendentes = vendasComItens.filter(
    (venda) => !venda.enviada_financeiro
  );

  return {
    data,
    vendas: vendasComItens,
    totais: {
      vendas: vendasComItens.length,
      faturamento: somarFaturamento(vendasComItens)
    },
    pendentes: {
      vendas: pendentes.length,
      faturamento: somarFaturamento(pendentes)
    }
  };
}
