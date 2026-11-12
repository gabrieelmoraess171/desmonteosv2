const CATEGORIAS_ML = {
  Retrovisores:
    'Autopeças > Peças de Carros e Caminhonetes > Retrovisores',
  'Faróis e Lanternas':
    'Autopeças > Peças de Carros e Caminhonetes > Faróis e Lanternas',
  Parachoques:
    'Autopeças > Peças de Carros e Caminhonetes > Parachoques',
  'Almas e Absorvedores de Impacto':
    'Autopeças > Peças de Carros e Caminhonetes > Parachoques',
  'Acabamentos e Molduras':
    'Autopeças > Peças de Carros e Caminhonetes > Interior',
  'Maçanetas e Fechaduras':
    'Autopeças > Peças de Carros e Caminhonetes > Portas e Capôs',
  'Portas e Capôs':
    'Autopeças > Peças de Carros e Caminhonetes > Portas e Capôs',
  'Motor e Componentes':
    'Autopeças > Peças de Carros e Caminhonetes > Motor e Componentes',
  'Suspensão e Direção':
    'Autopeças > Peças de Carros e Caminhonetes > Suspensão e Direção',
  Freios: 'Autopeças > Peças de Carros e Caminhonetes > Freios',
  'Rodas e Pneus':
    'Autopeças > Peças de Carros e Caminhonetes > Rodas e Pneus',
  'Radiadores e Arrefecimento':
    'Autopeças > Peças de Carros e Caminhonetes > Radiadores e Arrefecimento',
  'Elétrica':
    'Autopeças > Peças de Carros e Caminhonetes > Elétrica',
  Interior: 'Autopeças > Peças de Carros e Caminhonetes > Interior',
  Vidros: 'Autopeças > Peças de Carros e Caminhonetes > Vidros',
  Escapamento:
    'Autopeças > Peças de Carros e Caminhonetes > Escapamento',
  Transmissão:
    'Autopeças > Peças de Carros e Caminhonetes > Transmissão',
  Baterias: 'Autopeças > Peças de Carros e Caminhonetes > Baterias',
  Outros: 'Autopeças > Peças de Carros e Caminhonetes > Outros'
};

// A ordem importa: termos mais específicos vêm antes dos genéricos.
const REGRAS_CATEGORIA = [
  { categoria: 'Almas e Absorvedores de Impacto', termos: ['absorvedor de impacto', 'absorvedor impacto', 'absorvedor imapcto', 'absorvedor de imapcto', 'absorvedores de impacto', 'alma', 'almas', 'reforco de parachoque', 'reforco parachoque', 'travessa de parachoque', 'travessa parachoque'] },
  { categoria: 'Maçanetas e Fechaduras', termos: ['macaneta', 'macanetas', 'fechadura', 'fechaduras', 'trinco'] },
  { categoria: 'Acabamentos e Molduras', termos: ['acabamento', 'acabamentos', 'moldura', 'molduras', 'friso', 'frisos', 'emblema'] },
  { categoria: 'Interior', termos: ['tampao', 'tampoes', 'carpete', 'carpetes', 'alavanca de cambio'] },
  {
    categoria: 'Retrovisores',
    termos: ['retrovisor', 'espelho retrovisor', 'espelho lateral']
  },
  {
    categoria: 'Faróis e Lanternas',
    termos: ['farol', 'lanterna', 'milha', 'neblina', 'pisca', 'seta', 'xenon', 'bi-led']
  },
  {
    categoria: 'Parachoques',
    termos: ['parachoque', 'para-choque', 'para choque']
  },
  {
    categoria: 'Portas e Capôs',
    termos: ['porta', 'capo', 'capô', 'tampa', 'aleta', 'para-lama', 'paralama', 'grade']
  },
  {
    categoria: 'Elétrica',
    termos: [
      'alternador',
      'motor de partida',
      'bobina',
      'sensor',
      'modulo',
      'módulo',
      'chicote',
      'fusivel',
      'fusível',
      'lampada',
      'lâmpada',
      'rele',
      'relé'
    ]
  },
  {
    categoria: 'Motor e Componentes',
    termos: [
      'motor',
      'biela',
      'pistao',
      'pistão',
      'virabrequim',
      'cabecote',
      'cabeçote',
      'valvula',
      'válvula',
      'turbo',
      'injecao',
      'injeção',
      'correia',
      'tensor',
      'bomba de oleo',
      'bomba de óleo'
    ]
  },
  {
    categoria: 'Suspensão e Direção',
    termos: [
      'suspensao',
      'suspensão',
      'amortecedor',
      'mola',
      'bieleta',
      'pivo',
      'pivô',
      'bandeja',
      'direcao',
      'direção',
      'caixa de direcao'
    ]
  },
  {
    categoria: 'Freios',
    termos: ['freio', 'pastilha', 'disco', 'pinca', 'pinça', 'abs', 'cilindro de roda']
  },
  {
    categoria: 'Rodas e Pneus',
    termos: ['roda', 'pneu', 'aro', 'calota']
  },
  {
    categoria: 'Radiadores e Arrefecimento',
    termos: [
      'radiador',
      'reservatorio',
      'reservatório',
      'ventoinha',
      'bomba d agua',
      'bomba d água',
      'arrefecimento',
      'condensador'
    ]
  },
  {
    categoria: 'Interior',
    termos: ['banco', 'painel', 'volante', 'console', 'forro', 'tapete', 'macaco']
  },
  {
    categoria: 'Vidros',
    termos: ['vidro', 'parabrisa', 'para-brisa', 'para brisa']
  },
  {
    categoria: 'Escapamento',
    termos: ['escapamento', 'silencioso', 'catalisador', 'cano de descarga']
  },
  {
    categoria: 'Transmissão',
    termos: [
      'cambio',
      'câmbio',
      'transmissao',
      'transmissão',
      'embreagem',
      'diferencial',
      'cardan'
    ]
  },
  {
    categoria: 'Baterias',
    termos: ['bateria']
  }
];

export const CATEGORIAS_PECA = Object.keys(CATEGORIAS_ML);

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function categoriaValida(valor) {
  return CATEGORIAS_PECA.includes(String(valor || '').trim());
}

export function classificarCategoria(nome, descricao = '', carro = '') {
  // O nome da peça define a categoria; descrição e veículo não podem
  // transformar um absorvedor em porta ou um módulo em motor.
  const titulo = normalizarTexto(nome || descricao)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(?:(?:kit|jogo|par|conjunto)\s+(?:de\s+)?)|^(?:original\s+)/, '')
    .trim();
  if (!titulo) return 'Outros';
  for (const regra of REGRAS_CATEGORIA) {
    if (regra.termos.some((termo) => {
      const prefixo = normalizarTexto(termo).replace(/[^a-z0-9]+/g, ' ');
      return titulo === prefixo || titulo.startsWith(prefixo + ' ');
    })) return regra.categoria;
  }

  return 'Outros';
}

export function normalizarCategoria(valor, nome = '', descricao = '', carro = '') {
  const categoria = String(valor || '').trim();

  if (categoriaValida(categoria)) return categoria;

  return classificarCategoria(nome, descricao, carro);
}

export function sugerirCategoriaMl(categoria) {
  return CATEGORIAS_ML[categoria] || CATEGORIAS_ML.Outros;
}
