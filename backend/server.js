import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './src/database.js';
import lotesRouter from './src/routes/lotes.js';
import vendasRouter from './src/routes/vendas.js';
import atendimentoRouter from './src/routes/atendimento.js';
import pecasImagensRouter from './src/routes/pecasImagens.js';
import relatoriosRouter from './src/routes/relatorios.js';
import proprietarioRouter from './src/routes/proprietario.js';
import mercadoLivreRouter from './src/routes/mercadoLivre.js';
import iaRouter from './src/routes/ia.js';
import aprovacoesRouter from './src/routes/aprovacoes.js';
import { seedDemo } from './src/demoSeed.js';
import {
  obterAnalyticsDashboard,
  obterResumoDashboard
} from './src/services/dashboardService.js';
import {
  classificarCategoria,
  normalizarCategoria,
  sugerirCategoriaMl
} from './src/utils/categorias.js';
import {
  inserirImagensPeca,
  limparArquivos,
  mensagemErroUpload,
  moverFotosParaPeca,
  removerDiretorioPeca,
  uploadFotosPecaTemp
} from './src/services/pecaImagensService.js';
import {
  atualizarAnuncioPeca,
  encerrarAnuncioPeca,
  obterIntegracao,
  sincronizarPerguntas,
  sincronizarReclamacoes,
  sincronizarVendas
} from './src/services/mercadoLivreService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = await initDatabase();

// Sincronizações interrompidas por um reinício do servidor ficariam
// "executando" para sempre no histórico; marca como erro ao subir a API.
await db
  .run(
    `UPDATE ml_sincronizacoes SET
       status = 'erro',
       mensagem = COALESCE(mensagem, 'Interrompida pelo reinício do servidor'),
       finalizado_em = CURRENT_TIMESTAMP
     WHERE status = 'executando'`
  )
  .catch(() => {});

app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/lotes', lotesRouter);
app.use('/api/vendas', vendasRouter);
app.use('/api/atendimento', atendimentoRouter);
app.use('/api/pecas', pecasImagensRouter);
app.use('/api/relatorios', relatoriosRouter);
app.use('/api/proprietario', proprietarioRouter);
app.use('/api/mercadolivre', mercadoLivreRouter);
app.use('/api/ia', iaRouter);
app.use('/api/aprovacoes', aprovacoesRouter);

function normalizarBooleano(valor) {
  return (
    valor === true ||
    valor === 1 ||
    valor === '1' ||
    valor === 'true' ||
    valor === 'on'
  );
}

function numero(valor, padrao = 0) {
  const numeroConvertido = Number(valor);
  return Number.isFinite(numeroConvertido) ? numeroConvertido : padrao;
}

function texto(valor, limite = 500) {
  return String(valor ?? '').trim().slice(0, limite);
}

function parseAtributos(valor) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return JSON.stringify(valor).slice(0, 8000);
  }

  const textoAtributos = texto(valor, 8000);
  if (!textoAtributos) return '{}';

  try {
    const objeto = JSON.parse(textoAtributos);
    return JSON.stringify(
      objeto && typeof objeto === 'object' && !Array.isArray(objeto)
        ? objeto
        : {}
    ).slice(0, 8000);
  } catch {
    return '{}';
  }
}

