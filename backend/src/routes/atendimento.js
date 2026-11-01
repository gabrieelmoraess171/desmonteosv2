import express from 'express';
import { getDb } from '../database.js';
import { gerarSugestaoResposta } from '../services/iaService.js';
import { responderPerguntaMl, obterMensagensReclamacao, obterDetalheReclamacao, obterResolucoesEsperadasReclamacao, obterPedidoMl, obterEnvioMl, enviarMensagemReclamacao, sincronizarPerguntas } from '../services/mercadoLivreService.js';

const router = express.Router();

const STATUS_RECLAMACAO_ABERTA =
  "status NOT IN ('resolvida', 'resolvido', 'fechada', 'closed')";

const CAMPOS_PERGUNTA = `
  q.id, q.peca_id, q.pergunta, q.resposta, q.sugestao_ia, q.sugestao_fonte, q.respondida,
  q.ml_question_id, q.ml_item_id, q.ml_status,
  q.ml_buyer_id,
  datetime(q.data_pergunta, 'localtime') AS data_pergunta,
  datetime(q.data_resposta, 'localtime') AS data_resposta,
  p.nome AS peca_nome, p.sku AS peca_sku, p.carro AS peca_carro,
  p.descricao AS peca_descricao, p.marca AS peca_marca,
  p.modelo AS peca_modelo, p.ano AS peca_ano, p.condicao AS peca_condicao,
  p.garantia AS peca_garantia, p.numero_oem AS peca_numero_oem,
  p.quantidade AS peca_quantidade, p.preco AS peca_preco,
  p.atributos AS peca_atributos, p.categoria AS peca_categoria,
  p.categoria_ml AS peca_categoria_ml, p.ml_titulo AS peca_ml_titulo,
  p.ml_item_id AS peca_ml_item_id, p.ml_permalink AS peca_ml_permalink,
  p.ml_thumbnail AS peca_ml_thumbnail,
  COALESCE(
    (
      SELECT pi.caminho FROM peca_imagens pi
      WHERE pi.peca_id = p.id
      ORDER BY pi.is_principal DESC, pi.ordem ASC, pi.id ASC
      LIMIT 1
    ),
    REPLACE(COALESCE(p.ml_thumbnail, ''), 'http://', 'https://')
  ) AS peca_imagem
`;

const CAMPOS_RECLAMACAO = `
  r.id, r.peca_id, r.pedido_id, r.motivo, r.descricao, r.status,
  r.ml_claim_id, r.ml_status,
  datetime(r.data_reclamacao, 'localtime') AS data_reclamacao,
  r.resolvido_em,
  p.nome AS peca_nome, p.sku AS peca_sku, p.carro AS peca_carro,
  p.descricao AS peca_descricao, p.preco AS peca_preco,
  COALESCE(
    (
      SELECT pi.caminho FROM peca_imagens pi
      WHERE pi.peca_id = p.id
      ORDER BY pi.is_principal DESC, pi.ordem ASC, pi.id ASC
      LIMIT 1
    ),
    REPLACE(COALESCE(p.ml_thumbnail, ''), 'http://', 'https://')
  ) AS peca_imagem,
  (
    SELECT v.cliente FROM vendas v
    WHERE v.order_id = r.pedido_id
    LIMIT 1
  ) AS comprador,
  (
    SELECT v.valor FROM vendas v
    WHERE v.order_id = r.pedido_id
    LIMIT 1
  ) AS valor_pedido
`;

function pecaDaPergunta(linha) {
  return {
    nome: linha.peca_nome,
    carro: linha.peca_carro,
    descricao: linha.peca_descricao,
    marca: linha.peca_marca,
    modelo: linha.peca_modelo,
    ano: linha.peca_ano,
    condicao: linha.peca_condicao,
    garantia: linha.peca_garantia,
    numero_oem: linha.peca_numero_oem,
    quantidade: linha.peca_quantidade,
    preco: linha.peca_preco,
    atributos: linha.peca_atributos,
    categoria: linha.peca_categoria,
    categoria_ml: linha.peca_categoria_ml,
    ml_titulo: linha.peca_ml_titulo
  };
}

