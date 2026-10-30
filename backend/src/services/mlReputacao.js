const NIVEIS_ML = {
  '5_green': '5 verde',
  '4_light_green': '4 verde-claro',
  '3_yellow': '3 amarelo',
  '2_orange': '2 laranja',
  '1_red': '1 vermelho'
};

const BASE_POR_NIVEL = {
  '5_green': 95,
  '4_light_green': 85,
  '3_yellow': 70,
  '2_orange': 50,
  '1_red': 25
};

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function taxaPercentual(metrica) {
  const valor = numero(
    metrica && typeof metrica === 'object' ? metrica.rate : metrica
  );

  if (valor <= 0) return 0;

  // A API do Mercado Livre costuma devolver proporções (0,012 = 1,2%),
  // mas algumas contas retornam o percentual já multiplicado.
  return valor <= 1 ? valor * 100 : valor;
}

function arredondar(valor, casas = 1) {
  return Number(numero(valor).toFixed(casas));
}

function statusPorLimite(valor, bom, atencao) {
  if (valor <= bom) return 'success';
  if (valor <= atencao) return 'warning';
  return 'danger';
}

function periodoEmDias(periodo) {
  const texto = String(periodo || '');
  const encontrado = texto.match(/(\d+)/);
  return encontrado ? Number(encontrado[1]) : 60;
}

export function mapearReputacaoMl(dadosCache, perguntasPendentes = 0) {
  const seller = dadosCache?.seller_reputation;

  if (!seller || typeof seller !== 'object') return null;

  const nivelId = String(seller.level_id || '').trim();
  const transacoes = seller.transactions || {};
  const avaliacoes = transacoes.ratings || {};
  const metricasMl = seller.metrics || {};
  const positivas = numero(avaliacoes.positive);
  const neutras = numero(avaliacoes.neutral);
  const negativas = numero(avaliacoes.negative);
  const totalAvaliacoes = positivas + neutras + negativas;
  const totalTransacoes = numero(transacoes.total);
  const concluidas = numero(transacoes.completed);
  const canceladas = numero(transacoes.canceled);
  const taxaReclamacoes = taxaPercentual(metricasMl.claims);
  const taxaCancelamentos = taxaPercentual(metricasMl.cancellations);
  const taxaAtraso = taxaPercentual(metricasMl.delayed_handling_time);
  const taxaNegativas =
    totalAvaliacoes > 0 ? (negativas / totalAvaliacoes) * 100 : 0;
  const pendentes = Math.max(0, Math.trunc(numero(perguntasPendentes)));

  let score = BASE_POR_NIVEL[nivelId] ?? 60;

  if (taxaReclamacoes > 2) {
    score -= Math.min(18, (taxaReclamacoes - 2) * 2.5);
  }

  if (taxaCancelamentos > 2) {
    score -= Math.min(18, (taxaCancelamentos - 2) * 2.5);
  }

  if (taxaAtraso > 10) {
    score -= Math.min(10, (taxaAtraso - 10) * 0.5);
  }

  if (taxaNegativas > 5) {
    score -= Math.min(10, (taxaNegativas - 5) * 0.5);
  }

  if (pendentes > 0) {
    score -= Math.min(6, pendentes * 0.5);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const nivelCalculado =
    score >= 90
      ? 'Excelente'
      : score >= 80
        ? 'Boa'
        : score >= 65
          ? 'Atenção'
          : 'Crítica';
  const cor = score >= 80 ? 'success' : score >= 65 ? 'warning' : 'danger';
  const nivelOficial = Number(nivelId.match(/^[1-5]/)?.[0]) || 0;
  const selos = { gold: 'MercadoLíder Gold', platinum: 'MercadoLíder Platinum', silver: 'MercadoLíder' };
  const selo = selos[String(seller.power_seller_status || '').toLowerCase()] || null;
  const problemas = [];

  if (taxaReclamacoes > 2) {
    problemas.push(
      `reclamações em ${arredondar(taxaReclamacoes).toLocaleString('pt-BR')}%`
    );
  }

  if (taxaCancelamentos > 2) {
    problemas.push(
      `cancelamentos em ${arredondar(taxaCancelamentos).toLocaleString('pt-BR')}%`
    );
  }

  if (taxaAtraso > 10) {
    problemas.push(
      `atrasos em ${arredondar(taxaAtraso).toLocaleString('pt-BR')}%`
    );
  }

  if (pendentes > 0) {
    problemas.push(`${pendentes} pergunta(s) sem resposta`);
  }

  const partesMensagem = [];
  const nivelMl = NIVEIS_ML[nivelId];

  if (nivelMl) partesMensagem.push(`Termômetro ${nivelMl} no Mercado Livre.`);
  if (seller.power_seller_status) {
    const selo = String(seller.power_seller_status);
    const seloFormatado =
      selo.charAt(0).toUpperCase() + selo.slice(1).toLowerCase();
    partesMensagem.push(`Selo MercadoLíder ${seloFormatado}.`);
  }

  if (problemas.length > 0) {
    partesMensagem.push(
      `Atenção: ${problemas.join(' • ')}. Resolver essas pendências melhora seu termômetro.`
    );
  } else {
    partesMensagem.push(
      'Sua reputação real no Mercado Livre está saudável. Continue respondendo rápido e mantendo os anúncios atualizados.'
    );
  }

  return {
    score,
    nivel: nivelOficial ? NIVEIS_ML[nivelId] : nivelCalculado,
    selo,
    cor: nivelOficial ? (nivelOficial >= 4 ? 'success' : nivelOficial === 3 ? 'warning' : 'danger') : cor,
    termometro: nivelOficial,
    mensagem: partesMensagem.join(' '),
    periodoDias: periodoEmDias(transacoes.period),
    atualizadoEm:
      dadosCache?.atualizado_em || new Date().toISOString(),
    fonte: 'ml',
    metricas: [
      {
        chave: 'reclamacoes',
        label: 'Reclamações',
        valor: `${arredondar(taxaReclamacoes).toLocaleString('pt-BR')}%`,
        detalhe: `${numero(metricasMl.claims?.value)} no período`,
        meta: 'Meta: até 2%',
        status: statusPorLimite(taxaReclamacoes, 2, 5)
      },
      {
        chave: 'cancelamentos',
        label: 'Cancelamentos',
        valor: `${arredondar(taxaCancelamentos).toLocaleString('pt-BR')}%`,
        detalhe: `${canceladas} de ${totalTransacoes} pedido(s)`,
        meta: 'Meta: até 2%',
        status: statusPorLimite(taxaCancelamentos, 2, 5)
      },
      {
        chave: 'perguntas',
        label: 'Perguntas sem resposta',
        valor: String(pendentes),
        detalhe: 'Responda para proteger a reputação',
        meta: 'Meta: 0',
        status: statusPorLimite(pendentes, 0, 3)
      },
      {
        chave: 'vendas',
        label: 'Vendas concluídas',
        valor: String(concluidas),
        detalhe: `${totalTransacoes} transação(ões) no período`,
        meta: 'Base da reputação',
        status: concluidas > 0 ? 'success' : 'warning'
      }
    ]
  };
}