function montarPayloadPeca(body = {}, atual = {}) {
  const nome = texto(body.nome ?? atual.nome, 200);
  const descricao = texto(body.descricao ?? atual.descricao, 5000);
  const carro = texto(body.carro ?? atual.carro, 200);
  const categoria = normalizarCategoria(
    body.categoria ?? atual.categoria,
    nome,
    descricao,
    carro
  );
  const categoriaMl =
    texto(body.categoria_ml ?? atual.categoria_ml, 300) ||
    sugerirCategoriaMl(categoria);
  const sku = texto(body.sku ?? atual.sku, 100).toUpperCase();

  return {
    nome,
    sku,
    carro,
    descricao,
    categoria,
    categoria_ml: categoriaMl,
    marca: texto(body.marca ?? atual.marca, 120),
    modelo: texto(body.modelo ?? atual.modelo, 120),
    ano: texto(body.ano ?? atual.ano, 40),
    condicao: texto(body.condicao ?? atual.condicao ?? 'usado', 40) || 'usado',
    numero_oem: texto(body.numero_oem ?? atual.numero_oem, 120),
    garantia: texto(body.garantia ?? atual.garantia, 120),
    peso_kg: numero(body.peso_kg ?? atual.peso_kg),
    comprimento_cm: numero(body.comprimento_cm ?? atual.comprimento_cm),
    largura_cm: numero(body.largura_cm ?? atual.largura_cm),
    altura_cm: numero(body.altura_cm ?? atual.altura_cm),
    atributos: parseAtributos(body.atributos ?? atual.atributos),
    ml_titulo:
      texto(body.ml_titulo ?? atual.ml_titulo, 60) || nome.slice(0, 60),
    tipo_anuncio:
      texto(body.tipo_anuncio ?? atual.tipo_anuncio ?? 'clássico', 40) ||
      'clássico',
    gtin: texto(body.gtin ?? atual.gtin, 60),
    localizacao: texto(body.localizacao ?? atual.localizacao, 200),
    video_url: texto(body.video_url ?? atual.video_url, 500),
    modo_compra:
      texto(body.modo_compra ?? atual.modo_compra ?? 'buy_it_now', 40) ||
      'buy_it_now',
    quantidade: Math.trunc(numero(body.quantidade ?? atual.quantidade)),
    preco: numero(body.preco ?? atual.preco),
    ml_ativo: normalizarBooleano(body.ml_ativo ?? atual.ml_ativo) ? 1 : 0
  };
}

function validarPayloadPeca(payload) {
  if (!payload.nome) {
    return 'Nome da peça é obrigatório';
  }

  if (!Number.isInteger(payload.quantidade) || payload.quantidade < 0) {
    return 'Quantidade deve ser um número inteiro maior ou igual a zero';
  }

  if (!Number.isFinite(payload.preco) || payload.preco < 0) {
    return 'Preço inválido';
  }

  if (payload.peso_kg < 0 || payload.comprimento_cm < 0) {
    return 'Peso e dimensões não podem ser negativos';
  }

  return null;
}

function avaliarAnuncio(peca) {
  if (!peca.ml_ativo) {
    return { status: 'inativo', motivos: [] };
  }

  const motivos = [];
  // Na listagem resumida a descrição completa não é enviada; nesse caso o
  // tamanho vem calculado do banco em descricao_len.
  const tamanhoDescricao =
    peca.descricao !== undefined && peca.descricao !== null
      ? texto(peca.descricao).length
      : Number(peca.descricao_len) || 0;

  if (Number(peca.quantidade) <= 0) motivos.push('Sem estoque');
  // A foto do anúncio no Mercado Livre também conta: não é preciso reenviar
  // imagem para uma peça que já tem miniatura no ML.
  if (!Number(peca.imagens_count) && !texto(peca.ml_thumbnail)) {
    motivos.push('Sem fotos');
  }
  if (!texto(peca.sku)) motivos.push('Sem SKU');
  if (!texto(peca.categoria)) motivos.push('Sem categoria');
  if (tamanhoDescricao < 40) motivos.push('Descrição curta');
  if (
    numero(peca.peso_kg) <= 0 ||
    numero(peca.comprimento_cm) <= 0 ||
    numero(peca.largura_cm) <= 0 ||
    numero(peca.altura_cm) <= 0
  ) {
    motivos.push('Sem peso/medidas');
  }

  return {
    status: motivos.length > 0 ? 'revisar' : 'pronto',
    motivos
  };
}

function comStatusAnuncio(peca) {
  return { ...peca, ...avaliarAnuncio(peca) };
}

async function skuJaExiste(sku, ignorarId = null) {
  if (!sku) return false;

  const existente = await db.get(
    `SELECT id FROM pecas WHERE UPPER(sku) = UPPER(?) ${
      ignorarId ? 'AND id <> ?' : ''
    }`,
    ignorarId ? [sku, ignorarId] : [sku]
  );

  return Boolean(existente);
}

function receberFotosNovaPeca(req, res, next) {
  uploadFotosPecaTemp.array('fotos', 20)(req, res, (error) => {
    if (!error) return next();

    limparArquivos(req.files || []).finally(() => {
      res.status(400).json({ error: mensagemErroUpload(error) });
    });
  });
}

