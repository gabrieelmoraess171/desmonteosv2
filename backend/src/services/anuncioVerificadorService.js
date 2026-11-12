import fs from 'node:fs/promises';
import path from 'node:path';
import { PECAS_DIR } from './pecaImagensService.js';
import { extrairJson, gerarVisaoComIa } from './iaService.js';

const UPLOADS_ROOT = path.resolve(PECAS_DIR, '..');

function texto(valor, limite = 500) {
  return String(valor ?? '').trim().slice(0, limite);
}

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

async function lerImagem(caminho, nome) {
  const relativo = String(caminho || '').replace(/^\/+/, '').replace(/^uploads\//i, '');
  const absoluto = path.resolve(UPLOADS_ROOT, relativo);
  if (!absoluto.startsWith(`${UPLOADS_ROOT}${path.sep}`)) return null;
  try {
    const buffer = await fs.readFile(absoluto);
    const ext = path.extname(absoluto).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { nome: nome || path.basename(absoluto), mime, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
  } catch {
    return null;
  }
}

function verificarCampos(peca, imagens) {
  const problemas = [];
  const avisos = [];
  const titulo = texto(peca.ml_titulo || peca.nome, 200);
  if (!titulo) problemas.push({ campo: 'titulo', mensagem: 'Título do anúncio não informado.' });
  if (titulo.length > 60) problemas.push({ campo: 'titulo', mensagem: 'O título ultrapassa 60 caracteres.' });
  if (!texto(peca.sku)) problemas.push({ campo: 'sku', mensagem: 'SKU não informado.' });
  if (!texto(peca.categoria)) problemas.push({ campo: 'categoria', mensagem: 'Categoria não informada.' });
  if (!texto(peca.descricao)) problemas.push({ campo: 'descricao', mensagem: 'Descrição não informada.' });
  if (numero(peca.preco) <= 0) problemas.push({ campo: 'preco', mensagem: 'Preço inválido ou não informado.' });
  if (numero(peca.quantidade) < 0) problemas.push({ campo: 'quantidade', mensagem: 'Quantidade inválida.' });
  if (numero(peca.peso_kg) <= 0) avisos.push({ campo: 'peso_kg', mensagem: 'Peso não confirmado.' });
  if (numero(peca.comprimento_cm) <= 0 || numero(peca.largura_cm) <= 0 || numero(peca.altura_cm) <= 0) {
    avisos.push({ campo: 'medidas', mensagem: 'Confira comprimento, largura e altura.' });
  }
  if (imagens.length === 0) problemas.push({ campo: 'fotos', mensagem: 'Nenhuma foto do produto disponível.' });
  return { problemas, avisos };
}

export async function verificarAnuncioComAgente({ peca, imagens = [] } = {}) {
  const base = verificarCampos(peca || {}, imagens);
  let leitura = null;

  if (imagens.length > 0) {
    const prompt = [
      'Você é o agente revisor final de anúncios de autopeças.',
      'Sua única função é comparar as fotos reais com os dados do anúncio e apontar conflitos.',
      'Não preencha dados por palpite. Não altere a ficha. Verifique visualmente tipo de peça, fabricante, modelo, lado, código OEM, SKU, medidas, peso e compatibilidade.',
      'Fotos [SKU], [MEDIDAS] e [CODIGO] são técnicas e não devem ser consideradas fotos publicáveis do produto.',
      'Responda somente JSON: {"aprovado":true,"confianca":"alta|media|baixa","problemas":[{"campo":"","mensagem":""}],"avisos":[{"campo":"","mensagem":""}],"confirmados":[""],"observacao":""}.',
      `Dados do anúncio: ${JSON.stringify({ nome: peca.nome, titulo: peca.ml_titulo, sku: peca.sku, marca: peca.marca, modelo: peca.modelo, ano: peca.ano, carro: peca.carro, categoria: peca.categoria, numero_oem: peca.numero_oem, peso_kg: peca.peso_kg, comprimento_cm: peca.comprimento_cm, largura_cm: peca.largura_cm, altura_cm: peca.altura_cm })}`,
      `Nomes e grupos das fotos: ${imagens.map((imagem) => imagem.nome).join(', ')}`
    ].join('\n');
    try {
      const resposta = await gerarVisaoComIa(prompt, imagens, { modelo: 'gemini-2.5-flash', googleSearch: true, googleSearchOnly: true, maxTokens: 1800, timeoutMs: 120000 });
      leitura = extrairJson(resposta?.texto || '');
    } catch {
      base.avisos.push({ campo: 'ia', mensagem: 'A verificação visual automática não respondeu.' });
    }
  }

  const problemas = [...base.problemas, ...(Array.isArray(leitura?.problemas) ? leitura.problemas : [])];
  const avisos = [...base.avisos, ...(Array.isArray(leitura?.avisos) ? leitura.avisos : [])];
  return {
    agente: 'verificador-de-anuncio',
    aprovado: problemas.length === 0 && leitura?.aprovado !== false,
    confianca: texto(leitura?.confianca || 'media', 20),
    problemas,
    avisos,
    confirmados: Array.isArray(leitura?.confirmados) ? leitura.confirmados : [],
    observacao: texto(leitura?.observacao, 600) || 'Revise os pontos indicados antes de publicar.'
  };
}

