export interface CampoCatalogo {
  key: string;
  label: string;
  tipo?: 'text' | 'select';
  opcoes?: string[];
  placeholder?: string;
}

export const CATEGORIAS_PECA = [
  'Retrovisores',
  'Faróis e Lanternas',
  'Parachoques',
  'Portas e Capôs',
  'Motor e Componentes',
  'Suspensão e Direção',
  'Freios',
  'Rodas e Pneus',
  'Radiadores e Arrefecimento',
  'Elétrica',
  'Interior',
  'Vidros',
  'Escapamento',
  'Transmissão',
  'Baterias',
  'Outros',
] as const;

export type CategoriaPeca = (typeof CATEGORIAS_PECA)[number];

export const CATEGORIA_ML: Record<string, string> = {
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
  Elétrica: 'Autopeças > Peças de Carros e Caminhonetes > Elétrica',
  Interior: 'Autopeças > Peças de Carros e Caminhonetes > Interior',
  Vidros: 'Autopeças > Peças de Carros e Caminhonetes > Vidros',
  Escapamento:
    'Autopeças > Peças de Carros e Caminhonetes > Escapamento',
  Transmissão:
    'Autopeças > Peças de Carros e Caminhonetes > Transmissão',
  Baterias: 'Autopeças > Peças de Carros e Caminhonetes > Baterias',
  Outros: 'Autopeças > Peças de Carros e Caminhonetes > Outros',
};

const LADOS = ['Esquerdo', 'Direito', 'Par'];

