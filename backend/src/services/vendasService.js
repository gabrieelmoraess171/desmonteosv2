import { getDb } from '../database.js';

const STATUS_INTERNO = {
  paid: 'concluida',
  approved: 'concluida',
  completed: 'concluida',
  concluida: 'concluida',
  shipped: 'enviada',
  enviada: 'enviada',
  delivered: 'entregue',
  entregue: 'entregue',
  cancelled: 'cancelada',
  canceled: 'cancelada',
  cancelada: 'cancelada',
  refunded: 'reembolsada',
  reembolsada: 'reembolsada',
  pending: 'pendente',
  pendente: 'pendente'
};

let filaDeEscrita = Promise.resolve();

function enfileirar(operacao) {
  const resultado = filaDeEscrita.then(operacao, operacao);
  filaDeEscrita = resultado.catch(() => {});
  return resultado;
}

function erroValidacao(mensagem) {
  const error = new Error(mensagem);
  error.statusCode = 400;
  return error;
}

function texto(valor, limite = 200) {
  return String(valor ?? '').trim().slice(0, limite);
}

function juntarPartes(partes) {
  return partes
    .map((parte) => texto(parte, 120))
    .filter(Boolean)
    .join(' - ');
}

function normalizarEndereco(payload = {}, buyer = {}) {
  const bruto =
    buyer.address ||
    payload.endereco ||
    payload.cliente_endereco ||
    payload.shipping_address ||
    payload.shipping?.address ||
    payload.shipping?.receiver_address;

  if (typeof bruto === 'string') {
    return texto(bruto, 300);
  }

  if (!bruto || typeof bruto !== 'object') return '';

  const rua = texto(
    bruto.street_name || bruto.street || bruto.logradouro || bruto.address,
    160
  );
  const numero = texto(
    bruto.street_number || bruto.number || bruto.numero,
    20
  );
  const bairro = texto(
    bruto.neighborhood || bruto.bairro || bruto.district,
    100
  );
  const cidade = texto(bruto.city || bruto.cidade, 100);
  const estado = texto(bruto.state || bruto.uf || bruto.state_id, 40);
  const cep = texto(
    bruto.zip_code || bruto.zipcode || bruto.cep || bruto.postal_code,
    20
  );

  return texto(
    juntarPartes([
      [rua, numero].filter(Boolean).join(', '),
      bruto.complement || bruto.complemento,
      bairro,
      [cidade, estado].filter(Boolean).join('/'),
      cep ? `CEP: ${cep}` : ''
    ]),
    300
  );
}

function normalizarStatus(valor) {
  const status = texto(valor || 'paid', 40).toLowerCase();
  return STATUS_INTERNO[status] || 'pendente';
}

function normalizarItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw erroValidacao('Informe pelo menos um item na venda');
  }

  if (itens.length > 200) {
    throw erroValidacao('Uma venda pode ter no máximo 200 itens');
  }

  return itens.map((item, indice) => {
    if (!item || typeof item !== 'object') {
      throw erroValidacao(`Item ${indice + 1} inválido`);
    }

    const sku = texto(item.sku, 100).toUpperCase();

    if (!sku) {
      throw erroValidacao(`Item ${indice + 1}: SKU obrigatório`);
    }

    const quantidade = Number(item.quantity ?? item.qtd ?? item.quantidade);

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw erroValidacao(
        `Item ${sku}: quantidade deve ser um número inteiro maior que zero`
      );
    }

    const precoUnitario = Number(
      item.unit_price ?? item.preco_unitario ?? item.preco ?? 0
    );

    if (!Number.isFinite(precoUnitario) || precoUnitario < 0) {
      throw erroValidacao(`Item ${sku}: preço unitário inválido`);
    }

    return {
      sku,
      descricao: texto(item.descricao || item.description, 500) || null,
      quantidade,
      precoUnitario
    };
  });
}

