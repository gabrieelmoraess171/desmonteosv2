import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getDb } from '../database.js';
import {
  processarLote,
  obterGruposDoLote,
  atualizarGruposDoLote
} from '../processors/loteProcessor.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');
const LOTES_DIR = path.join(UPLOADS_ROOT, 'lotes');

fs.mkdirSync(LOTES_DIR, { recursive: true });

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.heic'
]);

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function mensagemErro(error) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    const loteId = Number(req.params.id);

    if (!Number.isInteger(loteId) || loteId <= 0) {
      return callback(new Error('Lote inválido'));
    }

    const directory = path.join(LOTES_DIR, String(loteId));
    fs.mkdirSync(directory, { recursive: true });
    callback(null, directory);
  },
  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 200
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (extension === '.zip') {
      return callback(null, true);
    }

    if (IMAGE_EXTENSIONS.has(extension) && file.mimetype.startsWith('image/')) {
      return callback(null, true);
    }

    callback(new Error('Somente imagens (JPG, PNG, GIF, WEBP) e arquivos ZIP são permitidos'));
  }
});

async function carregarLote(req, res, next) {
  try {
    const loteId = Number(req.params.id);

    if (!Number.isInteger(loteId) || loteId <= 0) {
      return res.status(400).json({ error: 'ID de lote inválido' });
    }

    const db = getDb();
    const lote = await db.get('SELECT * FROM lotes WHERE id = ?', [loteId]);

    if (!lote) {
      return res.status(404).json({ error: 'Lote não encontrado' });
    }

    req.lote = lote;
    next();
  } catch (error) {
    next(error);
  }
}

function receberArquivos(req, res, next) {
  upload.array('fotos', 200)(req, res, (error) => {
    if (!error) return next();

    const directory = path.join(LOTES_DIR, String(req.params.id));
    fs.rmSync(directory, { recursive: true, force: true });

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Cada arquivo deve ter no máximo 10 MB' });
      }

      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Envie no máximo 200 arquivos por lote' });
      }

      return res.status(400).json({ error: error.message });
    }

    return res.status(400).json({ error: mensagemErro(error) });
  });
}

function garantirLoteEditavel(req, res, next) {
  if (req.lote.status === 'processado' || req.lote.status === 'organizado') {
    return res.status(409).json({ error: 'Este lote já foi processado' });
  }

  next();
}

// Criar lote
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { nome, modo, veiculoOrigem, detectarSKU } = req.body || {};
    const modoNormalizado = modo === 'same_vehicle' ? 'same_vehicle' : 'mixed';
    const nomeLote =
      String(nome || '').trim() ||
      `Lote ${new Date().toLocaleString('pt-BR')}`;
    const detectar =
      detectarSKU === false || detectarSKU === 'false' || detectarSKU === 0
        ? 0
        : 1;

    const db = getDb();
    const resultado = await db.run(
      `INSERT INTO lotes (
        nome, modo, veiculo_origem, detectar_sku, status
      ) VALUES (?, ?, ?, ?, 'importando')`,
      [nomeLote, modoNormalizado, veiculoOrigem || null, detectar]
    );

    res.status(201).json({
      success: true,
      message: 'Lote criado com sucesso',
      loteId: resultado.lastID,
      lote: {
        id: resultado.lastID,
        nome: nomeLote,
        modo: modoNormalizado,
        veiculoOrigem: veiculoOrigem || null,
        detectarSKU: Boolean(detectar)
      }
    });
  })
);

