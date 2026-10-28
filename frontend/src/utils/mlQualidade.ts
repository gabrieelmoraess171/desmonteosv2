export interface DadosQualidadeMl {
  ml_item_id?: string | null;
  ml_ativo?: number | boolean | null;
  ml_status?: string | null;
  ml_thumbnail?: string | null;
  ml_health?: number | null;
  imagens_count?: number | null;
  descricao?: string | null;
  descricao_len?: number | null;
  categoria?: string | null;
  categoria_ml?: string | null;
  carro?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ano?: string | null;
  numero_oem?: string | null;
  garantia?: string | null;
  peso_kg?: number | null;
  comprimento_cm?: number | null;
  largura_cm?: number | null;
  altura_cm?: number | null;
  preco?: number | null;
  quantidade?: number | null;
}

export interface QualidadeMl {
  nota: number | null;
  label: string;
  detalhe: string;
  badge: string;
  barra: string;
  oficial: boolean;
  pontos: string[];
  semAnuncio: boolean;
}

function faixaDaNota(nota: number) {
  if (nota >= 85) {
    return {
      label: 'Excelente',
      badge: 'border-success/25 bg-successSoft text-success',
      barra: 'bg-success',
    };
  }

  if (nota >= 70) {
    return {
      label: 'Boa',
      badge: 'border-cyan/25 bg-cyan/10 text-cyan',
      barra: 'bg-cyan',
    };
  }

  if (nota >= 50) {
    return {
      label: 'Regular',
      badge: 'border-warning/25 bg-warningSoft text-warning',
      barra: 'bg-warning',
    };
  }

  return {
    label: 'Baixa',
    badge: 'border-danger/25 bg-dangerSoft text-danger',
    barra: 'bg-danger',
  };
}

function texto(valor: unknown): string {
  return String(valor ?? '').trim();
}

function medida(valor: unknown): boolean {
  return Number(valor) > 0;
}

/**
 * O Mercado Livre só expõe `health` em parte dos anúncios (principalmente
 * pausados). Quando ele vem, usamos a nota oficial. Quando não vem, calculamos
 * uma nota de qualidade a partir dos dados que o vendedor controla no anúncio.
 */
export function avaliarQualidadeMl(peca: DadosQualidadeMl): QualidadeMl {
  if (!texto(peca.ml_item_id)) {
    return {
      nota: null,
      label: 'Sem anúncio',
      detalhe: 'Esta peça ainda não está vinculada a um anúncio do Mercado Livre.',
      badge: 'border-white/10 bg-white/[0.04] text-muted',
      barra: 'bg-muted',
      oficial: false,
      pontos: ['Vincular anúncio no Mercado Livre'],
      semAnuncio: true,
    };
  }

  const health = Number(peca.ml_health);

  if (Number.isFinite(health) && health > 0) {
    const nota = Math.max(
      0,
      Math.min(100, Math.round(health <= 1 ? health * 100 : health))
    );
    const faixa = faixaDaNota(nota);

    return {
      nota,
      label: faixa.label,
      detalhe: 'Nota de saúde do anúncio informada pelo Mercado Livre.',
      badge: faixa.badge,
      barra: faixa.barra,
      oficial: true,
      pontos: [],
      semAnuncio: false,
    };
  }

  const fotos =
    Math.max(0, Number(peca.imagens_count) || 0) ||
    (texto(peca.ml_thumbnail) ? 1 : 0);
  const descricaoLen = Number.isFinite(Number(peca.descricao_len))
    ? Number(peca.descricao_len)
    : texto(peca.descricao).length;
  const ativo = Boolean(peca.ml_ativo) || peca.ml_status === 'active';
  const aplicacao = [
    texto(peca.carro),
    texto(peca.marca),
    texto(peca.modelo),
    texto(peca.ano),
  ].filter(Boolean).length;
  const medidas = [
    peca.peso_kg,
    peca.comprimento_cm,
    peca.largura_cm,
    peca.altura_cm,
  ].filter(medida).length;

  let nota = 15; // anúncio vinculado
  const pontos: string[] = [];

  if (ativo) {
    nota += 10;
  } else {
    pontos.push('Ativar o anúncio');
  }

  if (fotos >= 6) {
    nota += 20;
  } else if (fotos >= 3) {
    nota += 14;
    pontos.push('Chegar a 6 fotos');
  } else if (fotos >= 1) {
    nota += 8;
    pontos.push('Adicionar mais fotos');
  } else {
    pontos.push('Adicionar fotos');
  }

  if (descricaoLen >= 300) {
    nota += 15;
  } else if (descricaoLen >= 120) {
    nota += 10;
    pontos.push('Descrição mais completa');
  } else if (descricaoLen > 0) {
    nota += 5;
    pontos.push('Descrição mais completa');
  } else {
    pontos.push('Escrever a descrição');
  }

  if (texto(peca.categoria_ml)) {
    nota += 5;
  } else {
    pontos.push('Informar categoria ML');
  }

  nota += Math.round((aplicacao / 4) * 10);

  if (aplicacao < 4) {
    pontos.push('Completar aplicação');
  }

  if (texto(peca.numero_oem)) {
    nota += 5;
  } else {
    pontos.push('Informar código OEM');
  }

  if (texto(peca.garantia)) {
    nota += 5;
  } else {
    pontos.push('Informar garantia');
  }

  nota += Math.round((medidas / 4) * 10);

  if (medidas < 4) {
    pontos.push('Completar peso e medidas');
  }

  if (Number(peca.preco) > 0) {
    nota += 3;
  } else {
    pontos.push('Definir preço');
  }

  if (Number(peca.quantidade) > 0) {
    nota += 2;
  } else {
    pontos.push('Repor estoque');
  }

  const notaFinal = Math.max(0, Math.min(100, nota));
  const faixa = faixaDaNota(notaFinal);

  return {
    nota: notaFinal,
    label: faixa.label,
    detalhe:
      'Nota estimada com fotos, descrição, ficha técnica, preço, estoque e status do anúncio.',
    badge: faixa.badge,
    barra: faixa.barra,
    oficial: false,
    pontos: pontos.slice(0, 4),
    semAnuncio: false,
  };
}
