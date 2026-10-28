import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { getDb } from '../database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');
const MAX_IMAGENS_POR_LOTE = 1000;

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.heic'
]);

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.heic': 'image/heic'
};

function diretorioDoLote(loteId) {
  return path.join(UPLOADS_ROOT, 'lotes', String(loteId));
}

function extensaoDeImagem(nomeArquivo) {
  return path.extname(nomeArquivo).toLowerCase();
}

function ehImagem(nomeArquivo) {
  return IMAGE_EXTENSIONS.has(extensaoDeImagem(nomeArquivo));
}

function pareceEtiqueta(nomeArquivo) {
  return /(etiqueta|tag)/i.test(path.basename(nomeArquivo));
}

function extrairSkuDoNome(nomeArquivo) {
  const nome = path.basename(nomeArquivo, path.extname(nomeArquivo));
  const padroes = [
    /sku[\s_-]*([a-z0-9]+(?:-[a-z0-9]+)*)/i,
    /((?=[a-z0-9-]*\d)[a-z0-9]+(?:-[a-z0-9]+)*)[\s_-]*sku\b/i,
    /^([a-z]{0,3}\d{3,})(?:[\s_.-]|$)/i
  ];

  for (const padrao of padroes) {
    const match = nome.match(padrao);
    if (match) {
      const sku = match[1].replace(/[-_]+$/, '').toUpperCase();
      if (sku) return sku;
    }
  }

  return null;
}

function mimetypeDaExtensao(nomeArquivo) {
  return MIME_BY_EXTENSION[extensaoDeImagem(nomeArquivo)] || 'application/octet-stream';
}

function erroValidacao(mensagem) {
  const error = new Error(mensagem);
  error.statusCode = 400;
  return error;
}

async function expandirArquivos(loteId, files) {
  const destinationDir = diretorioDoLote(loteId);
  await fs.mkdir(destinationDir, { recursive: true });

  const arquivos = [];

  for (const file of files) {
    if (extensaoDeImagem(file.originalname) === '.zip') {
      let zip;

      try {
        zip = new AdmZip(file.path);
      } catch {
        throw erroValidacao(`ZIP inválido: ${file.originalname}`);
      }

      const entradas = zip
        .getEntries()
        .filter((entry) => !entry.isDirectory && ehImagem(entry.entryName));

      if (entradas.length === 0) {
        await fs.unlink(file.path).catch(() => {});
        continue;
      }

      const tamanhoDescompactado = entradas.reduce(
        (total, entry) => total + entry.header.size,
        0
      );

      if (tamanhoDescompactado > 500 * 1024 * 1024) {
        throw erroValidacao(
          `O ZIP ${file.originalname} excede o limite de 500 MB descompactado`
        );
      }

      for (const entry of entradas) {
        if (arquivos.length >= MAX_IMAGENS_POR_LOTE) {
          throw erroValidacao(
            `O lote excede o limite de ${MAX_IMAGENS_POR_LOTE} imagens`
          );
        }

        const nomeOriginal = path.basename(entry.entryName);
        if (!nomeOriginal) continue;

        const extensao = extensaoDeImagem(nomeOriginal);
        const nomeArquivo = `${crypto.randomUUID()}${extensao}`;
        const caminhoCompleto = path.join(destinationDir, nomeArquivo);

        await fs.writeFile(caminhoCompleto, entry.getData());

        arquivos.push({
          originalname: nomeOriginal,
          filename: nomeArquivo,
          path: caminhoCompleto,
          size: entry.header.size,
          mimetype: mimetypeDaExtensao(nomeOriginal)
        });
      }

      // O ZIP em si não é usado depois da extração.
      await fs.unlink(file.path).catch(() => {});
      continue;
    }

    if (!ehImagem(file.originalname)) {
      continue;
    }

    if (arquivos.length >= MAX_IMAGENS_POR_LOTE) {
      throw erroValidacao(
        `O lote excede o limite de ${MAX_IMAGENS_POR_LOTE} imagens`
      );
    }

    arquivos.push(file);
  }

  return arquivos;
}

