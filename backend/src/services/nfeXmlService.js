  import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIRETORIO_XML = path.resolve(__dirname, '../../storage/nfe-xml');
const DIRETORIO_TEMP = path.join(DIRETORIO_XML, '.tmp');
const MAX_ARQUIVOS = 20;
const MAX_TAMANHO_ARQUIVO = 20 * 1024 * 1024;
const MAX_XML_DESCOMPACTADO = 10 * 1024 * 1024;
const MAX_ENTRADAS_ZIP = 500;

fs.mkdirSync(DIRETORIO_TEMP, { recursive: true });

export const uploadXmlNfe = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      callback(null, DIRETORIO_TEMP);
    },
    filename(_req, _file, callback) {
      callback(null, `${crypto.randomUUID()}.upload`);
    }
  }),
  limits: {
    fileSize: MAX_TAMANHO_ARQUIVO,
    files: MAX_ARQUIVOS
  },
  fileFilter(_req, file, callback) {
    if (!['.xml', '.zip'].includes(path.extname(file.originalname).toLowerCase())) {
      return callback(new Error('Envie um arquivo XML ou ZIP contendo a NF-e.'));
    }

    callback(null, true);
  }
});

export function nomeOriginalXml(file) {
  return path
    .basename(String(file?.nomeXml || file?.originalname || 'nota-fiscal.xml'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 255);
}

function decodificarTextoXml(valor) {
  const codigoUnicode = (codigo, base) => {
    const numero = Number.parseInt(codigo, base);

    return numero >= 0 &&
      numero <= 0x10ffff &&
      (numero < 0xd800 || numero > 0xdfff)
      ? String.fromCodePoint(numero)
      : '';
  };

  return String(valor || '')
    .replace(/&#x([0-9a-f]+);/gi, (_match, codigo) =>
      codigoUnicode(codigo, 16)
    )
    .replace(/&#(\d+);/g, (_match, codigo) =>
      codigoUnicode(codigo, 10)
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extrairTagXml(conteudo, nome) {
  const tag = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expressao = new RegExp(
    `<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}\\s*>`,
    'i'
  );
  const resultado = conteudo.match(expressao);

  return resultado ? decodificarTextoXml(resultado[1].trim()) : '';
}

export function extrairDestinatarioXml(conteudo) {
  validarConteudoXml(conteudo, 'NF-e');

  const destinatario = conteudo.match(
    /<(?:[\w.-]+:)?dest\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?dest\s*>/i
  )?.[1];

  if (!destinatario) {
    const error = new Error('A NF-e não contém os dados do destinatário.');
    error.statusCode = 400;
    throw error;
  }

  const endereco = destinatario.match(
    /<(?:[\w.-]+:)?enderDest\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?enderDest\s*>/i
  )?.[1] || '';
  const entrega = conteudo.match(
    /<(?:[\w.-]+:)?entrega\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?entrega\s*>/i
  )?.[1] || '';
  const documento =
    extrairTagXml(destinatario, 'CPF') ||
    extrairTagXml(destinatario, 'CNPJ');
  const montarEndereco = (bloco) =>
    [extrairTagXml(bloco, 'xLgr'), extrairTagXml(bloco, 'nro')]
      .filter(Boolean)
      .join(' ');
  const enderecos = [montarEndereco(endereco), montarEndereco(entrega)].filter(
    (valor, indice, lista) => valor && lista.indexOf(valor) === indice
  );
  const cliente = {
    nome: extrairTagXml(destinatario, 'xNome'),
    documento: documento.replace(/\D/g, ''),
    cep: extrairTagXml(endereco, 'CEP').replace(/\D/g, ''),
    endereco: enderecos[0] || '',
    enderecos
  };

  if (!cliente.nome) {
    const error = new Error(
      'A NF-e não identifica o nome do destinatário.'
    );
    error.statusCode = 400;
    throw error;
  }

  return cliente;
}

export function extrairItensXml(conteudo) {
  const itens = [];
  const expressao = /<(?:[\w.-]+:)?det\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?det\s*>/gi;
  let correspondencia;

  while ((correspondencia = expressao.exec(conteudo))) {
    const bloco = correspondencia[1];
    const produto = bloco.match(
      /<(?:[\w.-]+:)?prod\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?prod\s*>/i
    )?.[1] || bloco;
    const nome = extrairTagXml(produto, 'xProd');
    const codigo = extrairTagXml(produto, 'cProd');

    if (nome || codigo) itens.push({ nome, codigo });
  }

  return itens;
}

function validarConteudoXml(conteudo, nomeArquivo) {
  if (
    /<!DOCTYPE|<!ENTITY/i.test(conteudo) ||
    !/<(?:[\w.-]+:)?(?:NFe|nfeProc|procNFe)\b/i.test(conteudo) ||
    !/<(?:[\w.-]+:)?infNFe\b/i.test(conteudo)
  ) {
    const error = new Error(
      `${nomeArquivo} não parece conter uma NF-e válida.`
    );
    error.statusCode = 400;
    throw error;
  }
}

async function obterXmlParaPersistir(file) {
  if (path.extname(file.originalname).toLowerCase() !== '.zip') {
    const conteudo = await fs.promises.readFile(file.path, 'utf8');
    validarConteudoXml(conteudo, nomeOriginalXml(file));
    return { caminho: file.path, nomeXml: file.originalname, conteudo };
  }

  let zip;

  try {
    zip = new AdmZip(file.path);
  } catch {
    const error = new Error(`${file.originalname} não é um arquivo ZIP válido.`);
    error.statusCode = 400;
    throw error;
  }

  const entradas = zip.getEntries();

  if (entradas.length > MAX_ENTRADAS_ZIP) {
    const error = new Error(
      `${file.originalname} contém arquivos demais para processar.`
    );
    error.statusCode = 400;
    throw error;
  }

  const candidatos = entradas
    .filter(
      (entrada) =>
        !entrada.isDirectory &&
        path.extname(entrada.entryName).toLowerCase() === '.xml'
    )
    .sort((a, b) => a.entryName.localeCompare(b.entryName));
  const validos = [];

  for (const entrada of candidatos) {
    const tamanho = Number(entrada.header?.size);

    if (!Number.isFinite(tamanho) || tamanho > MAX_XML_DESCOMPACTADO) {
      continue;
    }

    const conteudo = entrada.getData().toString('utf8');

    try {
      validarConteudoXml(conteudo, path.basename(entrada.entryName));
      validos.push({ entrada, conteudo });
    } catch (error) {
      if (error?.statusCode !== 400) throw error;
    }
  }

  if (validos.length === 0) {
    const error = new Error(
      `${file.originalname} não contém um XML de NF-e válido.`
    );
    error.statusCode = 400;
    throw error;
  }

  if (validos.length > 1) {
    const error = new Error(
      `${file.originalname} contém mais de um XML de NF-e. Envie um ZIP por venda.`
    );
    error.statusCode = 400;
    throw error;
  }

  const escolhido = validos[0];
  const caminhoXml = path.join(
    DIRETORIO_TEMP,
    `${crypto.randomUUID()}.xml`
  );
  await fs.promises.writeFile(caminhoXml, escolhido.conteudo, {
    encoding: 'utf8',
    flag: 'wx'
  });

  return {
    caminho: caminhoXml,
    nomeXml: path.basename(escolhido.entrada.entryName),
    conteudo: escolhido.conteudo
  };
}

export async function prepararXmlNfe(file) {
  const xmlExtraido = await obterXmlParaPersistir(file);

  try {
    return {
      ...xmlExtraido,
      filePath: file.path,
      destinatario: extrairDestinatarioXml(xmlExtraido.conteudo),
      itens: extrairItensXml(xmlExtraido.conteudo)
    };
  } catch (error) {
    if (xmlExtraido.caminho !== file.path) {
      await fs.promises.unlink(xmlExtraido.caminho).catch(() => {});
    }

    throw error;
  }
}

export async function limparPreparacaoXmlNfe(xmlExtraido) {
  if (
    xmlExtraido?.caminho &&
    xmlExtraido.caminho !== xmlExtraido.filePath
  ) {
    await fs.promises.unlink(xmlExtraido.caminho).catch(() => {});
  }
}

export async function persistirXmlNfe(file, preparado = null) {
  const xmlExtraido = preparado || await prepararXmlNfe(file);

  const nomeArmazenado = `${crypto.randomUUID()}.xml`;
  const caminhoFinal = path.join(DIRETORIO_XML, nomeArmazenado);

  try {
    await fs.promises.rename(xmlExtraido.caminho, caminhoFinal);
  } catch (error) {
    if (xmlExtraido.caminho !== file.path) {
      await fs.promises.unlink(xmlExtraido.caminho).catch(() => {});
    }
    throw error;
  }

  return {
    arquivo: nomeArmazenado,
    nome: nomeOriginalXml({
      ...file,
      nomeXml: xmlExtraido.nomeXml
    }),
    caminho: caminhoFinal
  };
}

export function caminhoXmlNfe(nomeArmazenado) {
  if (!/^[\da-f-]{36}\.xml$/i.test(String(nomeArmazenado || ''))) {
    return null;
  }

  return path.join(DIRETORIO_XML, nomeArmazenado);
}

export async function removerArquivoXmlNfe(nomeArmazenado) {
  const caminho = caminhoXmlNfe(nomeArmazenado);

  if (caminho) {
    await fs.promises.unlink(caminho).catch(() => {});
  }
}

export async function limparUploadsTemporarios(files = []) {
  await Promise.all(
    files.map((file) =>
      fs.promises.unlink(file.path).catch(() => {})
    )
  );
}

export function mensagemErroUploadXml(error) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return 'Cada arquivo XML ou ZIP deve ter no máximo 20 MB.';
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return `Envie no máximo ${MAX_ARQUIVOS} XMLs por lote.`;
    }
  }

  return error instanceof Error ? error.message : 'Erro ao enviar o XML.';
}