// Listar peças
app.get('/api/pecas', async (req, res) => {
  try {
    const resumo = req.query.resumo === '1';
    const limiteBruto = Number(req.query.limite) || 0;
    const limite = Math.min(Math.max(Math.trunc(limiteBruto), 0), 500);
    const campos = resumo
      ? `p.id, p.nome, p.sku, p.carro, p.categoria, p.categoria_ml,
         p.marca, p.modelo, p.ano, p.condicao, p.numero_oem, p.garantia,
         p.quantidade, p.preco, p.ml_ativo,
         p.ml_titulo, p.ml_item_id, p.ml_status, p.ml_thumbnail, p.ml_health,
         p.peso_kg, p.comprimento_cm, p.largura_cm, p.altura_cm,
         LENGTH(TRIM(COALESCE(p.descricao, ''))) AS descricao_len`
      : 'p.*';

    const pecas = await db.all(`
      SELECT
        ${campos},
        (
          SELECT COUNT(*) FROM peca_imagens pi WHERE pi.peca_id = p.id
        ) AS imagens_count,
        COALESCE(
          (
            SELECT pi.caminho FROM peca_imagens pi
            WHERE pi.peca_id = p.id
            ORDER BY pi.is_principal DESC, pi.ordem ASC, pi.id ASC
            LIMIT 1
          ),
          p.ml_thumbnail
        ) AS imagem_principal
      FROM pecas p
      ORDER BY p.id DESC
      ${limite > 0 ? `LIMIT ${limite}` : ''}
    `);

    res.json(pecas.map(comStatusAnuncio));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Próximo SKU sugerido (ex.: SKU G001) antes da rota /:id.
app.get('/api/pecas/proximo-sku', async (req, res) => {
  try {
    const prefixo = texto(req.query.prefixo || 'D', 8)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 3) || 'D';
    const inicio = `SKU ${prefixo}`;
    const existentes = await db.all(
      'SELECT sku FROM pecas WHERE UPPER(sku) LIKE UPPER(?)',
      [`${inicio}%`]
    );

    let maior = 0;
    const regex = new RegExp(`^${inicio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);

    for (const item of existentes) {
      const resultado = String(item.sku || '').match(regex);
      if (resultado) maior = Math.max(maior, Number(resultado[1]));
    }

    res.json({
      prefixo,
      sku: `${inicio}${String(maior + 1).padStart(3, '0')}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Classificação automática por palavra-chave (retrovisor, farol, motor...).
app.post('/api/pecas/classificar', async (req, res) => {
  try {
    const nome = texto(req.body?.nome, 200);
    const descricao = texto(req.body?.descricao, 2000);
    const carro = texto(req.body?.carro, 200);
    const categoria = classificarCategoria(nome, descricao, carro);

    res.json({
      categoria,
      categoria_ml: sugerirCategoriaMl(categoria)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cadastrar peça (JSON ou multipart/form-data com fotos)
app.post('/api/pecas', receberFotosNovaPeca, async (req, res) => {
  const files = req.files || [];
  let pecaId = null;

  try {
    const payload = montarPayloadPeca(req.body);
    const erro = validarPayloadPeca(payload);

    if (erro) {
      await limparArquivos(files);
      return res.status(400).json({ error: erro });
    }

    if (await skuJaExiste(payload.sku)) {
      await limparArquivos(files);
      return res.status(409).json({ error: 'Já existe uma peça com este SKU' });
    }

    await db.exec('BEGIN IMMEDIATE');

    try {
      const result = await db.run(
        `INSERT INTO pecas (
          nome, sku, carro, descricao, categoria, categoria_ml, marca, modelo,
          ano, condicao, numero_oem, garantia, peso_kg, comprimento_cm,
          largura_cm, altura_cm, atributos, ml_titulo, tipo_anuncio,
          gtin, localizacao, video_url, modo_compra,
          quantidade, preco, ml_ativo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.nome,
          payload.sku || null,
          payload.carro,
          payload.descricao,
          payload.categoria,
          payload.categoria_ml,
          payload.marca,
          payload.modelo,
          payload.ano,
          payload.condicao,
          payload.numero_oem,
          payload.garantia,
          payload.peso_kg,
          payload.comprimento_cm,
          payload.largura_cm,
          payload.altura_cm,
          payload.atributos,
          payload.ml_titulo,
          payload.tipo_anuncio,
          payload.gtin,
          payload.localizacao,
          payload.video_url,
          payload.modo_compra,
          payload.quantidade,
          payload.preco,
          payload.ml_ativo
        ]
      );

      pecaId = result.lastID;

      if (files.length > 0) {
        await moverFotosParaPeca(files, pecaId);
        await inserirImagensPeca(db, pecaId, files);
      }

      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      throw error;
    }

    res.status(201).json({
      id: pecaId,
      message: 'Peça cadastrada com sucesso!',
      imagens: files.length
    });
  } catch (error) {
    await limparArquivos(files);

    if (pecaId) {
      await db.run('DELETE FROM peca_imagens WHERE peca_id = ?', [pecaId]).catch(() => {});
      await db.run('DELETE FROM pecas WHERE id = ?', [pecaId]).catch(() => {});
      await removerDiretorioPeca(pecaId);
    }

    res.status(500).json({ error: error.message });
  }
});

// Dashboard resumido
app.get('/api/dashboard', async (req, res) => {
  try {
    res.json(await obterResumoDashboard(db));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard analítico com período selecionável.
app.get('/api/dashboard/analytics', async (req, res) => {
  try {
    res.json(
      await obterAnalyticsDashboard(db, req.query.periodo ?? req.query.dias)
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard específico Mercado Livre (compatibilidade).
app.get('/api/dashboard/ml', async (req, res) => {
  try {
    const vendasML = await db.get(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(valor), 0) as faturamento,
        COALESCE(SUM(CASE WHEN DATE(data_venda, 'localtime') = DATE('now', 'localtime') THEN 1 ELSE 0 END), 0) as vendas_hoje
      FROM vendas
      WHERE (plataforma LIKE '%ML%' OR plataforma LIKE '%Mercado Livre%')
        AND status NOT IN ('cancelada', 'cancelled', 'canceled', 'refunded', 'reembolsada')
    `);

    const anunciosAtivos = await db.get(`
      SELECT COUNT(*) as total
      FROM pecas
      WHERE ml_ativo = 1
    `);

    res.json({
      vendasML: vendasML.total || 0,
      faturamentoML: vendasML.faturamento || 0,
      vendasHojeML: vendasML.vendas_hoje || 0,
      anunciosAtivos: anunciosAtivos.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET peça por ID
app.get('/api/pecas/:id', async (req, res) => {
  try {
    const peca = await db.get(
      `SELECT p.*,
        (SELECT COUNT(*) FROM peca_imagens pi WHERE pi.peca_id = p.id) AS imagens_count
       FROM pecas p WHERE p.id = ?`,
      [req.params.id]
    );

    if (!peca) return res.status(404).json({ error: 'Peça não encontrada' });

    const imagens = await db.all(
      `SELECT id, caminho, nome_arquivo, is_principal, ordem
       FROM peca_imagens
       WHERE peca_id = ?
       ORDER BY is_principal DESC, ordem ASC, id ASC`,
      [peca.id]
    );

    res.json({ ...comStatusAnuncio(peca), imagens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT atualizar peça (aceita atualização parcial)
app.put('/api/pecas/:id', async (req, res) => {
  try {
    const atual = await db.get('SELECT * FROM pecas WHERE id = ?', [
      req.params.id
    ]);

    if (!atual) {
      return res.status(404).json({ error: 'Peça não encontrada' });
    }

    const payload = montarPayloadPeca(req.body, atual);
    const erro = validarPayloadPeca(payload);

    if (erro) {
      return res.status(400).json({ error: erro });
    }

    if (await skuJaExiste(payload.sku, atual.id)) {
      return res.status(409).json({ error: 'Já existe uma peça com este SKU' });
    }

    // Peças vinculadas a anúncios reais: atualiza primeiro no Mercado Livre.
    // Se a API recusar, o estoque local não fica divergente.
    const dadosMl = {};

    if (atual.ml_item_id) {
      if (
        req.body.quantidade !== undefined &&
        Number(payload.quantidade) !== Number(atual.quantidade)
      ) {
        dadosMl.quantidade = payload.quantidade;
      }

      if (
        req.body.preco !== undefined &&
        Number(payload.preco) !== Number(atual.preco)
      ) {
        dadosMl.preco = payload.preco;
      }

      if (
        req.body.ml_titulo !== undefined &&
        payload.ml_titulo !== atual.ml_titulo
      ) {
        dadosMl.titulo = payload.ml_titulo;
      }

      if (
        req.body.descricao !== undefined &&
        payload.descricao !== atual.descricao
      ) {
        dadosMl.descricao = payload.descricao;
      }

      if (
        req.body.ml_ativo !== undefined &&
        Number(payload.ml_ativo) !== Number(atual.ml_ativo)
      ) {
        dadosMl.status = payload.ml_ativo ? 'active' : 'paused';
      }
    }

    if (Object.keys(dadosMl).length > 0) {
      try {
        await atualizarAnuncioPeca(atual.id, dadosMl);
      } catch (error) {
        return res.status(error?.statusCode || 502).json({
          error: `O anúncio do Mercado Livre não foi atualizado: ${error.message}`
        });
      }
    }

    await db.run(
      `UPDATE pecas
       SET nome = ?, sku = ?, carro = ?, descricao = ?, categoria = ?,
           categoria_ml = ?, marca = ?, modelo = ?, ano = ?, condicao = ?,
           numero_oem = ?, garantia = ?, peso_kg = ?, comprimento_cm = ?,
           largura_cm = ?, altura_cm = ?, atributos = ?, ml_titulo = ?,
           tipo_anuncio = ?, gtin = ?, localizacao = ?, video_url = ?,
           modo_compra = ?, quantidade = ?, preco = ?, ml_ativo = ?
       WHERE id = ?`,
      [
        payload.nome,
        payload.sku || null,
        payload.carro,
        payload.descricao,
        payload.categoria,
        payload.categoria_ml,
        payload.marca,
        payload.modelo,
        payload.ano,
        payload.condicao,
        payload.numero_oem,
        payload.garantia,
        payload.peso_kg,
        payload.comprimento_cm,
        payload.largura_cm,
        payload.altura_cm,
        payload.atributos,
        payload.ml_titulo,
        payload.tipo_anuncio,
        payload.gtin,
        payload.localizacao,
        payload.video_url,
        payload.modo_compra,
        payload.quantidade,
        payload.preco,
        payload.ml_ativo,
        atual.id
      ]
    );

    res.json({ message: 'Peça atualizada com sucesso!', id: atual.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excluir o anúncio no Mercado Livre sem apagar a peça do estoque.
app.post('/api/pecas/:id/anuncio/excluir', async (req, res) => {
  try {
    const resultado = await encerrarAnuncioPeca(req.params.id);
    res.json(resultado);
  } catch (error) {
    res
      .status(error?.statusCode || 500)
      .json({ error: error.message });
  }
});

// DELETE peça
app.delete('/api/pecas/:id', async (req, res) => {
  try {
    const vendas = await db.get(
      'SELECT COUNT(*) as total FROM vendas WHERE peca_id = ?',
      [req.params.id]
    );

    if (vendas.total > 0) {
      return res.status(400).json({
        error: 'Não é possível excluir peça com vendas associadas'
      });
    }

    const peca = await db.get('SELECT id FROM pecas WHERE id = ?', [
      req.params.id
    ]);

    if (!peca) {
      return res.status(404).json({ error: 'Peça não encontrada' });
    }

    await db.exec('BEGIN IMMEDIATE');

    try {
      await db.run('DELETE FROM peca_imagens WHERE peca_id = ?', [peca.id]);
      await db.run('DELETE FROM pecas WHERE id = ?', [peca.id]);
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      throw error;
    }

    await removerDiretorioPeca(peca.id);

    res.json({ message: 'Peça excluída com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SEED de demonstração (destrutivo: substitui peças, vendas e atendimento)
app.post('/api/seed', async (req, res) => {
  try {
    const resultado = await seedDemo(db);
    res.json({
      message: 'Demonstração criada com peças, vendas, perguntas e reclamações!',
      ...resultado
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET todas vendas (histórico bruto da API)
app.get('/api/vendas', async (req, res) => {
  try {
    const vendas = await db.all(`
      SELECT
        v.*,
        p.nome as peca_nome,
        p.carro as peca_carro,
        (SELECT COUNT(*) FROM venda_itens vi WHERE vi.venda_id = v.id) as itens_count,
        (SELECT GROUP_CONCAT(vi.sku, ', ') FROM venda_itens vi WHERE vi.venda_id = v.id) as itens_skus
      FROM vendas v
      LEFT JOIN pecas p ON v.peca_id = p.id
      ORDER BY v.data_venda DESC, v.id DESC
      LIMIT 50
    `);
    res.json(vendas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Venda avulsa (compatibilidade com integrações antigas)
app.post('/api/vendas', async (req, res) => {
  try {
    const { peca_id, valor, plataforma } = req.body;

    const resultado = await db.run(
      'UPDATE pecas SET quantidade = quantidade - 1 WHERE id = ? AND quantidade > 0',
      [peca_id]
    );

    if (resultado.changes === 0) {
      return res.status(400).json({ error: 'Estoque insuficiente' });
    }

    const venda = await db.run(
      'INSERT INTO vendas (peca_id, valor, plataforma) VALUES (?, ?, ?)',
      [peca_id, valor, plataforma || 'Mercado Livre']
    );

    res.json({ id: venda.lastID, message: 'Venda registrada!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Nova venda com baixa de estoque (compatibilidade)
app.post('/api/vendas/nova', async (req, res) => {
  try {
    const { peca_id, valor, plataforma, cliente, pagamento } = req.body;

    const peca = await db.get(
      'SELECT id, quantidade, nome FROM pecas WHERE id = ?',
      [peca_id]
    );

    if (!peca) {
      return res.status(404).json({ error: 'Peça não encontrada' });
    }

    if (peca.quantidade < 1) {
      return res.status(400).json({ error: 'Estoque insuficiente' });
    }

    const result = await db.run(
      `INSERT INTO vendas (
        peca_id, valor, plataforma, cliente, metodo_pagamento
      ) VALUES (?, ?, ?, ?, ?)`,
      [peca_id, valor, plataforma || 'Mercado Livre', cliente || '', pagamento || '']
    );

    await db.run('UPDATE pecas SET quantidade = quantidade - 1 WHERE id = ?', [
      peca_id
    ]);

    res.json({
      id: result.lastID,
      message: 'Venda registrada com sucesso!',
      estoque_atualizado: peca.quantidade - 1
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tratamento central de erros (inclui falhas de upload)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error('Erro na API:', err);

  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Cada arquivo deve ter no máximo 10 MB' });
  }

  if (err?.code === 'LIMIT_FILE_COUNT') {
    return res
      .status(400)
      .json({ error: 'Envie no máximo 20 fotos por peça' });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido na requisição' });
  }

  const statusCode =
    Number.isInteger(err?.statusCode) && err.statusCode >= 400
      ? err.statusCode
      : 500;

  return res.status(statusCode).json({
    error: err instanceof Error ? err.message : 'Erro interno do servidor'
  });
});

// Mantém as vendas, perguntas e reclamações em dia sem depender de webhook.
// O Mercado Livre nem sempre entrega o webhook na hora, então uma varredura
// curta garante que o painel reflita venda/pergunta nova em pouco tempo.
const INTERVALO_SYNC_AUTOMATICO_MS = 60_000;
const INTERVALO_SYNC_PERGUNTAS_MS = 120_000;
const INTERVALO_SYNC_PERGUNTAS_COMPLETO_MS = 30 * 60_000;
const INTERVALO_SYNC_RECLAMACOES_MS = 180_000;
let sincronizacaoAutomaticaRodando = false;
let ultimaSyncPerguntas = 0;
let ultimaSyncPerguntasCompleto = 0;
let ultimaSyncReclamacoes = 0;

async function sincronizarAutomaticamente() {
  if (sincronizacaoAutomaticaRodando) return;

  sincronizacaoAutomaticaRodando = true;

  try {
    const integracao = await obterIntegracao();

    if (!integracao) return;

    try {
      await sincronizarVendas({ dias: 7 });
    } catch (error) {
      console.warn(
        'Sync automática de vendas falhou:',
        error instanceof Error ? error.message : error
      );
    }

    const agora = Date.now();

    if (agora - ultimaSyncPerguntas >= INTERVALO_SYNC_PERGUNTAS_MS) {
      ultimaSyncPerguntas = agora;
      const completo =
        agora - ultimaSyncPerguntasCompleto >=
        INTERVALO_SYNC_PERGUNTAS_COMPLETO_MS;

      if (completo) ultimaSyncPerguntasCompleto = agora;

      try {
        await sincronizarPerguntas({ apenasPendentes: !completo });
      } catch (error) {
        console.warn(
          'Sync automática de perguntas falhou:',
          error instanceof Error ? error.message : error
        );
      }
    }

    if (agora - ultimaSyncReclamacoes >= INTERVALO_SYNC_RECLAMACOES_MS) {
      ultimaSyncReclamacoes = agora;

      try {
        await sincronizarReclamacoes();
      } catch (error) {
        console.warn(
          'Sync automática de reclamações falhou:',
          error instanceof Error ? error.message : error
        );
      }
    }
  } finally {
    sincronizacaoAutomaticaRodando = false;
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log('📊 Banco: database.sqlite');

  // Espera o servidor estabilizar antes da primeira varredura automática.
  setTimeout(() => {
    void sincronizarAutomaticamente();
    setInterval(() => void sincronizarAutomaticamente(), INTERVALO_SYNC_AUTOMATICO_MS);
  }, 12_000);
});
