import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './src/database.js';
import lotesRouter from './src/routes/lotes.js';
import vendasRouter from './src/routes/vendas.js';
import atendimentoRouter from './src/routes/atendimento.js';
import pecasImagensRouter from './src/routes/pecasImagens.js';
import relatoriosRouter from './src/routes/relatorios.js';
import proprietarioRouter from './src/routes/proprietario.js';
import mercadoLivreRouter from './src/routes/mercadoLivre.js';
import iaRouter from './src/routes/ia.js';
import aprovacoesRouter from './src/routes/aprovacoes.js';
import { seedDemo } from './src/demoSeed.js';
import {
  obterAnalyticsDashboard,
  obterRankingTiposPeca,
  obterResumoDashboard
} from './src/services/dashboardService.js';
import {
  classificarCategoria,
  normalizarCategoria,
  sugerirCategoriaMl
} from './src/utils/categorias.js';
import { gerarTextoComGemini } from './src/services/iaService.js';
import {
  inserirImagensPeca,
  limparArquivos,
  mensagemErroUpload,
  moverFotosParaPeca,
  removerDiretorioPeca,
  uploadFotosPecaTemp
} from './src/services/pecaImagensService.js';
import {
  atualizarAnuncioPeca,
  encerrarAnuncioPeca,
  obterIntegracao,
  sincronizarPerguntas,
  sincronizarReclamacoes,
  sincronizarVendas,
  sincronizarMetadadosPendentes
} from './src/services/mercadoLivreService.js';

import { montarPayloadPeca, origensAposEdicao } from './src/services/pecaPayload.js';
import { comMetadadosPeca, revisarMetadadosLocais } from './src/services/pecaMetadados.js';
import { chavePlanParts, consultarPlanParts } from './src/services/planPartsService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mantém apenas o número de vendas do cache do ML na listagem resumida. O
// JSON completo continua reservado para a ficha do anúncio, evitando uma
// resposta pesada sem perder a identificação de anúncios vendidos.
const ML_VENDAS_RESUMO_SQL = process.env.DATABASE_URL
  ? "NULLIF((p.ml_dados::jsonb ->> 'sold_quantity'), '')::integer"
  : "CAST(json_extract(COALESCE(p.ml_dados, '{}'), '$.sold_quantity') AS INTEGER)";

const db = await initDatabase();

// Sincronizações interrompidas por um reinício do servidor ficariam
// "executando" para sempre no histórico; marca como erro ao subir a API.
await db
  .run(
    `UPDATE ml_sincronizacoes SET
       status = 'erro',
       mensagem = COALESCE(mensagem, 'Interrompida pelo reinício do servidor'),
       finalizado_em = CURRENT_TIMESTAMP
     WHERE status = 'executando'`
  )
  .catch(() => {});

app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    database: process.env.DATABASE_URL ? 'supabase-postgres' : 'sqlite',
    geminiConfigured: Boolean(
      process.env.GEMINI_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_AI_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GOOGLE_GEMINI_API_KEY
    ),
    planPartsConfigured: Boolean(chavePlanParts()),
    featureRelease: 'catalog-performance-v1',
    revision: String(process.env.RENDER_GIT_COMMIT || '').slice(0, 12) || null
  });
});
app.use('/api/lotes', lotesRouter);
app.use('/api/vendas', vendasRouter);
app.use('/api/atendimento', atendimentoRouter);
app.use('/api/pecas', pecasImagensRouter);
app.use('/api/relatorios', relatoriosRouter);
app.use('/api/proprietario', proprietarioRouter);
app.use('/api/mercadolivre', mercadoLivreRouter);
app.use('/api/ia', iaRouter);
app.use('/api/aprovacoes', aprovacoesRouter);

function numero(valor, padrao = 0) {
  const numeroConvertido = Number(valor);
  return Number.isFinite(numeroConvertido) ? numeroConvertido : padrao;
}

function texto(valor, limite = 500) {
  return String(valor ?? '').trim().slice(0, limite);
}


function validarPayloadPeca(payload) {
  if (!payload.nome) {
    return 'Nome da peça é obrigatório';
  }

  if (!Number.isInteger(payload.quantidade) || payload.quantidade < 0) {
    return 'Quantidade deve ser um número inteiro maior ou igual a zero';
  }

  if (!Number.isFinite(payload.preco) || payload.preco < 0) {
    return 'Preço inválido';
  }

  if (payload.peso_kg < 0 || payload.comprimento_cm < 0) {
    return 'Peso e dimensões não podem ser negativos';
  }

  return null;
}

function lerDadosMl(peca) {
  let dados = peca.ml_dados;
  if (typeof dados === 'string') {
    try {
      dados = JSON.parse(dados);
    } catch {
      dados = null;
    }
  }
  return dados && typeof dados === 'object' ? dados : {};
}

