// Os requisitos são consultados por categoria; uma lista fixa fica desatualizada.
const cache = new Map();

export function lerConfigMl(valor) {
  const dados = typeof valor === 'string' ? JSON.parse(valor || '{}') : valor;
  return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
}

export async function obterFichaCategoria(categoryId, consultar) {
  if (!/^MLB\d+$/.test(categoryId)) {
    throw Object.assign(new Error('Selecione uma categoria válida do Mercado Livre.'), { statusCode: 400 });
  }
  const salvo = cache.get(categoryId);
  if (salvo && Date.now() - salvo.em < 15 * 60_000) return salvo.dados;
  const [categoria, atributos, termos] = await Promise.all([
    consultar(`/categories/${categoryId}`),
    consultar(`/categories/${categoryId}/attributes`),
    consultar(`/categories/${categoryId}/sale_terms`)
  ]);
  const dominio = categoria.settings?.catalog_domain;
  const restricoes = dominio ? await consultar(`/catalog_compatibilities/restrictions/values?main_domain_id=MLB-CARS_AND_VANS&secondary_domain_id=${encodeURIComponent(dominio)}`).catch(() => null) : null;
  const dados = { categoria, atributos, termos, restricoes };
  cache.set(categoryId, { em: Date.now(), dados });
  return dados;
}

export function valoresMl(valores, definicoes) {
  return Object.entries(valores || {}).filter(([, valor]) => String(valor ?? '').trim()).map(([id, valor]) => {
    const definicao = definicoes.find((item) => item.id === id);
    const opcao = definicao?.values?.find((item) => item.name === valor || item.id === valor);
    if (valor === '-1' && definicao?.tags?.allow_na) return { id, value_id: '-1' };
    return opcao ? { id, value_id: opcao.id, value_name: opcao.name } : { id, value_name: String(valor).trim() };
  });
}

