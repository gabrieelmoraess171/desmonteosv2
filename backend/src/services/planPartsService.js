const BASE_URL = 'https://cdn.plan.parts';

export function chavePlanParts() {
  return String(
    process.env.PLAN_PARTS_API_KEY ||
      process.env.PLANPARTS_API_KEY ||
      process.env.PLAN_PARTS_KEY ||
      process.env.PLANPARTS_KEY ||
      process.env.PLAN_PARTS_TOKEN ||
      ''
  ).trim();
}

function texto(valor, limite = 240) {
  return String(valor ?? '').trim().slice(0, limite);
}

function listaResultados(payload) {
  const data = payload?.data;
  const candidatos = [
    payload?.results,
    payload?.articles,
    data?.results,
    data?.articles,
    Array.isArray(data) ? data : null
  ];
  return candidatos.find(Array.isArray) || [];
}

function normalizarResultado(item, partNumber) {
  const numero = texto(
    item?.article_number || item?.article || item?.part_number || item?.number || item?.code || partNumber,
    100
  );
  const titulo = texto(item?.name || item?.title || item?.description || item?.article_name || numero, 180);
  const marca = texto(item?.brand || item?.manufacturer || item?.brand_name, 100);
  const imagem = texto(item?.image || item?.image_url || item?.thumbnail, 500);
  const url = texto(item?.url || item?.permalink || item?.link, 500);
  const aplicacoes = texto(
    item?.applicability || item?.vehicle_count
      ? `${item?.applicability || ''}${item?.vehicle_count ? ` · ${item.vehicle_count} aplicação(ões)` : ''}`
      : '',
    180
  );

  return {
    titulo: titulo || `Peça ${numero}`,
    marca,
    modelo: texto(item?.model || item?.vehicle_model, 100),
    numero: numero || partNumber,
    aplicacoes,
    url,
    imagem,
    fonte: 'plan.parts'
  };
}

export async function consultarPlanParts(partNumber) {
  const chave = chavePlanParts();
  if (!chave) return { status: 'nao_configurado', resultados: [] };

  const consulta = texto(partNumber, 80);
  const resposta = await fetch(
    `${BASE_URL}/api/v1/aftermarket/search?q=${encodeURIComponent(consulta)}&type=OEM`,
    {
      signal: AbortSignal.timeout(12000),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${chave}`,
        'user-agent': 'DesmonteOS/1.0 plan.parts catalog lookup'
      }
    }
  );

  if (resposta.status === 401) throw new Error('Chave do plan.parts inválida ou ausente');
  if (resposta.status === 402) throw new Error('Tokens insuficientes no plan.parts');
  if (resposta.status === 429) throw new Error('Limite de requisições do plan.parts atingido');
  if (!resposta.ok) throw new Error(`plan.parts respondeu ${resposta.status}`);

  const payload = await resposta.json();
  const resultados = listaResultados(payload)
    .map((item) => normalizarResultado(item, consulta))
    .filter((item) => item.numero)
    .slice(0, 24);

  return {
    status: resultados.length ? 'encontrado' : 'nenhum resultado',
    resultados,
    total: Number(payload?.count || payload?.data?.count) || resultados.length
  };
}

