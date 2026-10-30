import { getDb } from '../database.js';

const STATUS_FINALIZADOS = new Set([
  'delivered',
  'not_delivered',
  'returned'
]);
const STATUS_CANCELADOS = new Set(['cancelled', 'canceled']);
const STATUS_EM_TRANSITO = new Set([
  'shipped',
  'in_transit',
  'out_for_delivery'
]);
const SUBSTATUS_JA_DESPACHADOS = new Set(['dropped_off', 'picked_up', 'in_hub']);
const STATUS_ATIVOS = new Set(['ready_to_ship', 'pending', 'handling']);
const SUBSTATUS_LIBERADOS_HOJE = new Set([
  'invoice_pending',
  'ready_to_print',
  'printed'
]);
const SUBSTATUS_ETIQUETA_IMPRESSA = new Set(['printed']);
const SUBSTATUS_ETIQUETA_IMPRIMIVEL = new Set([
  'ready_to_print',
  'printed'
]);
const LOGISTICA_AGENCIA = new Set(['xd_drop_off', 'drop_off']);
const HORARIO_LIMITE_AGENCIA = '14:30';

function texto(valor, limite = 300) {
  return String(valor ?? '').trim().slice(0, limite);
}

function numero(valor, padrao = 0) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : padrao;
}

function paraIso(valor) {
  if (!valor) return null;

  const somenteData = String(valor).match(/^\d{4}-\d{2}-\d{2}$/);

  if (somenteData) return somenteData[0];

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return null;

  return data.toISOString();
}

function normalizarImagem(valor) {
  return texto(valor, 1000).replace(/^http:\/\//i, 'https://');
}

function chaveDiaLocal(valor) {
  if (!valor) return null;

  const somenteData = String(valor).match(/^(\d{4}-\d{2}-\d{2})$/);

  if (somenteData) return somenteData[1];

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return null;

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(data);
  const valores = Object.fromEntries(
    partes
      .filter((parte) => parte.type !== 'literal')
      .map((parte) => [parte.type, parte.value])
  );

  return `${valores.year}-${valores.month}-${valores.day}`;
}

function partesDataLocal(data) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(data);

  return Object.fromEntries(
    partes
      .filter((parte) => parte.type !== 'literal')
      .map((parte) => [parte.type, parte.value])
  );
}

function dataComHorarioLocal(dia, horario) {
  const tentativa = new Date(`${dia}T${horario}:00Z`);
  const partes = partesDataLocal(tentativa);
  const horarioRepresentadoComoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute)
  );

  return new Date(
    tentativa.getTime() + tentativa.getTime() - horarioRepresentadoComoUtc
  );
}

function prazoDespacho(payBefore, logisticType) {
  if (!payBefore || !LOGISTICA_AGENCIA.has(texto(logisticType, 80).toLowerCase())) {
    return payBefore;
  }

  const dia = chaveDiaLocal(payBefore);

  if (!dia) return payBefore;

  return dataComHorarioLocal(dia, HORARIO_LIMITE_AGENCIA).toISOString();
}

function prazoVencido(prazo, agora) {
  if (!prazo) return false;

  if (/^\d{4}-\d{2}-\d{2}$/.test(prazo)) {
    const hoje = chaveDiaLocal(new Date(agora).toISOString());
    return prazo < hoje;
  }

  const timestamp = new Date(prazo).getTime();

  return Number.isFinite(timestamp) && timestamp < agora;
}

function capitalizar(valor) {
  const textoNormalizado = texto(valor, 120);

  if (!textoNormalizado) return '';

  return (
    textoNormalizado.charAt(0).toUpperCase() + textoNormalizado.slice(1)
  );
}

function rotuloDia(chave) {
  if (!chave) return 'Sem data';

  const hoje = chaveDiaLocal(new Date().toISOString());
  const amanhaData = new Date(`${hoje}T12:00:00Z`);
  amanhaData.setUTCDate(amanhaData.getUTCDate() + 1);
  const amanha = amanhaData.toISOString().slice(0, 10);

  if (chave === hoje) return 'Hoje';
  if (chave === amanha) return 'Amanhã';

  const data = new Date(`${chave}T12:00:00`);

  if (Number.isNaN(data.getTime())) return chave;

  return capitalizar(
    new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(data)
  );
}