export const CAMPOS_CATEGORIA: Record<string, CampoCatalogo[]> = {
  Retrovisores: [
    { key: 'lado', label: 'Lado', tipo: 'select', opcoes: LADOS },
    {
      key: 'acionamento',
      label: 'Acionamento',
      tipo: 'select',
      opcoes: ['Elétrico', 'Manual'],
    },
    {
      key: 'cor',
      label: 'Cor',
      tipo: 'select',
      opcoes: ['Preta', 'Branca', 'Cromada', 'Com pintura', 'Outra'],
    },
    {
      key: 'aquecimento',
      label: 'Aquecimento',
      tipo: 'select',
      opcoes: ['Sim', 'Não'],
    },
  ],
  'Faróis e Lanternas': [
    { key: 'lado', label: 'Lado', tipo: 'select', opcoes: LADOS },
    {
      key: 'tipo_lampada',
      label: 'Tipo de lâmpada',
      tipo: 'select',
      opcoes: ['H4', 'H7', 'H11', 'LED', 'Xenon', 'Outra'],
    },
    {
      key: 'lente',
      label: 'Tipo de lente',
      tipo: 'select',
      opcoes: ['Cristal', 'Plástica', 'Original'],
    },
    {
      key: 'regulagem',
      label: 'Regulagem',
      tipo: 'select',
      opcoes: ['Elétrica', 'Manual'],
    },
  ],
  Parachoques: [
    {
      key: 'posicao',
      label: 'Posição',
      tipo: 'select',
      opcoes: ['Dianteiro', 'Traseiro'],
    },
    {
      key: 'cor',
      label: 'Cor',
      tipo: 'select',
      opcoes: ['Preta', 'Branca', 'Prata', 'Com pintura', 'Outra'],
    },
    {
      key: 'sensores',
      label: 'Sensores de estacionamento',
      tipo: 'select',
      opcoes: ['Sim', 'Não'],
    },
    {
      key: 'farol_milha',
      label: 'Suporte para farol de milha',
      tipo: 'select',
      opcoes: ['Sim', 'Não'],
    },
  ],
  'Portas e Capôs': [
    {
      key: 'posicao',
      label: 'Posição',
      tipo: 'select',
      opcoes: [
        'Dianteira esquerda',
        'Dianteira direita',
        'Traseira esquerda',
        'Traseira direita',
        'Capô',
        'Tampa traseira',
      ],
    },
    {
      key: 'cor',
      label: 'Cor',
      tipo: 'select',
      opcoes: ['Preta', 'Branca', 'Prata', 'Com pintura', 'Outra'],
    },
    {
      key: 'vidro',
      label: 'Vidro incluso',
      tipo: 'select',
      opcoes: ['Sim', 'Não'],
    },
    {
      key: 'macaneta',
      label: 'Maçaneta inclusa',
      tipo: 'select',
      opcoes: ['Sim', 'Não'],
    },
  ],
  'Motor e Componentes': [
    {
      key: 'combustivel',
      label: 'Combustível',
      tipo: 'select',
      opcoes: ['Flex', 'Gasolina', 'Diesel', 'GNV', 'Elétrico'],
    },
    {
      key: 'cilindrada',
      label: 'Cilindrada',
      placeholder: 'Ex: 1.0, 1.6, 2.0',
    },
    {
      key: 'cambio',
      label: 'Câmbio',
      tipo: 'select',
      opcoes: ['Manual', 'Automático', 'Automatizado', 'CVT'],
    },
    {
      key: 'numero_cilindros',
      label: 'Número de cilindros',
      tipo: 'select',
      opcoes: ['3', '4', '5', '6', '8'],
    },
  ],
  'Suspensão e Direção': [
    {
      key: 'posicao',
      label: 'Posição',
      tipo: 'select',
      opcoes: ['Dianteira', 'Traseira', 'Dianteira esquerda', 'Dianteira direita'],
    },
    {
      key: 'tipo',
      label: 'Tipo',
      tipo: 'select',
      opcoes: ['Amortecedor', 'Mola', 'Bandeja', 'Bieleta', 'Pivô', 'Caixa de direção', 'Outro'],
    },
    { key: 'lado', label: 'Lado', tipo: 'select', opcoes: LADOS },
  ],
  Freios: [
    {
      key: 'posicao',
      label: 'Posição',
      tipo: 'select',
      opcoes: ['Dianteiro', 'Traseiro'],
    },
    {
      key: 'tipo',
      label: 'Componente',
      tipo: 'select',
      opcoes: ['Pastilha', 'Disco', 'Pinça', 'Cilindro', 'ABS', 'Outro'],
    },
    { key: 'diametro', label: 'Diâmetro / medida', placeholder: 'Ex: 280 mm' },
  ],
  'Rodas e Pneus': [
    { key: 'medida', label: 'Medida', placeholder: 'Ex: 185/65 R15' },
    { key: 'aro', label: 'Aro', placeholder: 'Ex: 15' },
    {
      key: 'material',
      label: 'Material da roda',
      tipo: 'select',
      opcoes: ['Liga leve', 'Aço', 'Alumínio', 'Ferro'],
    },
    {
      key: 'pneu_incluso',
      label: 'Pneu incluso',
      tipo: 'select',
      opcoes: ['Sim', 'Não'],
    },
  ],
  'Radiadores e Arrefecimento': [
    {
      key: 'material',
      label: 'Material',
      tipo: 'select',
      opcoes: ['Alumínio', 'Plástico', 'Cobre', 'Misto'],
    },
    {
      key: 'transmissao',
      label: 'Transmissão',
      tipo: 'select',
      opcoes: ['Manual', 'Automático'],
    },
    {
      key: 'ventoinha',
      label: 'Ventoinha inclusa',
      tipo: 'select',
      opcoes: ['Sim', 'Não'],
    },
  ],
  Elétrica: [
    {
      key: 'tipo',
      label: 'Tipo',
      tipo: 'select',
      opcoes: ['Alternador', 'Motor de partida', 'Sensor', 'Módulo', 'Chicote', 'Relé', 'Outro'],
    },
    { key: 'tensao', label: 'Tensão', placeholder: 'Ex: 12V' },
    { key: 'conectores', label: 'Conectores / pinagem', placeholder: 'Ex: 4 pinos' },
  ],
  Interior: [
    {
      key: 'posicao',
      label: 'Posição',
      tipo: 'select',
      opcoes: ['Dianteira', 'Traseira', 'Esquerda', 'Direita', 'Central'],
    },
    {
      key: 'cor',
      label: 'Cor',
      tipo: 'select',
      opcoes: ['Preta', 'Cinza', 'Bege', 'Marrom', 'Outra'],
    },
    {
      key: 'material',
      label: 'Material',
      tipo: 'select',
      opcoes: ['Tecido', 'Couro', 'Vinil', 'Plástico', 'Misto'],
    },
  ],
  Vidros: [
    {
      key: 'posicao',
      label: 'Posição',
      tipo: 'select',
      opcoes: [
        'Para-brisa',
        'Vidro dianteiro esquerdo',
        'Vidro dianteiro direito',
        'Vidro traseiro esquerdo',
        'Vidro traseiro direito',
        'Vigia traseiro',
      ],
    },
    {
      key: 'tipo',
      label: 'Tipo',
      tipo: 'select',
      opcoes: ['Original', 'Temperado', 'Laminado'],
    },
    {
      key: 'cor',
      label: 'Cor',
      tipo: 'select',
      opcoes: ['Incolor', 'Verde', 'Fumê', 'Privacidade'],
    },
  ],
  Escapamento: [
    {
      key: 'posicao',
      label: 'Posição',
      tipo: 'select',
      opcoes: ['Dianteiro', 'Central', 'Traseiro'],
    },
    {
      key: 'material',
      label: 'Material',
      tipo: 'select',
      opcoes: ['Aço carbono', 'Aço inox', 'Aluminizado'],
    },
    {
      key: 'catalisador',
      label: 'Catalisador incluso',
      tipo: 'select',
      opcoes: ['Sim', 'Não'],
    },
  ],
  Transmissão: [
    {
      key: 'tipo',
      label: 'Componente',
      tipo: 'select',
      opcoes: ['Câmbio', 'Embreagem', 'Diferencial', 'Cardã', 'Outro'],
    },
    {
      key: 'cambio',
      label: 'Câmbio',
      tipo: 'select',
      opcoes: ['Manual', 'Automático', 'Automatizado', 'CVT'],
    },
    {
      key: 'tracao',
      label: 'Tração',
      tipo: 'select',
      opcoes: ['Dianteira', 'Traseira', '4x4'],
    },
  ],
  Baterias: [
    { key: 'amperagem', label: 'Amperagem', placeholder: 'Ex: 60Ah' },
    { key: 'tensao', label: 'Tensão', placeholder: 'Ex: 12V' },
    {
      key: 'tecnologia',
      label: 'Tecnologia',
      tipo: 'select',
      opcoes: ['Chumbo-ácido', 'AGM', 'EFB', 'Lítio'],
    },
  ],
  Outros: [
    { key: 'aplicacao', label: 'Aplicação', placeholder: 'Ex: Gol G6 2013 a 2016' },
  ],
};

export function camposDaCategoria(categoria?: string | null): CampoCatalogo[] {
  return CAMPOS_CATEGORIA[categoria || ''] || CAMPOS_CATEGORIA.Outros;
}

export function categoriaMlDe(categoria?: string | null): string {
  return CATEGORIA_ML[categoria || ''] || CATEGORIA_ML.Outros;
}

export function lerAtributos(valor: unknown): Record<string, string> {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return Object.fromEntries(
      Object.entries(valor).map(([chave, item]) => [chave, String(item ?? '')])
    );
  }

  if (typeof valor !== 'string' || !valor.trim()) return {};

  try {
    const json = JSON.parse(valor);
    if (!json || typeof json !== 'object' || Array.isArray(json)) return {};

    return Object.fromEntries(
      Object.entries(json).map(([chave, item]) => [chave, String(item ?? '')])
    );
  } catch {
    return {};
  }
}

export function prefixoSku(nome?: string | null): string {
  const limpo = String(nome || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');

  return (limpo.charAt(0) || 'D').toUpperCase();
}