function calcularTotal(payload, itens) {
  const informado = Number(
    payload.totals?.amount_paid ?? payload.total ?? payload.valor
  );

  if (Number.isFinite(informado)) {
    if (informado < 0) {
      throw erroValidacao('O total da venda não pode ser negativo');
    }

    return Number(informado.toFixed(2));
  }

  const calculado = itens.reduce(
    (total, item) => total + item.quantidade * item.precoUnitario,
    0
  );

  return Number(calculado.toFixed(2));
}

export async function upsertVenda(payload, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw erroValidacao('Payload da venda inválido');
  }

  const orderId = texto(payload.order_id, 120);

  if (!orderId) {
    throw erroValidacao('order_id é obrigatório');
  }

  const itens = normalizarItens(payload.items);
  const total = calcularTotal(payload, itens);
  const buyer = payload.buyer && typeof payload.buyer === 'object'
    ? payload.buyer
    : {};
  const statusPayload = texto(payload.status, 40);
  const plataformaPayload = texto(
    payload.plataforma || payload.marketplace || payload.channel,
    80
  );
  const plataformaPadrao =
    plataformaPayload || texto(options.plataforma, 80) || 'Manual';
  const clientePayload = texto(buyer.name || payload.cliente, 200);
  const emailPayload = texto(buyer.email || payload.email, 200);
  const fonePayload = texto(buyer.phone || buyer.fone || payload.fone, 60);
  const cpfPayload = texto(
    buyer.cpf ||
      buyer.identification?.number ||
      buyer.billing_info?.documents?.[0]?.number ||
      payload.cpf,
    30
  );
  const enderecoPayload = normalizarEndereco(payload, buyer);
  const pagamentoPayload = texto(
    payload.metodo_pagamento || payload.payment_method || payload.pagamento,
    80
  );
  const lastUpdated =
    texto(payload.last_updated, 40) || new Date().toISOString();
  const dataRecebimentoPayload = texto(
    payload.data_recebimento || payload.received_at,
    40
  );
  const dataPrevistaRecebimentoPayload = texto(
    payload.data_prevista_recebimento || payload.money_release_date,
    40
  );
  const dataVendaPayload = texto(
    payload.data_venda || payload.date_created || payload.date_closed,
    40
  );
  const taxaMlInformada =
    payload.taxa_ml !== undefined || payload.sale_fee !== undefined;
  const taxaMlNumero = Number(payload.taxa_ml ?? payload.sale_fee);
  const taxaMl =
    taxaMlInformada && Number.isFinite(taxaMlNumero) && taxaMlNumero >= 0
      ? Number(taxaMlNumero.toFixed(2))
      : null;
  const mlPackId = texto(payload.ml_pack_id || payload.pack_id, 120);
  const mlStatus = texto(
    payload.ml_status || payload.marketplace_status,
    80
  );

  return enfileirar(async () => {
    const db = getDb();
    await db.exec('BEGIN IMMEDIATE');

    try {
      const mlBuyerId = texto(buyer.id || payload.ml_buyer_id, 40);
      const mlBuyerNickname = texto(
        buyer.nickname || payload.ml_buyer_nickname,
        80
      );
      const existente = await db.get(
        `SELECT id, status, plataforma, cliente, cliente_email, cliente_fone,
                cliente_cpf, cliente_endereco, metodo_pagamento, data_recebimento,
                data_venda, taxa_ml, ml_pack_id, ml_status, ml_buyer_id,
                ml_buyer_nickname, data_prevista_recebimento
         FROM vendas WHERE order_id = ?`,
        [orderId]
      );
      const status = statusPayload
        ? normalizarStatus(statusPayload)
        : existente?.status || 'concluida';
      const plataforma =
        plataformaPayload || existente?.plataforma || plataformaPadrao;
      const cliente = clientePayload || existente?.cliente || '';
      const email = emailPayload || existente?.cliente_email || '';
      const fone = fonePayload || existente?.cliente_fone || '';
      const cpf = cpfPayload || existente?.cliente_cpf || '';
      const endereco =
        enderecoPayload || existente?.cliente_endereco || '';
      const metodoPagamento =
        pagamentoPayload || existente?.metodo_pagamento || '';
      const statusConcluido = ['concluida', 'entregue'].includes(status);
      const dataRecebimento = statusConcluido
        ? dataRecebimentoPayload || existente?.data_recebimento || lastUpdated
        : null;
      const dataPrevistaRecebimento =
        dataPrevistaRecebimentoPayload ||
        existente?.data_prevista_recebimento ||
        null;
      const dataVenda = dataVendaPayload || existente?.data_venda || null;
      const taxaMlFinal =
        taxaMl !== null ? taxaMl : Number(existente?.taxa_ml || 0);
      const packIdFinal = mlPackId || existente?.ml_pack_id || null;
      const mlStatusFinal = mlStatus || existente?.ml_status || '';
      const buyerIdFinal = mlBuyerId || existente?.ml_buyer_id || null;
      const buyerNicknameFinal =
        mlBuyerNickname || existente?.ml_buyer_nickname || '';

      let vendaId;
      let atualizado = false;

      if (existente) {
        vendaId = existente.id;
        atualizado = true;

        await db.run(
          `UPDATE vendas
           SET valor = ?,
               plataforma = ?,
               cliente = ?,
               metodo_pagamento = ?,
               status = ?,
               cliente_email = ?,
               cliente_fone = ?,
               cliente_cpf = ?,
               cliente_endereco = ?,
               data_recebimento = ?,
               data_prevista_recebimento = COALESCE(?, data_prevista_recebimento),
               data_venda = COALESCE(?, data_venda),
               taxa_ml = ?,
               ml_pack_id = COALESCE(?, ml_pack_id),
               ml_status = ?,
               ml_buyer_id = COALESCE(?, ml_buyer_id),
               ml_buyer_nickname = COALESCE(NULLIF(?, ''), ml_buyer_nickname),
               last_updated = ?,
               itens_count = ?
           WHERE id = ?`,
          [
            total,
            plataforma,
            cliente,
            metodoPagamento,
            status,
            email,
            fone,
            cpf,
            endereco,
            dataRecebimento,
            dataPrevistaRecebimento,
            dataVenda,
            taxaMlFinal,
            packIdFinal,
            mlStatusFinal,
            buyerIdFinal,
            buyerNicknameFinal,
            lastUpdated,
            itens.length,
            vendaId
          ]
        );

        await db.run('DELETE FROM venda_itens WHERE venda_id = ?', [vendaId]);
      } else {
        const resultado = await db.run(
          `INSERT INTO vendas (
            order_id, valor, plataforma, cliente, metodo_pagamento, status,
            cliente_email, cliente_fone, cliente_cpf, cliente_endereco,
            data_recebimento, data_prevista_recebimento, data_venda,
            taxa_ml, ml_pack_id, ml_status,
            ml_buyer_id, ml_buyer_nickname, last_updated, itens_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            total,
            plataforma,
            cliente,
            metodoPagamento,
            status,
            email,
            fone,
            cpf,
            endereco,
            dataRecebimento,
            dataPrevistaRecebimento,
            dataVenda,
            taxaMlFinal,
            packIdFinal,
            mlStatusFinal,
            buyerIdFinal,
            buyerNicknameFinal,
            lastUpdated,
            itens.length
          ]
        );

        vendaId = resultado.lastID;
      }

      for (const item of itens) {
        await db.run(
          `INSERT INTO venda_itens (
            venda_id, sku, descricao, quantidade, preco_unitario
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            vendaId,
            item.sku,
            item.descricao,
            item.quantidade,
            item.precoUnitario
          ]
        );
      }

      await db.exec('COMMIT');

      return {
        venda_id: vendaId,
        order_id: orderId,
        atualizado,
        status,
        total,
        taxa_ml: taxaMlFinal,
        data_venda: dataVenda,
        ml_pack_id: packIdFinal,
        cliente,
        cliente_cpf: cpf,
        cliente_endereco: endereco,
        itens: itens.length
      };
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      throw error;
    }
  });
}

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
const STATUS_RECLAMACAO_ABERTA =
  "status NOT IN ('resolvida', 'resolvido', 'fechada', 'closed')";

