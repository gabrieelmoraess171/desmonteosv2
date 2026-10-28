import express from 'express';
import {
  upsertVenda,
  listarVendas,
  obterVendaPorId,
  obterNotificacoes
} from '../services/vendasService.js';
import { obterVendasMlHoje } from '../services/dashboardService.js';
import {
  enviarMensagemVenda,
  obterMensagensVenda,
  sincronizarVendas
} from '../services/mercadoLivreService.js';
import { getDb } from '../database.js';
import { autenticar } from '../middleware/auth.js';

const router = express.Router();

function statusErro(error) {
  return Number(error?.statusCode) || 500;
}

function dataLocalISO() {
  const agora = new Date();
  return new Date(
    agora.getTime() - agora.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
}

// Vendas do dia vindas do Mercado Livre (para o fechamento financeiro).
router.get('/hoje-ml', async (req, res) => {
  try {
    res.json(await obterVendasMlHoje(getDb(), req.query.data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/notificacoes', async (req, res) => {
  try {
    res.json(await obterNotificacoes(req.query));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await listarVendas(req.query));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/mensagens', async (req, res) => {
  try {
    res.json(await obterMensagensVenda(Number(req.params.id)));
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.post('/:id/mensagens', async (req, res) => {
  try {
    res.json(
      await enviarMensagemVenda(Number(req.params.id), req.body?.mensagem)
    );
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await obterVendaPorId(req.params.id));
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.post('/sincronizar', async (req, res) => {
  try {
    res.json(await sincronizarVendas({ dias: Number(req.body?.dias) || 30 }));
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.patch('/:id/agendamento-financeiro', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID da venda inválido' });
    }

    const status = String(req.body?.status || '').trim().toLowerCase();
    const permitidos = ['pendente', 'disponivel', 'agendada', 'enviada'];
    if (!permitidos.includes(status)) {
      return res.status(400).json({
        error: 'Status inválido. Use pendente, disponivel, agendada ou enviada.'
      });
    }

    let dataAgendada = null;
    if (status === 'agendada') {
      dataAgendada = String(req.body?.data || '').trim().slice(0, 10);
      const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(dataAgendada);
      const dataNormalizada = new Date(`${dataAgendada}T00:00:00Z`);
      if (
        !dataValida ||
        Number.isNaN(dataNormalizada.getTime()) ||
        dataNormalizada.toISOString().slice(0, 10) !== dataAgendada
      ) {
        return res.status(400).json({
          error: 'Informe uma data válida para o agendamento.'
        });
      }
    } else if (status === 'disponivel') {
      dataAgendada = dataLocalISO();
    }

    const enviada = status === 'enviada';
    const resultado = await getDb().run(
      `UPDATE vendas
          SET financeiro_status = ?,
              financeiro_agendada_para = ?,
              enviada_financeiro = ?,
              enviada_financeiro_em = ?,
              last_updated = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        status,
        dataAgendada,
        enviada ? 1 : 0,
        enviada ? new Date().toISOString() : null,
        id
      ]
    );
    if (!resultado.changes) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    res.json({
      ok: true,
      status,
      data: dataAgendada,
      enviada_financeiro: enviada ? 1 : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Marca/desmarca uma venda como já enviada ao WhatsApp do financeiro.
router.patch('/:id/enviada-financeiro', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID da venda inválido' });
    }

    const enviada = req.body?.enviada !== false;
    const resultado = await getDb().run(
      `UPDATE vendas
          SET enviada_financeiro = ?,
              financeiro_status = ?,
              financeiro_agendada_para = CASE
                WHEN ? = 1 THEN NULL
                ELSE DATE('now', 'localtime')
              END,
              enviada_financeiro_em = ?,
              last_updated = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        enviada ? 1 : 0,
        enviada ? 'enviada' : 'disponivel',
        enviada ? 1 : 0,
        enviada ? new Date().toISOString() : null,
        id
      ]
    );

    if (!resultado.changes) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    res.json({ ok: true, enviada });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registro manual: mesmo shape de payload da importação, sem extensão.
// Se API_TOKEN estiver configurado, exige Bearer token.
router.post('/manual', autenticar, async (req, res) => {
  try {
    const resultado = await upsertVenda(req.body, { plataforma: 'Manual' });
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Importação em lote: mesma função, várias linhas.
router.post('/import', autenticar, async (req, res) => {
  const lista = Array.isArray(req.body) ? req.body : req.body?.vendas;

  if (!Array.isArray(lista) || lista.length === 0) {
    return res.status(400).json({ error: 'Lista vazia' });
  }

  if (lista.length > 500) {
    return res.status(400).json({ error: 'Envie no máximo 500 vendas por lote' });
  }

  let sucesso = 0;
  const falhas = [];

  for (const item of lista) {
    try {
      await upsertVenda(item, { plataforma: 'Importação' });
      sucesso += 1;
    } catch (error) {
      falhas.push({
        order_id: item?.order_id ?? null,
        erro: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  res.json({ ok: true, sucesso, falhas });
});

export default router;
