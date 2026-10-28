import express from 'express';
import { getDb } from '../database.js';
import {
  analisarFotosLoteComIa,
  analisarFotosPecaComIa,
  gerarAnaliseComIa,
  gerarAnuncioComIa
} from '../services/iaService.js';

const router = express.Router();

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

router.get('/analise', async (req, res) => {
  try {
    const db = getDb();
    const [pecas, categorias, vendas, perguntas, reclamacoes] =
      await Promise.all([
        db.get(`
          SELECT
            COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN ml_ativo = 1 THEN 1 ELSE 0 END), 0) AS ativas,
            COALESCE(SUM(CASE WHEN ml_ativo = 0 THEN 1 ELSE 0 END), 0) AS pausadas,
            COALESCE(SUM(CASE WHEN quantidade <= 0 THEN 1 ELSE 0 END), 0) AS sem_estoque,
            COALESCE(SUM(CASE
              WHEN NOT EXISTS (
                SELECT 1 FROM peca_imagens pi WHERE pi.peca_id = pecas.id
              )
              AND (ml_thumbnail IS NULL OR TRIM(ml_thumbnail) = '')
              THEN 1 ELSE 0
            END), 0) AS sem_fotos,
            COALESCE(SUM(CASE
              WHEN LENGTH(TRIM(COALESCE(descricao, ''))) < 40 THEN 1 ELSE 0
            END), 0) AS descricao_curta,
            COALESCE(SUM(quantidade * preco), 0) AS valor
          FROM pecas
        `),
        db.all(`
          SELECT
            COALESCE(NULLIF(TRIM(categoria), ''), 'Outros') AS categoria,
            COUNT(*) AS total
          FROM pecas
          GROUP BY 1
          ORDER BY total DESC, categoria ASC
          LIMIT 5
        `),
        db.get(`
          SELECT
            COUNT(*) AS total,
            COALESCE(SUM(valor), 0) AS faturamento
          FROM vendas
          WHERE status NOT IN ('cancelada', 'reembolsada')
            AND DATE(data_venda) >= DATE('now', '-30 days')
        `),
        db.get(
          'SELECT COUNT(*) AS total FROM perguntas_ml WHERE respondida = 0'
        ),
        db.get(
          'SELECT COUNT(*) AS total FROM reclamacoes_ml WHERE resolvido_em IS NULL'
        )
      ]);

    const dados = {
      pecas: {
        total: numero(pecas?.total),
        ativas: numero(pecas?.ativas),
        pausadas: numero(pecas?.pausadas),
        semEstoque: numero(pecas?.sem_estoque),
        semFotos: numero(pecas?.sem_fotos),
        descricaoCurta: numero(pecas?.descricao_curta),
        valor: numero(pecas?.valor)
      },
      vendas: {
        total: numero(vendas?.total),
        faturamento: numero(vendas?.faturamento)
      },
      categorias: categorias.map((item) => ({
        categoria: item.categoria,
        total: numero(item.total)
      })),
      perguntasPendentes: numero(perguntas?.total),
      reclamacoesAbertas: numero(reclamacoes?.total)
    };

    const resultado = await gerarAnaliseComIa(dados);

    res.json({ ...resultado, dados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/anuncio', async (req, res) => {
  try {
    const id = Number(req.body?.pecaId);
    const db = getDb();
    const peca = Number.isInteger(id)
      ? await db.get('SELECT * FROM pecas WHERE id = ?', [id])
      : null;

    if (!peca) {
      return res.status(404).json({ error: 'Peça não encontrada.' });
    }

    const resultado = await gerarAnuncioComIa(peca);

    res.json({ ...resultado, pecaId: peca.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function normalizarImagens(valor) {
  if (!Array.isArray(valor)) return [];

  return valor
    .map((imagem) => ({
      nome: String(imagem?.nome || 'foto.jpg').slice(0, 220),
      dataUrl: String(imagem?.dataUrl || ''),
      mime: String(imagem?.mime || 'image/jpeg').slice(0, 80)
    }))
    .filter(
      (imagem) =>
        /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(imagem.dataUrl) &&
        imagem.dataUrl.length <= 5 * 1024 * 1024
    )
    .slice(0, 8);
}

router.post('/analisar-fotos', async (req, res) => {
  try {
    const imagens = normalizarImagens(req.body?.imagens);

    if (imagens.length === 0) {
      return res.status(400).json({
        error: 'Envie ao menos uma foto válida para a leitura com IA.'
      });
    }

    const resultado = await analisarFotosPecaComIa({
      imagens,
      contexto: {
        peca: req.body?.contexto?.peca || {},
        categorias: Array.isArray(req.body?.contexto?.categorias)
          ? req.body.contexto.categorias
          : []
      }
    });

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/analisar-lote', async (req, res) => {
  try {
    const imagens = normalizarImagens(req.body?.imagens);
    const arquivos = Array.isArray(req.body?.arquivos)
      ? req.body.arquivos
          .map((arquivo) => String(arquivo || '').slice(0, 220))
          .filter(Boolean)
          .slice(0, 1000)
      : [];

    if (imagens.length === 0) {
      return res.status(400).json({
        error: 'Envie ao menos uma foto válida para a leitura do lote.'
      });
    }

    const resultado = await analisarFotosLoteComIa({
      imagens,
      arquivos,
      contexto: {
        veiculoOrigem: req.body?.contexto?.veiculoOrigem || '',
        modo: req.body?.contexto?.modo || 'mixed'
      }
    });

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
