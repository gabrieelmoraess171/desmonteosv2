import { classificarCategoria } from '../utils/categorias.js';

export function lerObjeto(valor) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor;
  try { const parsed = JSON.parse(String(valor || '{}')); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}

const texto = (valor) => String(valor ?? '').replace(/\s+/g, ' ').trim();
const valido = (valor) => valor && !/^(?:n[aã]o informad[oa]|n[aã]o aplic[aá]vel|n\/?a|sem aplica[cç][aã]o|universal|-|original)$/i.test(valor);

function atributosDe(item, peca) {
  const resultado = { ...lerObjeto(peca?.atributos) };
  for (const fonte of [item?.attributes, item?.atributos]) {
    if (Array.isArray(fonte)) {
      for (const atributo of fonte) {
        if (atributo?.id) resultado[String(atributo.id).toUpperCase()] = atributo.value_name || atributo.values?.map((value) => value.name).filter(Boolean).join(', ') || '';
      }
    } else Object.assign(resultado, lerObjeto(fonte));
  }
  return resultado;
}

function valorAtributo(atributos, ids) {
  for (const id of ids) {
    const valor = atributos[id];
    const nome = texto(valor && typeof valor === 'object' ? valor.value_name || valor.name : valor);
    if (valido(nome)) return nome;
  }
  return '';
}

function normalizarData(valor) {
  if (!valor || !/^\d{4}-\d\d-\d\d[T ]/.test(String(valor))) return null;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) ? data.toISOString() : null;
}

export function dataPublicacaoMl(item = {}, peca = {}) {
  // created_at é a importação local e jamais representa a publicação do ML.
  return normalizarData(item.date_created) || normalizarData(item.start_time) || normalizarData(peca.ml_publicado_em);
}

const MARCAS_VEICULO = /\b(?:alfa romeo|aston martin|land rover|mercedes(?:[ -]benz)?|volkswagen|chevrolet|mitsubishi|citro[eë]n|peugeot|renault|hyundai|toyota|nissan|suzuki|subaru|jaguar|porsche|chery|troller|honda|fiat|ford|jeep|volvo|audi|bmw|kia|dodge|ram)\b/i;

function aplicacaoTitulo(titulo) {
  const nome = texto(titulo);
  const marca = nome.match(MARCAS_VEICULO);
  return marca ? nome.slice(marca.index).slice(0, 300) : '';
}

function compatibilidadesDe(item) {
  const info = item.compatibilidades_info || item.compatibilities || {};
  if (Array.isArray(item.compatibilidades)) return item.compatibilidades;
  return info.products || info.products_families || info.compatibilities || [];
}

function resumoCompatibilidades(item) {
  const descricoes = [];
  for (const compatibilidade of compatibilidadesDe(item)) {
    if (!compatibilidade || typeof compatibilidade !== 'object') continue;
    const atributos = atributosDe(compatibilidade, {});
    const marca = valorAtributo(atributos, ['BRAND', 'CAR_AND_VAN_BRAND', 'VEHICLE_BRAND']);
    const modelo = valorAtributo(atributos, ['MODEL', 'CAR_AND_VAN_MODEL', 'VEHICLE_MODEL']);
    const ano = valorAtributo(atributos, ['YEAR', 'VEHICLE_YEAR', 'CAR_AND_VAN_YEAR']);
    const nome = texto(compatibilidade.catalog_product_name || compatibilidade.name || compatibilidade.product_name || compatibilidade.product?.name);
    if (compatibilidade.source === 'CATALOGO') {
      // Desde julho/2026 o ML pode expor somente marca/total do catálogo.
      if (nome || marca) descricoes.push(`Catálogo ${nome || marca}${Number(compatibilidade.total) > 0 ? ` (${compatibilidade.total} veículos)` : ''}`);
    } else {
      const detalhes = [marca, modelo, ano].filter(Boolean).join(' ');
      if (detalhes && (modelo || ano)) descricoes.push(detalhes);
      else if (nome && valido(nome)) descricoes.push(nome);
    }
  }
  const unicas = [...new Set(descricoes)];
  return unicas.slice(0, 4).join(' • ') + (unicas.length > 4 ? ` • +${unicas.length - 4} aplicações` : '');
}

// Tipos inequívocos permitem reparar categorias legadas sem assumir que uma
// palavra no meio do título define a peça. Tipos ambíguos preservam o cadastro.
const TIPO_INEQUIVOCO = /^(?:absorvedor(?:es)?(?: de)? (?:impactos?|imapcto)|almas?\b|acabamentos?\b|molduras?\b|frisos?\b|emblemas?\b|macanetas?\b|fechaduras?\b|tamp(?:ao|oes)\b|consoles?\b|carpetes?\b|tapetes?\b|forros?\b|bancos?\b|retrovisores?\b|faro(?:l|is)\b|lanternas?\b|para[ -]?choques?\b|amortecedores?\b|alternadores?\b|motor(?:es)? de partida\b|baterias?\b|radiadores?\b|condensadores?\b|vidros?\b|para[ -]?brisas?\b|discos? de freio\b|pastilhas?\b)/;