// Enviar fotos e processar o lote
router.post(
  '/:id/upload',
  carregarLote,
  garantirLoteEditavel,
  receberArquivos,
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const detectarSKU =
      req.body.detectarSKU === undefined
        ? Boolean(req.lote.detectar_sku)
        : !['false', '0', false].includes(req.body.detectarSKU);
    let mapaIA = null;

    if (req.body.mapaIA) {
      try {
        const interpretado =
          typeof req.body.mapaIA === 'string'
            ? JSON.parse(req.body.mapaIA)
            : req.body.mapaIA;
        mapaIA =
          interpretado && typeof interpretado === 'object'
            ? interpretado
            : null;
      } catch {
        mapaIA = null;
      }
    }

    try {
      const resultado = await processarLote(req.lote.id, req.files, {
        modo: req.body.modo || req.lote.modo,
        veiculoOrigem: req.body.veiculoOrigem || req.lote.veiculo_origem,
        detectarSKU,
        mapaIA
      });

      res.json({
        success: true,
        loteId: req.lote.id,
        ...resultado
      });
    } catch (error) {
      const directory = path.join(LOTES_DIR, String(req.lote.id));
      await fs.promises.rm(directory, { recursive: true, force: true }).catch(() => {});

      throw error;
    }
  })
);

// Listar lotes
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const status = req.query.status ? String(req.query.status) : null;
    const db = getDb();

    const params = [];
    let where = '';

    if (status) {
      where = 'WHERE l.status = ?';
      params.push(status);
    }

    const lotes = await db.all(
      `SELECT l.*,
        (SELECT COUNT(*) FROM produtos p WHERE p.lote_id = l.id) AS produtos_count,
        (SELECT COUNT(*)
         FROM produto_imagens pi
         INNER JOIN produtos p ON p.id = pi.produto_id
         WHERE p.lote_id = l.id) AS fotos_count
       FROM lotes l
       ${where}
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json(lotes);
  })
);

// Detalhes do lote
router.get(
  '/:id',
  carregarLote,
  asyncHandler(async (req, res) => {
    const grupos = await obterGruposDoLote(req.lote.id);
    const totalFotos = grupos.reduce(
      (total, grupo) => total + grupo.images.length,
      0
    );

    res.json({
      lote: {
        ...req.lote,
        detectar_sku: Boolean(req.lote.detectar_sku)
      },
      produtos: grupos,
      estatisticas: {
        totalProdutos: grupos.length,
        totalFotos,
        porStatus: grupos.reduce((acc, grupo) => {
          acc[grupo.statusRevisao] = (acc[grupo.statusRevisao] || 0) + 1;
          return acc;
        }, {})
      }
    });
  })
);

// Salvar organização dos grupos
router.put(
  '/:id/grupos',
  carregarLote,
  asyncHandler(async (req, res) => {
    const { grupos } = req.body || {};

    if (!Array.isArray(grupos)) {
      return res.status(400).json({ error: 'Dados de grupos inválidos' });
    }

    const gruposAtualizados = await atualizarGruposDoLote(req.lote.id, grupos);

    res.json({
      success: true,
      message: 'Grupos atualizados com sucesso',
      gruposAtualizados: gruposAtualizados.length,
      grupos: gruposAtualizados
    });
  })
);

// Excluir/cancelar lote
router.delete(
  '/:id',
  carregarLote,
  asyncHandler(async (req, res) => {
    const db = getDb();
    const loteId = req.lote.id;

    await db.exec('BEGIN IMMEDIATE');

    try {
      await db.run(
        `DELETE FROM analises_ia
         WHERE produto_id IN (SELECT id FROM produtos WHERE lote_id = ?)`,
        [loteId]
      );
      await db.run(
        `DELETE FROM produto_imagens
         WHERE produto_id IN (SELECT id FROM produtos WHERE lote_id = ?)
            OR caminho LIKE ?`,
        [loteId, `/uploads/lotes/${loteId}/%`]
      );
      await db.run('DELETE FROM produtos WHERE lote_id = ?', [loteId]);
      await db.run('DELETE FROM lotes WHERE id = ?', [loteId]);
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }

    await fs.promises
      .rm(path.join(LOTES_DIR, String(loteId)), { recursive: true, force: true })
      .catch(() => {});

    res.json({
      success: true,
      message: 'Lote excluído com sucesso'
    });
  })
);

export default router;
