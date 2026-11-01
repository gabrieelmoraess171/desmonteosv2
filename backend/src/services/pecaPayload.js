import { normalizarCategoria, sugerirCategoriaMl } from '../utils/categorias.js';

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
  if (!valor) return '{}';
  try {
    const objeto = typeof valor === 'string' ? JSON.parse(valor) : valor;
    if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) throw new Error();
    const json = JSON.stringify(objeto);
    if (json.length > 30000) throw new Error();
    return json;
  } catch {
    throw new Error('A ficha técnica deve conter atributos válidos e ter até 30 mil caracteres.');
  }
}

export function montarPayloadPeca(body = {}, atual = {}) {
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
    ml_category_id: texto(body.ml_category_id ?? atual.ml_category_id, 80),
    ml_config: (() => {
      const bruto = body.ml_config ?? atual.ml_config ?? '{}';
      const config = typeof bruto === 'string' ? JSON.parse(bruto) : bruto;
      if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Configuração do anúncio inválida.');
      if (Object.keys(atual).length === 0) {
        config.shipping = { mode: 'not_specified', free_shipping: false, local_pick_up: false, ...(config.shipping || {}) };
        config.sale_terms = { WARRANTY_TYPE: 'Sem garantia', ...(config.sale_terms || {}) };
      }
      const json = JSON.stringify(config);
      if (json.length > 30000) throw new Error('Configuração do anúncio excede o limite de tamanho.');
      return json;
    })(),
    marca: texto(body.marca ?? atual.marca, 120),
    modelo: texto(body.modelo ?? atual.modelo, 120),
    ano: texto(body.ano ?? atual.ano, 40),
    condicao: texto(body.condicao ?? atual.condicao ?? 'usado', 40),
    numero_oem: texto(body.numero_oem ?? atual.numero_oem, 120),
    garantia: texto(body.garantia ?? atual.garantia ?? 'Sem garantia', 200),
    peso_kg: numero(body.peso_kg ?? atual.peso_kg),
    comprimento_cm: numero(body.comprimento_cm ?? atual.comprimento_cm),
    largura_cm: numero(body.largura_cm ?? atual.largura_cm),
    altura_cm: numero(body.altura_cm ?? atual.altura_cm),
    atributos: parseAtributos(body.atributos ?? atual.atributos),
    ml_titulo:
      texto(body.ml_titulo ?? atual.ml_titulo, 60) || nome.slice(0, 60),
    tipo_anuncio: texto(body.tipo_anuncio ?? atual.tipo_anuncio ?? 'premium', 60),
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


// Um formulário que reenvia a categoria intacta não converte uma classificação
// automática legada em escolha manual. Pausar/reativar nunca muda a origem.
export function origensAposEdicao(body = {}, atual = {}, payload = {}) {
  return {
    categoria_origem: body.categoria !== undefined && payload.categoria !== atual.categoria ? 'cadastro' : atual.categoria_origem || null,
    aplicacao_origem: body.carro !== undefined && payload.carro !== atual.carro ? 'cadastro' : atual.aplicacao_origem || null,
  };
}
