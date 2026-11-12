import express from 'express';
import { getDb } from '../database.js';
import {
  inserirImagensPeca,
  limparArquivos,
  listarImagensPeca,
  mensagemErroUpload,
  removerArquivoImagem,
  uploadFotosPeca
} from '../services/pecaImagensService.js';
import { atualizarAnuncioPeca } from '../services/mercadoLivreService.js';

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function carregarPeca(req, res, next) {
  try {
    const pecaId = Number(req.params.id);

    if (!Number.isInteger(pecaId) || pecaId <= 0) {
      return res.status(400).json({ error: 'ID de peça inválido' });
    }

    const db = getDb();
    const peca = await db.get('SELECT * FROM pecas WHERE id = ?', [pecaId]);

    if (!peca) {
      return res.status(404).json({ error: 'Peça não encontrada' });
    }

    req.peca = peca;
    next();
  } catch (error) {
    next(error);
  }
}

function receberFotos(req, res, next) {
  uploadFotosPeca.array('fotos', 20)(req, res, (error) => {
    if (!error) return next();

    limparArquivos(req.files || []).finally(() => {
      res.status(400).json({ error: mensagemErroUpload(error) });
    });
  });
}

// Listar fotos de uma peça
router.get(
  '/:id/imagens',
  carregarPeca,
  asyncHandler(async (req, res) => {
    const db = getDb();
    res.json(await listarImagensPeca(db, req.peca.id));
  })
);

// Enviar novas fotos para uma peça existente
router.post(
  '/:id/imagens',
  carregarPeca,
  receberFotos,
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhuma foto enviada' });
    }

    const db = getDb();
    await db.exec('BEGIN IMMEDIATE');

    try {
      const imagens = await inserirImagensPeca(db, req.peca.id, req.files);
      await db.exec('COMMIT');

      res.status(201).json({
        ok: true,
        message: `${imagens.length} foto(s) adicionada(s) com sucesso`,
        imagens: await listarImagensPeca(db, req.peca.id)
      });
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      await limparArquivos(req.files);
      throw error;
    }
  })
);

// Definir a foto principal (capa do anúncio)
router.patch(
  '/:id/imagens/:imagemId/principal',
  carregarPeca,
  asyncHandler(async (req, res) => {
    const imagemId = Number(req.params.imagemId);

    if (!Number.isInteger(imagemId) || imagemId <= 0) {
      return res.status(400).json({ error: 'ID de imagem inválido' });
    }

    const db = getDb();
    const imagem = await db.get(
      'SELECT id FROM peca_imagens WHERE id = ? AND peca_id = ?',
      [imagemId, req.peca.id]
    );

    if (!imagem) {
      return res.status(404).json({ error: 'Imagem não encontrada' });
    }

    await db.exec('BEGIN IMMEDIATE');

    try {
      await db.run(
        'UPDATE peca_imagens SET is_principal = 0 WHERE peca_id = ?',
        [req.peca.id]
      );
      await db.run(
        'UPDATE peca_imagens SET is_principal = 1 WHERE id = ? AND peca_id = ?',
        [imagemId, req.peca.id]
      );
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      throw error;
    }

    res.json({
      ok: true,
      message: 'Foto principal atualizada',
      imagens: await listarImagensPeca(db, req.peca.id)
    });
  })
);

// Reordenar fotos locais e, quando solicitado, refletir a ordem no anúncio ML.
router.patch(
  '/:id/imagens/ordem',
  carregarPeca,
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (ids.length === 0) {
      return res.status(400).json({ error: 'Informe a ordem das imagens.' });
    }

    const db = getDb();
    const imagens = await db.all(
      'SELECT id FROM peca_imagens WHERE peca_id = ? AND id IN (' + ids.map(() => '?').join(',') + ')',
      [req.peca.id, ...ids]
    );
    const permitidas = new Set(imagens.map((imagem) => Number(imagem.id)));
    if (ids.some((id) => !permitidas.has(id))) {
      return res.status(400).json({ error: 'Uma das imagens não pertence a esta peça.' });
    }

    await db.exec('BEGIN IMMEDIATE');
    try {
      for (let indice = 0; indice < ids.length; indice += 1) {
        await db.run(
          'UPDATE peca_imagens SET ordem = ?, is_principal = ? WHERE id = ? AND peca_id = ?',
          [indice, indice === 0 ? 1 : 0, ids[indice], req.peca.id]
        );
      }
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      throw error;
    }

    let mercado_livre = false;
    let aviso = '';
    if (req.body?.sincronizarMl && req.peca.ml_item_id) {
      try {
        await atualizarAnuncioPeca(req.peca.id, { sincronizarFotos: true });
        mercado_livre = true;
      } catch (error) {
        aviso = error?.message || 'A ordem foi salva, mas não foi possível atualizar o Mercado Livre.';
      }
    }

    res.json({
      ok: true,
      mercado_livre,
      aviso,
      imagens: await listarImagensPeca(db, req.peca.id)
    });
  })
);

// Remover uma foto
router.delete(
  '/:id/imagens/:imagemId',
  carregarPeca,
  asyncHandler(async (req, res) => {
    const imagemId = Number(req.params.imagemId);

    if (!Number.isInteger(imagemId) || imagemId <= 0) {
      return res.status(400).json({ error: 'ID de imagem inválido' });
    }

    const db = getDb();
    const imagem = await db.get(
      `SELECT id, caminho, is_principal FROM peca_imagens
       WHERE id = ? AND peca_id = ?`,
      [imagemId, req.peca.id]
    );

    if (!imagem) {
      return res.status(404).json({ error: 'Imagem não encontrada' });
    }

    await db.exec('BEGIN IMMEDIATE');

    try {
      await db.run(
        'DELETE FROM peca_imagens WHERE id = ? AND peca_id = ?',
        [imagemId, req.peca.id]
      );

      if (imagem.is_principal) {
        const proxima = await db.get(
          `SELECT id FROM peca_imagens
           WHERE peca_id = ?
           ORDER BY ordem ASC, id ASC
           LIMIT 1`,
          [req.peca.id]
        );

        if (proxima) {
          await db.run(
            'UPDATE peca_imagens SET is_principal = 1 WHERE id = ?',
            [proxima.id]
          );
        }
      }

      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      throw error;
    }

    await removerArquivoImagem(imagem.caminho);

    res.json({
      ok: true,
      message: 'Foto removida',
      imagens: await listarImagensPeca(db, req.peca.id)
    });
  })
);

export default router;