export function completarPublicacao(corpo, peca, ficha, usuario) {
  const config = lerConfigMl(peca.ml_config);
  const permitidos = new Map(ficha.atributos.map((atributo) => [atributo.id, atributo]));
  const medidas = {
    SELLER_PACKAGE_HEIGHT: peca.altura_cm ? `${peca.altura_cm} cm` : '',
    SELLER_PACKAGE_WIDTH: peca.largura_cm ? `${peca.largura_cm} cm` : '',
    SELLER_PACKAGE_LENGTH: peca.comprimento_cm ? `${peca.comprimento_cm} cm` : '',
    SELLER_PACKAGE_WEIGHT: peca.peso_kg ? `${peca.peso_kg} kg` : ''
  };
  for (const [id, valor] of Object.entries(medidas)) {
    if (valor && !corpo.attributes.some((atributo) => atributo.id === id)) corpo.attributes.push({ id, value_name: valor });
  }
  corpo.attributes = corpo.attributes.filter((atributo) => permitidos.has(atributo.id) && !permitidos.get(atributo.id).tags?.read_only);
  corpo.attributes = valoresMl(Object.fromEntries(corpo.attributes.map((atributo) => [atributo.id, atributo.value_name])), ficha.atributos);
  if (permitidos.has('ITEM_CONDITION')) {
    corpo.attributes = corpo.attributes.filter((atributo) => atributo.id !== 'ITEM_CONDITION');
    corpo.attributes.push({ id: 'ITEM_CONDITION', value_id: { new: '2230284', used: '2230581', refurbished: '2230582' }[corpo.condition] });
  }
  for (const atributo of ficha.atributos) {
    if (atributo.tags?.fixed && !atributo.tags?.read_only && atributo.values?.length === 1 && !corpo.attributes.some((item) => item.id === atributo.id)) {
      corpo.attributes.push({ id: atributo.id, value_id: atributo.values[0].id });
    }
  }
  corpo.sale_terms = valoresMl(config.sale_terms, ficha.termos);
  if (!corpo.sale_terms.some((termo) => termo.id === 'WARRANTY_TIME') && peca.garantia) {
    corpo.sale_terms.push({ id: 'WARRANTY_TIME', value_name: peca.garantia });
  }
  if (usuario?.tags?.includes('user_product_seller')) {
    corpo.family_name = config.family_name?.trim() || corpo.title;
    delete corpo.title;
  }
  const envio = config.shipping || {};
  if (envio.mode || envio.free_shipping || envio.local_pick_up) {
    if (envio.mode && !['me2', 'custom', 'not_specified'].includes(envio.mode)) throw new Error('Modalidade de envio inválida.');
    corpo.shipping = {
      ...(envio.mode ? { mode: envio.mode } : {}), local_pick_up: envio.local_pick_up === true,
      free_shipping: envio.free_shipping === true
    };
    if (Number(peca.peso_kg) > 0 && [peca.altura_cm, peca.largura_cm, peca.comprimento_cm].every((valor) => Number(valor) > 0)) {
      corpo.shipping.dimensions = `${peca.altura_cm}x${peca.largura_cm}x${peca.comprimento_cm},${Math.ceil(peca.peso_kg * 1000)}`;
    }
  }
  if (config.catalog_product_id) {
    corpo.catalog_listing = true;
    corpo.catalog_product_id = String(config.catalog_product_id).trim();
  }
  if (config.official_store_id) corpo.official_store_id = Number(config.official_store_id);
  if (peca.video_url) {
    const url = new URL(peca.video_url);
    const host = url.hostname.replace(/^www\./, '');
    const video = host === 'youtu.be' ? url.pathname.slice(1) : ['youtube.com', 'm.youtube.com'].includes(host) ? url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1] : null;
    if (!video || !/^[\w-]{11}$/.test(video)) throw new Error('Informe um link válido do vídeo no YouTube.');
    corpo.video_id = video;
  }
  const faltantes = ficha.atributos.filter((atributo) =>
    (atributo.tags?.required || atributo.tags?.new_required && corpo.condition === 'new') &&
    !atributo.tags?.read_only && atributo.id !== 'ITEM_CONDITION' &&
    !corpo.attributes.some((item) => item.id === atributo.id)
  );
  if (faltantes.length) throw Object.assign(new Error(`Preencha os atributos obrigatórios: ${faltantes.map((item) => item.name).join(', ')}.`), { statusCode: 400 });
  if (ficha.categoria.children_categories?.length) throw new Error('Escolha uma subcategoria final para anunciar.');
  if (ficha.categoria.settings?.listing_allowed === false) throw new Error('Esta categoria não permite novos anúncios.');
  const maxFotos = ficha.categoria.settings?.max_pictures_per_item;
  if (maxFotos && corpo.pictures.length > maxFotos) throw new Error(`Esta categoria aceita até ${maxFotos} fotos.`);
  return corpo;
}

export function montarCompatibilidades(config) {
  const grupos = config.compatibilities || [];
  if (!Array.isArray(grupos) || grupos.length > 50) throw new Error('Informe até 50 grupos de veículos compatíveis.');
  return grupos.map((grupo) => {
    const atributos = grupo.attributes || {};
    if (!atributos.BRAND?.trim() || !atributos.CAR_AND_VAN_MODEL?.trim() || !atributos.YEAR?.trim()) {
      throw new Error('Cada veículo compatível precisa de marca, modelo e ano.');
    }
    return {
      domain_id: 'MLB-CARS_AND_VANS_FOR_COMPATIBILITIES',
      creation_source: 'DEFAULT',
      attributes: Object.entries(atributos).filter(([, valor]) => String(valor).trim()).map(([id, valor]) => ({ id, value_name: String(valor).trim() })),
      ...(grupo.note ? { note: String(grupo.note).slice(0, 500) } : {}),
      ...(grupo.positions?.length ? { restrictions: [{
        attribute_id: 'POSITION',
        attribute_values: grupo.positions.map((posicao) => ({ values: [{ value_id: String(posicao.value_id), value_name: String(posicao.value_name) }] }))
      }] } : {})
    };
  });
}
