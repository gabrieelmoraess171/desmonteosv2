export type TipoAtributoMl = 'texto' | 'lista' | 'numero' | 'unidade';

export interface CampoMl {
  id: string;
  name: string;
  value_type?: string;
  value_max_length?: number;
  tags?: Record<string, boolean>;
  values?: Array<{ id: string; name: string }>;
  allowed_units?: Array<{ id: string; name: string }>;
}

/** Opções já traduzidas para a categoria, quando a ficha do ML as devolve. */
interface CampoComResolver extends CampoMl {
  valoresResolvidos?: Array<{ id: string; name: string }>;
}

export interface FichaMlCarregada {
  categoria: {
    id: string;
    name: string;
    path_from_root?: Array<{ id: string; name: string }>;
    children_categories?: Array<{ id: string; name: string }>;
    settings?: { max_pictures_per_item?: number; max_title_length?: number };
  };
  atributos: CampoMl[];
  termos: CampoMl[];
  restricoes?: {
    attributes_values?: Array<{
      attribute_id: string;
      values?: Array<{ value_id: string; value_name: string }>;
    }>;
  } | null;
}

export interface FonteAtributo {
  ml_titulo: string;
  nome: string;
  sku: string;
  marca: string;
  modelo: string;
  ano: string;
  condicao: string;
  numero_oem: string;
  garantia: string;
  carro: string;
  atributos: Record<string, string>;
}

function semAcento(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizarCondicao(condicao: string): 'novo' | 'usado' | 'recondicionado' {
  const limpo = semAcento(condicao);
  if (limpo.startsWith('novo')) return 'novo';
  if (limpo.startsWith('recondicion')) return 'recondicionado';
  return 'usado';
}

/**
 * Valores equivalentes que o operador costuma digitar para cada id oficial.
 * O casamento é por `semAcento` e por igualdade; devolve o `name` exato da
 * categoria, que é o que o backend espera em `value_name`.
 */
const ALIASES: Record<string, Record<string, string[]>> = {
  POSITION: {
    Direita: ['direita', 'direito', 'lado direito', 'right'],
    Esquerda: ['esquerda', 'esquerdo', 'lado esquerdo', 'left'],
    'Dianteira Direita': ['dianteira direita', 'frontal direita', 'front right'],
    'Dianteira Esquerda': ['dianteira esquerda', 'frontal esquerda', 'front left'],
    'Traseira Direita': ['traseira direita', 'rear right'],
    'Traseira Esquerda': ['traseira esquerda', 'rear left'],
  },
  ITEM_CONDITION: {
    Novo: ['novo', 'new'],
    Usado: ['usado', 'used'],
    Recondicionado: ['recondicionado', 'refurbished'],
  },
  PART_TYPE: {
    Original: ['original', 'oem'],
    'Genérica': ['generica', 'genérica', 'paralela'],
    Recondicionado: ['recondicionado', 'refurbished'],
  },
};

const ORIGEM_ATRIBUTO: Array<{ id: string; origem: keyof FonteAtributo }> = [
  { id: 'BRAND', origem: 'marca' },
  { id: 'CAR_AND_VAN_BRAND', origem: 'marca' },
  { id: 'VEHICLE_BRAND', origem: 'marca' },
  { id: 'CAR_AND_VAN_MODEL', origem: 'modelo' },
  { id: 'MODEL', origem: 'modelo' },
  { id: 'VEHICLE_MODEL', origem: 'modelo' },
  { id: 'YEAR', origem: 'ano' },
  { id: 'OEM', origem: 'numero_oem' },
  { id: 'PART_NUMBER', origem: 'numero_oem' },
  { id: 'SELLER_SKU', origem: 'sku' },
  { id: 'ALPHANUMERIC_MODEL', origem: 'numero_oem' },
];

function resolverValor(campo: CampoComResolver, bruto: string): string {
  const valor = String(bruto || '').trim();
  if (!valor) return '';
  if (!campo.values?.length) return valor;

  const opcoes = campo.valoresResolvidos ?? campo.values;
  const alvo = semAcento(valor);

  const direto = opcoes.find((opcao) => semAcento(opcao.name) === alvo);
  if (direto) return direto.name;

  const aliases = ALIASES[campo.id] || {};
  for (const [nome, sinonimos] of Object.entries(aliases)) {
    const opcao = opcoes.find((item) => semAcento(item.name) === semAcento(nome));
    if (opcao && sinonimos.some((sinonimo) => semAcento(sinonimo) === alvo)) {
      return opcao.name;
    }
  }

  const contem = opcoes.find((opcao) => semAcento(valor).includes(semAcento(opcao.name)));
  return contem ? contem.name : valor;
}

/**
 * Converte os campos base do formulário nos ids oficiais do Mercado Livre.
 * Só devolve valores para atributos que existem na ficha da categoria, para
 * não enviar ids inventados. O que o operador já digitou nunca é sobrescrito.
 */
export function derivarAtributosMl(
  fonte: FonteAtributo,
  ficha: FichaMlCarregada | null
): Record<string, string> {
  if (!ficha) return {};

  const resultado: Record<string, string> = {};
  const existentes = new Map(ficha.atributos.map((campo) => [campo.id, campo]));
  const condicao = normalizarCondicao(fonte.condicao);

  const preencher = (id: string, bruto: string) => {
    const campo = existentes.get(id) as CampoComResolver | undefined;
    if (!campo || !bruto) return;
    const jaPreenchido = String(fonte.atributos[id] || '').trim();
    if (jaPreenchido) return;
    const valor = resolverValor(campo, bruto);
    if (valor) resultado[id] = valor;
  };

  for (const item of ORIGEM_ATRIBUTO) {
    preencher(item.id, String(fonte[item.origem] || ''));
  }

  const textoLado = [fonte.atributos.lado, fonte.carro, fonte.nome]
    .filter(Boolean)
    .join(' ');
  if (textoLado) {
    for (const id of ['POSITION', 'SIDE']) {
      if (!existentes.has(id)) continue;
      const achado = /direit|right/i.test(textoLado)
        ? 'Direita'
        : /esquerd|left/i.test(textoLado)
          ? 'Esquerda'
          : '';
      if (achado) preencher(id, achado);
    }
  }

  if (condicao === 'novo') preencher('ITEM_CONDITION', 'Novo');
  else if (condicao === 'recondicionado') preencher('ITEM_CONDITION', 'Recondicionado');
  else preencher('ITEM_CONDITION', 'Usado');

  const garantia = String(fonte.garantia || '').trim();
  if (garantia && !/^sem\s+garantia$/i.test(garantia)) {
    preencher('WARRANTY_TIME', garantia);
  }

  return resultado;
}