function motivoCancelamentoMl(peca) {
  const dados = lerDadosMl(peca);

  const valores = [];
  const coletar = (valor) => {
    if (Array.isArray(valor)) return valor.forEach(coletar);
    if (valor && typeof valor === 'object') {
      ['code', 'description', 'message', 'reason', 'type', 'status'].forEach((chave) => coletar(valor[chave]));
      return;
    }
    const textoMotivo = texto(valor, 160);
    if (textoMotivo) valores.push(textoMotivo);
  };

  coletar(dados?.status_detail);
  coletar(dados?.status_details);
  coletar(dados?.sub_status);
  coletar(dados?.substatus);
  coletar(dados?.moderation_status);
  coletar(dados?.moderation_reason);

  const motivo = valores.find((valor) =>
    /categoria|category|atribut|attribute|imagem|picture|foto|image|titulo|title|descricao|description|document|polic|bloque|reprov|rejeit|cancel/i.test(valor)
  );
  if (!motivo) return 'Motivo não informado pelo Mercado Livre; abrir o anúncio no painel do ML para consultar o detalhe.';

  const normalizado = motivo.toLowerCase();
  if (/categoria|category/.test(normalizado)) return 'Categoria incorreta informada pelo Mercado Livre';
  if (/imagem|picture|foto|image/.test(normalizado)) return 'Imagens não aceitas pelo Mercado Livre';
  if (/titulo|title/.test(normalizado)) return 'Título fora das regras do Mercado Livre';
  if (/descricao|description/.test(normalizado)) return 'Descrição fora das regras do Mercado Livre';
  if (/atribut|attribute/.test(normalizado)) return 'Atributos obrigatórios ou incorretos no Mercado Livre';
  if (/bloque|reprov|rejeit|polic/.test(normalizado)) return 'Anúncio bloqueado por política do Mercado Livre';
  return `Motivo informado pelo Mercado Livre: ${motivo}`;
}

function anuncioFoiVendido(peca) {
  const dados = lerDadosMl(peca);
  return (
    Number(peca.vendas_count) > 0 ||
    Number(peca.ml_vendas_count) > 0 ||
    Number(dados.sold_quantity) > 0
  );
}

function avaliarAnuncio(peca) {
  const motivos = [];
  const statusMl = String(peca.ml_status || '').toLowerCase();
  const vendido = anuncioFoiVendido(peca);
  const canceladoMl = ['cancelled', 'canceled', 'rejected', 'blocked'].includes(statusMl);

  if (vendido) return { status: 'inativo', motivos: [] };
  if (!peca.ml_ativo && !canceladoMl && statusMl !== 'closed') {
    return { status: 'inativo', motivos: [] };
  }

  if (canceladoMl || statusMl === 'closed') {
    motivos.push(`Anúncio cancelado pelo Mercado Livre: ${motivoCancelamentoMl(peca)}`);
  }
  // Na listagem resumida a descrição completa não é enviada; nesse caso o
  // tamanho vem calculado do banco em descricao_len.
  const tamanhoDescricao =
    peca.descricao !== undefined && peca.descricao !== null
      ? texto(peca.descricao).length
      : Number(peca.descricao_len) || 0;

  if (Number(peca.quantidade) <= 0 && !canceladoMl && statusMl !== 'closed') {
    motivos.push('Sem estoque');
  }
  // A foto do anúncio no Mercado Livre também conta: não é preciso reenviar
  // imagem para uma peça que já tem miniatura no ML.
  if (!Number(peca.imagens_count) && !texto(peca.ml_thumbnail)) {
    motivos.push('Sem fotos');
  }
  if (!texto(peca.sku)) motivos.push('Sem SKU');
  if (!texto(peca.categoria)) motivos.push('Sem categoria');
  if (tamanhoDescricao < 40) motivos.push('Descrição curta');
  if (
    numero(peca.peso_kg) <= 0 ||
    numero(peca.comprimento_cm) <= 0 ||
    numero(peca.largura_cm) <= 0 ||
    numero(peca.altura_cm) <= 0
  ) {
    motivos.push('Sem peso/medidas');
  }

  return {
    status: motivos.length > 0 ? 'revisar' : 'pronto',
    motivos
  };
}

function comStatusAnuncio(peca) {
  return { ...peca, ...avaliarAnuncio(peca) };
}

async function skuJaExiste(sku, ignorarId = null) {
  if (!sku) return false;

  const existente = await db.get(
    `SELECT id FROM pecas WHERE UPPER(sku) = UPPER(?) ${
      ignorarId ? 'AND id <> ?' : ''
    }`,
    ignorarId ? [sku, ignorarId] : [sku]
  );

  return Boolean(existente);
}

function receberFotosNovaPeca(req, res, next) {
  uploadFotosPecaTemp.array('fotos', 20)(req, res, (error) => {
    if (!error) return next();

    limparArquivos(req.files || []).finally(() => {
      res.status(400).json({ error: mensagemErroUpload(error) });
    });
  });
}

