import express from 'express';
import { getDb } from '../database.js';
import {
  atualizarAnuncioPeca,
  atualizarCompatibilidadesPeca,
  publicarAnuncioPeca
} from '../services/mercadoLivreService.js';

const router = express.Router();

function texto(valor, limite = 2000) {
  return String(valor ?? '').trim().slice(0, limite);
}

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function booleano(valor) {
  if (valor === true || valor === 1 || valor === '1') return 1;
  if (valor === false || valor === 0 || valor === '0') return 0;
  return null;
}

function normalizarDadosExtras(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;

  const permitidos = [
    'nome',
    'sku',
    'carro',
    'categoria',
    'categoria_ml',
    'ml_category_id',
    'ml_config',
    'marca',
    'modelo',
    'ano',
    'condicao',
    'numero_oem',
    'garantia',
    'peso_kg',
    'comprimento_cm',
    'largura_cm',
    'altura_cm',
    'atributos',
    'tipo_anuncio',
    'gtin',
    'localizacao',
    'video_url',
    'modo_compra'
  ];
  const dados = {};

  for (const chave of permitidos) {
    if (valor[chave] === undefined) continue;

    if (chave === 'atributos' || chave === 'ml_config') {
      dados[chave] =
        valor[chave] && typeof valor[chave] === 'object'
          ? valor[chave]
          : (() => { try { return JSON.parse(valor[chave] || '{}'); } catch { return {}; } })();
    } else if (
      ['peso_kg', 'comprimento_cm', 'largura_cm', 'altura_cm'].includes(chave)
    ) {
      dados[chave] = Math.max(0, numero(valor[chave]));
    } else {
      dados[chave] = texto(valor[chave], chave === 'descricao' ? 5000 : 500);
    }
  }

  return Object.keys(dados).length > 0 ? dados : null;
}

