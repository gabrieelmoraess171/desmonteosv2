import { normalizarPeriodo } from './dashboardService.js';

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

function numero(valor) {
  return Number.isFinite(Number(valor)) ? Number(valor) : 0;
}

function arredondar(valor) {
  return Number(numero(valor).toFixed(2));
}

function dataLocalISO(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function resolverPeriodo(params = {}) {
  const inicioParam = String(params.inicio || '').trim().slice(0, 10);
  const fimParam = String(params.fim || '').trim().slice(0, 10);
  const formatoISO = /^\d{4}-\d{2}-\d{2}$/;
  const dataValida = (valor) => {
    if (!formatoISO.test(valor)) return false;
    const data = new Date(`${valor}T12:00:00`);
    return !Number.isNaN(data.getTime());
  };

  if (
    dataValida(inicioParam) &&
    dataValida(fimParam) &&
    inicioParam <= fimParam
  ) {
    const inicio = new Date(`${inicioParam}T12:00:00`);
    const fim = new Date(`${fimParam}T12:00:00`);
    const dias = Math.max(
      1,
      Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1
    );

    return {
      chave: 'custom',
      label: 'Personalizado',
      dias,
      descricao: 'Período personalizado',
      inicio: inicioParam,
      fim: fimParam
    };
  }

  const base = normalizarPeriodo(params.periodo);
  const fim = new Date();
  fim.setHours(0, 0, 0, 0);
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - (base.dias - 1));

  return {
    ...base,
    inicio: dataLocalISO(inicio),
    fim: dataLocalISO(fim)
  };
}

function condicaoPeriodo(periodo) {
  return `DATE(v.data_venda, 'localtime') BETWEEN '${periodo.inicio}' AND '${periodo.fim}'`;
}

function normalizarFiltroStatus(valor) {
  const filtro = String(valor || 'todas')
    .trim()
    .toLowerCase();

  if (['concluidas', 'concluida', 'concluido'].includes(filtro)) {
    return 'concluidas';
  }

  if (['canceladas', 'cancelada', 'cancelados', 'cancelado'].includes(filtro)) {
    return 'canceladas';
  }

  if (
    ['andamento', 'a-receber', 'a_receber', 'areceber', 'abertas'].includes(
      filtro
    )
  ) {
    return 'andamento';
  }

  return 'todas';
}

function classificarStatus(valor) {
  const status = String(valor || '')
    .trim()
    .toLowerCase();

  if (STATUS_CANCELADOS.includes(status)) return 'cancelada';
  if (STATUS_CONCLUIDOS.includes(status)) return 'concluida';
  if (STATUS_ANDAMENTO.includes(status)) return 'andamento';
  return 'andamento';
}

function filtrarVendas(vendas, filtroStatus) {
  if (filtroStatus === 'concluidas') {
    return vendas.filter((venda) => venda.status_grupo === 'concluida');
  }

  if (filtroStatus === 'andamento') {
    return vendas.filter((venda) => venda.status_grupo === 'andamento');
  }

  if (filtroStatus === 'canceladas') {
    return vendas.filter((venda) => venda.status_grupo === 'cancelada');
  }

  return vendas;
}

function rotuloMetodoPagamento(valor) {
  const chave = String(valor || '')
    .trim()
    .toLowerCase();

  const mapa = {
    visa: 'Cartão Visa',
    master: 'Cartão Mastercard',
    mastercard: 'Cartão Mastercard',
    amex: 'Cartão American Express',
    american_express: 'Cartão American Express',
    elo: 'Cartão Elo',
    hipercard: 'Cartão Hipercard',
    debito_mercadopago: 'Cartão de débito Mercado Pago',
    debito: 'Cartão de débito',
    credit_card: 'Cartão de crédito',
    account_money: 'Saldo Mercado Pago',
    mercadopago: 'Saldo Mercado Pago',
    consumer_credits: 'Mercado Crédito',
    mercadocredito: 'Mercado Crédito',
    pix: 'Pix',
    bolbradesco: 'Boleto',
    boleto: 'Boleto',
    pecunia: 'Boleto',
    ticket: 'Boleto',
    dinheiro: 'Dinheiro',
    transferencia: 'Transferência'
  };

  if (mapa[chave]) return mapa[chave];
  if (!chave) return 'Não informado';

  return chave
    .replace(/[_-]+/g, ' ')
    .replace(/(^|\s)(\p{L})/gu, (_trecho, espaco, letra) => espaco + letra.toUpperCase());
}