function normalizarMapaIA(mapaIA) {
  if (!mapaIA || typeof mapaIA !== 'object' || Array.isArray(mapaIA)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(mapaIA)
      .map(([arquivo, dados]) => [
        String(arquivo || '').trim(),
        {
          sku: normalizarSku(dados?.sku),
          nome: String(dados?.nome || '').trim().slice(0, 200)
        }
      ])
      .filter(([arquivo]) => Boolean(arquivo))
  );
}

function agruparPorSku(arquivos, mapaIA = {}) {
  const grupos = new Map();

  for (const arquivo of arquivos) {
    const dadosIa = mapaIA[arquivo.originalname] || {};
    const sku =
      normalizarSku(dadosIa.sku) ||
      extrairSkuDoNome(arquivo.originalname) ||
      'DESCONHECIDO';

    if (!grupos.has(sku)) {
      grupos.set(sku, { imagens: [], nome: dadosIa.nome || '' });
    }

    const grupo = grupos.get(sku);
    grupo.imagens.push(arquivo);

    if (!grupo.nome && dadosIa.nome) {
      grupo.nome = dadosIa.nome;
    }
  }

  return Array.from(grupos, ([sku, grupo]) => ({
    sku,
    nome: grupo.nome || `Produto ${sku}`,
    imagens: grupo.imagens,
    skuDetectado: sku !== 'DESCONHECIDO'
  }));
}

function criarGruposIndividuais(arquivos, mapaIA = {}) {
  return arquivos.map((arquivo) => {
    const dadosIa = mapaIA[arquivo.originalname] || {};
    const sku =
      normalizarSku(dadosIa.sku) ||
      `IND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    return {
      sku,
      nome: dadosIa.nome || `Produto ${sku}`,
      imagens: [arquivo],
      skuDetectado: Boolean(dadosIa.sku)
    };
  });
}

async function salvarGrupos(db, loteId, grupos) {
  const gruposSalvos = [];

  for (const grupo of grupos) {
    const resultadoProduto = await db.run(
      `INSERT INTO produtos (sku, nome, lote_id, status_revisao)
       VALUES (?, ?, ?, 'pendente')`,
      [grupo.sku, grupo.nome || `Produto ${grupo.sku}`, loteId]
    );

    const produtoId = resultadoProduto.lastID;
    const imagensSalvas = [];

    for (let indice = 0; indice < grupo.imagens.length; indice += 1) {
      const imagem = grupo.imagens[indice];
      const caminho = `/uploads/lotes/${loteId}/${imagem.filename}`;
      const tipo = pareceEtiqueta(imagem.originalname) ? 'etiqueta' : 'produto';

      const resultadoImagem = await db.run(
        `INSERT INTO produto_imagens (
          produto_id, caminho, nome_arquivo, tipo, ordem, is_principal
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          produtoId,
          caminho,
          imagem.originalname,
          tipo,
          indice,
          indice === 0 ? 1 : 0
        ]
      );

      imagensSalvas.push({
        id: resultadoImagem.lastID,
        caminho,
        fileName: imagem.originalname,
        detectedAsSKU: tipo === 'etiqueta'
      });
    }

    gruposSalvos.push({
      produtoId,
      sku: grupo.sku,
      totalImagens: imagensSalvas.length,
      imagens: imagensSalvas
    });
  }

  return gruposSalvos;
}

function calcularConfianca(grupo) {
  if (grupo.sku === 'DESCONHECIDO') return 'low';
  if (grupo.images.length > 1) return 'high';
  return 'medium';
}

function calcularAlertas(grupo) {
  const alertas = [];

  if (grupo.sku === 'DESCONHECIDO') {
    alertas.push('SKU não identificado no nome dos arquivos');
  }

  if (grupo.images.length === 1) {
    alertas.push('Grupo com apenas 1 foto');
  }

  return alertas;
}

function mapearGrupo(produto, imagens) {
  const grupo = {
    produtoId: produto.id,
    sku: produto.sku,
    nome: produto.nome,
    statusRevisao: produto.status_revisao,
    images: imagens.map((imagem) => ({
      id: imagem.id,
      url: imagem.caminho,
      fileName: imagem.nome_arquivo,
      detectedAsSKU: imagem.tipo === 'etiqueta',
      isPrincipal: Boolean(imagem.is_principal)
    }))
  };

  return {
    ...grupo,
    totalImagens: imagens.length,
    suggestedName: null,
    confidence: calcularConfianca(grupo),
    alerts: calcularAlertas(grupo)
  };
}

