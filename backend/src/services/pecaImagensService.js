import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

export const PECAS_DIR = path.join(UPLOADS_ROOT, 'pecas');
const TEMP_DIR = path.join(PECAS_DIR, '_temp');

fs.mkdirSync(TEMP_DIR, { recursive: true });

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const MAX_FOTOS = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function extensaoDoArquivo(nome) {
  return path.extname(String(nome || '')).toLowerCase();
}

function ehImagemPermitida(file) {
  return (
    IMAGE_EXTENSIONS.has(extensaoDoArquivo(file.originalname)) &&
    String(file.mimetype || '').startsWith('image/')
  );
}

function fileFilter(req, file, callback) {
  if (!ehImagemPermitida(file)) {
    return callback(
      new Error('Envie apenas imagens JPG, PNG, GIF, WEBP ou BMP')
    );
  }

  callback(null, true);
}

function criarStorage(destino) {
  return multer.diskStorage({
    destination(req, file, callback) {
      try {
        callback(null, destino(req));
      } catch (error) {
        callback(error);
      }
    },
    filename(req, file, callback) {
      callback(null, `${crypto.randomUUID()}${extensaoDoArquivo(file.originalname)}`);
    }
  });
}

function criarUpload(destino) {
  return multer({
    storage: criarStorage(destino),
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: MAX_FOTOS
    },
    fileFilter
  });
}

const storageDaPeca = (req) => {
  const pecaId = Number(req.params.id);

  if (!Number.isInteger(pecaId) || pecaId <= 0) {
    throw new Error('Peça inválida');
  }

  const diretorio = path.join(PECAS_DIR, String(pecaId));
  fs.mkdirSync(diretorio, { recursive: true });
  return diretorio;
};

export const uploadFotosPeca = criarUpload(storageDaPeca);
export const uploadFotosPecaTemp = criarUpload(() => TEMP_DIR);

export function mensagemErroUpload(error) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return 'Cada foto deve ter no máximo 10 MB';
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return `Envie no máximo ${MAX_FOTOS} fotos por vez`;
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return 'Campo de upload inválido';
    }
  }

  return error instanceof Error ? error.message : 'Erro ao enviar as fotos';
}

export async function limparArquivos(files = []) {
  await Promise.all(
    files.map((file) =>
      fs.promises.unlink(file.path).catch(() => {
        // Arquivo pode já ter sido movido ou removido.
      })
    )
  );
}

export async function moverFotosParaPeca(files, pecaId) {
  const diretorio = path.join(PECAS_DIR, String(pecaId));
  await fs.promises.mkdir(diretorio, { recursive: true });

  for (const file of files) {
    const destino = path.join(diretorio, file.filename);
    await fs.promises.rename(file.path, destino);
    file.path = destino;
  }
}

export async function inserirImagensPeca(db, pecaId, files) {
  const existentes = await db.get(
    'SELECT COUNT(*) AS total FROM peca_imagens WHERE peca_id = ?',
    [pecaId]
  );

  if (Number(existentes?.total || 0) + files.length > MAX_FOTOS) {
    const error = new Error(
      `Uma peça pode ter no máximo ${MAX_FOTOS} fotos`
    );
    error.statusCode = 400;
    throw error;
  }

  const ultimaOrdem = await db.get(
    'SELECT COALESCE(MAX(ordem), -1) AS maior FROM peca_imagens WHERE peca_id = ?',
    [pecaId]
  );
  const principal = await db.get(
    `SELECT COUNT(*) AS total FROM peca_imagens
     WHERE peca_id = ? AND is_principal = 1`,
    [pecaId]
  );

  let ordem = Number(ultimaOrdem?.maior ?? -1) + 1;
  let temPrincipal = Number(principal?.total ?? 0) > 0;
  const inseridas = [];

  for (const file of files) {
    const isPrincipal = !temPrincipal ? 1 : 0;
    const caminho = `/uploads/pecas/${pecaId}/${file.filename}`;
    const nomeArquivo = file.originalname || file.filename;

    const resultado = await db.run(
      `INSERT INTO peca_imagens (
        peca_id, caminho, nome_arquivo, is_principal, ordem
      ) VALUES (?, ?, ?, ?, ?)`,
      [pecaId, caminho, nomeArquivo, isPrincipal, ordem]
    );

    inseridas.push({
      id: resultado.lastID,
      caminho,
      nome_arquivo: nomeArquivo,
      is_principal: isPrincipal,
      ordem
    });

    if (isPrincipal) temPrincipal = true;
    ordem += 1;
  }

  return inseridas;
}

export async function listarImagensPeca(db, pecaId) {
  return db.all(
    `SELECT id, caminho, nome_arquivo, is_principal, ordem, created_at
     FROM peca_imagens
     WHERE peca_id = ?
     ORDER BY is_principal DESC, ordem ASC, id ASC`,
    [pecaId]
  );
}

export async function removerArquivoImagem(caminho) {
  const relativo = String(caminho || '').replace(/^\/+/, '');
  const absoluto = path.resolve(UPLOADS_ROOT, relativo);

  if (!absoluto.startsWith(`${UPLOADS_ROOT}${path.sep}`)) return;

  await fs.promises.unlink(absoluto).catch(() => {});
}

export async function removerDiretorioPeca(pecaId) {
  await fs.promises
    .rm(path.join(PECAS_DIR, String(pecaId)), { recursive: true, force: true })
    .catch(() => {});
}
