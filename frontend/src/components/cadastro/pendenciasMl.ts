import type { FichaMlCarregada } from '../../config/atributosMl';
import { normalizarCondicao } from '../../config/atributosMl';

export type BlocoId =
  | 'fotos'
  | 'identificacao'
  | 'aplicacao'
  | 'fichaMl'
  | 'preco'
  | 'descricao';

export interface Pendencia {
  bloco: BlocoId;
  campo: string;
  detalhe?: string;
  origem: 'base' | 'atributo' | 'termo';
}

export interface DadosPendencias {
  formData: {
    garantia?: string;
    ml_titulo: string;
    nome: string;
    categoria: string;
    ml_category_id: string;
    categoria_ml: string;
    descricao: string;
    preco: string;
    quantidade: string;
    marca: string;
    modelo: string;
    ano: string;
    condicao: string;
    atributos: Record<string, string>;
    ml_config: { sale_terms?: Record<string, string>; compatibilities?: unknown[] };
  };
  fotos: number;
  ficha: FichaMlCarregada | null;
  editando: boolean;
}

// Mesmas exigências que o backend aplica antes de publicar
// (backend/src/services/mlCadastroService.js:86-99 e :60-62).
export function calcularPendencias({
  formData,
  fotos,
  ficha,
  editando,
}: DadosPendencias): Pendencia[] {
  const pendencias: Pendencia[] = [];
  const temTexto = (valor: string) => Boolean(String(valor || '').trim());
  const preco = Number(
    String(formData.preco || '')
      .replace(/\./g, '')
      .replace(',', '.')
  );
  const quantidade = Number(formData.quantidade || 0);

  if (!editando && fotos === 0) {
    pendencias.push({ bloco: 'fotos', campo: 'Foto do produto', origem: 'base' });
  }

  if (!temTexto(formData.ml_titulo) && !temTexto(formData.nome)) {
    pendencias.push({ bloco: 'identificacao', campo: 'Título do anúncio', origem: 'base' });
  }
  if (!temTexto(formData.categoria)) {
    pendencias.push({ bloco: 'identificacao', campo: 'Categoria', origem: 'base' });
  }
  if (!temTexto(formData.ml_category_id)) {
    pendencias.push({
      bloco: 'identificacao',
      campo: 'Categoria oficial do Mercado Livre',
      detalhe: 'Escolha a categoria para o ML liberar os atributos obrigatórios.',
      origem: 'base',
    });
  }
  if (!Number.isFinite(preco) || preco <= 0) {
    pendencias.push({ bloco: 'preco', campo: 'Preço', origem: 'base' });
  }
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    pendencias.push({ bloco: 'preco', campo: 'Quantidade em estoque', origem: 'base' });
  }
  if (!temTexto(formData.descricao)) {
    pendencias.push({ bloco: 'descricao', campo: 'Descrição', origem: 'base' });
  }

  if (!ficha) return pendencias;

  const condicao = normalizarCondicao(formData.condicao);
  const requerido = (campo: (typeof ficha.atributos)[number]) =>
    Boolean(
      campo.tags?.required ||
        (condicao === 'novo' && campo.tags?.new_required)
    );

  for (const campo of ficha.atributos) {
    if (campo.tags?.read_only || !requerido(campo)) continue;
    if (campo.id === 'ITEM_CONDITION' || campo.id === 'SELLER_SKU') continue;
    if (temTexto(formData.atributos[campo.id] || '')) continue;
    pendencias.push({
      bloco: 'fichaMl',
      campo: campo.name,
      detalhe: 'Atributo obrigatório da categoria no Mercado Livre.',
      origem: 'atributo',
    });
  }

  for (const termo of ficha.termos || []) {
    if (!termo.tags?.required) continue;
    if (termo.id === 'WARRANTY_TIME') {
      const garantia = formData.garantia || formData.ml_config?.sale_terms?.WARRANTY_TIME;
      if (!temTexto(String(garantia || '')) || /^sem\s+garantia$/i.test(String(garantia))) {
        pendencias.push({
          bloco: 'fichaMl',
          campo: termo.name || 'Garantia',
          detalhe: 'O Mercado Livre exige este termo de venda.',
          origem: 'termo',
        });
      }
      continue;
    }
    if (temTexto(formData.ml_config?.sale_terms?.[termo.id] || '')) continue;
    pendencias.push({
      bloco: 'fichaMl',
      campo: termo.name || termo.id,
      detalhe: 'Termo de venda obrigatório da categoria.',
      origem: 'termo',
    });
  }

  const exigeCompatibilidade = Boolean(
    ficha.restricoes?.attributes_values?.some(
      (grupo) => grupo.attribute_id === 'POSITION' && (grupo.values?.length || 0) > 0
    )
  );
  if (exigeCompatibilidade && (formData.ml_config?.compatibilities?.length || 0) === 0) {
    pendencias.push({
      bloco: 'fichaMl',
      campo: 'Veículos compatíveis',
      detalhe: 'A categoria usa compatibilidade de veículo no anúncio.',
      origem: 'termo',
    });
  }

  return pendencias;
}

export function contarPorBloco(pendencias: Pendencia[]): Record<BlocoId, number> {
  const contagem: Record<BlocoId, number> = {
    fotos: 0,
    identificacao: 0,
    aplicacao: 0,
    fichaMl: 0,
    preco: 0,
    descricao: 0,
  };
  for (const pendencia of pendencias) contagem[pendencia.bloco] += 1;
  return contagem;
}
