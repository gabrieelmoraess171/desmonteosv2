import express from 'express';
import { getDb } from '../database.js';
import { exigirProprietario } from './proprietario.js';
import { obterFichaCategoria } from '../services/mlCadastroService.js';
import { resolverUrlFrontend, urlPublicaBackend } from '../services/urlsPublicas.js';
import {
  MercadoLivreError,
  mlFetch,
  atualizarAnuncioPeca,
  desconectarMl,
  gerarUrlAutorizacao,
  obterReputacaoMl,
  obterStatusMl,
  obterImagensAnuncioMl,
  processarCallback,
  processarWebhook,
  salvarConfiguracaoMl,
  sincronizarPecas,
  sincronizarPerguntas,
  sincronizarReclamacoes,
  sincronizarReputacao,
  sincronizarTudo,
  sincronizarVendas
} from '../services/mercadoLivreService.js';

const router = express.Router();

router.get('/cadastro/veiculos', async (req, res) => {
  try {
    const dados = await mlFetch('/catalog_domains/MLB-CARS_AND_VANS_FOR_COMPATIBILITIES');
    res.json({ id: dados.id, atributos: dados.attributes });
  } catch (error) { res.status(statusErro(error)).json({ error: mensagemErro(error) }); }
});

router.get('/cadastro/categorias', async (req, res) => {
  try {
    const busca = String(req.query.busca || '').trim().slice(0, 150);
    res.json(await mlFetch(busca
      ? `/sites/MLB/domain_discovery/search?q=${encodeURIComponent(busca)}&limit=8`
      : '/sites/MLB/categories'));
  } catch (error) { res.status(statusErro(error)).json({ error: mensagemErro(error) }); }
});

router.get('/cadastro/categorias/:id', async (req, res) => {
  try { res.json(await obterFichaCategoria(req.params.id, mlFetch)); }
  catch (error) { res.status(statusErro(error)).json({ error: mensagemErro(error) }); }
});

function statusErro(error) {
  return error instanceof MercadoLivreError
    ? error.statusCode
    : error?.statusCode || 500;
}

function mensagemErro(error) {
  return error instanceof Error
    ? error.message
    : 'Erro inesperado na integração com o Mercado Livre';
}

function urlFrontend() {
  return resolverUrlFrontend();
}

function redirecionarParaFrontend(res, parametros = {}) {
  const url = new URL(urlFrontend());

  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      url.searchParams.set(chave, String(valor).slice(0, 500));
    }
  }

  res.redirect(url.toString());
}

const OPERACOES = {
  pecas: () => sincronizarPecas(),
  vendas: () => sincronizarVendas({ dias: 30 }),
  perguntas: () => sincronizarPerguntas(),
  reclamacoes: () => sincronizarReclamacoes(),
  reputacao: () => sincronizarReputacao()
};

router.get('/status', async (req, res) => {
  try {
    const status = await obterStatusMl();
    const webhookUrl =
      String(process.env.ML_WEBHOOK_URL || '').trim() ||
      `${urlPublicaBackend() || `${req.protocol}://${req.get('host')}`}/api/mercadolivre/webhook`;

    res.json({ ...status, webhookUrl });
  } catch (error) {
    res.status(statusErro(error)).json({ error: mensagemErro(error) });
  }
});

router.post('/config', exigirProprietario, async (req, res) => {
  try {
    await salvarConfiguracaoMl({
      clientId: req.body?.clientId,
      clientSecret: req.body?.clientSecret,
      redirectUri: req.body?.redirectUri,
      siteId: req.body?.siteId
    });

    res.json({
      ok: true,
      status: await obterStatusMl()
    });
  } catch (error) {
    res.status(statusErro(error)).json({ error: mensagemErro(error) });
  }
});

router.get('/oauth/iniciar', async (req, res) => {
  try {
    const autorizacao = await gerarUrlAutorizacao();

    if (req.query.redirect === '1') {
      return res.redirect(autorizacao.url);
    }

    res.json(autorizacao);
  } catch (error) {
    if (req.query.redirect === '1') {
      return redirecionarParaFrontend(res, {
        ml: 'erro',
        motivo: mensagemErro(error)
      });
    }

    res.status(statusErro(error)).json({ error: mensagemErro(error) });
  }
});