function numero(valor, padrao = 0) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : padrao;
}

function classificarStatusGrupo(valor) {
  const status = texto(valor, 40).toLowerCase();

  if (STATUS_CANCELADOS.includes(status)) return 'cancelada';
  if (STATUS_CONCLUIDOS.includes(status)) return 'concluida';
  if (STATUS_ANDAMENTO.includes(status)) return 'andamento';
  return 'andamento';
}

function rotuloPagamento(valor) {
  const chave = texto(valor, 80).toLowerCase();
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

  return mapa[chave] || (chave ? chave.replace(/[_-]+/g, ' ') : 'Não informado');
}

function mapearVendaLista(venda, itens = []) {
  const statusGrupo = classificarStatusGrupo(venda.status);
  const titulo =
    texto(venda.peca_nome, 300) ||
    texto(itens[0]?.descricao, 300) ||
    'Produto do anúncio';
  const sku =
    texto(venda.peca_sku, 80) || texto(itens[0]?.sku, 80) || '';

  return {
    id: venda.id,
    order_id: venda.order_id || null,
    titulo,
    sku,
    valor: numero(venda.valor),
    taxa_ml: numero(venda.taxa_ml),
    plataforma: venda.plataforma || 'Mercado Livre',
    cliente: venda.cliente || '',
    cliente_email: venda.cliente_email || '',
    cliente_fone: venda.cliente_fone || '',
    cliente_cpf: venda.cliente_cpf || '',
    cliente_endereco: venda.cliente_endereco || '',
    metodo_pagamento: venda.metodo_pagamento || '',
    metodo_pagamento_label: rotuloPagamento(venda.metodo_pagamento),
    status: venda.status,
    status_grupo: statusGrupo,
    ml_status: venda.ml_status || '',
    ml_pack_id: venda.ml_pack_id || venda.order_id || null,
    ml_buyer_id: venda.ml_buyer_id || null,
    ml_buyer_nickname: venda.ml_buyer_nickname || '',
    data_venda: venda.data_venda,
    data_recebimento: venda.data_recebimento || null,
    data_prevista_recebimento: venda.data_prevista_recebimento || null,
    financeiro_status:
      venda.financeiro_status ||
      (Number(venda.enviada_financeiro) === 1 ? 'enviada' : 'disponivel'),
    financeiro_agendada_para: venda.financeiro_agendada_para || null,
    enviada_financeiro: Number(venda.enviada_financeiro) || 0,
    enviada_financeiro_em: venda.enviada_financeiro_em || null,
    peca_id: venda.peca_id || null,
    peca_nome: venda.peca_nome || titulo,
    peca_sku: sku,
    peca_imagem: venda.peca_imagem || null,
    peca_carro: venda.peca_carro || null,
    reclamacoes_abertas: numero(venda.reclamacoes_abertas),
    itens_count: itens.length || numero(venda.itens_count),
    itens
  };
}