export async function obterGruposDoLote(loteId) {
  const db = getDb();
  const produtos = await db.all(
    'SELECT * FROM produtos WHERE lote_id = ? ORDER BY id',
    [loteId]
  );
  const imagens = await db.all(
    `SELECT pi.*
     FROM produto_imagens pi
     INNER JOIN produtos p ON p.id = pi.produto_id
     WHERE p.lote_id = ?
     ORDER BY pi.produto_id, pi.ordem, pi.id`,
    [loteId]
  );

  const imagensPorProduto = new Map();

  for (const imagem of imagens) {
    if (!imagensPorProduto.has(imagem.produto_id)) {
      imagensPorProduto.set(imagem.produto_id, []);
    }

    imagensPorProduto.get(imagem.produto_id).push(imagem);
  }

  return produtos.map((produto) =>
    mapearGrupo(produto, imagensPorProduto.get(produto.id) || [])
  );
}

export async function processarLote(loteId, files, options = {}) {
  const db = getDb();
  const lote = await db.get('SELECT * FROM lotes WHERE id = ?', [loteId]);

  if (!lote) {
    throw new Error('Lote não encontrado');
  }

  if (lote.status === 'processado' || lote.status === 'organizado') {
    throw new Error('Este lote já foi processado');
  }

  const detectarSKU = options.detectarSKU !== false;
  const mapaIA = normalizarMapaIA(options.mapaIA);

  await db.run(
    `UPDATE lotes
     SET status = 'processando',
         veiculo_origem = COALESCE(?, veiculo_origem),
         detectar_sku = ?,
         metadata = ?
     WHERE id = ?`,
    [
      options.veiculoOrigem || null,
      detectarSKU ? 1 : 0,
      JSON.stringify({
        modo: options.modo || lote.modo,
        veiculoOrigem: options.veiculoOrigem || lote.veiculo_origem,
        detectarSKU,
        timestamp: new Date().toISOString()
      }),
      loteId
    ]
  );

  try {
    const arquivos = await expandirArquivos(loteId, files);

    if (arquivos.length === 0) {
      throw erroValidacao('Nenhuma imagem válida foi encontrada nos arquivos enviados');
    }

    const grupos = detectarSKU
      ? agruparPorSku(arquivos, mapaIA)
      : criarGruposIndividuais(arquivos, mapaIA);

    await db.exec('BEGIN IMMEDIATE');

    try {
      // Reenvios para o mesmo lote substituem o resultado anterior.
      await db.run(
        `DELETE FROM analises_ia
         WHERE produto_id IN (SELECT id FROM produtos WHERE lote_id = ?)`,
        [loteId]
      );
      await db.run(
        `DELETE FROM produto_imagens
         WHERE produto_id IN (SELECT id FROM produtos WHERE lote_id = ?)`,
        [loteId]
      );
      await db.run('DELETE FROM produtos WHERE lote_id = ?', [loteId]);

      await salvarGrupos(db, loteId, grupos);

      await db.run(
        `UPDATE lotes
         SET status = 'processado',
             fotos_count = ?,
             produtos_count = ?,
             processado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [arquivos.length, grupos.length, loteId]
      );

      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }

    return {
      totalFotos: arquivos.length,
      gruposCriados: grupos.length,
      grupos: await obterGruposDoLote(loteId)
    };
  } catch (error) {
    await db
      .run(`UPDATE lotes SET status = 'erro' WHERE id = ?`, [loteId])
      .catch(() => {});

    throw error;
  }
}

function normalizarSku(valor) {
  return String(valor || '').trim().toUpperCase();
}

export async function atualizarGruposDoLote(loteId, gruposPayload) {
  const db = getDb();
  const lote = await db.get('SELECT id FROM lotes WHERE id = ?', [loteId]);

  if (!lote) {
    throw new Error('Lote não encontrado');
  }

  if (!Array.isArray(gruposPayload)) {
    throw erroValidacao('Dados de grupos inválidos');
  }

  const grupos = gruposPayload.filter(
    (grupo) => grupo && Array.isArray(grupo.imageIds) && grupo.imageIds.length > 0
  );

  if (grupos.length === 0) {
    throw erroValidacao('Informe pelo menos uma imagem nos grupos');
  }

  const skus = new Set();
  const todosImageIds = [];

  for (const grupo of grupos) {
    const sku = normalizarSku(grupo.sku);

    if (!sku) {
      throw erroValidacao('Todos os grupos precisam de um SKU');
    }

    if (skus.has(sku)) {
      throw erroValidacao(`O SKU ${sku} está duplicado entre os grupos`);
    }

    skus.add(sku);

    for (const imageId of grupo.imageIds) {
      const numero = Number(imageId);

      if (!Number.isInteger(numero) || numero <= 0) {
        throw erroValidacao('Identificador de imagem inválido');
      }

      todosImageIds.push(numero);
    }
  }

  if (new Set(todosImageIds).size !== todosImageIds.length) {
    throw erroValidacao('Uma imagem não pode estar em mais de um grupo');
  }

  const imagensDoLote = await db.all(
    `SELECT pi.id
     FROM produto_imagens pi
     INNER JOIN produtos p ON p.id = pi.produto_id
     WHERE p.lote_id = ?`,
    [loteId]
  );
  const idsPermitidos = new Set(imagensDoLote.map((imagem) => imagem.id));

  for (const imageId of todosImageIds) {
    if (!idsPermitidos.has(imageId)) {
      throw erroValidacao('Uma das imagens não pertence a este lote');
    }
  }

  const produtosDoLote = await db.all(
    'SELECT id FROM produtos WHERE lote_id = ?',
    [loteId]
  );
  const idsProdutosDoLote = new Set(produtosDoLote.map((produto) => produto.id));
  const produtosMantidos = new Set();

  await db.exec('BEGIN IMMEDIATE');

  try {
    // Libera as imagens antes de redistribuí-las entre os grupos.
    await db.run(
      `UPDATE produto_imagens
       SET produto_id = NULL, ordem = 0, is_principal = 0
       WHERE produto_id IN (SELECT id FROM produtos WHERE lote_id = ?)`,
      [loteId]
    );

    for (const grupo of grupos) {
      const sku = normalizarSku(grupo.sku);
      const nome = String(grupo.nome || `Produto ${sku}`).trim();
      const produtoIdInformado = Number(grupo.produtoId);
      let produtoId;

      if (
        Number.isInteger(produtoIdInformado) &&
        idsProdutosDoLote.has(produtoIdInformado)
      ) {
        produtoId = produtoIdInformado;
        await db.run(
          'UPDATE produtos SET sku = ?, nome = ? WHERE id = ? AND lote_id = ?',
          [sku, nome, produtoId, loteId]
        );
      } else {
        const resultado = await db.run(
          `INSERT INTO produtos (sku, nome, lote_id, status_revisao)
           VALUES (?, ?, ?, 'pendente')`,
          [sku, nome, loteId]
        );
        produtoId = resultado.lastID;
      }

      produtosMantidos.add(produtoId);

      const imageIds = grupo.imageIds.map((imageId) => Number(imageId));

      for (let indice = 0; indice < imageIds.length; indice += 1) {
        await db.run(
          `UPDATE produto_imagens
           SET produto_id = ?, ordem = ?, is_principal = ?
           WHERE id = ?`,
          [produtoId, indice, indice === 0 ? 1 : 0, imageIds[indice]]
        );
      }
    }

    const idsParaRemover = [...idsProdutosDoLote].filter(
      (id) => !produtosMantidos.has(id)
    );

    if (idsParaRemover.length > 0) {
      const placeholders = idsParaRemover.map(() => '?').join(', ');
      await db.run(
        `DELETE FROM analises_ia WHERE produto_id IN (${placeholders})`,
        idsParaRemover
      );
      await db.run(`DELETE FROM produtos WHERE id IN (${placeholders})`, idsParaRemover);
    }

    await db.run(
      `UPDATE lotes
       SET status = 'organizado', produtos_count = ?, fotos_count = ?
       WHERE id = ?`,
      [produtosMantidos.size, todosImageIds.length, loteId]
    );

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }

  return obterGruposDoLote(loteId);
}
