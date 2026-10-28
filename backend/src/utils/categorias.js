const CATEGORIAS_ML = {
  Retrovisores:
    'Autopeças > Peças de Carros e Caminhonetes > Retrovisores',
  'Faróis e Lanternas':
    'Autopeças > Peças de Carros e Caminhonetes > Faróis e Lanternas',
  Parachoques:
    'Autopeças > Peças de Carros e Caminhonetes > Parachoques',
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
  const texto = normalizarTexto(`${nome} ${descricao} ${carro}`);

  if (!texto) return 'Outros';

  for (const regra of REGRAS_CATEGORIA) {
    if (regra.termos.some((termo) => texto.includes(normalizarTexto(termo)))) {
      return regra.categoria;
    }
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
