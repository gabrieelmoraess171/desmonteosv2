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
      const existente = await db.get(
        `SELECT id, status, plataforma, cliente, cliente_email, cliente_fone,
                cliente_cpf, cliente_endereco, metodo_pagamento, data_recebimento,
                data_venda, taxa_ml, ml_pack_id, ml_status
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
      const dataVenda = dataVendaPayload || existente?.data_venda || null;
      const taxaMlFinal =
        taxaMl !== null ? taxaMl : Number(existente?.taxa_ml || 0);
      const packIdFinal = mlPackId || existente?.ml_pack_id || null;
      const mlStatusFinal = mlStatus || existente?.ml_status || '';

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
               data_venda = COALESCE(?, data_venda),
               taxa_ml = ?,
               ml_pack_id = COALESCE(?, ml_pack_id),
               ml_status = ?,
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
            dataVenda,
            taxaMlFinal,
            packIdFinal,
            mlStatusFinal,
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
            data_recebimento, data_venda, taxa_ml, ml_pack_id, ml_status,
            last_updated, itens_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            dataVenda,
            taxaMlFinal,
            packIdFinal,
            mlStatusFinal,
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