function categoriaDaPeca(peca, titulo) {
  const atual = texto(peca.categoria);
  if (peca.categoria_origem === 'cadastro') return { categoria: atual || 'Outros', categoria_origem: 'cadastro' };
  const classificada = classificarCategoria(titulo);
  const tipo = texto(titulo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const podeReverLegado = peca.ml_item_id && TIPO_INEQUIVOCO.test(tipo);
  const automatica = classificada !== 'Outros' && (!atual || atual === 'Outros' || peca.categoria_origem === 'nome_ml' || podeReverLegado);
  return {
    categoria: automatica ? classificada : atual || classificada,
    categoria_origem: automatica ? 'nome_ml' : peca.categoria_origem || (!peca.ml_item_id && atual ? 'cadastro' : null),
  };
}

export function metadadosPeca(peca = {}, itemInformado) {
  const item = itemInformado || lerObjeto(peca.ml_dados);
  const atributos = atributosDe(item, peca);
  const carro = texto(peca.carro);
  const marca = valorAtributo(atributos, ['CAR_AND_VAN_BRAND', 'VEHICLE_BRAND', 'VEHICLE_MANUFACTURER']);
  const modelo = valorAtributo(atributos, ['CAR_AND_VAN_MODEL', 'VEHICLE_MODEL']);
  const ano = valorAtributo(atributos, ['CAR_AND_VAN_YEAR', 'VEHICLE_YEAR', 'YEAR']);
  const veiculo = [marca, modelo, ano].filter(Boolean).join(' ');
  const compatibilidades = resumoCompatibilidades(item);
  const titulo = aplicacaoTitulo(item.title || peca.nome || peca.ml_titulo);
  const compatibilidadeDetalhada = compatibilidades && !compatibilidades.split(' • ').every((parte) => parte.startsWith('Catálogo '));
  // BRAND/MODEL genéricos podem ser do fabricante/modelo da peça, não do carro.
  const cadastro = valido(carro) && !['titulo_ml', 'atributos_ml', 'compatibilidades_ml'].includes(peca.aplicacao_origem);
  const aplicacao = cadastro ? carro : (compatibilidadeDetalhada ? compatibilidades : '') || (modelo ? veiculo : '') || titulo || compatibilidades || (valido(carro) ? carro : '');
  const origem = cadastro ? 'cadastro' : compatibilidadeDetalhada ? 'compatibilidades_ml' : modelo ? 'atributos_ml' : titulo ? 'titulo_ml' : compatibilidades ? 'compatibilidades_ml' : peca.aplicacao_origem || null;
  const categoria = categoriaDaPeca(peca, peca.nome || item.title);
  return {
    ...categoria,
    aplicacao: aplicacao || '',
    aplicacao_origem: origem,
    ml_publicado_em: dataPublicacaoMl(item, peca),
  };
}

export function comMetadadosPeca(peca) {
  const metadados = metadadosPeca(peca);
  return { ...peca, ...metadados, carro: metadados.aplicacao };
}

export async function revisarMetadadosLocais(db, { lote = 100, pausaMs = 25 } = {}) {
  let ultimoId = 0;
  let atualizados = 0;
  while (true) {
    const pecas = await db.all(`SELECT id, nome, carro, categoria, atributos, ml_dados, ml_item_id, ml_publicado_em, aplicacao_origem, categoria_origem FROM pecas WHERE id > ? ORDER BY id ASC LIMIT ?`, [ultimoId, lote]);
    if (!pecas.length) break;
    for (const peca of pecas) {
      ultimoId = Math.max(ultimoId, Number(peca.id));
      const metadata = metadadosPeca(peca);
      if (metadata.categoria !== peca.categoria || metadata.categoria_origem !== (peca.categoria_origem || null) || metadata.ml_publicado_em !== (peca.ml_publicado_em || null) || metadata.aplicacao !== texto(peca.carro) || metadata.aplicacao_origem !== (peca.aplicacao_origem || null)) {
        await db.run(`UPDATE pecas SET categoria = ?, categoria_origem = ?, carro = ?, aplicacao_origem = ?, ml_publicado_em = COALESCE(?, ml_publicado_em) WHERE id = ?`, [metadata.categoria, metadata.categoria_origem, metadata.aplicacao, metadata.aplicacao_origem, metadata.ml_publicado_em, peca.id]);
        atualizados += 1;
      }
    }
    if (pausaMs > 0) await new Promise((resolve) => setTimeout(resolve, pausaMs));
  }
  return { atualizados };
}
