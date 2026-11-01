import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '../database.js';
import { PECAS_DIR } from '../services/pecaImagensService.js';
import {
  analisarFotosLoteComIa,
  analisarFotosPecaComIa,
  completarFichaComIa,
  gerarAnaliseComIa,
  gerarAnuncioComIa
} from '../services/iaService.js';
import { verificarAnuncioComAgente } from '../services/anuncioVerificadorService.js';

const router = express.Router();
const UPLOADS_DIR = path.resolve(PECAS_DIR, '..');
const MAX_IMAGEM_BYTES = 5 * 1024 * 1024;
const MAX_IMAGENS_FICHA = 20;

const MIME_POR_EXTENSAO = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
};

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
          WHERE NOT (
            quantidade <= 0
            AND EXISTS (
              SELECT 1 FROM vendas v
              WHERE v.peca_id = pecas.id
                AND LOWER(COALESCE(v.status, '')) NOT IN ('cancelada', 'cancelado', 'cancelled', 'canceled', 'refunded', 'reembolsada')
            )
          )
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

router.post('/verificar-anuncio', async (req, res) => {
  try {
    const id = Number(req.body?.pecaId);
    const db = getDb();
    const peca = Number.isInteger(id) && id > 0
      ? await db.get('SELECT * FROM pecas WHERE id = ?', [id])
      : null;

    if (!peca) return res.status(404).json({ error: 'Peça não encontrada.' });

    const registros = await db.all(
      `SELECT caminho, nome_arquivo, grupo
         FROM peca_imagens
        WHERE peca_id = ?
        ORDER BY ordem ASC, id ASC
        LIMIT ?`,
      [id, MAX_IMAGENS_FICHA]
    );
    const imagens = [];
    for (const registro of registros) {
      const imagem = await lerImagemLocal(registro.caminho);
      if (imagem) {
        imagem.nome = `[${String(registro.grupo || 'produto').toUpperCase()}] ${registro.nome_arquivo || imagem.nome}`;
        imagens.push(imagem);
      }
    }

    res.json(await verificarAnuncioComAgente({ peca, imagens }));
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
        imagem.dataUrl.length <= 1024 * 1024
    )
    .slice(0, 20);
}

async function lerImagemLocal(caminho) {
  const relativo = String(caminho || '')
    .replace(/^\/+/, '')
    .replace(/^uploads\//i, '');
  const absoluto = path.resolve(UPLOADS_DIR, relativo);

  if (
    absoluto !== UPLOADS_DIR &&
    !absoluto.startsWith(`${UPLOADS_DIR}${path.sep}`)
  ) {
    return null;
  }

  const mime = MIME_POR_EXTENSAO[path.extname(absoluto).toLowerCase()];
  if (!mime) return null;

  try {
    const info = await fs.stat(absoluto);
    if (!info.isFile() || info.size <= 0 || info.size > MAX_IMAGEM_BYTES) {
      return null;
    }

    const buffer = await fs.readFile(absoluto);

    return {
      nome: path.basename(absoluto),
      mime,
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`
    };
  } catch {
    return null;
  }
}

async function baixarMiniatura(url) {
  const endereco = String(url || '').trim();

  if (!/^https?:\/\//i.test(endereco)) return null;

  try {
    const resposta = await fetch(endereco, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000)
    });

    if (!resposta.ok) return null;

    const mime = String(resposta.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();

    if (!mime.startsWith('image/')) return null;

    const buffer = Buffer.from(await resposta.arrayBuffer());

    if (buffer.length <= 0 || buffer.length > MAX_IMAGEM_BYTES) return null;

    return {
      nome: 'miniatura-mercado-livre.jpg',
      mime,
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`
    };
  } catch {
    return null;
  }
}

async function imagensDaPeca(pecaId) {
  const db = getDb();
  const registros = await db.all(
    `SELECT caminho
       FROM peca_imagens
      WHERE peca_id = ?
      ORDER BY is_principal DESC, ordem ASC, id ASC
      LIMIT ?`,
    [pecaId, MAX_IMAGENS_FICHA]
  );
  const imagens = [];

  for (const registro of registros) {
    if (imagens.length >= MAX_IMAGENS_FICHA) break;
    const imagem = await lerImagemLocal(registro.caminho);
    if (imagem) imagens.push(imagem);
  }

  return imagens;
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

router.post('/completar-ficha', async (req, res) => {
  try {
    const id = Number(req.body?.pecaId);
    const db = getDb();
    const pecaDb =
      Number.isInteger(id) && id > 0
        ? await db.get('SELECT * FROM pecas WHERE id = ?', [id])
        : null;

    if (Number.isInteger(id) && id > 0 && !pecaDb) {
      return res.status(404).json({ error: 'Peça não encontrada.' });
    }

    const contexto = req.body?.contexto?.peca;
    const peca = {
      ...(pecaDb || {}),
      ...(contexto && typeof contexto === 'object' && !Array.isArray(contexto)
        ? contexto
        : {})
    };

    const imagens = normalizarImagens(req.body?.imagens);

    if (pecaDb) {
      const existentes = await imagensDaPeca(pecaDb.id);

      for (const imagem of existentes) {
        if (imagens.length >= MAX_IMAGENS_FICHA) break;
        imagens.push(imagem);
      }

      if (imagens.length === 0 && pecaDb.ml_thumbnail) {
        const miniatura = await baixarMiniatura(pecaDb.ml_thumbnail);
        if (miniatura) imagens.push(miniatura);
      }
    }

    if (
      imagens.length === 0 &&
      !String(peca.ml_titulo || peca.nome || '').trim()
    ) {
      return res.status(400).json({
        error:
          'Informe o título da peça ou envie fotos para a IA completar a ficha.'
      });
    }

    const categorias = Array.isArray(req.body?.categorias)
      ? req.body.categorias
          .map((categoria) => String(categoria || '').slice(0, 80))
          .filter(Boolean)
          .slice(0, 60)
      : [];
    const camposPorCategoria =
      req.body?.camposPorCategoria &&
      typeof req.body.camposPorCategoria === 'object' &&
      !Array.isArray(req.body.camposPorCategoria)
        ? req.body.camposPorCategoria
        : {};

    const resultado = await completarFichaComIa({
      peca,
      imagens: imagens.slice(0, MAX_IMAGENS_FICHA),
      categorias,
      camposPorCategoria
    });

    res.json({
      ...resultado,
      pecaId: pecaDb?.id ?? null,
      imagensAnalisadas: Math.min(imagens.length, MAX_IMAGENS_FICHA)
    });
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
        modo: req.body?.contexto?.modo || 'mixed',
        skuPorArquivo: req.body?.contexto?.skuPorArquivo || {}
      }
    });

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