function calcularVenda(venda, taxaMlPercent) {
  const statusGrupo = classificarStatus(venda.status);
  const cancelada = statusGrupo === 'cancelada';
  const plataforma = String(venda.plataforma || '');
  const isMl = /ml|mercado\s*livre/i.test(plataforma);
  const valorBruto = arredondar(venda.valor);
  const taxaMlReal = Number(venda.taxa_ml);
  const usaTaxaReal =
    isMl && Number.isFinite(taxaMlReal) && taxaMlReal > 0;
  const taxaMl =
    isMl && !cancelada
      ? usaTaxaReal
        ? arredondar(taxaMlReal)
        : arredondar((valorBruto * taxaMlPercent) / 100)
      : 0;
  const valorLiquido = cancelada ? 0 : arredondar(valorBruto - taxaMl);
  const recebido = statusGrupo === 'concluida';
  const dataRecebimento = recebido
    ? venda.data_recebimento || venda.data_venda || null
    : null;

  return {
    ...venda,
    valor: valorBruto,
    valor_bruto: valorBruto,
    taxa_ml: taxaMl,
    valor_liquido: valorLiquido,
    status_grupo: statusGrupo,
    cancelada,
    recebido,
    is_ml: isMl,
    taxa_ml_real: usaTaxaReal,
    metodo_pagamento_label: rotuloMetodoPagamento(venda.metodo_pagamento),
    data_recebimento: dataRecebimento,
    itens: venda.itens || []
  };
}

function somar(lista, campo) {
  return arredondar(
    lista.reduce((total, item) => total + numero(item[campo]), 0)
  );
}

function contarItens(lista) {
  return lista.reduce(
    (total, venda) =>
      total +
      (venda.itens || []).reduce(
        (subtotal, item) => subtotal + numero(item.quantidade),
        0
      ),
    0
  );
}

function contarClientes(lista) {
  return new Set(
    lista
      .map((venda) => String(venda.cliente || '').trim())
      .filter(Boolean)
  ).size;
}

function ultimoRecebimento(lista) {
  return lista.reduce((ultimo, venda) => {
    if (!venda.recebido || !venda.data_recebimento) return ultimo;
    if (!ultimo || venda.data_recebimento > ultimo) return venda.data_recebimento;
    return ultimo;
  }, null);
}

function resumirVendas(vendas, taxaMlPercent) {
  const validas = vendas.filter((venda) => !venda.cancelada);
  const canceladas = vendas.filter((venda) => venda.cancelada);
  const concluidas = validas.filter(
    (venda) => venda.status_grupo === 'concluida'
  );
  const andamento = validas.filter(
    (venda) => venda.status_grupo === 'andamento'
  );
  const faturamentoBruto = somar(validas, 'valor_bruto');
  const faturamentoLiquido = somar(validas, 'valor_liquido');
  const taxaMl = somar(validas, 'taxa_ml');
  const valorCancelado = somar(canceladas, 'valor_bruto');
  const taxaMlCancelada = arredondar(
    canceladas
      .filter((venda) => venda.is_ml)
      .reduce(
        (total, venda) => total + (venda.valor_bruto * taxaMlPercent) / 100,
        0
      )
  );
  const totalRegistros = vendas.length;
  const vendasValidas = validas.length;
  const cancelamentos = canceladas.length;

  return {
    totalRegistros,
    vendasValidas,
    cancelamentos,
    faturamentoBruto,
    taxaMl,
    faturamentoLiquido,
    recebidoLiquido: somar(concluidas, 'valor_liquido'),
    aReceberLiquido: somar(andamento, 'valor_liquido'),
    valorCancelado,
    taxaMlCancelada,
    ticketMedioBruto:
      vendasValidas > 0 ? arredondar(faturamentoBruto / vendasValidas) : 0,
    ticketMedioLiquido:
      vendasValidas > 0 ? arredondar(faturamentoLiquido / vendasValidas) : 0,
    ticketMedioCancelado:
      cancelamentos > 0 ? arredondar(valorCancelado / cancelamentos) : 0,
    itens: contarItens(vendas),
    itensValidos: contarItens(validas),
    clientes: contarClientes(vendas),
    clientesValidos: contarClientes(validas),
    participacaoCancelamento:
      totalRegistros > 0
        ? arredondar((cancelamentos / totalRegistros) * 100)
        : 0,
    ultimoRecebimento: ultimoRecebimento(concluidas)
  };
}