const CAMPOS_VENDA = `
  v.id, v.peca_id, v.order_id, v.valor, v.plataforma, v.cliente,
  v.cliente_email, v.cliente_fone, v.cliente_cpf, v.cliente_endereco,
  v.metodo_pagamento, v.status, v.ml_status, v.ml_pack_id, v.ml_buyer_id,
  v.ml_buyer_nickname, v.taxa_ml, v.itens_count,
  datetime(v.data_venda, 'localtime') AS data_venda,
  datetime(v.data_recebimento, 'localtime') AS data_recebimento,
  datetime(v.data_prevista_recebimento, 'localtime') AS data_prevista_recebimento,
  v.financeiro_status, v.financeiro_agendada_para,
  v.enviada_financeiro, v.enviada_financeiro_em,
  p.nome AS peca_nome, p.sku AS peca_sku, p.carro AS peca_carro,
  COALESCE(
    (SELECT pi.caminho FROM peca_imagens pi
      WHERE pi.peca_id = p.id
      ORDER BY pi.is_principal DESC, pi.ordem ASC, pi.id ASC
      LIMIT 1),
    REPLACE(COALESCE(p.ml_thumbnail, ''), 'http://', 'https://')
  ) AS peca_imagem,
  (
    SELECT COUNT(*) FROM reclamacoes_ml r
     WHERE r.pedido_id = v.order_id
       AND r.${STATUS_RECLAMACAO_ABERTA}
  ) AS reclamacoes_abertas
`;