router.get('/', async (req, res) => {
  try {
    const db = getDb();

    const [perguntas, reclamacoes] = await Promise.all([
      db.all(
        `SELECT ${CAMPOS_PERGUNTA}
         FROM perguntas_ml q
         LEFT JOIN pecas p ON p.id = q.peca_id
         WHERE q.respondida = 0
         ORDER BY q.data_pergunta DESC, q.id DESC
         LIMIT 100`
      ),
      db.all(
        `SELECT ${CAMPOS_RECLAMACAO}
         FROM reclamacoes_ml r
         LEFT JOIN pecas p ON p.id = r.peca_id
         WHERE ${STATUS_RECLAMACAO_ABERTA}
         ORDER BY r.data_reclamacao DESC, r.id DESC
         LIMIT 100`
      )
    ]);

    res.json({
      perguntas,
      reclamacoes,
      resumo: {
        perguntasPendentes: perguntas.length,
        reclamacoesAbertas: reclamacoes.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/perguntas/historico', async (req, res) => {
  try {
    const pecaId = Number(req.query.peca_id);
    const mlItemId = String(req.query.ml_item_id || '').trim();
    const mlBuyerId = String(req.query.ml_buyer_id || '').trim();
    if ((!Number.isInteger(pecaId) || pecaId <= 0) && !mlItemId) {
      return res.status(400).json({ error: 'Informe o anúncio para consultar o histórico.' });
    }

    // Atualiza as perguntas pendentes sem bloquear o atendimento com uma
    // varredura completa do histórico remoto a cada clique.
    try {
      await sincronizarPerguntas({ apenasPendentes: true });
    } catch {
      // Mantém o histórico local disponível se o Mercado Livre estiver fora.
    }

    const db = getDb();
    const temPeca = Number.isInteger(pecaId) && pecaId > 0;
    const parametros = mlBuyerId
      ? [mlBuyerId, temPeca ? pecaId : null, mlItemId || null]
      : [temPeca ? pecaId : null, mlItemId || null];
    const historico = await db.all(
      `SELECT q.id, q.pergunta, q.resposta, q.respondida, q.ml_question_id,
              q.ml_item_id, q.ml_buyer_id, datetime(q.data_pergunta, 'localtime') AS data_pergunta,
              datetime(q.data_resposta, 'localtime') AS data_resposta
         FROM perguntas_ml q
        WHERE q.respondida = 1
          AND ${mlBuyerId
            ? '(q.ml_buyer_id = ? AND (q.peca_id = ? OR q.ml_item_id = ?))'
            : '(q.peca_id = ? OR q.ml_item_id = ?)'}
        ORDER BY q.data_pergunta DESC, q.id DESC
        LIMIT 20`,
      parametros
    );

    res.json({ historico });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/perguntas/:id/sugestao', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID da pergunta inválido' });
    }

    const db = getDb();
    const linha = await db.get(
      `SELECT ${CAMPOS_PERGUNTA}
       FROM perguntas_ml q
       LEFT JOIN pecas p ON p.id = q.peca_id
       WHERE q.id = ?`,
      [id]
    );

    if (!linha) {
      return res.status(404).json({ error: 'Pergunta não encontrada' });
    }

    const resultado = await gerarSugestaoResposta({
      pergunta: linha.pergunta,
      peca: pecaDaPergunta(linha)
    });

    await db.run(
      'UPDATE perguntas_ml SET sugestao_ia = ?, sugestao_fonte = ? WHERE id = ?',
      [resultado.sugestao, resultado.fonte, id]
    );

    res.json({ ...resultado, pergunta_id: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/perguntas/:id/respondida', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const respondida = req.body?.respondida !== false;
    const resposta = String(req.body?.resposta || '').trim();

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID da pergunta inválido' });
    }

    const db = getDb();
    const pergunta = await db.get(
      'SELECT id, ml_question_id, respondida FROM perguntas_ml WHERE id = ?',
      [id]
    );

    if (!pergunta) {
      return res.status(404).json({ error: 'Pergunta não encontrada' });
    }

    let respostaMercadoLivre = null;

    if (respondida && pergunta.ml_question_id && !resposta) {
      return res.status(400).json({
        error: 'Escreva uma resposta antes de enviar ao Mercado Livre.'
      });
    }

    if (respondida && resposta && pergunta.ml_question_id) {
      try {
        respostaMercadoLivre = await responderPerguntaMl(
          pergunta.ml_question_id,
          resposta
        );
      } catch (error) {
        return res.status(error?.statusCode || 502).json({
          error:
            error?.message ||
            'Não foi possível enviar a resposta ao Mercado Livre.'
        });
      }
    }

    const resultado = await db.run(
      `UPDATE perguntas_ml
       SET respondida = ?,
           resposta = CASE WHEN ? <> '' THEN ? ELSE resposta END,
           data_resposta = CASE
             WHEN ? = 1 THEN CURRENT_TIMESTAMP
             ELSE data_resposta
           END,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        respondida ? 1 : 0,
        resposta,
        resposta,
        respondida && resposta ? 1 : 0,
        id
      ]
    );

    if (resultado.changes === 0) {
      return res.status(404).json({ error: 'Pergunta não encontrada' });
    }

    res.json({
      ok: true,
      respondida,
      mercado_livre: Boolean(respostaMercadoLivre),
      resposta_ml: respostaMercadoLivre
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function valorPreenchido(valor) {
  return valor !== null && valor !== undefined && String(valor).trim() !== '';
}

function primeiroValor(...valores) {
  return valores.find((valor) => valorPreenchido(valor)) ?? null;
}

function nomeCompradorMl(pedido) {
  const comprador = pedido?.buyer || {};
  const nome = [comprador.first_name, comprador.last_name]
    .filter((parte) => valorPreenchido(parte))
    .join(' ')
    .trim();

  return nome || comprador.nickname || null;
}

function telefoneValido(valor) {
  const telefone = String(valor || '').trim();
  if (!telefone || /^x+$/i.test(telefone)) return null;
  return telefone;
}

function enderecoMl(endereco) {
  if (!endereco) return null;

  const linha = primeiroValor(
    endereco.address_line,
    [endereco.street_name, endereco.street_number]
      .filter((parte) => valorPreenchido(parte))
      .join(' ')
  );
  const cidade = [endereco.city?.name, endereco.state?.name]
    .filter((parte) => valorPreenchido(parte))
    .join(' - ');
  const cep = valorPreenchido(endereco.zip_code)
    ? `CEP ${endereco.zip_code}`
    : null;

  return [linha, endereco.neighborhood?.name, cidade, cep]
    .filter((parte) => valorPreenchido(parte))
    .join(', ');
}

function rotuloStatusPedidoMl(status) {
  const mapa = {
    confirmed: 'Confirmado',
    paid: 'Pago',
    partially_refunded: 'Parcialmente reembolsado',
    refunded: 'Reembolsado',
    cancelled: 'Cancelado',
    canceled: 'Cancelado',
    invalid: 'Inválido'
  };

  return mapa[String(status || '').toLowerCase()] || status || null;
}

function rotuloStatusEnvioMl(status) {
  const mapa = {
    pending: 'Pendente',
    handling: 'Em preparação',
    ready_to_ship: 'Pronto para envio',
    shipped: 'Enviado',
    in_transit: 'Em trânsito',
    out_for_delivery: 'Saiu para entrega',
    delivered: 'Entregue',
    not_delivered: 'Não entregue',
    cancelled: 'Cancelado',
    canceled: 'Cancelado'
  };

  return mapa[String(status || '').toLowerCase()] || status || null;
}

function itensDoPedidoMl(pedido) {
  const itens = Array.isArray(pedido?.order_items) ? pedido.order_items : [];

  return itens.map((item) => ({
    sku: item?.item?.seller_sku || item?.item?.id || 'Sem SKU',
    descricao: item?.item?.title || 'Produto do Mercado Livre',
    quantidade: Number(item?.quantity) || 1,
    preco_unitario: Number(item?.unit_price) || 0,
    imagem: item?.item?.thumbnail || null
  }));
}

router.get('/reclamacoes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID da reclamação inválido' });
    }

    const db = getDb();
    const reclamacao = await db.get(
      `SELECT ${CAMPOS_RECLAMACAO}
       FROM reclamacoes_ml r
       LEFT JOIN pecas p ON p.id = r.peca_id
       WHERE r.id = ?`,
      [id]
    );

    if (!reclamacao) {
      return res.status(404).json({ error: 'Reclamação não encontrada' });
    }

    const [detalheResultado, resolucoesResultado, mensagensResultado, pedidoResultado] =
      await Promise.allSettled([
        reclamacao.ml_claim_id
          ? obterDetalheReclamacao(reclamacao.ml_claim_id)
          : Promise.resolve(null),
        reclamacao.ml_claim_id
          ? obterResolucoesEsperadasReclamacao(reclamacao.ml_claim_id)
          : Promise.resolve([]),
        reclamacao.ml_claim_id
          ? obterMensagensReclamacao(reclamacao.ml_claim_id)
          : Promise.resolve([]),
        reclamacao.pedido_id
          ? obterPedidoMl(reclamacao.pedido_id)
          : Promise.resolve(null)
      ]);

    const detalheMl =
      detalheResultado.status === 'fulfilled' ? detalheResultado.value : null;
    const resolucoesEsperadas =
      resolucoesResultado.status === 'fulfilled'
        ? resolucoesResultado.value
        : [];
    const mensagens =
      mensagensResultado.status === 'fulfilled'
        ? [...mensagensResultado.value].sort((a, b) =>
            String(a.data || '').localeCompare(String(b.data || ''))
          )
        : [];
    const pedidoMl =
      pedidoResultado.status === 'fulfilled' ? pedidoResultado.value : null;

    const avisos = [];

    if (detalheResultado.status === 'rejected') {
      avisos.push(
        'Não foi possível atualizar os detalhes do caso no Mercado Livre agora. Os dados salvos foram mantidos.'
      );
    }

    if (pedidoResultado.status === 'rejected') {
      avisos.push(
        'Não foi possível consultar o pedido no Mercado Livre agora. Alguns dados podem estar incompletos.'
      );
    }

    let envioMl = null;

    if (pedidoMl?.shipping?.id) {
      try {
        envioMl = await obterEnvioMl(pedidoMl.shipping.id);
      } catch {
        avisos.push(
          'Não foi possível consultar o envio no Mercado Livre agora.'
        );
      }
    }

    let venda = null;
    let itens = [];

    if (reclamacao.pedido_id) {
      venda = await db.get(
        `SELECT id, order_id, valor, plataforma, cliente, cliente_email,
                cliente_fone, cliente_cpf, cliente_endereco,
                metodo_pagamento, status,
                datetime(data_venda, 'localtime') AS data_venda,
                itens_count
         FROM vendas
         WHERE order_id = ?
         LIMIT 1`,
        [reclamacao.pedido_id]
      );

      if (venda) {
        itens = await db.all(
          `SELECT sku, descricao, quantidade, preco_unitario
           FROM venda_itens
           WHERE venda_id = ?
           ORDER BY id ASC`,
          [venda.id]
        );
      }
    }

    const itensMl = itensDoPedidoMl(pedidoMl);
    const itensVenda = itens.length > 0 ? itens : itensMl;
    const compradorMl = nomeCompradorMl(pedidoMl);
    const endereco = enderecoMl(envioMl?.receiver_address);
    const pagamentoMl = Array.isArray(pedidoMl?.payments)
      ? pedidoMl.payments[0]
      : null;
    const temPedido = Boolean(venda || pedidoMl || reclamacao.pedido_id);
    const vendaCompleta = temPedido
      ? {
          id: venda?.id ?? null,
          order_id: primeiroValor(venda?.order_id, reclamacao.pedido_id),
          valor: Number(
            venda?.valor ??
              pedidoMl?.paid_amount ??
              pedidoMl?.total_amount ??
              reclamacao.valor_pedido ??
              0
          ),
          plataforma:
            venda?.plataforma || (pedidoMl ? 'Mercado Livre' : null),
          cliente: primeiroValor(venda?.cliente, compradorMl),
          cliente_email: primeiroValor(
            venda?.cliente_email,
            pedidoMl?.buyer?.email
          ),
          cliente_fone: primeiroValor(
            venda?.cliente_fone,
            telefoneValido(envioMl?.receiver_address?.receiver_phone)
          ),
          cliente_cpf: venda?.cliente_cpf || null,
          cliente_endereco: primeiroValor(venda?.cliente_endereco, endereco),
          metodo_pagamento: primeiroValor(
            venda?.metodo_pagamento,
            pagamentoMl?.payment_method_id,
            pagamentoMl?.payment_type
          ),
          status: primeiroValor(
            venda?.status,
            rotuloStatusPedidoMl(pedidoMl?.status)
          ),
          status_label:
            rotuloStatusPedidoMl(pedidoMl?.status) || venda?.status || null,
          data_venda: primeiroValor(
            venda?.data_venda,
            pedidoMl?.date_created,
            reclamacao.data_reclamacao
          ),
          itens_count: Number(venda?.itens_count) || itensVenda.length,
          itens: itensVenda,
          envio: envioMl
            ? {
                status: envioMl.status || null,
                status_label: rotuloStatusEnvioMl(envioMl.status),
                rastreio: envioMl.tracking_number || null,
                transportadora: envioMl.tracking_method || null,
                modalidade: envioMl.shipping_option?.name || null,
                custo: Number(envioMl.shipping_option?.cost) || 0,
                endereco,
                previsao:
                  envioMl.shipping_option?.estimated_delivery_time?.date ||
                  null,
                atualizado_em: envioMl.last_updated || null
              }
            : null,
          pagamento: pagamentoMl
            ? {
                metodo:
                  pagamentoMl.payment_method_id ||
                  pagamentoMl.payment_type ||
                  null,
                tipo: pagamentoMl.payment_type || null,
                parcelas: Number(pagamentoMl.installments) || 1,
                valor: Number(pagamentoMl.total_paid_amount) || 0,
                status: pagamentoMl.status || null,
                aprovado_em: pagamentoMl.date_approved || null
              }
            : null
        }
      : null;

    const timeline = [];
    const dataPedido = vendaCompleta?.data_venda;

    if (dataPedido) {
      timeline.push({
        tipo: 'pedido',
        titulo: 'Pedido realizado',
        descricao: `Pedido #${
          vendaCompleta.order_id || reclamacao.pedido_id
        } registrado no Mercado Livre.`,
        data: dataPedido
      });
      timeline.push({
        tipo: 'pagamento',
        titulo: 'Pagamento aprovado',
        descricao:
          vendaCompleta.pagamento?.metodo ||
          vendaCompleta.metodo_pagamento ||
          'Pagamento confirmado.',
        data: vendaCompleta.pagamento?.aprovado_em || dataPedido
      });
    }

    if (envioMl?.status) {
      timeline.push({
        tipo: 'envio',
        titulo:
          envioMl.status === 'delivered'
            ? 'Pedido entregue'
            : `Envio: ${rotuloStatusEnvioMl(envioMl.status)}`,
        descricao: [
          envioMl.tracking_method,
          envioMl.tracking_number ? `Rastreio ${envioMl.tracking_number}` : null,
          endereco
        ]
          .filter(Boolean)
          .join(' • '),
        data: envioMl.last_updated || dataPedido
      });
    } else if (venda?.status && ['enviada', 'entregue'].includes(venda.status)) {
      timeline.push({
        tipo: 'envio',
        titulo: 'Pedido enviado',
        descricao: 'O pedido saiu do centro de distribuição.',
        data: venda.data_venda
      });
    }

    timeline.push({
      tipo: 'reclamacao',
      titulo: 'Reclamação aberta',
      descricao: reclamacao.motivo,
      data: reclamacao.data_reclamacao
    });

    if (detalheMl?.last_updated) {
      timeline.push({
        tipo: 'atualizacao',
        titulo: 'Última atualização no Mercado Livre',
        descricao: `Caso em ${
          detalheMl.stage || 'análise'
        } • status ${detalheMl.status || reclamacao.ml_status || 'aberto'}.`,
        data: detalheMl.last_updated
      });
    }

    if (reclamacao.resolvido_em) {
      timeline.push({
        tipo: 'resolucao',
        titulo: 'Reclamação marcada como resolvida',
        descricao: 'Controle interno do site. O caso segue o fluxo do Mercado Livre.',
        data: reclamacao.resolvido_em
      });
    }

    const reclamacaoMl = detalheMl
      ? {
          status: detalheMl.status || null,
          stage: detalheMl.stage || null,
          type: detalheMl.type || null,
          reason_id: detalheMl.reason_id || null,
          claimed_quantity: Number(detalheMl.claimed_quantity) || 1,
          date_created: detalheMl.date_created || null,
          last_updated: detalheMl.last_updated || null,
          resolution: detalheMl.resolution || null,
          players: Array.isArray(detalheMl.players) ? detalheMl.players : []
        }
      : null;

    const acaoResponder = reclamacaoMl
      ? (reclamacaoMl.players || []).some(
          (player) =>
            player?.role === 'respondent' &&
            (player?.available_actions || []).some(
              (acao) => acao?.action === 'send_message_to_mediator'
            )
        )
      : true;
    const podeResponder = Boolean(
      reclamacao.ml_claim_id &&
        !['resolvida', 'resolvido', 'fechada', 'closed'].includes(
          String(reclamacao.status || '').toLowerCase()
        ) &&
        acaoResponder
    );

    res.json({
      reclamacao,
      reclamacaoMl,
      peca: {
        id: reclamacao.peca_id,
        nome: reclamacao.peca_nome,
        sku: reclamacao.peca_sku,
        carro: reclamacao.peca_carro,
        descricao: reclamacao.peca_descricao,
        preco: reclamacao.peca_preco,
        imagem: reclamacao.peca_imagem
      },
      venda: vendaCompleta,
      mensagens,
      resolucoesEsperadas,
      podeResponder,
      avisos,
      timeline
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/reclamacoes/:id/responder', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID da reclamação inválido' });
    }

    const mensagem = String(req.body?.mensagem || '').trim();

    if (!mensagem) {
      return res.status(400).json({ error: 'Escreva uma mensagem antes de enviar.' });
    }

    if (mensagem.length > 4000) {
      return res
        .status(400)
        .json({ error: 'A mensagem pode ter no máximo 4000 caracteres.' });
    }

    const db = getDb();
    const reclamacao = await db.get(
      'SELECT id, ml_claim_id, status FROM reclamacoes_ml WHERE id = ?',
      [id]
    );

    if (!reclamacao) {
      return res.status(404).json({ error: 'Reclamação não encontrada' });
    }

    if (!reclamacao.ml_claim_id) {
      return res.status(409).json({
        error: 'Esta reclamação não está vinculada a um caso do Mercado Livre.'
      });
    }

    await enviarMensagemReclamacao(reclamacao.ml_claim_id, mensagem);

    await db.run(
      `UPDATE reclamacoes_ml
       SET atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    res.json({
      ok: true,
      mensagem:
        'Mensagem enviada ao mediador do Mercado Livre. O caso continua em análise até a decisão final.'
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.patch('/reclamacoes/:id/resolver', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID da reclamação inválido' });
    }

    const db = getDb();
    const resultado = await db.run(
      `UPDATE reclamacoes_ml
       SET status = 'resolvida', resolvido_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    if (resultado.changes === 0) {
      return res.status(404).json({ error: 'Reclamação não encontrada' });
    }

    res.json({ ok: true, status: 'resolvida' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