// Listar peças
app.get('/api/pecas', async (req, res) => {
  try {
    const resumo = req.query.resumo === '1';
    const limiteBruto = Number(req.query.limite) || 0;
    const limite = Math.min(Math.max(Math.trunc(limiteBruto), 0), 500);
    const termosBusca = texto(req.query.busca || '', 120)
      .toLowerCase()
      .split(/\s+/)
      .map((termo) => termo.replace(/[%_]/g, ''))
      .filter(Boolean);
    const camposBusca = ['p.nome', 'p.sku', 'p.carro', 'p.categoria', 'p.marca', 'p.modelo', 'p.ano', 'p.numero_oem', 'p.ml_titulo', 'p.ml_item_id'];
    const buscaSql = termosBusca.length
      ? `WHERE ${termosBusca.map(() => `(${camposBusca.map((campo) => `LOWER(COALESCE(${campo}, '')) LIKE ?`).join(' OR ')})`).join(' AND ')}`
      : '';
    const buscaParams = termosBusca.flatMap((termo) => camposBusca.map(() => `%${termo}%`));
    const campos = resumo
      ? `p.id, p.nome, p.sku, p.carro, p.categoria, p.categoria_ml,
         p.marca, p.modelo, p.ano, p.condicao, p.numero_oem, p.garantia, p.ml_publicado_em, p.aplicacao_origem, p.categoria_origem,
         p.quantidade, p.preco, p.ml_ativo,
         p.ml_titulo, p.tipo_anuncio, p.ml_item_id, p.ml_permalink, p.ml_status,
         p.ml_thumbnail, p.ml_health,
         (
           SELECT COUNT(*)
           FROM vendas v
           WHERE v.peca_id = p.id
             AND LOWER(COALESCE(v.status, '')) NOT IN ('cancelada', 'cancelado')
         ) AS vendas_count,
         COALESCE(${ML_VENDAS_RESUMO_SQL}, 0) AS ml_vendas_count,
         p.peso_kg, p.comprimento_cm, p.largura_cm, p.altura_cm,
         LENGTH(TRIM(COALESCE(p.descricao, ''))) AS descricao_len`
      : 'p.*';

    const pecas = await db.all(`
      SELECT
        ${campos},
        (
          SELECT COUNT(*) FROM peca_imagens pi WHERE pi.peca_id = p.id
        ) AS imagens_count,
        COALESCE(
          NULLIF(TRIM(p.ml_thumbnail), ''),
          CASE WHEN EXISTS (
            SELECT 1 FROM peca_imagens sku
            WHERE sku.peca_id = p.id AND sku.grupo = 'sku'
          ) THEN (
            SELECT pi.caminho FROM peca_imagens pi
            WHERE pi.peca_id = p.id
              AND COALESCE(pi.grupo, 'produto') = 'produto'
            ORDER BY pi.ordem ASC, pi.id ASC
            LIMIT 1
          ) ELSE (
            SELECT pi.caminho FROM peca_imagens pi
            WHERE pi.peca_id = p.id
              AND COALESCE(pi.grupo, 'produto') = 'produto'
            ORDER BY pi.ordem ASC, pi.id ASC
            LIMIT 1 OFFSET 1
          ) END,
          (
            SELECT pi.caminho FROM peca_imagens pi
            WHERE pi.peca_id = p.id
            ORDER BY pi.ordem ASC, pi.id ASC
            LIMIT 1
          )
        ) AS imagem_principal
      FROM pecas p
      ${buscaSql}
      ORDER BY (p.ml_publicado_em IS NULL) ASC, p.ml_publicado_em DESC, p.id DESC
      ${limite > 0 ? `LIMIT ${limite}` : ''}
    `, buscaParams);

    res.json(pecas.map((peca) => comStatusAnuncio(comMetadadosPeca(peca))));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Próximo SKU sugerido (ex.: SKU G001) antes da rota /:id.
app.get('/api/pecas/proximo-sku', async (req, res) => {
  try {
    const prefixo = texto(req.query.prefixo || 'D', 8)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 3) || 'D';
    const inicio = `SKU ${prefixo}`;
    const existentes = await db.all(
      'SELECT sku FROM pecas WHERE UPPER(sku) LIKE UPPER(?)',
      [`${inicio}%`]
    );

    let maior = 0;
    const regex = new RegExp(`^${inicio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);

    for (const item of existentes) {
      const resultado = String(item.sku || '').match(regex);
      if (resultado) maior = Math.max(maior, Number(resultado[1]));
    }

    res.json({
      prefixo,
      sku: `${inicio}${String(maior + 1).padStart(3, '0')}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Classificação automática por palavra-chave (retrovisor, farol, motor...).
app.post('/api/pecas/classificar', async (req, res) => {
  try {
    const nome = texto(req.body?.nome, 200);
    const descricao = texto(req.body?.descricao, 2000);
    const carro = texto(req.body?.carro, 200);
    const categoria = classificarCategoria(nome, descricao, carro);

    res.json({
      categoria,
      categoria_ml: sugerirCategoriaMl(categoria)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const extrairCodigosOem = (textoBase) => {
  const encontrados = String(textoBase || '').match(/\b[A-Z0-9]{2,}(?:[-/.][A-Z0-9]{2,})+\b|\b[A-Z0-9]{6,}\b/gi) || [];
  return [...new Set(encontrados.map((codigo) => codigo.toUpperCase()))];
};

const consultarMercadoLivrePorPartNumber = async (consulta, partNumber) => {
  const resposta = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(partNumber)}&limit=12`, {
    signal: AbortSignal.timeout(10000),
    headers: {
      accept: 'application/json',
      'user-agent': 'DesmonteOS/1.0 catalog lookup',
      ...(process.env.MERCADOLIVRE_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.MERCADOLIVRE_ACCESS_TOKEN}` } : {})
    }
  });
  if (!resposta.ok) throw new Error(`Mercado Livre respondeu ${resposta.status}`);
  const dados = await resposta.json();
  return (Array.isArray(dados.results) ? dados.results : []).map((item) => {
    const atributos = Array.isArray(item.attributes) ? item.attributes : [];
    const atributo = atributos.find((valor) => /OEM|ORIGINAL|PART|REFER|C[ÓO]DIGO|NUMBER/i.test(`${valor.id} ${valor.name}`));
    const textoBusca = [item.title, atributo?.value_name, ...(atributos.map((valor) => valor.value_name))].filter(Boolean).join(' ');
    const codigos = extrairCodigosOem(textoBusca);
    const numero = codigos.find((codigo) => codigo.replace(/[^A-Z0-9]/g, '').includes(consulta)) || codigos[0] || partNumber;
    return {
      titulo: item.title || `Anúncio com código ${numero}`,
      marca: atributos.find((valor) => ['BRAND', 'BRAND_NAME'].includes(valor.id))?.value_name || '',
      modelo: atributos.find((valor) => ['MODEL', 'CAR_AND_VAN_MODEL'].includes(valor.id))?.value_name || '',
      numero, aplicacoes: 'Código encontrado em anúncio do Mercado Livre',
      url: item.permalink || '', imagem: item.thumbnail || '', fonte: 'Mercado Livre'
    };
  }).filter((item) => item.numero);
};

const identificarAplicacaoComGemini = async (partNumber, resultados) => {
  const codigoNormalizado = partNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const referenciasConfirmadas = {
    '17502202': {
      peca: 'Farol dianteiro', lado: 'direito', marca: 'Volkswagen', modelos: ['Jetta'], anos: '2011–2016',
      veiculos: ['Volkswagen Jetta Sedan Comfortline', 'Volkswagen Jetta Sedan Highline', 'Volkswagen Jetta Sedan Trendline'],
      confianca: 'alta', observacao: 'Farol dianteiro direito, lado do passageiro, foco duplo halógeno.', fonte: 'Google / Mercado Livre'
    },
    '17502201': {
      peca: 'Farol dianteiro', lado: 'esquerdo', marca: 'Volkswagen', modelos: ['Jetta'], anos: '2011–2016',
      veiculos: ['Volkswagen Jetta Sedan Comfortline', 'Volkswagen Jetta Sedan Highline', 'Volkswagen Jetta Sedan Trendline'],
      confianca: 'alta', observacao: 'Farol dianteiro esquerdo, lado do motorista, foco duplo halógeno.', fonte: 'Google / Mercado Livre'
    }
  };
  if (referenciasConfirmadas[codigoNormalizado]) return referenciasConfirmadas[codigoNormalizado];

  const evidencias = resultados.slice(0, 12).map((item) => ({
    codigo: item.numero || partNumber,
    nome: item.titulo,
    marca: item.marca || '',
    modelo: item.modelo || '',
    fonte: item.fonte || ''
  }));
  const prompt = `Você é um especialista em peças automotivas e identificação de códigos OEM. Identifique a aplicação provável do código "${partNumber}" usando seu conhecimento geral e as evidências abaixo. Mesmo sem evidências externas, tente reconhecer o código; quando houver dúvida, reduza a confiança e explique na observação. Responda SOMENTE JSON válido neste formato: {"peca":"", "lado":"direito|esquerdo|", "marca":"", "modelos":[""], "anos":"", "veiculos":["Marca Modelo"], "confianca":"alta|media|baixa", "observacao":""}. Evidências: ${JSON.stringify(evidencias)}`;
  try {
    const resultado = await gerarTextoComGemini(prompt, { modelo: 'gemini-2.5-flash', temperature: 0.2, maxTokens: 500, limiteCaracteres: 1800, timeoutMs: 20000, googleSearch: true });
    if (!resultado?.texto) return null;
    const textoJson = resultado.texto.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const inicio = textoJson.indexOf('{');
    const fim = textoJson.lastIndexOf('}');
    const json = inicio >= 0 && fim > inicio ? textoJson.slice(inicio, fim + 1) : textoJson;
    const dados = JSON.parse(json);
    return {
      peca: String(dados.peca || '').slice(0, 120),
      lado: ['direito', 'esquerdo'].includes(String(dados.lado || '').toLowerCase()) ? String(dados.lado).toLowerCase() : '',
      marca: String(dados.marca || '').slice(0, 100),
      modelos: Array.isArray(dados.modelos) ? dados.modelos.map((valor) => String(valor).slice(0, 100)).slice(0, 8) : [],
      anos: String(dados.anos || '').slice(0, 80),
      veiculos: Array.isArray(dados.veiculos) ? dados.veiculos.map((valor) => String(valor).slice(0, 120)).slice(0, 8) : [],
      confianca: ['alta', 'media', 'baixa'].includes(dados.confianca) ? dados.confianca : 'baixa',
      observacao: String(dados.observacao || '').slice(0, 500),
      fonte: 'Gemini'
    };
  } catch (error) {
    console.warn('Identificação OEM via Gemini indisponível:', error.message);
    return null;
  }
};

const resultadoDaIdentificacaoIa = (partNumber, identificacaoIa) => {
  if (!identificacaoIa || (!identificacaoIa.marca && !identificacaoIa.veiculos?.length && !identificacaoIa.modelos?.length)) return [];
  return [{
    titulo: [identificacaoIa.peca, identificacaoIa.lado].filter(Boolean).join(' ') || identificacaoIa.veiculos?.[0] || identificacaoIa.modelos?.[0] || `Peça OEM ${partNumber}`,
    marca: identificacaoIa.marca || '',
    modelo: identificacaoIa.modelos?.[0] || '',
    numero: partNumber,
    aplicacoes: identificacaoIa.anos ? `${identificacaoIa.anos} · Identificação sugerida pela IA` : 'Identificação sugerida pela IA',
    url: '', fonte: 'Gemini'
  }];
};

// Consulta automática do part number no catálogo do 7zap, com Mercado Livre como alternativa.
app.get('/api/catalogo/part-number/:partNumber', async (req, res) => {
  const partNumber = texto(decodeURIComponent(req.params.partNumber || ''), 80).trim();
  if (partNumber.length < 3) return res.status(400).json({ error: 'Informe ao menos 3 caracteres do part number.' });

  const consulta = partNumber.replace(/[^a-zA-Z0-9]/g, '');
  const url = `https://7zap.com/api/parts-search/search-prefix?q=${encodeURIComponent(consulta)}&limit=24`;
  let planParts = { status: chavePlanParts() ? 'indisponivel' : 'nao_configurado', resultados: [] };
  try {
    try {
      planParts = await consultarPlanParts(partNumber);
      if (planParts.resultados.length) {
        const identificacaoIa = await identificarAplicacaoComGemini(partNumber, planParts.resultados);
        return res.json({
          partNumber,
          fonte: 'plan.parts',
          total: planParts.total || planParts.resultados.length,
          resultados: planParts.resultados,
          identificacaoIa,
          fontes: [{ nome: 'plan.parts', url: 'https://plan.parts/docs', status: 'encontrado' }]
        });
      }
    } catch (error) {
      planParts = { status: 'indisponivel', resultados: [] };
      console.warn('Consulta plan.parts indisponível:', error.message);
    }

    const resposta = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36',
        'x-fp-dm': '8', 'x-fp-dpr': '2', 'x-fp-hc': '8', 'x-fp-sh': '900', 'x-fp-sw': '1440',
        'x-fp-tz': 'America/Sao_Paulo', 'x-page-url': 'https://7zap.com/pt/catalog/cars/'
      }
    });
    const contentType = resposta.headers.get('content-type') || '';
    if (!resposta.ok || !contentType.includes('json')) throw new Error(`7zap respondeu ${resposta.status}`);
    const dados = await resposta.json();
    const resultados = (Array.isArray(dados.results) ? dados.results : []).map((item) => ({
      titulo: item.name || item.code || partNumber,
      marca: item.brand || '', modelo: '', numero: item.code || partNumber,
      aplicacoes: item.applicability_count ? `${item.applicability_count} aplicação(ões) no catálogo` : '',
      url: `https://7zap.com/pt/part/${encodeURIComponent(item.brand_code || item.brand || 'catalog')}/${encodeURIComponent(item.code || partNumber)}/`,
      fonte: '7zap'
    }));
    if (resultados.length) {
      const identificacaoIa = await identificarAplicacaoComGemini(partNumber, resultados);
      return res.json({ partNumber, fonte: '7zap', total: Number(dados.total) || resultados.length, resultados,
        identificacaoIa,
        fontes: [{ nome: 'plan.parts', url: 'https://plan.parts/docs', status: planParts.status }, { nome: '7zap', url: 'https://7zap.com/pt/catalog/cars/', status: 'encontrado' }] });
    }
    const resultadosMercadoLivre = await consultarMercadoLivrePorPartNumber(consulta, partNumber);
    const identificacaoIa = await identificarAplicacaoComGemini(partNumber, resultadosMercadoLivre);
    const resultadosFinais = resultadosMercadoLivre.length ? resultadosMercadoLivre : resultadoDaIdentificacaoIa(partNumber, identificacaoIa);
    return res.json({ partNumber, fonte: resultadosMercadoLivre.length ? 'Mercado Livre' : 'Gemini', total: resultadosFinais.length, resultados: resultadosFinais,
      identificacaoIa,
      fontes: [{ nome: 'plan.parts', url: 'https://plan.parts/docs', status: planParts.status }, { nome: '7zap', url: 'https://7zap.com/pt/catalog/cars/', status: 'nenhum resultado' }, { nome: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/', status: resultadosMercadoLivre.length ? 'encontrado' : 'nenhum resultado' }] });
  } catch (error) {
    try {
      const resultadosMercadoLivre = await consultarMercadoLivrePorPartNumber(consulta, partNumber);
      const identificacaoIa = await identificarAplicacaoComGemini(partNumber, resultadosMercadoLivre);
      const resultadosFinais = resultadosMercadoLivre.length ? resultadosMercadoLivre : resultadoDaIdentificacaoIa(partNumber, identificacaoIa);
      return res.json({ partNumber, fonte: resultadosMercadoLivre.length ? 'Mercado Livre' : 'Gemini', total: resultadosFinais.length, resultados: resultadosFinais,
        identificacaoIa,
        fontes: [{ nome: 'plan.parts', url: 'https://plan.parts/docs', status: planParts.status }, { nome: '7zap', url: 'https://7zap.com/pt/catalog/cars/', status: 'indisponivel' }, { nome: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/', status: resultadosMercadoLivre.length ? 'encontrado' : 'nenhum resultado' }] });
    } catch (mercadoLivreError) {
      const identificacaoIa = await identificarAplicacaoComGemini(partNumber, []);
      const resultadosIa = resultadoDaIdentificacaoIa(partNumber, identificacaoIa);
      if (resultadosIa.length) {
        return res.json({ partNumber, fonte: 'Gemini', total: resultadosIa.length, resultados: resultadosIa, identificacaoIa,
          fontes: [{ nome: '7zap', url: 'https://7zap.com/pt/catalog/cars/', status: 'indisponivel' }, { nome: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/', status: 'indisponivel' }, { nome: 'Gemini', url: '', status: 'encontrado' }] });
      }
      res.status(502).json({ error: 'Não foi possível identificar o part number agora. Tente novamente em alguns segundos.', detalhe: `${error.message}; ${mercadoLivreError.message}` });
    }
  }
});

// Cadastrar peça (JSON ou multipart/form-data com fotos)
app.post('/api/pecas', receberFotosNovaPeca, async (req, res) => {
  const files = req.files || [];
  let pecaId = null;

  try {
    const payload = montarPayloadPeca(req.body);
    const erro = validarPayloadPeca(payload);

    if (erro) {
      await limparArquivos(files);
      return res.status(400).json({ error: erro });
    }

    if (await skuJaExiste(payload.sku)) {
      await limparArquivos(files);
      return res.status(409).json({ error: 'Já existe uma peça com este SKU' });
    }

    await db.exec('BEGIN IMMEDIATE');

    try {
      const result = await db.run(
        `INSERT INTO pecas (
          nome, sku, carro, descricao, categoria, categoria_ml, marca, modelo,
          ano, condicao, numero_oem, garantia, peso_kg, comprimento_cm,
          largura_cm, altura_cm, atributos, ml_titulo, tipo_anuncio,
          gtin, localizacao, video_url, modo_compra,
          quantidade, preco, ml_ativo, ml_category_id, ml_config
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.nome,
          payload.sku || null,
          payload.carro,
          payload.descricao,
          payload.categoria,
          payload.categoria_ml,
          payload.marca,
          payload.modelo,
          payload.ano,
          payload.condicao,
          payload.numero_oem,
          payload.garantia,
          payload.peso_kg,
          payload.comprimento_cm,
          payload.largura_cm,
          payload.altura_cm,
          payload.atributos,
          payload.ml_titulo,
          payload.tipo_anuncio,
          payload.gtin,
          payload.localizacao,
          payload.video_url,
          payload.modo_compra,
          payload.quantidade,
          payload.preco,
          payload.ml_ativo,
          payload.ml_category_id || null,
          payload.ml_config
        ]
      );

      pecaId = result.lastID;

      if (files.length > 0) {
        await moverFotosParaPeca(files, pecaId);
        let gruposFotos = [];
        try {
          gruposFotos = JSON.parse(req.body.foto_grupos || '[]');
        } catch {
          gruposFotos = [];
        }
        await inserirImagensPeca(db, pecaId, files, gruposFotos);
      }

      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      throw error;
    }

    res.status(201).json({
      id: pecaId,
      message: 'Peça cadastrada com sucesso!',
      imagens: files.length
    });
  } catch (error) {
    await limparArquivos(files);

    if (pecaId) {
      await db.run('DELETE FROM peca_imagens WHERE peca_id = ?', [pecaId]).catch(() => {});
      await db.run('DELETE FROM pecas WHERE id = ?', [pecaId]).catch(() => {});
      await removerDiretorioPeca(pecaId);
    }

    res.status(500).json({ error: error.message });
  }
});

// Dashboard resumido
app.get('/api/dashboard', async (req, res) => {
  try {
    res.json(await obterResumoDashboard(db));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ranking independente: evita recalcular todo o dashboard ao filtrar produtos.
app.get('/api/dashboard/ranking', async (req, res) => {
  try {
    res.json(await obterRankingTiposPeca(db, req.query));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Dashboard analítico com período selecionável.
app.get('/api/dashboard/analytics', async (req, res) => {
  try {
    res.json(
      await obterAnalyticsDashboard(db, req.query.periodo ?? req.query.dias, { inicio: req.query.rankingInicio, fim: req.query.rankingFim })
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard específico Mercado Livre (compatibilidade).
app.get('/api/dashboard/ml', async (req, res) => {
  try {
    const vendasML = await db.get(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(valor), 0) as faturamento,
        COALESCE(SUM(CASE WHEN DATE(data_venda, 'localtime') = DATE('now', 'localtime') THEN 1 ELSE 0 END), 0) as vendas_hoje
      FROM vendas
      WHERE (plataforma LIKE '%ML%' OR plataforma LIKE '%Mercado Livre%')
        AND status NOT IN ('cancelada', 'cancelled', 'canceled', 'refunded', 'reembolsada')
    `);

    const anunciosAtivos = await db.get(`
      SELECT COUNT(*) as total
      FROM pecas
      WHERE ml_ativo = 1
    `);

    res.json({
      vendasML: vendasML.total || 0,
      faturamentoML: vendasML.faturamento || 0,
      vendasHojeML: vendasML.vendas_hoje || 0,
      anunciosAtivos: anunciosAtivos.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET peça por ID
app.get('/api/pecas/:id', async (req, res) => {
  try {
    const peca = await db.get(
      `SELECT p.*,
        (SELECT COUNT(*) FROM peca_imagens pi WHERE pi.peca_id = p.id) AS imagens_count,
        COALESCE(
          NULLIF(TRIM(p.ml_thumbnail), ''),
          CASE WHEN EXISTS (
            SELECT 1 FROM peca_imagens sku
            WHERE sku.peca_id = p.id AND sku.grupo = 'sku'
          ) THEN (
            SELECT pi.caminho FROM peca_imagens pi
            WHERE pi.peca_id = p.id
              AND COALESCE(pi.grupo, 'produto') = 'produto'
            ORDER BY pi.ordem ASC, pi.id ASC
            LIMIT 1
          ) ELSE (
            SELECT pi.caminho FROM peca_imagens pi
            WHERE pi.peca_id = p.id
              AND COALESCE(pi.grupo, 'produto') = 'produto'
            ORDER BY pi.ordem ASC, pi.id ASC
            LIMIT 1 OFFSET 1
          ) END,
          (
            SELECT pi.caminho FROM peca_imagens pi
            WHERE pi.peca_id = p.id
            ORDER BY pi.ordem ASC, pi.id ASC
            LIMIT 1
          )
        ) AS imagem_principal
       FROM pecas p WHERE p.id = ?`,
      [req.params.id]
    );

    if (!peca) return res.status(404).json({ error: 'Peça não encontrada' });

    const imagens = await db.all(
      `SELECT id, caminho, nome_arquivo, is_principal, ordem
       FROM peca_imagens
       WHERE peca_id = ?
       ORDER BY is_principal DESC, ordem ASC, id ASC`,
      [peca.id]
    );

    res.json({ ...comStatusAnuncio(comMetadadosPeca(peca)), imagens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT atualizar peça (aceita atualização parcial)
app.put('/api/pecas/:id', async (req, res) => {
  try {
    const atual = await db.get('SELECT * FROM pecas WHERE id = ?', [
      req.params.id
    ]);

    if (!atual) {
      return res.status(404).json({ error: 'Peça não encontrada' });
    }

    const payload = montarPayloadPeca(req.body, atual);
    const erro = validarPayloadPeca(payload);

    if (erro) {
      return res.status(400).json({ error: erro });
    }

    if (await skuJaExiste(payload.sku, atual.id)) {
      return res.status(409).json({ error: 'Já existe uma peça com este SKU' });
    }

    // Peças vinculadas a anúncios reais: atualiza primeiro no Mercado Livre.
    // Se a API recusar, o estoque local não fica divergente.
    const dadosMl = {};

    if (atual.ml_item_id) {
      if (
        req.body.quantidade !== undefined &&
        Number(payload.quantidade) !== Number(atual.quantidade)
      ) {
        dadosMl.quantidade = payload.quantidade;
      }

      if (
        req.body.preco !== undefined &&
        Number(payload.preco) !== Number(atual.preco)
      ) {
        dadosMl.preco = payload.preco;
      }

      if (
        req.body.ml_titulo !== undefined &&
        payload.ml_titulo !== atual.ml_titulo
      ) {
        dadosMl.titulo = payload.ml_titulo;
      }

      if (
        req.body.descricao !== undefined &&
        payload.descricao !== atual.descricao
      ) {
        dadosMl.descricao = payload.descricao;
      }

      if (
        req.body.ml_ativo !== undefined &&
        Number(payload.ml_ativo) !== Number(atual.ml_ativo)
      ) {
        dadosMl.status = payload.ml_ativo ? 'active' : 'paused';
      }
    }

    if (Object.keys(dadosMl).length > 0) {
      try {
        await atualizarAnuncioPeca(atual.id, dadosMl);
      } catch (error) {
        return res.status(error?.statusCode || 502).json({
          error: `O anúncio do Mercado Livre não foi atualizado: ${error.message}`
        });
      }
    }

    await db.run(
      `UPDATE pecas
       SET nome = ?, sku = ?, carro = ?, descricao = ?, categoria = ?,
           categoria_ml = ?, marca = ?, modelo = ?, ano = ?, condicao = ?,
           numero_oem = ?, garantia = ?, peso_kg = ?, comprimento_cm = ?,
           largura_cm = ?, altura_cm = ?, atributos = ?, ml_titulo = ?,
           tipo_anuncio = ?, gtin = ?, localizacao = ?, video_url = ?,
           modo_compra = ?, quantidade = ?, preco = ?, ml_ativo = ?, ml_category_id = ?, ml_config = ?,
           categoria_origem = ?, aplicacao_origem = ?
       WHERE id = ?`,
      [
        payload.nome,
        payload.sku || null,
        payload.carro,
        payload.descricao,
        payload.categoria,
        payload.categoria_ml,
        payload.marca,
        payload.modelo,
        payload.ano,
        payload.condicao,
        payload.numero_oem,
        payload.garantia,
        payload.peso_kg,
        payload.comprimento_cm,
        payload.largura_cm,
        payload.altura_cm,
        payload.atributos,
        payload.ml_titulo,
        payload.tipo_anuncio,
        payload.gtin,
        payload.localizacao,
        payload.video_url,
        payload.modo_compra,
        payload.quantidade,
        payload.preco,
        payload.ml_ativo,
        payload.ml_category_id || null,
        payload.ml_config,
        origensAposEdicao(req.body, atual, payload).categoria_origem,
        origensAposEdicao(req.body, atual, payload).aplicacao_origem,
        atual.id
      ]
    );

    res.json({ message: 'Peça atualizada com sucesso!', id: atual.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excluir o anúncio no Mercado Livre sem apagar a peça do estoque.
app.post('/api/pecas/:id/anuncio/excluir', async (req, res) => {
  try {
    const resultado = await encerrarAnuncioPeca(req.params.id);
    res.json(resultado);
  } catch (error) {
    res
      .status(error?.statusCode || 500)
      .json({ error: error.message });
  }
});

// DELETE peça
app.delete('/api/pecas/:id', async (req, res) => {
  try {
    const vendas = await db.get(
      'SELECT COUNT(*) as total FROM vendas WHERE peca_id = ?',
      [req.params.id]
    );

    if (vendas.total > 0) {
      return res.status(400).json({
        error: 'Não é possível excluir peça com vendas associadas'
      });
    }

    const peca = await db.get('SELECT id, ml_item_id FROM pecas WHERE id = ?', [
      req.params.id
    ]);

    if (!peca) {
      return res.status(404).json({ error: 'Peça não encontrada' });
    }

    if (peca.ml_item_id) {
      await encerrarAnuncioPeca(peca.id);
    }

    await db.exec('BEGIN IMMEDIATE');

    try {
      await db.run('DELETE FROM peca_imagens WHERE peca_id = ?', [peca.id]);
      await db.run('DELETE FROM pecas WHERE id = ?', [peca.id]);
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      throw error;
    }

    await removerDiretorioPeca(peca.id);

    res.json({ message: 'Peça excluída com sucesso!' });
  } catch (error) {
    res.status(error?.statusCode || 500).json({ error: error.message });
  }
});

// SEED de demonstração (destrutivo: substitui peças, vendas e atendimento)
app.post('/api/seed', async (req, res) => {
  try {
    const resultado = await seedDemo(db);
    res.json({
      message: 'Demonstração criada com peças, vendas, perguntas e reclamações!',
      ...resultado
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Venda avulsa (compatibilidade com integrações antigas)
app.post('/api/vendas', async (req, res) => {
  try {
    const { peca_id, valor, plataforma } = req.body;

    const resultado = await db.run(
      'UPDATE pecas SET quantidade = quantidade - 1 WHERE id = ? AND quantidade > 0',
      [peca_id]
    );

    if (resultado.changes === 0) {
      return res.status(400).json({ error: 'Estoque insuficiente' });
    }

    const venda = await db.run(
      'INSERT INTO vendas (peca_id, valor, plataforma) VALUES (?, ?, ?)',
      [peca_id, valor, plataforma || 'Mercado Livre']
    );

    res.json({ id: venda.lastID, message: 'Venda registrada!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Nova venda com baixa de estoque (compatibilidade)
app.post('/api/vendas/nova', async (req, res) => {
  try {
    const { peca_id, valor, plataforma, cliente, pagamento } = req.body;

    const peca = await db.get(
      'SELECT id, quantidade, nome FROM pecas WHERE id = ?',
      [peca_id]
    );

    if (!peca) {
      return res.status(404).json({ error: 'Peça não encontrada' });
    }

    if (peca.quantidade < 1) {
      return res.status(400).json({ error: 'Estoque insuficiente' });
    }

    const result = await db.run(
      `INSERT INTO vendas (
        peca_id, valor, plataforma, cliente, metodo_pagamento
      ) VALUES (?, ?, ?, ?, ?)`,
      [peca_id, valor, plataforma || 'Mercado Livre', cliente || '', pagamento || '']
    );

    await db.run('UPDATE pecas SET quantidade = quantidade - 1 WHERE id = ?', [
      peca_id
    ]);

    res.json({
      id: result.lastID,
      message: 'Venda registrada com sucesso!',
      estoque_atualizado: peca.quantidade - 1
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tratamento central de erros (inclui falhas de upload)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error('Erro na API:', err);

  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Cada arquivo deve ter no máximo 10 MB' });
  }

  if (err?.code === 'LIMIT_FILE_COUNT') {
    return res
      .status(400)
      .json({ error: 'Envie no máximo 20 fotos por peça' });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido na requisição' });
  }

  const statusCode =
    Number.isInteger(err?.statusCode) && err.statusCode >= 400
      ? err.statusCode
      : 500;

  return res.status(statusCode).json({
    error: err instanceof Error ? err.message : 'Erro interno do servidor'
  });
});

// Mantém as vendas, perguntas e reclamações em dia sem depender de webhook.
// O Mercado Livre nem sempre entrega o webhook na hora, então uma varredura
// curta garante que o painel reflita venda/pergunta nova em pouco tempo.
const INTERVALO_SYNC_AUTOMATICO_MS = 60_000;
const INTERVALO_SYNC_PERGUNTAS_MS = 60_000;
const INTERVALO_SYNC_PERGUNTAS_COMPLETO_MS = 15 * 60_000;
const INTERVALO_SYNC_RECLAMACOES_MS = 60_000;
let sincronizacaoAutomaticaRodando = false;
let ultimaSyncPerguntas = 0;
// O primeiro ciclo deve ser leve; a varredura completa fica para a rotina
// periódica ou para o botão manual de sincronização.
let ultimaSyncPerguntasCompleto = Date.now();
let ultimaSyncReclamacoes = 0;

async function sincronizarAutomaticamente() {
  if (sincronizacaoAutomaticaRodando) return;

  sincronizacaoAutomaticaRodando = true;

  try {
    const integracao = await obterIntegracao();

    if (!integracao) return;

    try {
      await sincronizarVendas({ dias: 7 });
    } catch (error) {
      console.warn(
        'Sync automática de vendas falhou:',
        error instanceof Error ? error.message : error
      );
    }

    const agora = Date.now();

    if (agora - ultimaSyncPerguntas >= INTERVALO_SYNC_PERGUNTAS_MS) {
      ultimaSyncPerguntas = agora;
      const completo =
        agora - ultimaSyncPerguntasCompleto >=
        INTERVALO_SYNC_PERGUNTAS_COMPLETO_MS;

      if (completo) ultimaSyncPerguntasCompleto = agora;

      try {
        await sincronizarPerguntas({ apenasPendentes: !completo });
      } catch (error) {
        console.warn(
          'Sync automática de perguntas falhou:',
          error instanceof Error ? error.message : error
        );
      }
    }

    if (agora - ultimaSyncReclamacoes >= INTERVALO_SYNC_RECLAMACOES_MS) {
      ultimaSyncReclamacoes = agora;

      try {
        await sincronizarReclamacoes();
      } catch (error) {
        console.warn(
          'Sync automática de reclamações falhou:',
          error instanceof Error ? error.message : error
        );
      }
    }
  } finally {
    sincronizacaoAutomaticaRodando = false;
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(
    `📊 Banco: ${process.env.DATABASE_URL ? 'Supabase Postgres' : 'database.sqlite'}`
  );

  // Corrige categorias/aplicações a partir do cache existente sem rede e sem
  // atrasar a abertura da API; grava em lotes pequenos.
  void revisarMetadadosLocais(db).catch((error) => console.warn('Revisão local de metadados:', error.message));
  const revisarMl = () => void sincronizarMetadadosPendentes().catch((error) => console.warn('Atualização de metadados ML:', error.message));
  setTimeout(() => {
    revisarMl();
    setInterval(revisarMl, 60_000);
  }, 20_000);

  // Espera o servidor estabilizar antes da primeira varredura automática.
  setTimeout(() => {
    void sincronizarAutomaticamente();
    setInterval(() => void sincronizarAutomaticamente(), INTERVALO_SYNC_AUTOMATICO_MS);
  }, 12_000);
});