function montarEndereco(receiver = {}) {
  const partes = [];
  const linha =
    texto(receiver.address_line, 180) ||
    [
      texto(receiver.street_name, 160),
      texto(receiver.street_number, 30)
    ]
      .filter(Boolean)
      .join(', ');

  if (linha) partes.push(linha);

  const bairro = texto(receiver.neighborhood?.name, 120);
  if (bairro) partes.push(bairro);

  const cidade = texto(receiver.city?.name, 120);
  const estado = texto(
    receiver.state?.id || receiver.state?.name,
    40
  ).replace(/^BR-/i, '');

  if (cidade || estado) {
    partes.push([cidade, estado].filter(Boolean).join('/'));
  }

  const cep = texto(receiver.zip_code, 20);
  if (cep) partes.push(`CEP: ${cep}`);

  return texto(partes.join(' - '), 500);
}

function montarItens(order = {}, shipment = {}) {
  const itensPedido = Array.isArray(order.order_items)
    ? order.order_items
    : [];
  const itensEnvio = Array.isArray(shipment.shipping_items)
    ? shipment.shipping_items
    : [];
  const itens = itensPedido.map((orderItem) => {
    const item = orderItem?.item || {};

    return {
      item_id: texto(item.id, 100) || null,
      sku:
        texto(
          item.seller_sku || item.seller_custom_field || item.id,
          100
        ) || null,
      descricao: texto(item.title, 500) || null,
      quantidade: Math.max(
        1,
        Math.trunc(numero(orderItem.quantity, 1))
      ),
      preco_unitario: numero(orderItem.unit_price)
    };
  });

  if (itens.length > 0) return itens;

  return itensEnvio.map((item) => ({
    item_id: texto(item.id || item.item_id, 100) || null,
    sku: texto(item.seller_sku || item.id || item.item_id, 100) || null,
    descricao: texto(item.description, 500) || null,
    quantidade: Math.max(1, Math.trunc(numero(item.quantity, 1))),
    preco_unitario: 0
  }));
}

function statusLabel(status, substatus) {
  const statusNormalizado = texto(status, 60).toLowerCase();
  const substatusNormalizado = texto(substatus, 80).toLowerCase();

  if (statusNormalizado === 'ready_to_ship') {
    if (substatusNormalizado === 'in_packing_list') return 'Na lista de coleta · aguardando confirmação do ML';
    if (substatusNormalizado === 'invoice_pending') return 'NF-e pendente';
    if (substatusNormalizado === 'buffered') return 'Aguardando';
    return 'Pronto para enviar';
  }

  if (statusNormalizado === 'pending') {
    return substatusNormalizado === 'buffered'
      ? 'Aguardando'
      : 'Pendente';
  }

  if (statusNormalizado === 'handling') return 'Em preparação';
  if (STATUS_EM_TRANSITO.has(statusNormalizado)) return 'Em trânsito';
  if (statusNormalizado === 'delivered') return 'Entregue';
  if (statusNormalizado === 'cancelled' || statusNormalizado === 'canceled') {
    return 'Cancelado';
  }
  if (statusNormalizado === 'not_delivered') return 'Não entregue';
  if (statusNormalizado === 'returned') return 'Devolvido';

  return statusNormalizado
    ? capitalizar(statusNormalizado.replace(/[_-]+/g, ' '))
    : 'Sem status';
}

