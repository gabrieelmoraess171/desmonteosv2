import express from 'express';
import { upsertVenda } from '../services/vendasService.js';
import { obterVendasMlHoje } from '../services/dashboardService.js';
import { getDb } from '../database.js';
import { autenticar } from '../middleware/auth.js';

const router = express.Router();

// Vendas do dia vindas do Mercado Livre (para o fechamento financeiro).
router.get('/hoje-ml', async (req, res) => {
  try {
    res.json(await obterVendasMlHoje(getDb(), req.query.dias));
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
              enviada_financeiro_em = ?,
              last_updated = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [enviada ? 1 : 0, enviada ? new Date().toISOString() : null, id]
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