router.get('/oauth/callback', async (req, res) => {
  try {
    if (req.query.error) {
      return redirecionarParaFrontend(res, {
        ml: 'erro',
        motivo: String(
          req.query.error_description || req.query.error
        ).slice(0, 500)
      });
    }

    await processarCallback(req.query.code, req.query.state);

    return redirecionarParaFrontend(res, {
      ml: 'conectado'
    });
  } catch (error) {
    console.error('Erro no callback do Mercado Livre:', error.message);

    return redirecionarParaFrontend(res, {
      ml: 'erro',
      motivo: mensagemErro(error)
    });
  }
});

router.post('/desconectar', async (req, res) => {
  try {
    await desconectarMl();
    res.json({ ok: true, status: await obterStatusMl() });
  } catch (error) {
    res.status(statusErro(error)).json({ error: mensagemErro(error) });
  }
});

router.post('/sincronizar', async (req, res) => {
  try {
    const lista = Array.isArray(req.body?.recursos)
      ? req.body.recursos
      : req.body?.recurso
        ? [req.body.recurso]
        : null;

    if (!lista) {
      return res.json(await sincronizarTudo());
    }

    const recursos = [
      ...new Set(
        lista
          .map((recurso) => String(recurso || '').trim().toLowerCase())
          .filter((recurso) => OPERACOES[recurso])
      )
    ];

    if (recursos.length === 0) {
      return res.status(400).json({
        error:
          'Informe ao menos um recurso válido: pecas, vendas, perguntas, reclamacoes ou reputacao.'
      });
    }

    const resultados = [];

    for (const recurso of recursos) {
      try {
        resultados.push(await OPERACOES[recurso]());
      } catch (error) {
        resultados.push({
          recurso,
          status: 'erro',
          mensagem: mensagemErro(error)
        });
      }
    }

    res.json({
      ok: resultados.every((resultado) => resultado.status !== 'erro'),
      resultados
    });
  } catch (error) {
    res.status(statusErro(error)).json({ error: mensagemErro(error) });
  }
});

router.get('/pecas/:id/imagens', async (req, res) => {
  try {
    const pecaId = Number(req.params.id);
    if (!Number.isInteger(pecaId) || pecaId <= 0) {
      return res.status(400).json({ error: 'ID da peça inválido' });
    }

    const peca = await getDb().get(
      'SELECT ml_item_id FROM pecas WHERE id = ?',
      [pecaId]
    );
    if (!peca) return res.status(404).json({ error: 'Peça não encontrada' });
    if (!peca.ml_item_id) return res.json({ imagens: [] });

    res.json(await obterImagensAnuncioMl(peca.ml_item_id));
  } catch (error) {
    res.status(statusErro(error)).json({ error: mensagemErro(error) });
  }
});

router.get('/reputacao', async (req, res) => {
  try {
    const reputacao = await obterReputacaoMl({
      atualizar: req.query.atualizar === '1'
    });

    res.json({ reputacao });
  } catch (error) {
    res.status(statusErro(error)).json({ error: mensagemErro(error) });
  }
});

router.post('/pecas/:id/atualizar-anuncio', async (req, res) => {
  try {
    const resultado = await atualizarAnuncioPeca(req.params.id, {
      quantidade: req.body?.quantidade,
      preco: req.body?.preco,
      titulo: req.body?.titulo,
      status: req.body?.status
    });

    res.json(resultado);
  } catch (error) {
    res.status(statusErro(error)).json({ error: mensagemErro(error) });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const segredo = String(process.env.ML_WEBHOOK_SECRET || '').trim();

    if (segredo) {
      const recebido = String(
        req.query.secret ||
          req.headers['x-ml-webhook-secret'] ||
          ''
      ).trim();

      if (recebido !== segredo) {
        return res.status(401).json({ error: 'Webhook não autorizado' });
      }
    }

    const resultado = await processarWebhook(req.body || {});

    res.json(resultado);
  } catch (error) {
    console.error('Erro no webhook do Mercado Livre:', error.message);
    res.status(200).json({ ok: false, error: mensagemErro(error) });
  }
});

export default router;