function logisticLabel(logisticType, trackingMethod) {
  const tipo = texto(logisticType, 80).toLowerCase();
  const mapa = {
    xd_drop_off: 'Agência Mercado Livre',
    drop_off: 'Agência Mercado Livre',
    self_service: 'Ponto de coleta',
    cross_docking: 'Mercado Envios',
    fulfillment: 'Mercado Envios Full',
    custom: 'Envio personalizado',
    me2: 'Mercado Envios'
  };

  if (mapa[tipo]) return mapa[tipo];

  const metodo = texto(trackingMethod, 120);
  if (metodo) return metodo;

  return tipo
    ? capitalizar(tipo.replace(/[_-]+/g, ' '))
    : 'Mercado Livre';
}

export function classificarAba(
  status,
  substatus,
  payBefore,
  combinarComprador = false
) {
  const statusNormalizado = texto(status, 60).toLowerCase();
  const substatusNormalizado = texto(substatus, 80).toLowerCase();

  if (STATUS_CANCELADOS.has(statusNormalizado)) return 'cancelados';
  if (STATUS_FINALIZADOS.has(statusNormalizado)) return 'finalizadas';
  if (
    STATUS_EM_TRANSITO.has(statusNormalizado) ||
    SUBSTATUS_JA_DESPACHADOS.has(substatusNormalizado)
  ) {
    return 'transito';
  }

  if (combinarComprador) return 'combinar';

  if (STATUS_ATIVOS.has(statusNormalizado)) {
    if (!payBefore) return 'hoje';

    const prazo = chaveDiaLocal(payBefore);
    const hoje = chaveDiaLocal(new Date().toISOString());

    return !prazo || prazo <= hoje ? 'hoje' : 'proximos';
  }

  return 'finalizadas';
}

export function etiquetaDisponivel(status, substatus, emitidaEm = null) {
  const statusNormalizado = texto(status, 60).toLowerCase();
  const substatusNormalizado = texto(substatus, 80).toLowerCase();

  return (
    statusNormalizado === 'ready_to_ship' &&
    (SUBSTATUS_ETIQUETA_IMPRIMIVEL.has(substatusNormalizado) ||
      Boolean(emitidaEm))
  );
}

export function etiquetaJaEmitida(substatus, emitidaEm = null) {
  return (
    SUBSTATUS_ETIQUETA_IMPRESSA.has(texto(substatus, 80).toLowerCase()) ||
    Boolean(emitidaEm)
  );
}

function dataReferencia(aba, envio) {
  if (aba === 'combinar') return envio.date_created;

  if (aba === 'hoje' || aba === 'proximos') {
    return envio.pay_before;
  }

  if (aba === 'transito') {
    return (
      envio.date_shipped ||
      envio.date_ready_to_ship ||
      envio.estimated_delivery ||
      envio.date_created
    );
  }

  return (
    envio.date_delivered ||
    envio.date_cancelled ||
    envio.date_shipped ||
    envio.date_created
  );
}