async function obterAprovacao(id) {
  const db = getDb();

  return db.get(
    `SELECT a.*, p.nome AS peca_nome, p.sku, p.ml_item_id,
            p.ml_titulo AS titulo_atual, p.descricao AS descricao_atual,
            p.preco AS preco_atual, p.quantidade AS quantidade_atual,
            p.ml_ativo AS ml_ativo_atual, p.ml_thumbnail
     FROM aprovacoes_anuncio a
     INNER JOIN pecas p ON p.id = a.peca_id
     WHERE a.id = ?`,
    [id]
  );
}

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const [aprovacoes, resumo] = await Promise.all([
      db.all(
        `SELECT a.*, p.nome AS peca_nome, p.sku, p.ml_item_id,
                p.ml_titulo AS titulo_atual, p.descricao AS descricao_atual,
                p.preco AS preco_atual, p.quantidade AS quantidade_atual,
                p.ml_ativo AS ml_ativo_atual, p.ml_thumbnail
         FROM aprovacoes_anuncio a
         INNER JOIN pecas p ON p.id = a.peca_id
         WHERE a.status = 'pendente'
         ORDER BY a.id DESC`
      ),
      db.get(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END), 0) AS pendentes,
           COALESCE(SUM(CASE WHEN status = 'aprovado' THEN 1 ELSE 0 END), 0) AS aprovadas,
           COALESCE(SUM(CASE WHEN status = 'rejeitado' THEN 1 ELSE 0 END), 0) AS rejeitadas
         FROM aprovacoes_anuncio`
      )
    ]);

    res.json({
      aprovacoes,
      resumo: {
        pendentes: numero(resumo?.pendentes),
        aprovadas: numero(resumo?.aprovadas),
        rejeitadas: numero(resumo?.rejeitadas)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const pecaId = Number(req.body?.pecaId);
    const peca = Number.isInteger(pecaId)
      ? await db.get('SELECT * FROM pecas WHERE id = ?', [pecaId])
      : null;

    if (!peca) {
      return res.status(404).json({ error: 'Peça não encontrada.' });
    }

    const titulo = texto(req.body?.titulo, 60) || null;
    const descricao = texto(req.body?.descricao, 2000) || null;
    const preco =
      req.body?.preco === undefined || req.body?.preco === ''
        ? null
        : numero(req.body.preco);
    const quantidade =
      req.body?.quantidade === undefined || req.body?.quantidade === ''
        ? null
        : Math.max(0, Math.trunc(numero(req.body.quantidade)));
    const mlAtivo = booleano(req.body?.mlAtivo);
    const observacao = texto(req.body?.observacao, 500) || null;
    const dadosExtras = normalizarDadosExtras(req.body?.dados);
    const dadosJson = dadosExtras ? JSON.stringify(dadosExtras) : null;

    if (preco !== null && preco <= 0) {
      return res
        .status(400)
        .json({ error: 'O preço deve ser maior que zero.' });
    }

    if (
      titulo === null &&
      descricao === null &&
      preco === null &&
      quantidade === null &&
      mlAtivo === null &&
      !dadosExtras
    ) {
      return res.status(400).json({
        error: 'Informe ao menos um campo para enviar à aprovação.'
      });
    }

    const existente = await db.get(
      `SELECT id FROM aprovacoes_anuncio
       WHERE peca_id = ? AND status = 'pendente'
       ORDER BY id DESC LIMIT 1`,
      [pecaId]
    );

    if (existente) {
      await db.run(
        `UPDATE aprovacoes_anuncio
         SET titulo = ?, descricao = ?, preco = ?, quantidade = ?,
             ml_ativo = ?, observacao = ?, dados_json = COALESCE(?, dados_json),
             criado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          titulo,
          descricao,
          preco,
          quantidade,
          mlAtivo,
          observacao,
          dadosJson,
          existente.id
        ]
      );

      return res.json({
        ok: true,
        id: existente.id,
        mensagem: 'Alterações atualizadas na fila de aprovação.'
      });
    }

    const resultado = await db.run(
      `INSERT INTO aprovacoes_anuncio
         (peca_id, titulo, descricao, preco, quantidade, ml_ativo, observacao,
          dados_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pecaId,
        titulo,
        descricao,
        preco,
        quantidade,
        mlAtivo,
        observacao,
        dadosJson
      ]
    );

    res.status(201).json({
      ok: true,
      id: resultado.lastID,
      mensagem: 'Alterações enviadas para a fila de aprovação.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/aprovar', async (req, res) => {
  try {
    const db = getDb();
    const aprovacao = await obterAprovacao(Number(req.params.id));

    if (!aprovacao || aprovacao.status !== 'pendente') {
      return res
        .status(404)
        .json({ error: 'Aprovação pendente não encontrada.' });
    }

    let dadosExtras = null;

    try {
      dadosExtras =
        aprovacao.dados_json && aprovacao.dados_json !== '{}'
          ? JSON.parse(aprovacao.dados_json)
          : null;
    } catch {
      const error = new Error(
        'Os dados da aprovação estão inválidos. Reenvie o anúncio para aprovação.'
      );
      error.statusCode = 400;
      throw error;
    }

    let anuncioPublicado = null;

    if (
      !aprovacao.ml_item_id &&
      Number(aprovacao.ml_ativo ?? aprovacao.ml_ativo_atual) === 1
    ) {
      const protocolo = String(
        req.headers['x-forwarded-proto'] || req.protocol
      )
        .split(',')[0]
        .trim();
      const publicBaseUrl =
        process.env.BACKEND_PUBLIC_URL ||
        process.env.API_PUBLIC_URL ||
        `${protocolo}://${req.get('host')}`;

      anuncioPublicado = await publicarAnuncioPeca(aprovacao.peca_id, {
        publicBaseUrl,
        titulo: aprovacao.titulo || dadosExtras?.ml_titulo,
        descricao: aprovacao.descricao,
        preco: aprovacao.preco,
        quantidade: aprovacao.quantidade,
        ...dadosExtras
      });
    }

    if (aprovacao.ml_item_id && dadosExtras?.ml_config) {
      await atualizarCompatibilidadesPeca(aprovacao.peca_id, dadosExtras.ml_config);
    }
    const dadosMl = {};

    if (
      aprovacao.quantidade !== null &&
      Number(aprovacao.quantidade) !== Number(aprovacao.quantidade_atual)
    ) {
      dadosMl.quantidade = aprovacao.quantidade;
    }

    if (
      aprovacao.preco !== null &&
      Number(aprovacao.preco) !== Number(aprovacao.preco_atual)
    ) {
      dadosMl.preco = aprovacao.preco;
    }

    if (
      aprovacao.titulo !== null &&
      aprovacao.titulo !== (aprovacao.titulo_atual || '')
    ) {
      dadosMl.titulo = aprovacao.titulo;
    }

    if (
      aprovacao.descricao !== null &&
      aprovacao.descricao !== (aprovacao.descricao_atual || '')
    ) {
      dadosMl.descricao = aprovacao.descricao;
    }

    if (
      aprovacao.ml_ativo !== null &&
      Number(aprovacao.ml_ativo) !== Number(aprovacao.ml_ativo_atual)
    ) {
      dadosMl.status = Number(aprovacao.ml_ativo) ? 'active' : 'paused';
    }

    if (aprovacao.ml_item_id && Object.keys(dadosMl).length > 0) {
      await atualizarAnuncioPeca(aprovacao.peca_id, dadosMl);
    }

    const campos = [];
    const valores = [];

    if (aprovacao.titulo !== null) {
      campos.push('ml_titulo = ?');
      valores.push(aprovacao.titulo);
    }

    if (aprovacao.descricao !== null) {
      campos.push('descricao = ?');
      valores.push(aprovacao.descricao);
    }

    if (!aprovacao.ml_item_id) {
      if (aprovacao.preco !== null) {
        campos.push('preco = ?');
        valores.push(aprovacao.preco);
      }

      if (aprovacao.quantidade !== null) {
        campos.push('quantidade = ?');
        valores.push(aprovacao.quantidade);
      }

      if (aprovacao.ml_ativo !== null) {
        campos.push('ml_ativo = ?');
        valores.push(aprovacao.ml_ativo);
      }
    }

    if (dadosExtras && typeof dadosExtras === 'object') {
      const colunasExtras = {
        nome: 'nome',
        sku: 'sku',
        carro: 'carro',
        categoria: 'categoria',
        categoria_ml: 'categoria_ml',
        ml_category_id: 'ml_category_id',
        ml_config: 'ml_config',
        marca: 'marca',
        modelo: 'modelo',
        ano: 'ano',
        condicao: 'condicao',
        numero_oem: 'numero_oem',
        garantia: 'garantia',
        peso_kg: 'peso_kg',
        comprimento_cm: 'comprimento_cm',
        largura_cm: 'largura_cm',
        altura_cm: 'altura_cm',
        atributos: 'atributos',
        tipo_anuncio: 'tipo_anuncio',
        gtin: 'gtin',
        localizacao: 'localizacao',
        video_url: 'video_url',
        modo_compra: 'modo_compra'
      };

      for (const [chave, coluna] of Object.entries(colunasExtras)) {
        if (dadosExtras[chave] === undefined) continue;

        campos.push(`${coluna} = ?`);
        valores.push(
          chave === 'atributos' || chave === 'ml_config'
            ? JSON.stringify(dadosExtras[chave] || {})
            : dadosExtras[chave]
        );
      }
    }

    if (campos.length > 0) {
      await db.run(
        `UPDATE pecas SET ${campos.join(', ')} WHERE id = ?`,
        [...valores, aprovacao.peca_id]
      );
    }

    await db.run(
      `UPDATE aprovacoes_anuncio
       SET status = 'aprovado', decidido_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [aprovacao.id]
    );

    res.json({
      ok: true,
      mensagem: anuncioPublicado
        ? 'Anúncio criado no Mercado Livre após a aprovação.'
        : 'Alterações aprovadas e aplicadas ao anúncio.',
      pecaId: aprovacao.peca_id,
      anuncio: anuncioPublicado
    });
  } catch (error) {
    res
      .status(error?.statusCode || 500)
      .json({ error: error.message });
  }
});

router.post('/:id/rejeitar', async (req, res) => {
  try {
    const db = getDb();
    const aprovacao = await obterAprovacao(Number(req.params.id));

    if (!aprovacao || aprovacao.status !== 'pendente') {
      return res
        .status(404)
        .json({ error: 'Aprovação pendente não encontrada.' });
    }

    await db.run(
      `UPDATE aprovacoes_anuncio
       SET status = 'rejeitado', decidido_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [aprovacao.id]
    );

    res.json({ ok: true, mensagem: 'Alterações rejeitadas.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