function resumirGrupo(lista) {
  const canceladas = lista.filter((venda) => venda.cancelada);

  return {
    vendas: lista.length,
    valorBruto: somar(lista, 'valor_bruto'),
    taxaMl: somar(lista, 'taxa_ml'),
    valorLiquido: somar(lista, 'valor_liquido'),
    valorCancelado: somar(canceladas, 'valor_bruto')
  };
}

function criarPonto(data, label) {
  return {
    data,
    label,
    vendas: 0,
    faturamentoBruto: 0,
    taxaMl: 0,
    faturamentoLiquido: 0,
    valorCancelado: 0,
    cancelamentos: 0
  };
}

function adicionarNaSerie(ponto, venda) {
  ponto.vendas += 1;

  if (venda.cancelada) {
    ponto.valorCancelado += venda.valor_bruto;
    ponto.cancelamentos += 1;
    return;
  }

  ponto.faturamentoBruto += venda.valor_bruto;
  ponto.taxaMl += venda.taxa_ml;
  ponto.faturamentoLiquido += venda.valor_liquido;
}

function arredondarPonto(ponto) {
  return {
    ...ponto,
    faturamentoBruto: arredondar(ponto.faturamentoBruto),
    taxaMl: arredondar(ponto.taxaMl),
    faturamentoLiquido: arredondar(ponto.faturamentoLiquido),
    valorCancelado: arredondar(ponto.valorCancelado)
  };
}