function mapearEnvio(linha, agora) {
  const status = texto(linha.status, 60).toLowerCase();
  const substatus = texto(linha.substatus, 80).toLowerCase();
  const payBefore = paraIso(linha.pay_before);
  const prazo = prazoDespacho(payBefore, linha.logistic_type);
  const combinarComprador = Boolean(Number(linha.combinar_comprador));
  const dateShipped = paraIso(linha.date_shipped);
  const despachoRealizado = Boolean(dateShipped) ||
    STATUS_EM_TRANSITO.has(status) ||
    STATUS_FINALIZADOS.has(status) ||
    SUBSTATUS_JA_DESPACHADOS.has(substatus);
  const abaMl =
    STATUS_CANCELADOS.has(status) || STATUS_FINALIZADOS.has(status)
      ? classificarAba(status, substatus, payBefore, combinarComprador)
      : despachoRealizado
      ? 'transito'
      : classificarAba(status, substatus, payBefore, combinarComprador);
  const despachoInformadoEm = paraIso(linha.despacho_informado_em);
  const confirmadoPeloOperador = Boolean(despachoInformadoEm) && ['hoje', 'proximos'].includes(abaMl);
  const aba = confirmadoPeloOperador ? 'transito' : abaMl;
  const nfePendente = substatus === 'invoice_pending';
  const liberadoHoje =
    STATUS_ATIVOS.has(status) &&
    SUBSTATUS_LIBERADOS_HOJE.has(substatus);
  const etiquetaEmitidaEm = paraIso(linha.etiqueta_emitida_em);
  const itens = (() => {
    try {
      const lista = JSON.parse(linha.itens || '[]');
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  })();
  const referencia = dataReferencia(aba, {
    pay_before: payBefore,
    estimated_delivery: paraIso(linha.estimated_delivery),
    date_created: paraIso(linha.date_created),
    date_shipped: dateShipped || (confirmadoPeloOperador ? despachoInformadoEm : null),
    date_delivered: paraIso(linha.date_delivered),
    date_cancelled: paraIso(linha.date_cancelled)
  });
  const dia = chaveDiaLocal(referencia);

  return {
    id: numero(linha.id),
    shipment_id: texto(linha.shipment_id, 100),
    order_id: texto(linha.order_id, 120) || null,
    pack_id: texto(linha.pack_id, 120) || null,
    venda_id: numero(linha.venda_id) || null,
    status,
    substatus,
    status_label: confirmadoPeloOperador
      ? 'Em trânsito · despacho confirmado pelo operador'
      : aba === 'transito' && SUBSTATUS_JA_DESPACHADOS.has(substatus)
      ? substatus === 'picked_up' ? 'Coletado pela transportadora' : 'Recebido pelo Mercado Livre'
      : despachoRealizado
      ? 'Em trânsito · despacho confirmado pelo Mercado Livre'
      : aba === 'combinar'
        ? 'A combinar com o comprador'
      : statusLabel(status, substatus),
    aba,
    despacho_informado_em: despachoInformadoEm,
    logistic_type: texto(linha.logistic_type, 80),
    logistic_label: combinarComprador
      ? 'A combinar com o comprador'
      : logisticLabel(linha.logistic_type, linha.tracking_method),
    combinar_comprador: combinarComprador,
    tracking_method: texto(linha.tracking_method, 120),
    tracking_number: texto(linha.tracking_number, 120) || null,
    pay_before: payBefore,
    prazo_despacho: prazo,
    data_original_despacho: payBefore,
    estimated_delivery: paraIso(linha.estimated_delivery),
    date_created: paraIso(linha.date_created),
    date_ready_to_ship: paraIso(linha.date_ready_to_ship),
    date_shipped: paraIso(linha.date_shipped),
    date_delivered: paraIso(linha.date_delivered),
    date_cancelled: paraIso(linha.date_cancelled),
    dia,
    dia_label: rotuloDia(dia),
    receiver_name: texto(linha.receiver_name, 200),
    receiver_address: texto(linha.receiver_address, 500),
    receiver_city: texto(linha.receiver_city, 120),
    receiver_state: texto(linha.receiver_state, 40),
    receiver_zip: texto(linha.receiver_zip, 20),
    destino:
      [texto(linha.receiver_city, 120), texto(linha.receiver_state, 40)]
        .filter(Boolean)
        .join(' • ') ||
      texto(linha.receiver_address, 300) ||
      'Destino não informado',
    titulo:
      texto(linha.titulo_exibicao, 300) ||
      texto(linha.titulo, 300) ||
      'Produto do anúncio',
    sku: texto(linha.sku_exibicao, 100) || texto(linha.sku, 100) || null,
    cliente:
      texto(linha.receiver_name, 200) ||
      texto(linha.cliente, 200) ||
      'Comprador',
    valor: numero(linha.valor),
    imagem: normalizarImagem(linha.imagem) || null,
    ml_item_id: texto(linha.ml_item_id, 100) || null,
    metodo_pagamento: texto(linha.metodo_pagamento, 80) || null,
    itens,
    itens_count: itens.length,
    nfe_pendente: nfePendente,
    liberado_hoje: liberadoHoje,
    nfe_xml_disponivel: Boolean(linha.nfe_xml_arquivo),
    nfe_xml_nome: texto(linha.nfe_xml_nome, 255) || null,
    nfe_xml_enviado_em: paraIso(linha.nfe_xml_enviado_em),
    etiqueta_disponivel: (aba === 'hoje' || aba === 'proximos') && etiquetaDisponivel(
      status,
      substatus,
      etiquetaEmitidaEm
    ),
    etiqueta_emitida: etiquetaJaEmitida(substatus, etiquetaEmitidaEm),
    etiqueta_emitida_em: etiquetaEmitidaEm,
    atrasado:
      aba === 'hoje' &&
      !despachoRealizado &&
      !liberadoHoje &&
      prazoVencido(prazo, agora),
    sincronizado_em: paraIso(linha.sincronizado_em)
  };
}

function compararEnvios(a, b) {
  if (a.aba !== b.aba) {
    const ordem = {
      hoje: 0,
      proximos: 1,
      combinar: 2,
      transito: 3,
      finalizadas: 4,
      cancelados: 5
    };
    return ordem[a.aba] - ordem[b.aba];
  }

  if (a.aba === 'hoje' || a.aba === 'proximos') {
    const prazoA = a.prazo_despacho || a.pay_before
      ? new Date(a.prazo_despacho || a.pay_before).getTime()
      : Number.MAX_SAFE_INTEGER;
    const prazoB = b.prazo_despacho || b.pay_before
      ? new Date(b.prazo_despacho || b.pay_before).getTime()
      : Number.MAX_SAFE_INTEGER;

    if (prazoA !== prazoB) return prazoA - prazoB;
  }

  if (a.aba === 'transito') {
    const entregaA = a.estimated_delivery
      ? new Date(a.estimated_delivery).getTime()
      : Number.MAX_SAFE_INTEGER;
    const entregaB = b.estimated_delivery
      ? new Date(b.estimated_delivery).getTime()
      : Number.MAX_SAFE_INTEGER;

    if (entregaA !== entregaB) return entregaA - entregaB;
  }

  if (a.aba === 'finalizadas' || a.aba === 'cancelados') {
    const dataA = a.date_delivered || a.date_cancelled
      ? new Date(a.date_delivered || a.date_cancelled).getTime()
      : 0;
    const dataB = b.date_delivered || b.date_cancelled
      ? new Date(b.date_delivered || b.date_cancelled).getTime()
      : 0;

    if (dataA !== dataB) return dataB - dataA;
  }

  return b.id - a.id;
}

export async function confirmarDespachoInformado(orderId) {
  const id = texto(orderId, 120);
  const db = getDb();
  const envio = await db.get('SELECT status, combinar_comprador FROM ml_envios WHERE order_id = ?', [id]);
  if (!envio) throw new Error('Pedido não encontrado nos envios.');
  if (!STATUS_ATIVOS.has(texto(envio.status, 60).toLowerCase()) || Number(envio.combinar_comprador)) {
    throw new Error('O pedido não está pendente de despacho pelo Mercado Envios.');
  }
  await db.run(
    `UPDATE ml_envios SET despacho_informado_em = COALESCE(despacho_informado_em, ?), updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
    [new Date().toISOString(), id]
  );
}

export async function upsertEnvio({
  shipment,
  order,
  combinarComprador = false
} = {}) {
  const shipmentId = texto(
    shipment?.id ||
      order?.shipping?.id ||
      (combinarComprador ? `COMBINAR-${order?.id || ''}` : ''),
    100
  );

  if (!shipmentId) return { ignorado: true };

  const db = getDb();
  const orderId = texto(shipment?.order_id || order?.id, 120) || null;
  const itens = montarItens(order, shipment);
  const primeiroItem = itens[0] || {};
  const receiver = shipment?.receiver_address || {};
  const buyer = order?.buyer || {};
  const pagamentos = Array.isArray(order?.payments) ? order.payments : [];
  const pagamento =
    pagamentos.find(
      (item) => String(item?.status || '').toLowerCase() === 'approved'
    ) ||
    pagamentos[0] ||
    {};
  const valor =
    numero(order?.total_amount) ||
    itens.reduce(
      (total, item) => total + item.quantidade * item.preco_unitario,
      0
    );
  const statusHistory = shipment?.status_history || {};
  const estimated = shipment?.shipping_option?.estimated_delivery_time || {};
  const cliente =
    texto(receiver.receiver_name, 200) ||
    texto(
      [buyer.first_name, buyer.last_name].filter(Boolean).join(' '),
      200
    ) ||
    texto(buyer.nickname, 200) ||
    'Comprador';
  const venda = orderId
    ? await db.get('SELECT id FROM vendas WHERE order_id = ?', [orderId])
    : null;
  const agora = new Date().toISOString();
  const existente = await db.get(
    'SELECT id FROM ml_envios WHERE shipment_id = ?',
    [shipmentId]
  );
  const dados = [
    orderId,
    texto(order?.pack_id || shipment?.pack_id, 120) || null,
    venda?.id || null,
    texto(shipment?.status, 60).toLowerCase(),
    texto(shipment?.substatus, 80).toLowerCase(),
    texto(shipment?.logistic_type, 80),
    texto(shipment?.tracking_method, 120),
    texto(shipment?.tracking_number, 120) || null,
    paraIso(estimated.pay_before),
    paraIso(estimated.date),
    paraIso(shipment?.date_created || order?.date_created),
    paraIso(statusHistory.date_ready_to_ship),
    paraIso(statusHistory.date_shipped),
    paraIso(statusHistory.date_delivered),
    paraIso(statusHistory.date_cancelled),
    texto(receiver.receiver_name, 200),
    montarEndereco(receiver),
    texto(receiver.city?.name, 120),
    texto(receiver.state?.id || receiver.state?.name, 40).replace(
      /^BR-/i,
      ''
    ),
    texto(receiver.zip_code, 20),
    texto(primeiroItem.descricao, 300),
    texto(primeiroItem.sku, 100),
    cliente,
    valor,
    texto(pagamento.payment_method_id || pagamento.payment_type, 80),
    texto(primeiroItem.item_id, 100) || null,
    JSON.stringify(itens).slice(0, 20000),
    combinarComprador ? 1 : 0,
    agora,
    agora
  ];

  if (existente) {
    await db.run(
      `UPDATE ml_envios SET
         order_id = ?,
         pack_id = ?,
         venda_id = ?,
         status = ?,
         substatus = ?,
         logistic_type = ?,
         tracking_method = ?,
         tracking_number = ?,
         pay_before = ?,
         estimated_delivery = ?,
         date_created = ?,
         date_ready_to_ship = ?,
         date_shipped = ?,
         date_delivered = ?,
         date_cancelled = ?,
         receiver_name = ?,
         receiver_address = ?,
         receiver_city = ?,
         receiver_state = ?,
         receiver_zip = ?,
         titulo = ?,
         sku = ?,
         cliente = ?,
         valor = ?,
         metodo_pagamento = ?,
         ml_item_id = ?,
         itens = ?,
         combinar_comprador = ?,
         sincronizado_em = ?,
         updated_at = ?
       WHERE shipment_id = ?`,
      [...dados, shipmentId]
    );

    return {
      criado: false,
      atualizado: true,
      shipment_id: shipmentId,
      order_id: orderId
    };
  }

  await db.run(
    `INSERT INTO ml_envios (
       order_id, pack_id, venda_id, status, substatus, logistic_type,
       tracking_method, tracking_number, pay_before, estimated_delivery,
       date_created, date_ready_to_ship, date_shipped, date_delivered,
       date_cancelled, receiver_name, receiver_address, receiver_city,
       receiver_state, receiver_zip, titulo, sku, cliente, valor,
       metodo_pagamento, ml_item_id, itens, combinar_comprador,
       sincronizado_em, updated_at, shipment_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...dados, shipmentId]
  );

  return {
    criado: true,
    atualizado: false,
    shipment_id: shipmentId,
    order_id: orderId
  };
}

export async function listarEnvios({ periodo = 60 } = {}) {
  const db = getDb();
  const periodoDias = Math.min(
    365,
    Math.max(1, Math.trunc(numero(periodo, 60)) || 60)
  );
  const limite = Date.now() - periodoDias * 86400000;
  const [linhas, integracao] = await Promise.all([
    db.all(
      `SELECT e.*,
              v.id AS venda_id,
              COALESCE(p.nome, e.titulo) AS titulo_exibicao,
              COALESCE(p.sku, e.sku) AS sku_exibicao,
              COALESCE(
                (SELECT pi.caminho FROM peca_imagens pi
                  WHERE pi.peca_id = v.peca_id
                  ORDER BY pi.is_principal DESC, pi.ordem ASC, pi.id ASC
                  LIMIT 1),
                (SELECT REPLACE(COALESCE(p2.ml_thumbnail, ''), 'http://', 'https://')
                   FROM pecas p2
                  WHERE p2.ml_item_id = e.ml_item_id
                  LIMIT 1),
                (SELECT pi2.caminho FROM peca_imagens pi2
                   JOIN pecas p3 ON p3.id = pi2.peca_id
                  WHERE p3.ml_item_id = e.ml_item_id
                  ORDER BY pi2.is_principal DESC, pi2.ordem ASC, pi2.id ASC
                  LIMIT 1)
              ) AS imagem
         FROM ml_envios e
         LEFT JOIN vendas v ON v.order_id = e.order_id
         LEFT JOIN pecas p ON p.id = v.peca_id
        ORDER BY e.id DESC
        LIMIT 1000`
    ),
    db.get('SELECT access_token FROM ml_integracao WHERE id = 1')
  ]);

  const agora = Date.now();
  const relevantes = linhas.filter((linha) => {
    const status = texto(linha.status, 60).toLowerCase();

    if (
      !STATUS_FINALIZADOS.has(status) &&
      !STATUS_CANCELADOS.has(status)
    ) {
      return true;
    }

    const dataFinal =
      linha.date_delivered ||
      linha.date_cancelled ||
      linha.date_shipped ||
      linha.date_created;

    if (!dataFinal) return true;

    const timestamp = new Date(dataFinal).getTime();

    return !Number.isFinite(timestamp) || timestamp >= limite;
  });

  const envios = relevantes
    .map((linha) => mapearEnvio(linha, agora))
    .sort(compararEnvios);
  const contagens = {
    hoje: 0,
    proximos: 0,
    combinar: 0,
    transito: 0,
    finalizadas: 0,
    cancelados: 0
  };

  for (const envio of envios) {
    contagens[envio.aba] += 1;
  }

  const hoje = envios.filter((envio) => envio.aba === 'hoje');
  const proximos = envios.filter((envio) => envio.aba === 'proximos');
  const prazosHoje = hoje
    .map((envio) => envio.prazo_despacho || envio.pay_before)
    .filter(Boolean)
    .sort();
  const prazosHojeValidos = hoje
    .filter((envio) => !envio.atrasado)
    .map((envio) => envio.prazo_despacho || envio.pay_before)
    .filter(Boolean)
    .sort();
  const diasProximos = proximos
    .map((envio) => envio.dia)
    .filter(Boolean)
    .sort();
  const sincronizados = linhas
    .map((linha) => linha.sincronizado_em)
    .filter(Boolean)
    .sort();

  return {
    conectado: Boolean(integracao?.access_token),
    totalGeral: envios.length,
    sincronizadoEm:
      sincronizados.length > 0
        ? sincronizados[sincronizados.length - 1]
        : null,
    contagens,
    resumo: {
      paraEnviar: contagens.hoje,
      nfePendente: hoje.filter((envio) => envio.nfe_pendente).length,
      atrasados: hoje.filter((envio) => envio.atrasado).length,
      prazoHoje: prazosHoje[0] || null,
      proximoPrazoHoje: prazosHojeValidos[0] || null,
      proximoDia: diasProximos[0] || null
    },
    envios
  };
}