async function carregarItens(db, ids) {
  if (!ids.length) return new Map();

  const linhas = await db.all(
    `SELECT venda_id, sku, descricao, quantidade, preco_unitario
     FROM venda_itens
     WHERE venda_id IN (${ids.map(() => '?').join(', ')})
     ORDER BY id ASC`,
    ids
  );
  const mapa = new Map();

  for (const item of linhas) {
    const lista = mapa.get(item.venda_id) || [];
    lista.push({
      sku: item.sku,
      descricao: item.descricao,
      quantidade: numero(item.quantidade, 1),
      preco_unitario: numero(item.preco_unitario)
    });
    mapa.set(item.venda_id, lista);
  }

  return mapa;
}

export async function listarVendas(params = {}) {
  const db = getDb();
  const busca = texto(params.q || params.busca, 120).toLowerCase();
  const statusFiltro = texto(params.status, 40).toLowerCase();
  const limite = Math.min(500, Math.max(1, Math.trunc(numero(params.limite, 80))));
  const offset = Math.max(0, Math.trunc(numero(params.offset, 0)));
  const condicoes = [
    `(v.plataforma LIKE '%ML%' OR v.plataforma LIKE '%Mercado Livre%' OR v.order_id IS NOT NULL)`
  ];
  const valores = [];

  if (statusFiltro === 'canceladas') {
    condicoes.push(
      `LOWER(COALESCE(v.status, '')) IN ('${STATUS_CANCELADOS.join("','")}')`
    );
  } else if (statusFiltro === 'concluidas') {
    condicoes.push(
      `LOWER(COALESCE(v.status, '')) IN ('${STATUS_CONCLUIDOS.join("','")}')`
    );
  } else if (statusFiltro === 'andamento') {
    condicoes.push(
      `LOWER(COALESCE(v.status, '')) NOT IN ('${[
        ...STATUS_CANCELADOS,
        ...STATUS_CONCLUIDOS
      ].join("','")}')`
    );
  }

  if (busca) {
    condicoes.push(`(
      LOWER(COALESCE(v.order_id, '')) LIKE ? OR
      LOWER(COALESCE(v.cliente, '')) LIKE ? OR
      LOWER(COALESCE(v.cliente_cpf, '')) LIKE ? OR
      LOWER(COALESCE(p.nome, '')) LIKE ? OR
      LOWER(COALESCE(p.sku, '')) LIKE ? OR
      EXISTS (
        SELECT 1 FROM venda_itens vi
         WHERE vi.venda_id = v.id
           AND (
             LOWER(COALESCE(vi.sku, '')) LIKE ? OR
             LOWER(COALESCE(vi.descricao, '')) LIKE ?
           )
      )
    )`);
    const like = `%${busca}%`;
    valores.push(like, like, like, like, like, like, like);
  }

  const where = `WHERE ${condicoes.join(' AND ')}`;
  const [totalRow, resumo, rows] = await Promise.all([
    db.get(
      `SELECT COUNT(*) AS total
       FROM vendas v
       LEFT JOIN pecas p ON p.id = v.peca_id
       ${where}`,
      valores
    ),
    db.get(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN DATE(v.data_venda, 'localtime') = DATE('now', 'localtime') THEN 1 ELSE 0 END), 0) AS hoje,
         COALESCE(SUM(CASE WHEN LOWER(COALESCE(v.status, '')) IN ('${STATUS_CANCELADOS.join("','")}') THEN 1 ELSE 0 END), 0) AS canceladas,
         COALESCE(SUM(CASE WHEN LOWER(COALESCE(v.status, '')) IN ('${STATUS_CONCLUIDOS.join("','")}') THEN 1 ELSE 0 END), 0) AS concluidas
       FROM vendas v
       LEFT JOIN pecas p ON p.id = v.peca_id
       ${where}`,
      valores
    ),
    db.all(
      `SELECT ${CAMPOS_VENDA}
       FROM vendas v
       LEFT JOIN pecas p ON p.id = v.peca_id
       ${where}
       ORDER BY v.data_venda DESC, v.id DESC
       LIMIT ? OFFSET ?`,
      [...valores, limite, offset]
    )
  ]);

  const itensPorVenda = await carregarItens(
    db,
    rows.map((venda) => venda.id)
  );

  return {
    total: numero(totalRow?.total),
    resumo: {
      total: numero(resumo?.total),
      hoje: numero(resumo?.hoje),
      concluidas: numero(resumo?.concluidas),
      andamento: Math.max(
        0,
        numero(resumo?.total) -
          numero(resumo?.concluidas) -
          numero(resumo?.canceladas)
      ),
      canceladas: numero(resumo?.canceladas)
    },
    vendas: rows.map((venda) =>
      mapearVendaLista(venda, itensPorVenda.get(venda.id) || [])
    )
  };
}

export async function obterVendaPorId(id) {
  const vendaId = Number(id);

  if (!Number.isInteger(vendaId) || vendaId <= 0) {
    const error = new Error('ID da venda inválido');
    error.statusCode = 400;
    throw error;
  }

  const db = getDb();
  const venda = await db.get(
    `SELECT ${CAMPOS_VENDA}
     FROM vendas v
     LEFT JOIN pecas p ON p.id = v.peca_id
     WHERE v.id = ?`,
    [vendaId]
  );

  if (!venda) {
    const error = new Error('Venda não encontrada');
    error.statusCode = 404;
    throw error;
  }

  const itensPorVenda = await carregarItens(db, [venda.id]);
  const detalhe = mapearVendaLista(venda, itensPorVenda.get(venda.id) || []);
  const reclamacoes = venda.order_id
    ? await db.all(
        `SELECT id, pedido_id, motivo, descricao, status,
                datetime(data_reclamacao, 'localtime') AS data_reclamacao
         FROM reclamacoes_ml
         WHERE pedido_id = ?
         ORDER BY data_reclamacao DESC`,
        [venda.order_id]
      )
    : [];

  return {
    ...detalhe,
    reclamacoes
  };
}

export async function obterNotificacoes(params = {}) {
  const db = getDb();
  const depoisVenda = Math.max(0, Math.trunc(numero(params.vendaId, 0)));
  const depoisReclamacao = Math.max(
    0,
    Math.trunc(numero(params.reclamacaoId, 0))
  );
  const depoisPergunta = Math.max(
    0,
    Math.trunc(numero(params.perguntaId, 0))
  );
  const [
    contadores,
    ultimaVenda,
    ultimaReclamacao,
    ultimaPergunta,
    vendas,
    reclamacoes,
    perguntas
  ] =
    await Promise.all([
      db.get(
        `SELECT
           (SELECT COUNT(*) FROM vendas
             WHERE DATE(data_venda, 'localtime') = DATE('now', 'localtime')
               AND LOWER(COALESCE(status, '')) NOT IN ('${STATUS_CANCELADOS.join("','")}')) AS vendas_hoje,
           (SELECT COUNT(*) FROM reclamacoes_ml
             WHERE ${STATUS_RECLAMACAO_ABERTA}) AS reclamacoes_abertas,
           (SELECT COUNT(*) FROM perguntas_ml WHERE respondida = 0) AS perguntas_pendentes`
      ),
      db.get('SELECT MAX(id) AS id FROM vendas'),
      db.get('SELECT MAX(id) AS id FROM reclamacoes_ml'),
      db.get('SELECT MAX(id) AS id FROM perguntas_ml'),
      depoisVenda > 0
        ? db.all(
            `SELECT v.id, v.order_id, v.valor,
                    COALESCE(NULLIF(v.cliente, ''), NULLIF(v.ml_buyer_nickname, '')) AS cliente,
                    v.status,
                    datetime(v.data_venda, 'localtime') AS data_venda,
                    COALESCE(p.nome, (
                      SELECT vi.descricao FROM venda_itens vi
                       WHERE vi.venda_id = v.id
                       ORDER BY vi.id ASC LIMIT 1
                    )) AS titulo
             FROM vendas v
             LEFT JOIN pecas p ON p.id = v.peca_id
             WHERE v.id > ?
             ORDER BY v.id DESC
             LIMIT 12`,
            [depoisVenda]
          )
        : Promise.resolve([]),
      depoisReclamacao > 0
        ? db.all(
            `SELECT r.id, r.pedido_id, r.motivo, r.status,
                    datetime(r.data_reclamacao, 'localtime') AS data_reclamacao,
                    p.nome AS peca_nome
             FROM reclamacoes_ml r
             LEFT JOIN pecas p ON p.id = r.peca_id
             WHERE r.id > ?
             ORDER BY r.id DESC
             LIMIT 12`,
            [depoisReclamacao]
          )
        : Promise.resolve([])
      ,
      depoisPergunta > 0
        ? db.all(
            `SELECT q.id, q.pergunta, q.respondida,
                    datetime(q.data_pergunta, 'localtime') AS data_pergunta,
                    p.nome AS peca_nome
             FROM perguntas_ml q
             LEFT JOIN pecas p ON p.id = q.peca_id
             WHERE q.id > ?
             ORDER BY q.id DESC
             LIMIT 12`,
            [depoisPergunta]
          )
        : Promise.resolve([])
    ]);

  return {
    contadores: {
      vendasHoje: numero(contadores?.vendas_hoje),
      reclamacoesAbertas: numero(contadores?.reclamacoes_abertas),
      perguntasPendentes: numero(contadores?.perguntas_pendentes)
    },
    ultimos: {
      vendaId: numero(ultimaVenda?.id),
      reclamacaoId: numero(ultimaReclamacao?.id),
      perguntaId: numero(ultimaPergunta?.id)
    },
    vendas: (vendas || []).map((venda) => ({
      id: venda.id,
      tipo: 'venda',
      order_id: venda.order_id,
      titulo: venda.titulo || 'Nova venda',
      cliente: venda.cliente || 'Comprador',
      valor: numero(venda.valor),
      status: venda.status,
      data: venda.data_venda
    })),
    reclamacoes: (reclamacoes || []).map((item) => ({
      id: item.id,
      tipo: 'reclamacao',
      pedido_id: item.pedido_id,
      titulo: item.peca_nome || item.motivo || 'Reclamação',
      motivo: item.motivo,
      status: item.respondida ? 'respondida' : 'pendente',
      data: item.data_reclamacao
    })),
    perguntas: (perguntas || []).map((item) => ({
      id: item.id,
      tipo: 'pergunta',
      titulo: item.peca_nome || 'Nova pergunta',
      pergunta: item.pergunta,
      status: item.status,
      data: item.data_pergunta
    }))
  };
}