function datasDoPeriodo(periodo) {
  const datas = [];
  const cursor = new Date(`${periodo.inicio}T12:00:00`);
  const fim = new Date(`${periodo.fim}T12:00:00`);

  while (cursor <= fim && datas.length < 370) {
    datas.push(dataLocalISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return datas;
}

function gerarSerie(vendas, periodo) {
  if (periodo.chave === 'hoje') {
    const mapa = new Map();

    for (const venda of vendas) {
      const hora = String(venda.data_venda || '').slice(11, 13);
      const chave = /^\d{2}$/.test(hora) ? hora : '00';
      const ponto = mapa.get(chave) || criarPonto(chave, `${chave}h`);
      adicionarNaSerie(ponto, venda);
      mapa.set(chave, ponto);
    }

    return Array.from({ length: 24 }, (_, hora) => {
      const chave = String(hora).padStart(2, '0');
      return arredondarPonto(
        mapa.get(chave) || criarPonto(chave, `${chave}h`)
      );
    });
  }

  const mapa = new Map();

  for (const venda of vendas) {
    const chave = String(venda.data_venda || '').slice(0, 10);
    const [ano, mes, dia] = chave.split('-');
    const label = dia && mes ? `${dia}/${mes}` : chave;
    const ponto = mapa.get(chave) || criarPonto(chave, label);
    adicionarNaSerie(ponto, venda);
    mapa.set(chave, ponto);
  }

  return datasDoPeriodo(periodo).map((data) => {
    const [ano, mes, dia] = data.split('-');
    return arredondarPonto(
      mapa.get(data) || criarPonto(data, `${dia}/${mes}`)
    );
  });
}

function agruparPlataformas(vendas) {
  const mapa = new Map();

  for (const venda of vendas) {
    const chave = String(venda.plataforma || 'Não informada');
    const item = mapa.get(chave) || {
      plataforma: chave,
      vendas: 0,
      faturamentoBruto: 0,
      taxaMl: 0,
      faturamentoLiquido: 0,
      cancelamentos: 0,
      valorCancelado: 0
    };

    item.vendas += 1;

    if (venda.cancelada) {
      item.cancelamentos += 1;
      item.valorCancelado += venda.valor_bruto;
    } else {
      item.faturamentoBruto += venda.valor_bruto;
      item.taxaMl += venda.taxa_ml;
      item.faturamentoLiquido += venda.valor_liquido;
    }

    mapa.set(chave, item);
  }

  return [...mapa.values()]
    .map((item) => ({
      ...item,
      faturamentoBruto: arredondar(item.faturamentoBruto),
      taxaMl: arredondar(item.taxaMl),
      faturamentoLiquido: arredondar(item.faturamentoLiquido),
      valorCancelado: arredondar(item.valorCancelado)
    }))
    .sort(
      (a, b) =>
        b.faturamentoLiquido - a.faturamentoLiquido || b.vendas - a.vendas
    );
}

function agruparPagamentos(vendas) {
  const mapa = new Map();

  for (const venda of vendas.filter((item) => !item.cancelada)) {
    const chave = rotuloMetodoPagamento(venda.metodo_pagamento);
    const item = mapa.get(chave) || {
      metodo: chave,
      vendas: 0,
      faturamentoBruto: 0,
      taxaMl: 0,
      faturamentoLiquido: 0
    };

    item.vendas += 1;
    item.faturamentoBruto += venda.valor_bruto;
    item.taxaMl += venda.taxa_ml;
    item.faturamentoLiquido += venda.valor_liquido;
    mapa.set(chave, item);
  }

  return [...mapa.values()]
    .map((item) => ({
      ...item,
      faturamentoBruto: arredondar(item.faturamentoBruto),
      taxaMl: arredondar(item.taxaMl),
      faturamentoLiquido: arredondar(item.faturamentoLiquido)
    }))
    .sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido);
}

export async function obterRelatorio(db, params = {}) {
  const periodo = resolverPeriodo(params);
  const filtroStatus = normalizarFiltroStatus(params.status);
  const taxaInformada = Number(params.taxa_ml ?? params.taxaMl);
  const taxaMlPercent = Number.isFinite(taxaInformada)
    ? Math.min(100, Math.max(0, taxaInformada))
    : 17;

  const rows = await db.all(
    `SELECT v.id, v.order_id, v.valor, v.plataforma, v.cliente,
            v.cliente_email, v.cliente_fone, v.cliente_cpf,
            v.cliente_endereco, v.metodo_pagamento, v.status,
            datetime(v.data_venda, 'localtime') AS data_venda,
            datetime(v.data_recebimento, 'localtime') AS data_recebimento,
            datetime(v.data_prevista_recebimento, 'localtime') AS data_prevista_recebimento,
            v.taxa_ml, v.itens_count,
            p.nome AS peca_nome, p.sku AS peca_sku,
            COALESCE(
              (SELECT pi.caminho FROM peca_imagens pi
                WHERE pi.peca_id = p.id
                ORDER BY pi.is_principal DESC, pi.ordem ASC, pi.id ASC
                LIMIT 1),
              p.ml_thumbnail
            ) AS peca_imagem
     FROM vendas v
     LEFT JOIN pecas p ON p.id = v.peca_id
     WHERE ${condicaoPeriodo(periodo)}
     ORDER BY v.data_venda DESC, v.id DESC
     LIMIT 2000`
  );

  const ids = rows.map((venda) => venda.id);
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
      preco_unitario: numero(item.preco_unitario)
    });
    itensPorVenda.set(item.venda_id, lista);
  }

  const vendasTodas = rows.map((venda) =>
    calcularVenda(
      {
        ...venda,
        itens: itensPorVenda.get(venda.id) || []
      },
      taxaMlPercent
    )
  );
  const vendas = filtrarVendas(vendasTodas, filtroStatus);

  return {
    periodo,
    filtroStatus,
    taxaMl: taxaMlPercent,
    resumo: resumirVendas(vendas, taxaMlPercent),
    porStatus: {
      concluidas: resumirGrupo(
        vendasTodas.filter((venda) => venda.status_grupo === 'concluida')
      ),
      andamento: resumirGrupo(
        vendasTodas.filter((venda) => venda.status_grupo === 'andamento')
      ),
      canceladas: resumirGrupo(
        vendasTodas.filter((venda) => venda.status_grupo === 'cancelada')
      )
    },
    serie: gerarSerie(vendas, periodo),
    plataformas: agruparPlataformas(vendas),
    pagamentos: agruparPagamentos(vendas),
    vendas
  };
}
