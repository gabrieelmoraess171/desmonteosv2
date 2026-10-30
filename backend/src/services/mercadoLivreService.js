import crypto from 'node:crypto';
import { redirectUriLocal, resolverRedirectUriMl } from './urlsPublicas.js';
export { redirectUriLocal } from './urlsPublicas.js';
import { getDb } from '../database.js';
import { upsertVenda } from './vendasService.js';
import { upsertEnvio } from './enviosService.js';
import { completarPublicacao, obterFichaCategoria, lerConfigMl, montarCompatibilidades } from './mlCadastroService.js';
import { mapearReputacaoMl } from './mlReputacao.js';
import {
  classificarCategoria,
  sugerirCategoriaMl
} from '../utils/categorias.js';

const MARGEM_EXPIRACAO_MS = 5 * 60 * 1000;
const LIMITE_ANUNCIOS = 10000;
const LIMITE_PEDIDOS = 500;
const LIMITE_PERGUNTAS = 1000;
const LIMITE_RECLAMACOES = 200;
const TAMANHO_PAGINA_ANUNCIOS = 100;
const CONCORRENCIA_DESCRICOES = 6;
const sincronizacoesEmAndamento = new Set();
const cacheBillingCliente = new Map();

export class MercadoLivreError extends Error {
  constructor(mensagem, statusCode = 502, detalhes = null) {
    super(mensagem);
    this.name = 'MercadoLivreError';
    this.statusCode = statusCode;
    this.detalhes = detalhes;
  }
}

function apiBase() {
  return String(process.env.ML_API_BASE || 'https://api.mercadolibre.com')
    .trim()
    .replace(/\/+$/, '');
}

function authBase() {
  return String(
    process.env.ML_AUTH_BASE ||
      'https://auth.mercadolivre.com.br/authorization'
  ).trim();
}

function texto(valor, limite = 500) {
  return String(valor ?? '').trim().slice(0, limite);
}

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

// O Mercado Livre devolve miniaturas em http://http2.mlstatic.com/... Carregar
// http em uma página https gera bloqueio de conteúdo misto no navegador.
export function normalizarImagemMl(valor) {
  const url = texto(valor, 1000);

  if (!url) return '';

  return url.replace(/^http:\/\//i, 'https://');
}

function dataSql(valor) {
  if (!valor) return null;

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return String(valor).slice(0, 19).replace('T', ' ');
  }

  return data.toISOString().slice(0, 19).replace('T', ' ');
}

function mascarar(valor) {
  const conteudo = String(valor || '');

  if (!conteudo) return '';
  if (conteudo.length <= 6) return `${conteudo.slice(0, 2)}***`;

  return `${conteudo.slice(0, 4)}...${conteudo.slice(-4)}`;
}

function gerarPkce() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

async function lerResposta(resposta) {
  const conteudo = await resposta.text();

  if (!conteudo) return null;

  try {
    return JSON.parse(conteudo);
  } catch {
    return { raw: conteudo.slice(0, 1000) };
  }
}

async function lerConfiguracaoBanco(chave) {
  const db = getDb();
  const linha = await db.get(
    'SELECT valor FROM configuracoes WHERE chave = ?',
    [chave]
  );

  return texto(linha?.valor, 1000);
}

export async function obterConfiguracaoMl() {
  const [clientIdBanco, clientSecretBanco, redirectBanco, siteBanco] =
    await Promise.all([
      lerConfiguracaoBanco('ml_client_id'),
      lerConfiguracaoBanco('ml_client_secret'),
      lerConfiguracaoBanco('ml_redirect_uri'),
      lerConfiguracaoBanco('ml_site_id')
    ]);

  const clientIdEnv = texto(process.env.ML_CLIENT_ID, 200);
  const clientSecretEnv = texto(process.env.ML_CLIENT_SECRET, 500);
  const siteEnv = texto(process.env.ML_SITE_ID, 20);
  const clientId = clientIdEnv || clientIdBanco;
  const clientSecret = clientSecretEnv || clientSecretBanco;
  const redirectUri = resolverRedirectUriMl(redirectBanco);
  const siteId = (siteEnv || siteBanco || 'MLB').toUpperCase();
  const origem =
    clientIdEnv && clientSecretEnv
      ? 'env'
      : clientIdBanco && clientSecretBanco
        ? 'banco'
        : null;

  return {
    clientId,
    clientSecret,
    redirectUri,
    siteId,
    origem,
    configurado: Boolean(clientId && clientSecret)
  };
}

export async function salvarConfiguracaoMl(dados = {}) {
  const db = getDb();
  const atual = await obterConfiguracaoMl();
  const valores = {
    ml_client_id: texto(dados.clientId, 200),
    ml_client_secret: texto(dados.clientSecret, 500),
    ml_redirect_uri: texto(dados.redirectUri, 500),
    ml_site_id: texto(dados.siteId, 20).toUpperCase()
  };
  const clientId = valores.ml_client_id || atual.clientId;
  const clientSecret = valores.ml_client_secret || atual.clientSecret;
  const redirectUri = valores.ml_redirect_uri || atual.redirectUri;

  if (!clientId || !clientSecret) {
    throw new MercadoLivreError(
      'Informe o Client ID e o Client Secret do aplicativo do Mercado Livre.',
      400
    );
  }

  if (clientSecret === clientId) {
    throw new MercadoLivreError(
      'O Client Secret não pode ser igual ao Client ID. Copie o Client Secret no painel do aplicativo (developers.mercadolivre.com.br); ele é um código longo, geralmente com 32 caracteres.',
      400
    );
  }

  try {
    new URL(redirectUri);
  } catch {
    throw new MercadoLivreError(
      'A Redirect URI informada não é uma URL válida.',
      400
    );
  }

  for (const [chave, valor] of Object.entries(valores)) {
    if (!valor) continue;

    await db.run(
      `INSERT INTO configuracoes (chave, valor, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(chave) DO UPDATE SET
         valor = excluded.valor,
         updated_at = CURRENT_TIMESTAMP`,
      [chave, valor]
    );
  }

  return obterConfiguracaoMl();
}

export async function obterIntegracao() {
  const db = getDb();
  const linha = await db.get('SELECT * FROM ml_integracao WHERE id = 1');

  if (!linha?.access_token) return null;

  return linha;
}

async function obterIntegracaoObrigatoria() {
  const integracao = await obterIntegracao();

  if (!integracao) {
    throw new MercadoLivreError(
      'Conecte sua conta do Mercado Livre para continuar.',
      409
    );
  }

  return integracao;
}

async function requisitarToken(parametros) {
  const configuracao = await obterConfiguracaoMl();

  if (!configuracao.configurado) {
    throw new MercadoLivreError(
      'Configure o Client ID e o Client Secret antes de conectar.',
      400
    );
  }

  const corpo = new URLSearchParams({
    ...parametros,
    client_id: configuracao.clientId,
    client_secret: configuracao.clientSecret
  });

  const resposta = await fetch(`${apiBase()}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: corpo
  });
  const dados = await lerResposta(resposta);

  if (!resposta.ok) {
    const causas = Array.isArray(dados?.cause)
      ? dados.cause.filter((causa) => causa.type === 'error').map((causa) => causa.message).filter(Boolean).join('; ')
      : '';
    const detalhe = causas ||
      dados?.message ||
      dados?.error_description ||
      dados?.error ||
      `HTTP ${resposta.status}`;

    throw new MercadoLivreError(
      `Não foi possível autenticar no Mercado Livre: ${detalhe}`,
      resposta.status === 400 || resposta.status === 401 ? 401 : 502,
      dados
    );
  }

  return dados;
}

async function salvarTokens(dados, usuario = null) {
  const db = getDb();
  const existente = await db.get('SELECT * FROM ml_integracao WHERE id = 1');
  const accessToken = texto(dados?.access_token, 5000);

  if (!accessToken) {
    throw new MercadoLivreError(
      'O Mercado Livre não retornou um token de acesso.',
      502
    );
  }

  const refreshToken =
    texto(dados?.refresh_token, 5000) || existente?.refresh_token || '';
  const expiraEm = new Date(
    Date.now() + numero(dados?.expires_in || 21600) * 1000
  ).toISOString();
  const userId = usuario?.id
    ? String(usuario.id)
    : existente?.user_id || null;
  const nickname = texto(usuario?.nickname, 200) || existente?.nickname || '';
  const email = texto(usuario?.email, 200) || existente?.email || '';
  const siteId =
    texto(usuario?.site_id, 20).toUpperCase() ||
    existente?.site_id ||
    (await obterConfiguracaoMl()).siteId;
  const scope = texto(
    Array.isArray(dados?.scope) ? dados.scope.join(' ') : dados?.scope,
    1000
  );
  const conectadoEm = existente?.conectado_em || new Date().toISOString();
  const atualizadoEm = new Date().toISOString();

  if (existente) {
    await db.run(
      `UPDATE ml_integracao SET
         user_id = ?,
         nickname = ?,
         email = ?,
         site_id = ?,
         access_token = ?,
         refresh_token = ?,
         expires_at = ?,
         scope = ?,
         conectado_em = ?,
         atualizado_em = ?,
         erro = NULL
       WHERE id = 1`,
      [
        userId,
        nickname,
        email,
        siteId,
        accessToken,
        refreshToken,
        expiraEm,
        scope,
        conectadoEm,
        atualizadoEm
      ]
    );
  } else {
    await db.run(
      `INSERT INTO ml_integracao (
         id, user_id, nickname, email, site_id, access_token, refresh_token,
         expires_at, scope, conectado_em, atualizado_em
       ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        nickname,
        email,
        siteId,
        accessToken,
        refreshToken,
        expiraEm,
        scope,
        conectadoEm,
        atualizadoEm
      ]
    );
  }

  if (
    usuario?.id &&
    existente?.user_id &&
    String(usuario.id) !== String(existente.user_id)
  ) {
    await db.run('DELETE FROM ml_reputacao_cache');
  }

  return {
    user_id: userId,
    nickname,
    email,
    site_id: siteId,
    expires_at: expiraEm,
    conectado_em: conectadoEm,
    atualizado_em: atualizadoEm
  };
}

async function renovarToken(integracao = null) {
  const atual = integracao || (await obterIntegracao());

  if (!atual?.refresh_token) {
    throw new MercadoLivreError(
      'Sessão do Mercado Livre expirada. Conecte a conta novamente.',
      401
    );
  }

  try {
    const dados = await requisitarToken({
      grant_type: 'refresh_token',
      refresh_token: atual.refresh_token
    });

    await salvarTokens(dados, null);
    return dados.access_token;
  } catch (error) {
    await getDb()
      .run('UPDATE ml_integracao SET erro = ? WHERE id = 1', [error.message])
      .catch(() => {});

    if (error instanceof MercadoLivreError) {
      throw new MercadoLivreError(
        'Sessão do Mercado Livre expirada. Conecte a conta novamente.',
        401,
        error.detalhes
      );
    }

    throw error;
  }
}

async function obterAccessToken() {
  const integracao = await obterIntegracaoObrigatoria();
  const expiraEm = integracao.expires_at
    ? new Date(integracao.expires_at).getTime()
    : 0;

  if (!expiraEm || expiraEm - Date.now() > MARGEM_EXPIRACAO_MS) {
    return integracao.access_token;
  }

  return renovarToken(integracao);
}

async function requisicaoComToken(token, caminho, opcoes = {}) {
  const url = caminho.startsWith('http')
    ? caminho
    : `${apiBase()}${caminho}`;
  const headers = {
    Accept: 'application/json',
    ...(opcoes.headers || {}),
    Authorization: `Bearer ${token}`
  };
  const resposta = await fetch(url, { ...opcoes, headers });
  const dados = await lerResposta(resposta);

  return { resposta, dados };
}

export async function mlFetch(caminho, opcoes = {}, estado = {}) {
  const token = await obterAccessToken();
  const { resposta, dados } = await requisicaoComToken(token, caminho, opcoes);

  if (resposta.status === 401 && !estado.renovouToken) {
    await renovarToken(await obterIntegracao());
    return mlFetch(caminho, opcoes, { ...estado, renovouToken: true });
  }

  if (resposta.status === 429 && numero(estado.tentativas429) < 3) {
    const tentativas = numero(estado.tentativas429);
    const retryAfter = numero(resposta.headers.get('retry-after')) * 1000;
    const espera = retryAfter || 1000 * (tentativas + 1);

    await new Promise((resolve) => setTimeout(resolve, espera));

    return mlFetch(caminho, opcoes, {
      ...estado,
      tentativas429: tentativas + 1
    });
  }

  if (!resposta.ok) {
    const detalhe =
      dados?.message ||
      dados?.error_description ||
      dados?.error ||
      `HTTP ${resposta.status}`;

    throw new MercadoLivreError(
      `Mercado Livre recusou a requisição: ${detalhe}`,
      resposta.status === 401
        ? 401
        : resposta.status === 404
          ? 404
          : 502,
      dados
    );
  }

  return dados;
}

async function mlFetchPdf(caminho, estado = {}) {
  const token = await obterAccessToken();
  const resposta = await fetch(`${apiBase()}${caminho}`, {
    headers: {
      Accept: 'application/pdf',
      Authorization: `Bearer ${token}`
    }
  });

  if (resposta.status === 401 && !estado.renovouToken) {
    await renovarToken(await obterIntegracao());
    return mlFetchPdf(caminho, { ...estado, renovouToken: true });
  }

  if (resposta.status === 429 && numero(estado.tentativas429) < 3) {
    const tentativas = numero(estado.tentativas429);
    const retryAfter = numero(resposta.headers.get('retry-after')) * 1000;
    await new Promise((resolve) =>
      setTimeout(resolve, retryAfter || 1000 * (tentativas + 1))
    );
    return mlFetchPdf(caminho, {
      ...estado,
      tentativas429: tentativas + 1
    });
  }

  if (!resposta.ok) {
    const dados = await lerResposta(resposta);
    const detalhe =
      dados?.message ||
      dados?.error_description ||
      dados?.error ||
      `HTTP ${resposta.status}`;

    throw new MercadoLivreError(
      `Mercado Livre recusou a requisição: ${detalhe}`,
      resposta.status === 401
        ? 401
        : resposta.status === 404
          ? 404
          : 502,
      dados
    );
  }

  const pdf = Buffer.from(await resposta.arrayBuffer());

  if (pdf.length < 5 || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new MercadoLivreError(
      'O Mercado Livre não retornou um PDF válido para as etiquetas.',
      502
    );
  }

  return pdf;
}

async function iniciarSincronizacao(recurso) {
  const db = getDb();
  const resultado = await db.run(
    `INSERT INTO ml_sincronizacoes (recurso, status)
     VALUES (?, 'executando')`,
    [recurso]
  );

  return resultado.lastID;
}

async function finalizarSincronizacao(id, status, dados = {}) {
  const db = getDb();

  await db.run(
    `UPDATE ml_sincronizacoes SET
       status = ?,
       itens = ?,
       criados = ?,
       atualizados = ?,
       ignorados = ?,
       mensagem = ?,
       finalizado_em = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      status,
      Math.trunc(numero(dados.itens)),
      Math.trunc(numero(dados.criados)),
      Math.trunc(numero(dados.atualizados)),
      Math.trunc(numero(dados.ignorados)),
      texto(dados.mensagem, 2000) || null,
      id
    ]
  );
}

async function comSincronizacao(recurso, operacao) {
  const id = await iniciarSincronizacao(recurso);

  if (sincronizacoesEmAndamento.has(recurso)) {
    await finalizarSincronizacao(id, 'ignorado', {
      mensagem: 'Já existe uma sincronização deste recurso em andamento.'
    });

    return {
      recurso,
      status: 'ignorado',
      mensagem: 'Sincronização já em andamento'
    };
  }

  sincronizacoesEmAndamento.add(recurso);

  try {
    const resultado = await operacao();
    await finalizarSincronizacao(id, 'sucesso', resultado);

    return { recurso, status: 'sucesso', ...resultado };
  } catch (error) {
    await finalizarSincronizacao(id, 'erro', {
      mensagem: error.message
    });
    throw error;
  } finally {
    sincronizacoesEmAndamento.delete(recurso);
  }
}

export async function obterHistoricoSincronizacoes(limite = 10) {
  const db = getDb();
  const quantidade = Math.min(50, Math.max(1, Math.trunc(numero(limite))));

  return db.all(
    `SELECT id, recurso, status, itens, criados, atualizados, ignorados,
            mensagem,
            datetime(iniciado_em, 'localtime') AS iniciado_em,
            datetime(finalizado_em, 'localtime') AS finalizado_em
     FROM ml_sincronizacoes
     ORDER BY id DESC
     LIMIT ?`,
    [quantidade]
  );
}

export async function obterStatusMl() {
  const db = getDb();
  const configuracao = await obterConfiguracaoMl();
  const integracao = await obterIntegracao();

  const [
    anuncios,
    pedidos,
    perguntas,
    reclamacoes,
    cacheReputacao,
    ultima,
    historico,
    ultimasPorRecurso
  ] = await Promise.all([
    db.get(
      `SELECT COUNT(*) AS total FROM pecas
       WHERE ml_item_id IS NOT NULL AND TRIM(ml_item_id) <> ''`
    ),
    db.get(
      `SELECT COUNT(*) AS total FROM vendas
       WHERE ml_status IS NOT NULL AND TRIM(ml_status) <> ''`
    ),
    db.get(
      `SELECT COUNT(*) AS total FROM perguntas_ml
       WHERE ml_question_id IS NOT NULL AND TRIM(ml_question_id) <> ''
         AND respondida = 0`
    ),
    db.get(
      `SELECT COUNT(*) AS total FROM reclamacoes_ml
       WHERE ml_claim_id IS NOT NULL AND TRIM(ml_claim_id) <> ''
         AND status NOT IN ('resolvida', 'resolvido', 'fechada', 'closed')`
    ),
    db.get(
      `SELECT datetime(atualizado_em, 'localtime') AS atualizado_em
       FROM ml_reputacao_cache WHERE id = 1`
    ),
    db.get(
      `SELECT recurso, status, itens, criados, atualizados, ignorados,
              mensagem,
              datetime(iniciado_em, 'localtime') AS iniciado_em,
              datetime(finalizado_em, 'localtime') AS finalizado_em
       FROM ml_sincronizacoes
       ORDER BY id DESC
       LIMIT 1`
    ),
    obterHistoricoSincronizacoes(8),
    db.all(
      `SELECT s.recurso, s.status, s.itens, s.criados, s.atualizados,
              s.ignorados, s.mensagem,
              datetime(s.iniciado_em, 'localtime') AS iniciado_em,
              datetime(s.finalizado_em, 'localtime') AS finalizado_em
       FROM ml_sincronizacoes s
       INNER JOIN (
         SELECT recurso, MAX(id) AS ultimo_id
         FROM ml_sincronizacoes
         GROUP BY recurso
       ) ultimas ON ultimas.ultimo_id = s.id`
    )
  ]);

  const expiraEm = integracao?.expires_at
    ? new Date(integracao.expires_at).getTime()
    : 0;

  return {
    configurado: configuracao.configurado,
    origemConfiguracao: configuracao.origem,
    clientId: mascarar(configuracao.clientId),
    clientSecretConfigurado: Boolean(configuracao.clientSecret),
    redirectUri: configuracao.redirectUri,
    redirectUriLocal: redirectUriLocal(configuracao.redirectUri),
    siteId: configuracao.siteId,
    conectado: Boolean(integracao),
    conta: integracao
      ? {
          user_id: integracao.user_id,
          nickname: integracao.nickname,
          email: integracao.email,
          site_id: integracao.site_id,
          conectado_em: integracao.conectado_em,
          atualizado_em: integracao.atualizado_em,
          expires_at: integracao.expires_at,
          expirado: expiraEm > 0 ? expiraEm <= Date.now() : false,
          erro: integracao.erro || null
        }
      : null,
    contagens: {
      anuncios: numero(anuncios?.total),
      pedidos: numero(pedidos?.total),
      perguntasPendentes: numero(perguntas?.total),
      reclamacoesAbertas: numero(reclamacoes?.total)
    },
    reputacaoAtualizadaEm: cacheReputacao?.atualizado_em || null,
    ultimaSincronizacao: ultima || null,
    historico,
    ultimasPorRecurso
  };
}

export async function gerarUrlAutorizacao() {
  const configuracao = await obterConfiguracaoMl();

  if (!configuracao.configurado) {
    throw new MercadoLivreError(
      'Configure o Client ID e o Client Secret do aplicativo do Mercado Livre antes de conectar.',
      400
    );
  }

  if (redirectUriLocal(configuracao.redirectUri)) {
    throw new MercadoLivreError(
      'O Mercado Livre não aceita Redirect URI em localhost/127.0.0.1: a página de autorização devolve o erro 403 (CloudFront / Request blocked). ' +
        'Exponha o backend em uma URL HTTPS pública (cloudflared, ngrok ou domínio próprio), cadastre exatamente essa URL como Redirect URI no aplicativo do Mercado Livre e salve a mesma URL em Configurações ou em ML_REDIRECT_URI. ' +
        `Redirect URI atual: ${configuracao.redirectUri}`,
      400
    );
  }

  const db = getDb();
  const state = crypto.randomBytes(32).toString('hex');
  const { codeVerifier, codeChallenge } = gerarPkce();

  await db.run(
    "DELETE FROM ml_oauth_states WHERE criado_em < datetime('now', '-1 hour')"
  );
  await db.run(
    'INSERT INTO ml_oauth_states (state, code_verifier) VALUES (?, ?)',
    [state, codeVerifier]
  );

  const url = new URL(authBase());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', configuracao.clientId);
  url.searchParams.set('redirect_uri', configuracao.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return {
    url: url.toString(),
    state,
    redirectUri: configuracao.redirectUri
  };
}

export async function processarCallback(code, state) {
  const codigo = texto(code, 2000);
  const stateRecebido = texto(state, 200);

  if (!codigo) {
    throw new MercadoLivreError(
      'O Mercado Livre não retornou o código de autorização.',
      400
    );
  }

  const db = getDb();
  const stateSalvo = stateRecebido
    ? await db.get(
        'SELECT state, code_verifier FROM ml_oauth_states WHERE state = ?',
        [stateRecebido]
      )
    : null;

  if (!stateSalvo) {
    throw new MercadoLivreError(
      'State de autorização inválido ou expirado. Inicie a conexão novamente.',
      400
    );
  }

  if (!stateSalvo.code_verifier) {
    throw new MercadoLivreError(
      'Autorização antiga sem PKCE. Inicie a conexão novamente.',
      400
    );
  }

  await db.run('DELETE FROM ml_oauth_states WHERE state = ?', [stateRecebido]);

  const configuracao = await obterConfiguracaoMl();
  const dados = await requisitarToken({
    grant_type: 'authorization_code',
    code: codigo,
    redirect_uri: configuracao.redirectUri,
    code_verifier: stateSalvo.code_verifier
  });

  let usuario = null;

  try {
    const { resposta, dados: dadosUsuario } = await requisicaoComToken(
      dados.access_token,
      '/users/me'
    );

    if (resposta.ok) usuario = dadosUsuario;
  } catch {
    // A conexão continua válida mesmo se a consulta do perfil falhar.
  }

  const conta = await salvarTokens(dados, usuario);

  return { ok: true, conta };
}

export async function desconectarMl() {
  const db = getDb();

  await db.run('DELETE FROM ml_integracao');
  await db.run('DELETE FROM ml_oauth_states');
  await db.run('DELETE FROM ml_reputacao_cache');

  return { ok: true };
}

async function listarIdsAnuncios(userId) {
  const ids = [];
  let scrollId = '';

  // A busca por offset para no limite de 1000. O search_type=scan usa
  // scroll_id e permite percorrer todos os anúncios (o seller pode ter mais
  // de mil itens), então a listagem completa usa scan.
  while (ids.length < LIMITE_ANUNCIOS) {
    const parametros = new URLSearchParams({
      search_type: 'scan',
      limit: String(TAMANHO_PAGINA_ANUNCIOS)
    });

    if (scrollId) parametros.set('scroll_id', scrollId);

    const dados = await mlFetch(
      `/users/${encodeURIComponent(userId)}/items/search?${parametros.toString()}`
    );
    const resultados = Array.isArray(dados?.results) ? dados.results : [];

    for (const id of resultados) {
      const identificador = texto(id, 100);
      if (identificador) ids.push(identificador);
    }

    const proximoScroll = texto(dados?.scroll_id, 500);

    if (
      resultados.length === 0 ||
      !proximoScroll ||
      proximoScroll === scrollId
    ) {
      break;
    }

    scrollId = proximoScroll;

    const total = numero(dados?.paging?.total);

    if (total > 0 && ids.length >= total) break;
  }

  return [...new Set(ids)];
}

async function mapComLimite(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;

  async function trabalhador() {
    while (proximo < itens.length) {
      const indice = proximo;
      proximo += 1;
      resultados[indice] = await fn(itens[indice]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, limite), itens.length) },
      () => trabalhador()
    )
  );

  return resultados;
}

function atributoItem(item, ids) {
  const atributos = Array.isArray(item?.attributes) ? item.attributes : [];

  for (const id of ids) {
    const encontrado = atributos.find(
      (atributo) =>
        String(atributo?.id || '').toUpperCase() === String(id).toUpperCase()
    );

    if (encontrado) {
      return texto(encontrado.value_name || encontrado.value_id, 200);
    }
  }

  return '';
}

function converterMedida(valor, unidadeFinal) {
  const bruto = texto(valor, 40);
  const numero = Number(
    (bruto.replace(',', '.').match(/\d+(?:\.\d+)?/) || ['0'])[0]
  );

  if (!Number.isFinite(numero) || numero <= 0) return 0;

  const unidade = (bruto.toLowerCase().match(/[a-z]+/) || [''])[0];

  if (unidadeFinal === 'kg') {
    // O Mercado Livre informa o peso da embalagem em gramas por padrão.
    return unidade === 'kg' ? numero : numero / 1000;
  }

  // Medidas: o padrão do Mercado Livre é centímetros.
  if (unidade === 'mm') return numero / 10;
  if (unidade === 'm') return numero * 100;

  return numero;
}

function dimensoesItem(item) {
  return {
    pesoKg: converterMedida(
      atributoItem(item, ['SELLER_PACKAGE_WEIGHT', 'PACKAGE_WEIGHT', 'WEIGHT']),
      'kg'
    ),
    comprimentoCm: converterMedida(
      atributoItem(item, ['SELLER_PACKAGE_LENGTH', 'PACKAGE_LENGTH']),
      'cm'
    ),
    larguraCm: converterMedida(
      atributoItem(item, ['SELLER_PACKAGE_WIDTH', 'PACKAGE_WIDTH']),
      'cm'
    ),
    alturaCm: converterMedida(
      atributoItem(item, ['SELLER_PACKAGE_HEIGHT', 'PACKAGE_HEIGHT']),
      'cm'
    )
  };
}

function montarAtributos(item) {
  const mapa = {};

  for (const atributo of Array.isArray(item?.attributes)
    ? item.attributes
    : []) {
    if (!atributo?.id) continue;
    mapa[atributo.id] =
      atributo.value_name ?? atributo.value_id ?? '';
  }

  return JSON.stringify(mapa).slice(0, 8000);
}

async function obterDescricaoItem(mlItemId) {
  try {
    const dados = await mlFetch(
      `/items/${encodeURIComponent(mlItemId)}/description`
    );

    return texto(dados?.plain_text || dados?.text, 5000);
  } catch {
    return '';
  }
}

async function upsertPecaMl(item) {
  const db = getDb();
  const mlItemId = texto(item?.id, 100);

  if (!mlItemId) return { criado: false, ignorado: true };

  const sellerSku = texto(
    item.seller_custom_field || atributoItem(item, ['SELLER_SKU']),
    100
  ).toUpperCase();
  let peca = await db.get('SELECT * FROM pecas WHERE ml_item_id = ?', [
    mlItemId
  ]);

  if (!peca && sellerSku) {
    peca = await db.get(
      `SELECT * FROM pecas
       WHERE UPPER(sku) = UPPER(?)
         AND (ml_item_id IS NULL OR TRIM(ml_item_id) = '')
       LIMIT 1`,
      [sellerSku]
    );
  }

  const titulo = texto(item.title, 200);
  const preco = numero(item.price);
  const dimensoes = dimensoesItem(item);
  const variacoes = Array.isArray(item.variations) ? item.variations : [];
  const quantidade = Math.max(
    0,
    Math.trunc(
      variacoes.length > 0
        ? variacoes.reduce(
            (soma, variacao) =>
              soma + numero(variacao.available_quantity),
            0
          )
        : numero(item.available_quantity)
    )
  );
  const status = texto(item.status, 40);
  const ativo = status === 'active' ? 1 : 0;
  const permalink = texto(item.permalink, 500);
  const categoryId = texto(item.category_id, 80);
  const thumbnail = normalizarImagemMl(item.thumbnail);
  const health = Number(item.health);
  const mlHealth = Number.isFinite(health) && health > 0 ? health : null;
  const condicao = item.condition === 'new' ? 'novo' : 'usado';
  const agora = new Date().toISOString();

  if (!peca) {
    let descricao = await obterDescricaoItem(mlItemId);

    if (!descricao) descricao = titulo;

    const categoria = classificarCategoria(titulo, descricao, '');
    const categoriaMl = sugerirCategoriaMl(categoria);
    let sku = sellerSku || `ML-${mlItemId}`;
    const skuEmUso = await db.get(
      'SELECT id FROM pecas WHERE UPPER(sku) = UPPER(?) LIMIT 1',
      [sku]
    );

    if (skuEmUso) sku = `ML-${mlItemId}`;

    const valores = [
      titulo || `Anúncio ${mlItemId}`,
      sku,
      '',
      descricao,
      categoria,
      categoriaMl,
      atributoItem(item, ['BRAND', 'MARCA']),
      atributoItem(item, ['MODEL', 'MODELO']),
      atributoItem(item, ['VEHICLE_YEAR', 'YEAR', 'ANO']),
      condicao,
      atributoItem(item, ['PART_NUMBER', 'OEM', 'GTIN']),
      '',
      dimensoes.pesoKg,
      dimensoes.comprimentoCm,
      dimensoes.larguraCm,
      dimensoes.alturaCm,
      montarAtributos(item),
      titulo.slice(0, 60),
      texto(item.listing_type_id, 40) || 'clássico',
      quantidade,
      preco,
      ativo,
      mlItemId,
      permalink,
      status,
      categoryId,
      thumbnail,
      mlHealth,
      agora
    ];
    const inserir = () =>
      db.run(
        `INSERT INTO pecas (
           nome, sku, carro, descricao, categoria, categoria_ml, marca, modelo,
           ano, condicao, numero_oem, garantia, peso_kg, comprimento_cm,
           largura_cm, altura_cm, atributos, ml_titulo, tipo_anuncio,
           quantidade, preco, ml_ativo, ml_item_id, ml_permalink, ml_status,
           ml_category_id, ml_thumbnail, ml_health, ml_sincronizado_em
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        valores
      );

    let resultado;

    try {
      resultado = await inserir();
    } catch (erro) {
      // Anúncios diferentes podem compartilhar o mesmo SKU do vendedor. Numa
      // sincronização paralela os dois passam pela verificação ao mesmo tempo,
      // então o segundo insert cai na constraint UNIQUE de pecas.sku. Nesse
      // caso usa o SKU único do item do Mercado Livre.
      if (!String(erro?.message || '').includes('UNIQUE constraint failed')) {
        throw erro;
      }

      valores[1] = `ML-${mlItemId}`;
      resultado = await inserir();
    }

    return { criado: true, peca_id: resultado.lastID };
  }

  await db.run(
    `UPDATE pecas SET
       preco = ?,
       quantidade = ?,
       ml_ativo = ?,
       ml_item_id = ?,
       ml_permalink = ?,
       ml_status = ?,
       ml_category_id = ?,
       ml_thumbnail = ?,
       ml_health = COALESCE(?, ml_health),
       ml_sincronizado_em = ?,
       peso_kg = CASE
         WHEN COALESCE(peso_kg, 0) <= 0 THEN ?
         ELSE peso_kg
       END,
       comprimento_cm = CASE
         WHEN COALESCE(comprimento_cm, 0) <= 0 THEN ?
         ELSE comprimento_cm
       END,
       largura_cm = CASE
         WHEN COALESCE(largura_cm, 0) <= 0 THEN ?
         ELSE largura_cm
       END,
       altura_cm = CASE
         WHEN COALESCE(altura_cm, 0) <= 0 THEN ?
         ELSE altura_cm
       END,
       ml_titulo = CASE
         WHEN TRIM(COALESCE(ml_titulo, '')) = '' THEN ?
         ELSE ml_titulo
       END,
       descricao = CASE
         WHEN TRIM(COALESCE(descricao, '')) = '' THEN ?
         ELSE descricao
       END
     WHERE id = ?`,
    [
      preco,
      quantidade,
      ativo,
      mlItemId,
      permalink,
      status,
      categoryId,
      thumbnail,
      mlHealth,
      agora,
      dimensoes.pesoKg,
      dimensoes.comprimentoCm,
      dimensoes.larguraCm,
      dimensoes.alturaCm,
      titulo,
      titulo,
      peca.id
    ]
  );

  return { criado: false, peca_id: peca.id };
}

export async function sincronizarPecas() {
  return comSincronizacao('pecas', async () => {
    const integracao = await obterIntegracaoObrigatoria();
    const ids = await listarIdsAnuncios(integracao.user_id);
    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (let indice = 0; indice < ids.length; indice += 20) {
      const lote = ids.slice(indice, indice + 20);
      const dados = await mlFetch(`/items?ids=${lote.join(',')}`);
      const lista = Array.isArray(dados) ? dados : [];
      const resultados = await mapComLimite(
        lista,
        CONCORRENCIA_DESCRICOES,
        (entrada) => {
          if (!entrada || Number(entrada.code) !== 200 || !entrada.body) {
            return { ignorado: true };
          }

          return upsertPecaMl(entrada.body);
        }
      );

      for (const resultado of resultados) {
        if (resultado.ignorado) {
          ignorados += 1;
        } else if (resultado.criado) {
          criados += 1;
        } else {
          atualizados += 1;
        }
      }
    }

    return {
      itens: ids.length,
      criados,
      atualizados,
      ignorados
    };
  });
}

function extrairId(valor) {
  const encontrado = String(valor || '').match(/(\d+)/);
  return encontrado ? encontrado[1] : '';
}

function montarPayloadVenda(order) {
  const orderId = texto(order?.id, 120);

  if (!orderId) throw new Error('Pedido sem ID');

  const orderItems = Array.isArray(order.order_items)
    ? order.order_items
    : [];
  const itens = orderItems.map((orderItem) => {
    const item = orderItem?.item || {};
    const sku = texto(
      item.seller_sku || item.seller_custom_field || item.id,
      100
    ).toUpperCase();

    return {
      sku: sku || `ML-${orderId}`,
      descricao: texto(item.title, 500),
      quantidade: Math.max(
        1,
        Math.trunc(numero(orderItem.quantity || 1))
      ),
      preco_unitario: numero(orderItem.unit_price)
    };
  });

  if (itens.length === 0) throw new Error('Pedido sem itens');

  const buyer = order.buyer || {};
  const pagamentos = Array.isArray(order.payments) ? order.payments : [];
  const pagamento =
    pagamentos.find(
      (item) => String(item?.status || '').toLowerCase() === 'approved'
    ) ||
    pagamentos[0] ||
    {};
  const taxa =
    pagamentos.reduce(
      (total, item) => total + numero(item.sale_fee),
      0
    ) ||
    orderItems.reduce(
      (total, item) => total + numero(item.sale_fee),
      0
    );
  const total =
    numero(order.total_amount) ||
    itens.reduce(
      (soma, item) => soma + item.quantidade * item.preco_unitario,
      0
    );
  const dataVenda =
    order.date_closed || order.date_created || order.last_updated;
  const dataRecebimento =
    pagamento.date_approved ||
    (String(order.status || '').toLowerCase() === 'paid'
      ? order.date_closed
      : null);
  const telefone = buyer.phone;

  return {
    order_id: orderId,
    status: order.status,
    plataforma: 'Mercado Livre',
    valor: total,
    taxa_ml: taxa,
    data_venda: dataSql(dataVenda),
    data_recebimento: dataSql(dataRecebimento),
    data_prevista_recebimento: dataSql(pagamento.money_release_date),
    last_updated: dataSql(order.last_updated) || new Date().toISOString(),
    metodo_pagamento: texto(
      pagamento.payment_method_id || pagamento.payment_type,
      80
    ),
    ml_pack_id: texto(order.pack_id || order.id, 120),
    ml_status: texto(order.status, 80),
    buyer: {
      id: texto(buyer.id, 40),
      nickname: texto(buyer.nickname, 80),
      name: texto(
        [buyer.first_name, buyer.last_name].filter(Boolean).join(' ') ||
          buyer.nickname ||
          buyer.name,
        200
      ),
      email: texto(buyer.email, 200),
      phone: texto(
        typeof telefone === 'object'
          ? telefone?.number || telefone?.area_code
          : telefone,
        60
      ),
      identification: buyer.identification || null,
      address:
        buyer.address ||
        order.shipping?.receiver_address ||
        null
    },
    items: itens
  };
}

async function obterBillingClienteMl(orderId) {
  if (!orderId) return null;
  const cache = cacheBillingCliente.get(String(orderId));
  if (cache && Date.now() - cache.criadoEm < MARGEM_EXPIRACAO_MS) {
    return cache.dados;
  }

  try {
    const dados = await mlFetch(
      `/orders/${encodeURIComponent(orderId)}/billing_info`
    );
    const info = Array.isArray(dados?.billing_info?.additional_info)
      ? dados.billing_info.additional_info
      : [];
    const valor = (tipo) =>
      texto(
        info.find(
          (item) => String(item?.type || '').toUpperCase() === tipo
        )?.value,
        200
      );
    const rua = valor('STREET_NAME');
    const numero = valor('STREET_NUMBER');
    const bairro = valor('NEIGHBORHOOD');
    const cidade = valor('CITY_NAME');
    const estado = valor('STATE_CODE').replace(/^BR-/i, '');
    const cep = valor('ZIP_CODE');
    const partes = [];

    if (rua) partes.push([rua, numero].filter(Boolean).join(', '));
    if (bairro) partes.push(bairro);
    if (cidade || estado) {
      partes.push([cidade, estado].filter(Boolean).join('/'));
    }
    if (cep) partes.push(`CEP: ${cep}`);

    const resultado = {
      cpf: texto(dados?.billing_info?.doc_number, 30),
      endereco: texto(partes.join(' - '), 300)
    };
    cacheBillingCliente.set(String(orderId), {
      dados: resultado,
      criadoEm: Date.now()
    });
    return resultado;
  } catch {
    return null;
  }
}

function pedidoACombinarComComprador(order) {
  const modo = texto(order?.shipping?.mode, 40).toLowerCase();
  const status = texto(order?.shipping?.status, 40).toLowerCase();
  const tags = Array.isArray(order?.tags) ? order.tags : [];
  return (
    ['custom', 'not_specified'].includes(modo) ||
    status === 'to_be_agreed' ||
    tags.includes('no_shipping') ||
    (!texto(order?.shipping?.id, 100) &&
      ['paid', 'partially_paid'].includes(texto(order?.status, 40).toLowerCase()))
  );
}

function envioACombinarDoPedido(order) {
  const shipping = order?.shipping || {};
  const statusPedido = texto(order?.status, 60).toLowerCase();
  const cancelado = ['cancelled', 'canceled'].includes(statusPedido);
  return {
    id: texto(shipping.id, 100) || `COMBINAR-${texto(order?.id, 80)}`,
    order_id: texto(order?.id, 120),
    pack_id: texto(order?.pack_id, 120),
    status: cancelado
      ? statusPedido
      : order?.fulfilled === true
        ? 'delivered'
        : texto(shipping.status || order?.status, 60),
    substatus: texto(shipping.substatus, 80),
    logistic_type: texto(
      shipping.logistic_type || shipping.mode || 'custom',
      80
    ),
    tracking_method: texto(shipping.tracking_method, 120),
    tracking_number: texto(shipping.tracking_number, 120),
    receiver_address: shipping.receiver_address || {},
    shipping_option: shipping.shipping_option || {},
    status_history: shipping.status_history || {},
    date_created: order?.date_created
  };
}

async function vincularPecaVenda(order) {
  const itens = Array.isArray(order.order_items)
    ? order.order_items
    : [];

  if (itens.length !== 1) return;

  const mlItemId = texto(itens[0]?.item?.id, 100);

  if (!mlItemId) return;

  const db = getDb();
  const peca = await db.get('SELECT id FROM pecas WHERE ml_item_id = ?', [
    mlItemId
  ]);

  if (!peca) return;

  await db.run('UPDATE vendas SET peca_id = ? WHERE order_id = ?', [
    peca.id,
    String(order.id)
  ]);
}

export async function sincronizarVendas({ dias = 30 } = {}) {
  return comSincronizacao('vendas', async () => {
    const integracao = await obterIntegracaoObrigatoria();
    const desde = Date.now() - Math.max(1, numero(dias) || 30) * 86400000;
    let offset = 0;
    let total = 0;
    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;

    // Pedidos antigos podem ter sido importados antes de buscarmos o CPF e o
    // endereço no billing_info; só consultamos o Mercado Livre para os que
    // ainda estão sem esses dados.
    const db = getDb();
    const linhasCompletas = await db.all(
      `SELECT order_id FROM vendas
        WHERE TRIM(COALESCE(cliente_cpf, '')) <> ''
          AND TRIM(COALESCE(cliente_endereco, '')) <> ''`
    );
    const clientesCompletos = new Set(
      linhasCompletas.map((linha) => String(linha.order_id))
    );

    while (offset < LIMITE_PEDIDOS) {
      const dados = await mlFetch(
        `/orders/search?seller=${encodeURIComponent(
          integracao.user_id
        )}&sort=date_desc&limit=50&offset=${offset}`
      );
      const resultados = Array.isArray(dados?.results)
        ? dados.results
        : [];

      for (const order of resultados) {
        const dataPedido = new Date(
          order?.date_created || order?.date_closed || 0
        ).getTime();

        if (Number.isFinite(dataPedido) && dataPedido < desde) {
          ignorados += 1;
          continue;
        }

        try {
          const payload = montarPayloadVenda(order);

          if (!clientesCompletos.has(String(order.id))) {
            const dadosCliente = await obterBillingClienteMl(order.id);

            if (dadosCliente) {
              if (!payload.buyer.identification && dadosCliente.cpf) {
                payload.buyer.identification = {
                  type: 'CPF',
                  number: dadosCliente.cpf
                };
              }

              if (!payload.buyer.address && dadosCliente.endereco) {
                payload.buyer.address = dadosCliente.endereco;
              }

              if (dadosCliente.cpf && dadosCliente.endereco) {
                clientesCompletos.add(String(order.id));
              }
            }
          }

          const resultado = await upsertVenda(payload, {
            plataforma: 'Mercado Livre'
          });

          if (resultado.atualizado) {
            atualizados += 1;
          } else {
            criados += 1;
          }

          await vincularPecaVenda(order);
          if (pedidoACombinarComComprador(order)) {
            await upsertEnvio({
              shipment: envioACombinarDoPedido(order),
              order,
              combinarComprador: true
            });
          }
        } catch (error) {
          ignorados += 1;
          console.error(
            `Erro ao importar pedido ${order?.id} do Mercado Livre:`,
            error.message
          );
        }
      }

      total += resultados.length;
      offset += resultados.length;

      const totalApi = numero(dados?.paging?.total);

      if (
        resultados.length < 50 ||
        resultados.length === 0 ||
        (totalApi > 0 && offset >= totalApi)
      ) {
        break;
      }
    }

    return {
      itens: total,
      criados,
      atualizados,
      ignorados
    };
  });
}

export async function sincronizarEnvios({
  dias = 60,
  limite = 200,
  forcar = false
} = {}) {
  return comSincronizacao('envios', async () => {
    const integracao = await obterIntegracaoObrigatoria();
    const db = getDb();
    const janelaDias = Math.min(
      365,
      Math.max(1, Math.trunc(numero(dias) || 60))
    );
    const desde = Date.now() - janelaDias * 86400000;
    const limitePedidos = Math.min(
      500,
      Math.max(1, Math.trunc(numero(limite) || 200))
    );
    const existentes = new Map();

    for (const linha of await db.all(
      'SELECT shipment_id, status, sincronizado_em FROM ml_envios'
    )) {
      existentes.set(String(linha.shipment_id), linha);
    }

    const pendentes = [];
    let offset = 0;
    let analisados = 0;
    let semEnvio = 0;
    let antigos = 0;
    let ignorados = 0;

    while (offset < limitePedidos) {
      const dados = await mlFetch(
        `/orders/search?seller=${encodeURIComponent(
          integracao.user_id
        )}&sort=date_desc&limit=50&offset=${offset}`
      );
      const resultados = Array.isArray(dados?.results)
        ? dados.results
        : [];

      for (const order of resultados) {
        const dataPedido = new Date(
          order?.date_created || order?.date_closed || 0
        ).getTime();

        if (Number.isFinite(dataPedido) && dataPedido < desde) {
          antigos += 1;
          continue;
        }

        const combinarComprador = pedidoACombinarComComprador(order);
        const shipmentId =
          texto(order?.shipping?.id, 100) ||
          (combinarComprador
            ? `COMBINAR-${texto(order?.id, 80)}`
            : '');

        if (!shipmentId) {
          semEnvio += 1;
          continue;
        }

        analisados += 1;

        const existente = existentes.get(shipmentId);
        const statusAtual = String(existente?.status || '').toLowerCase();
        const finalizado = [
          'delivered',
          'cancelled',
          'canceled',
          'not_delivered',
          'returned'
        ].includes(statusAtual);
        const idade = existente?.sincronizado_em
          ? Date.now() - new Date(existente.sincronizado_em).getTime()
          : Number.POSITIVE_INFINITY;
        const vencido =
          !existente ||
          (finalizado
            ? idade > 24 * 60 * 60 * 1000
            : idade >= 5000);

        if (!forcar && !vencido) {
          ignorados += 1;
          continue;
        }

        pendentes.push({ order, shipmentId, combinarComprador });
      }

      offset += resultados.length;

      const totalApi = numero(dados?.paging?.total);

      if (
        resultados.length === 0 ||
        resultados.length < 50 ||
        (totalApi > 0 && offset >= totalApi) ||
        offset >= limitePedidos
      ) {
        break;
      }
    }

    let criados = 0;
    let atualizados = 0;
    let erros = 0;
    const falhas = [];

    await mapComLimite(pendentes, 4, async (pendente) => {
      const { order, shipmentId, combinarComprador } = pendente;

      try {
        let shipment;
        if (combinarComprador) {
          const venda = await db.get(
            'SELECT id FROM vendas WHERE order_id = ?',
            [String(order.id)]
          );
          if (!venda) {
            await upsertVenda(montarPayloadVenda(order), {
              plataforma: 'Mercado Livre'
            });
            await vincularPecaVenda(order);
          }
          shipment = envioACombinarDoPedido(order);
        } else {
          shipment = await mlFetch(
            `/shipments/${encodeURIComponent(shipmentId)}`
          );
        }
        const resultado = await upsertEnvio({
          shipment,
          order,
          combinarComprador
        });

        if (resultado.criado) {
          criados += 1;
        } else if (resultado.atualizado) {
          atualizados += 1;
        }
      } catch (error) {
        erros += 1;

        if (falhas.length < 10) {
          falhas.push({
            order_id: order?.id || null,
            shipment_id: shipmentId,
            erro: error.message
          });
        }

        console.error(
          `Erro ao sincronizar envio ${shipmentId} do pedido ${order?.id}:`,
          error.message
        );
      }
    });

    return {
      itens: pendentes.length,
      pedidos: analisados,
      criados,
      atualizados,
      ignorados,
      erros,
      sem_envio: semEnvio,
      antigos,
      falhas
    };
  });
}

async function buscarPerguntasPorStatus(status) {
  const integracao = await obterIntegracaoObrigatoria();
  const perguntas = [];
  let offset = 0;

  while (perguntas.length < LIMITE_PERGUNTAS) {
    const dados = await mlFetch(
      `/questions/search?seller_id=${encodeURIComponent(
        integracao.user_id
      )}&status=${encodeURIComponent(status)}&api_version=4&limit=50&offset=${offset}`
    );
    const lista = Array.isArray(dados?.questions)
      ? dados.questions
      : Array.isArray(dados?.results)
        ? dados.results
        : [];

    perguntas.push(...lista);
    offset += lista.length;

    const total = numero(dados?.total ?? dados?.paging?.total);

    if (
      lista.length < 50 ||
      lista.length === 0 ||
      (total > 0 && offset >= total)
    ) {
      break;
    }
  }

  return perguntas;
}

async function buscarTodasPerguntas({ sort = '' } = {}) {
  const integracao = await obterIntegracaoObrigatoria();
  const perguntas = [];
  let offset = 0;
  const ordenacao = sort ? `&sort=${encodeURIComponent(sort)}` : '';

  while (perguntas.length < LIMITE_PERGUNTAS) {
    const dados = await mlFetch(
      `/questions/search?seller_id=${encodeURIComponent(
        integracao.user_id
      )}&api_version=4&limit=50&offset=${offset}${ordenacao}`
    );
    const lista = Array.isArray(dados?.questions)
      ? dados.questions
      : Array.isArray(dados?.results)
        ? dados.results
        : [];

    perguntas.push(...lista);
    offset += lista.length;

    const total = numero(dados?.total ?? dados?.paging?.total);

    if (
      lista.length < 50 ||
      lista.length === 0 ||
      (total > 0 && offset >= total)
    ) {
      break;
    }
  }

  return perguntas;
}

async function upsertPerguntaMl(perguntaMl) {
  const db = getDb();
  const mlQuestionId = texto(perguntaMl?.id, 100);

  if (!mlQuestionId) return { ignorado: true };

  const mlItemId = texto(perguntaMl?.item_id, 100);
  const peca = mlItemId
    ? await db.get('SELECT id FROM pecas WHERE ml_item_id = ?', [mlItemId])
    : null;
  const respondida =
    String(perguntaMl?.status || '').toUpperCase() === 'ANSWERED' ||
    Boolean(perguntaMl?.answer?.text) ||
    // CLOSED_UNANSWERED: o comprador encerrou a pergunta e ela não aceita mais
    // resposta; não deve continuar contando como pendente no Atendimento.
    String(perguntaMl?.status || '')
      .toUpperCase()
      .startsWith('CLOSED');
  const resposta = texto(perguntaMl?.answer?.text, 5000);
  const dataPergunta =
    dataSql(perguntaMl?.date_created) || new Date().toISOString();
  const dataResposta = dataSql(perguntaMl?.answer?.date_created);
  const existente = await db.get(
    'SELECT id FROM perguntas_ml WHERE ml_question_id = ?',
    [mlQuestionId]
  );

  if (existente) {
    await db.run(
      `UPDATE perguntas_ml SET
         peca_id = COALESCE(?, peca_id),
         pergunta = ?,
         ml_item_id = ?,
         ml_status = ?,
         data_pergunta = COALESCE(?, data_pergunta),
         resposta = CASE WHEN ? <> '' THEN ? ELSE resposta END,
         respondida = CASE
           WHEN ? = 1 THEN 1
           WHEN TRIM(COALESCE(resposta, '')) <> '' THEN 1
           ELSE 0
         END,
         data_resposta = COALESCE(?, data_resposta),
         atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        peca?.id ?? null,
        texto(perguntaMl?.text, 5000),
        mlItemId,
        texto(perguntaMl?.status, 40),
        dataPergunta,
        resposta,
        resposta,
        respondida ? 1 : 0,
        dataResposta,
        existente.id
      ]
    );

    return { criado: false, id: existente.id };
  }

  const resultado = await db.run(
    `INSERT INTO perguntas_ml (
       peca_id, pergunta, resposta, respondida, data_pergunta,
       ml_question_id, ml_item_id, ml_status, data_resposta, atualizado_em
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      peca?.id ?? null,
      texto(perguntaMl?.text, 5000),
      resposta || null,
      respondida ? 1 : 0,
      dataPergunta,
      mlQuestionId,
      mlItemId,
      texto(perguntaMl?.status, 40),
      dataResposta
    ]
  );

  return { criado: true, id: resultado.lastID };
}

export async function sincronizarPerguntas({ apenasPendentes = false } = {}) {
  return comSincronizacao('perguntas', async () => {
    // Modo leve usado pela sincronização automática: busca só as UNANSWERED e
    // resolve no banco o que deixou de ser pendente, sem varrer as ~1000
    // perguntas antigas a cada minuto.
    if (apenasPendentes) {
      const db = getDb();
      const antes = await db.all(
        `SELECT ml_question_id FROM perguntas_ml
          WHERE respondida = 0 AND ml_question_id IS NOT NULL`
      );
      const pendentes = await buscarPerguntasPorStatus('UNANSWERED');
      const ids = new Set();
      let criados = 0;
      let atualizados = 0;
      let ignorados = 0;

      for (const pergunta of pendentes) {
        const id = texto(pergunta?.id, 100);
        const status = String(pergunta?.status || '').toUpperCase();

        if (
          !id ||
          ids.has(id) ||
          ['BANNED', 'DELETED', 'DISABLED'].includes(status)
        ) {
          ignorados += 1;
          continue;
        }

        ids.add(id);

        const resultado = await upsertPerguntaMl(pergunta);

        if (resultado.ignorado) {
          ignorados += 1;
        } else if (resultado.criado) {
          criados += 1;
        } else {
          atualizados += 1;
        }
      }

      // O que estava pendente e não apareceu mais como UNANSWERED foi
      // respondido ou encerrado no Mercado Livre. Busca o detalhe de cada um
      // para guardar o texto da resposta e o status real, e não só sumir da
      // lista de pendentes.
      const resolvidos = antes
        .map((linha) => texto(linha.ml_question_id, 100))
        .filter((id) => id && !ids.has(id));
      const aindaPendentes = new Set();

      for (const id of resolvidos) {
        try {
          const detalhe = await mlFetch(
            `/questions/${encodeURIComponent(id)}`
          );

          if (detalhe?.id) {
            if (
              String(detalhe.status || '').toUpperCase() === 'UNANSWERED' &&
              !detalhe.answer?.text
            ) {
              aindaPendentes.add(id);
            }

            const resultado = await upsertPerguntaMl(detalhe);

            if (resultado.ignorado) {
              ignorados += 1;
            } else if (resultado.criado) {
              criados += 1;
            } else {
              atualizados += 1;
            }
          }
        } catch {
          // Pergunta apagada ou indisponível: o UPDATE abaixo resolve a linha.
        }
      }

      const paraFechar = resolvidos.filter((id) => !aindaPendentes.has(id));

      if (paraFechar.length > 0) {
        await db.run(
          `UPDATE perguntas_ml
              SET respondida = 1,
                  atualizado_em = CURRENT_TIMESTAMP
            WHERE respondida = 0
              AND ml_question_id IN (${paraFechar
                .map(() => '?')
                .join(', ')})`,
          paraFechar
        );
      }

      return { itens: ids.size, criados, atualizados, ignorados };
    }

    // A busca geral é limitada a 1000 itens e o vendedor já tem mais que isso.
    // Buscar as UNANSWERED garante que nenhuma pendente fique de fora; buscar
    // as mais novas e as mais antigas cobre os dois extremos, porque a API não
    // permite offset acima de 1000.
    const pendentes = await buscarPerguntasPorStatus('UNANSWERED');
    const recentes = await buscarTodasPerguntas({ sort: 'date_desc' });
    const antigas = await buscarTodasPerguntas({ sort: 'date_asc' });
    const unicas = new Map();

    for (const pergunta of [...pendentes, ...recentes, ...antigas]) {
      const id = texto(pergunta?.id, 100);
      if (id) unicas.set(id, pergunta);
    }

    const vistos = new Set();
    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (const pergunta of unicas.values()) {
      const id = texto(pergunta?.id, 100);
      const status = String(pergunta?.status || '').toUpperCase();

      if (
        !id ||
        vistos.has(id) ||
        ['BANNED', 'DELETED', 'DISABLED'].includes(status)
      ) {
        ignorados += 1;
        continue;
      }

      vistos.add(id);

      const resultado = await upsertPerguntaMl(pergunta);

      if (resultado.ignorado) {
        ignorados += 1;
      } else if (resultado.criado) {
        criados += 1;
      } else {
        atualizados += 1;
      }
    }

    // Reconciliação: o que o Mercado Livre não lista mais como UNANSWERED
    // (respondida ou encerrada) deixa de ser pendente no sistema. A lista de
    // pendentes vem do conjunto completo buscado, e não só da primeira
    // consulta, para não esconder pergunta criada no meio da sincronização.
    const db = getDb();
    const idsPendentes = [...unicas.values()]
      .filter(
        (pergunta) =>
          String(pergunta?.status || '').toUpperCase() === 'UNANSWERED'
      )
      .map((pergunta) => texto(pergunta?.id, 100))
      .filter(Boolean);

    if (unicas.size === 0) {
      return {
        itens: 0,
        criados,
        atualizados,
        ignorados
      };
    }

    if (idsPendentes.length > 0) {
      await db.run(
        `UPDATE perguntas_ml
            SET respondida = 1,
                atualizado_em = CURRENT_TIMESTAMP
          WHERE respondida = 0
            AND ml_question_id NOT IN (${idsPendentes
              .map(() => '?')
              .join(', ')})
            AND NOT (
              ml_status = 'UNANSWERED'
              AND TRIM(COALESCE(resposta, '')) = ''
            )`,
        idsPendentes
      );
    } else {
      await db.run(
        `UPDATE perguntas_ml
            SET respondida = 1,
                atualizado_em = CURRENT_TIMESTAMP
          WHERE respondida = 0
            AND NOT (
              ml_status = 'UNANSWERED'
              AND TRIM(COALESCE(resposta, '')) = ''
            )`
      );
    }

    return {
      itens: vistos.size,
      criados,
      atualizados,
      ignorados
    };
  });
}

export async function responderPerguntaMl(mlQuestionId, resposta) {
  const id = Number(mlQuestionId);
  const conteudo = texto(resposta, 5000);

  if (!Number.isInteger(id) || id <= 0) {
    throw new MercadoLivreError(
      'Identificador da pergunta do Mercado Livre inválido.',
      400
    );
  }

  if (!conteudo) {
    throw new MercadoLivreError('A resposta não pode ficar vazia.', 400);
  }

  return mlFetch('/answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question_id: id,
      text: conteudo
    })
  });
}

function mapearStatusClaim(status) {
  const mapa = {
    opened: 'aberta',
    closed: 'fechada',
    dispute: 'em disputa',
    remediated: 'resolvida',
    canceled: 'cancelada',
    cancelled: 'cancelada'
  };
  const chave = String(status || '').toLowerCase();

  return mapa[chave] || texto(status, 80) || 'aberta';
}

const cacheMotivosClaim = new Map();

async function obterMotivoClaim(claim) {
  const motivoId = texto(claim?.reason_id || claim?.reason?.id, 60);

  if (!motivoId) return null;

  if (cacheMotivosClaim.has(motivoId)) {
    return cacheMotivosClaim.get(motivoId);
  }

  try {
    const dados = await mlFetch(
      `/post-purchase/v1/claims/reasons/${encodeURIComponent(motivoId)}`
    );
    const motivo = {
      detalhe: texto(dados?.detail || dados?.name, 300),
      nome: texto(dados?.name, 120)
    };

    cacheMotivosClaim.set(motivoId, motivo);
    return motivo;
  } catch {
    return null;
  }
}

async function upsertReclamacaoMl(claim) {
  const db = getDb();
  const mlClaimId = texto(claim?.id, 100);

  if (!mlClaimId) return { ignorado: true };

  // O search de claims devolve o pedido em resource_id (resource = "order").
  const pedidoId = texto(
    claim.order_id ||
      (String(claim.resource || '').toLowerCase() === 'order'
        ? claim.resource_id
        : '') ||
      extrairId(claim.resource),
    120
  );
  let pecaId = null;

  if (pedidoId) {
    const venda = await db.get(
      'SELECT peca_id FROM vendas WHERE order_id = ?',
      [pedidoId]
    );
    pecaId = venda?.peca_id || null;
  }

  const motivoApi = await obterMotivoClaim(claim);
  const motivo = texto(
    motivoApi?.detalhe ||
      claim.reason?.detail ||
      claim.reason?.name ||
      claim.reason_id ||
      claim.type ||
      'Reclamação',
    300
  );
  const descricao = texto(
    motivoApi?.detalhe ||
      claim.reason?.detail ||
      claim.description ||
      '',
    5000
  );
  const status = mapearStatusClaim(claim.status);
  const data = dataSql(claim.date_created) || new Date().toISOString();
  const existente = await db.get(
    'SELECT id FROM reclamacoes_ml WHERE ml_claim_id = ?',
    [mlClaimId]
  );

  if (existente) {
    await db.run(
      `UPDATE reclamacoes_ml SET
         peca_id = COALESCE(?, peca_id),
         pedido_id = COALESCE(NULLIF(?, ''), pedido_id),
         motivo = ?,
         descricao = ?,
         status = ?,
         data_reclamacao = COALESCE(?, data_reclamacao),
         ml_status = ?,
         atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        pecaId,
        pedidoId,
        motivo,
        descricao,
        status,
        data,
        texto(claim.status, 40),
        existente.id
      ]
    );

    return { criado: false, id: existente.id };
  }

  const resultado = await db.run(
    `INSERT INTO reclamacoes_ml (
       peca_id, pedido_id, motivo, descricao, status, data_reclamacao,
       ml_claim_id, ml_status, atualizado_em
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      pecaId,
      pedidoId || null,
      motivo,
      descricao,
      status,
      data,
      mlClaimId,
      texto(claim.status, 40)
    ]
  );

  return { criado: true, id: resultado.lastID };
}

export async function sincronizarReclamacoes() {
  return comSincronizacao('reclamacoes', async () => {
    let offset = 0;
    let total = 0;
    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;

    while (offset < LIMITE_RECLAMACOES) {
      const dados = await mlFetch(
        `/post-purchase/v1/claims/search?stage=dispute&status=opened&limit=50&offset=${offset}`
      );
      const lista = Array.isArray(dados?.data) ? dados.data : [];

      for (const claim of lista) {
        const resultado = await upsertReclamacaoMl(claim);

        if (resultado.ignorado) {
          ignorados += 1;
        } else if (resultado.criado) {
          criados += 1;
        } else {
          atualizados += 1;
        }
      }

      total += lista.length;
      offset += lista.length;

      const totalApi = numero(dados?.paging?.total);

      if (
        lista.length < 50 ||
        lista.length === 0 ||
        (totalApi > 0 && offset >= totalApi)
      ) {
        break;
      }
    }

    return {
      itens: total,
      criados,
      atualizados,
      ignorados
    };
  });
}

const ENTIDADES_HTML = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  atilde: 'ã',
  otilde: 'õ',
  ccedil: 'ç',
  ecirc: 'ê',
  ocirc: 'ô',
  acirc: 'â',
  agrave: 'à',
  ordf: 'ª',
  ordm: 'º',
  deg: '°',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  euro: '€'
};

function codigoParaCaractere(codigo) {
  const numero = Number(codigo);

  if (!Number.isInteger(numero) || numero < 0 || numero > 0x10ffff) {
    return ' ';
  }

  try {
    return String.fromCodePoint(numero);
  } catch {
    return ' ';
  }
}

function decodificarEntidades(valor) {
  return String(valor ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, codigo) =>
      codigoParaCaractere(Number.parseInt(codigo, 16))
    )
    .replace(/&#(\d+);/g, (_, codigo) => codigoParaCaractere(codigo))
    .replace(/&([a-z][a-z0-9]+);/gi, (original, nome) => {
      const chave = nome.toLowerCase();
      return Object.prototype.hasOwnProperty.call(ENTIDADES_HTML, chave)
        ? ENTIDADES_HTML[chave]
        : original;
    });
}

function htmlParaTexto(valor) {
  const semTags = String(valor ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodificarEntidades(decodificarEntidades(semTags))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function obterDetalheReclamacao(mlClaimId) {
  const id = texto(mlClaimId, 100);

  if (!id) return null;

  return mlFetch(`/post-purchase/v1/claims/${encodeURIComponent(id)}`);
}

export async function obterResolucoesEsperadasReclamacao(mlClaimId) {
  const id = texto(mlClaimId, 100);

  if (!id) return [];

  const dados = await mlFetch(
    `/post-purchase/v1/claims/${encodeURIComponent(id)}/expected-resolutions`
  );

  return Array.isArray(dados) ? dados : [];
}

export async function obterPedidoMl(orderId) {
  const id = texto(orderId, 100);

  if (!id) return null;

  return mlFetch(`/orders/${encodeURIComponent(id)}`);
}

export async function enviarXmlNfeMl(packId, conteudo, nomeArquivo) {
  const id = texto(packId, 100);

  if (!id) {
    throw new MercadoLivreError('Pacote do Mercado Livre inválido.', 400);
  }

  if (!conteudo) {
    throw new MercadoLivreError('O XML da NF-e está vazio.', 400);
  }

  const formulario = new FormData();
  formulario.append(
    'fiscal_document',
    new Blob([conteudo], { type: 'application/xml' }),
    texto(nomeArquivo, 255) || 'nota-fiscal.xml'
  );

  return mlFetch(`/packs/${encodeURIComponent(id)}/fiscal_documents`, {
    method: 'POST',
    body: formulario
  });
}

export async function obterImagensAnuncioMl(itemId) {
  const id = texto(itemId, 100);
  if (!id) throw new MercadoLivreError('Anúncio do Mercado Livre inválido.', 400);

  const anuncio = await mlFetch(`/items/${encodeURIComponent(id)}`);
  const urls = Array.isArray(anuncio?.pictures)
    ? anuncio.pictures
        .map((imagem) => {
          const variacoes = Array.isArray(imagem?.variations)
            ? imagem.variations
            : [];
          const candidatos = [...variacoes, imagem]
            .map((variacao) => {
              const tamanho = String(variacao?.size || '').match(
                /(\d+)\s*x\s*(\d+)/i
              );
              return {
                url: normalizarImagemMl(
                  variacao?.secure_url || variacao?.url
                ),
                pixels: tamanho
                  ? Number(tamanho[1]) * Number(tamanho[2])
                  : 0
              };
            })
            .filter((variacao) => variacao.url)
            .sort((a, b) => b.pixels - a.pixels);

          return candidatos[0]?.url || '';
        })
        .filter(Boolean)
    : [];

  return { itemId: id, imagens: [...new Set(urls)] };
}

export async function obterEnvioMl(shipmentId) {
  const id = texto(shipmentId, 100);

  if (!id) return null;

  return mlFetch(`/shipments/${encodeURIComponent(id)}`);
}

export async function avisarEntregaCombinada(orderId) {
  const id = texto(orderId, 100);
  if (!/^\d+$/.test(id)) throw new MercadoLivreError('Pedido inválido.', 400);
  const order = await mlFetch(`/orders/${id}`);
  if (!pedidoACombinarComComprador(order)) {
    throw new MercadoLivreError('Avisar entrega está disponível apenas para vendas a combinar com o comprador.', 400);
  }
  if (['cancelled', 'canceled'].includes(order.status)) {
    throw new MercadoLivreError('O pedido foi cancelado.', 409);
  }
  if (order.fulfilled !== true) {
    await mlFetch(`/orders/${id}/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fulfilled: true, rating: 'positive' })
    });
  }
  await upsertEnvio({
    shipment: envioACombinarDoPedido({ ...order, fulfilled: true }),
    order, combinarComprador: true
  });
  return { ok: true, mensagem: 'Entrega informada ao Mercado Livre.' };
}

export async function obterEtiquetasEnviosMl(shipmentIds) {
  if (
    !Array.isArray(shipmentIds) ||
    shipmentIds.length === 0 ||
    shipmentIds.length > 50
  ) {
    throw new MercadoLivreError(
      'Selecione entre 1 e 50 envios para imprimir as etiquetas.',
      400
    );
  }

  const ids = shipmentIds.map((id) => texto(id, 100));

  if (ids.some((id) => !/^\d+$/.test(id)) || new Set(ids).size !== ids.length) {
    throw new MercadoLivreError(
      'A lista de envios para impressão é inválida.',
      400
    );
  }

  const parametros = new URLSearchParams({
    shipment_ids: ids.join(','),
    response_type: 'pdf'
  });

  return mlFetchPdf(`/shipment_labels?${parametros.toString()}`);
}

export async function enviarMensagemReclamacao(mlClaimId, mensagem) {
  const id = texto(mlClaimId, 100);
  const conteudo = texto(mensagem, 4000);

  if (!id) {
    throw new MercadoLivreError('Reclamação do Mercado Livre inválida.', 400);
  }

  if (!conteudo) {
    throw new MercadoLivreError('Escreva uma mensagem antes de enviar.', 400);
  }

  return mlFetch(
    `/post-purchase/v1/claims/${encodeURIComponent(id)}/actions/send-message`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver_role: 'mediator',
        message: conteudo
      })
    }
  );
}

function textoMensagemPack(item) {
  const bruto =
    item?.text?.plain ||
    item?.text?.text ||
    (typeof item?.text === 'string' ? item.text : '') ||
    item?.message ||
    '';

  return texto(htmlParaTexto(bruto), 6000);
}

function anexosMensagemPack(item) {
  const lista = Array.isArray(item?.message_attachments)
    ? item.message_attachments
    : Array.isArray(item?.attachments) ? item.attachments : [];
  return lista.map((anexo) => {
    const id = texto(typeof anexo === 'string' ? anexo : anexo?.filename || anexo?.id, 250);
    const mime = texto(anexo?.type || anexo?.mime_type, 100).toLowerCase();
    return {
      id, nome: texto(anexo?.original_filename || id, 250),
      tipo: mime || (/\.(jpe?g)$/i.test(id) ? 'image/jpeg' : /\.png$/i.test(id) ? 'image/png' : /\.gif$/i.test(id) ? 'image/gif' : /\.webp$/i.test(id) ? 'image/webp' : /\.pdf$/i.test(id) ? 'application/pdf' : 'application/octet-stream'),
      bloqueado: anexo?.potential_security_threat === true
    };
  }).filter((anexo) => /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,249}$/.test(anexo.id));
}

export function mapearMensagemPack(item, sellerId, indice = 0, vendaId = null) {
  const fromId = String(item?.from?.user_id ?? item?.from?.id ?? '');
  const papelApi = String(item?.from?.role || '').toLowerCase();
  const papel =
    papelApi === 'seller' || fromId === String(sellerId)
      ? 'vendedor'
      : 'comprador';

  return {
    id: item?.id || item?.message_id || `msg-${indice}`,
    papel,
    texto: textoMensagemPack(item),
    data: dataSql(
      item?.message_date?.created ||
        item?.message_date?.received ||
        item?.date ||
        item?.date_received ||
        null
    ),
    status: texto(item?.status, 40),
    anexos: anexosMensagemPack(item).map((anexo) => ({
      ...anexo,
      url: anexo.bloqueado ? null : `/api/vendas/${vendaId}/mensagens/${encodeURIComponent(item?.id || item?.message_id)}/anexos/${encodeURIComponent(anexo.id)}`
    }))
  };
}

const AGENTES_MENSAGERIA = { MLB: '3037675074', MLC: '3020819166', MCO: '3037204123', MLM: '3037204279', MLA: '3037674934', MLU: '3037204685' };

function avisoConversa(dados) {
  const estado = dados?.conversation_status;
  if (estado?.status !== 'blocked') return '';
  const motivos = {
    blocked_by_claim: 'Esta conversa está bloqueada por uma reclamação. Responda pelo Atendimento da reclamação.',
    blocked_by_mediation: 'Esta venda está em mediação. Responda pelo Atendimento da reclamação.',
    blocked_by_cancelled_order: 'O Mercado Livre bloqueou o chat porque a venda foi cancelada.',
    blocked_by_time: 'O Mercado Livre encerrou o prazo de resposta. O comprador precisa iniciar uma nova mensagem.',
    blocked_by_buyer: 'O comprador bloqueou o recebimento de mensagens.',
    blocked_by_message_pending_review: 'O Mercado Livre está revisando a conversa. Aguarde a liberação.'
  };
  return motivos[estado.substatus] || 'O Mercado Livre bloqueou o envio de mensagens nesta conversa.';
}

export function prepararMensagemVenda({ dados, packId, sellerId, buyerId, siteId, mensagem }) {
  const aviso = avisoConversa(dados);
  if (aviso) throw new MercadoLivreError(aviso, 409);
  const conteudo = String(mensagem ?? '').replace(/\r\n?/g, '\n').trim();
  const limite = Math.min(4000, Math.max(1, Number(dados?.seller_max_message_length) || 350));
  if (!conteudo) throw new MercadoLivreError('Escreva uma mensagem antes de enviar.', 400);
  if (conteudo.length > limite) throw new MercadoLivreError(`Esta conversa aceita até ${limite} caracteres por mensagem.`, 400);
  const usaAgente = /\/conversations\//.test(dados?.conversation_status?.path || '');
  const destino = usaAgente ? AGENTES_MENSAGERIA[siteId] : buyerId;
  if (!destino) throw new MercadoLivreError('Não foi possível identificar o destinatário da conversa.', 400);
  return {
    caminho: `/messages/packs/${encodeURIComponent(packId)}/sellers/${encodeURIComponent(sellerId)}?tag=post_sale`,
    corpo: { from: { user_id: String(sellerId) }, to: { user_id: String(destino) }, text: conteudo }
  };
}

async function buscarMensagensPack(packId, sellerId) {
  const caminho = `/messages/packs/${encodeURIComponent(
    packId
  )}/sellers/${encodeURIComponent(sellerId)}`;

  try {
    return await mlFetch(`${caminho}?tag=post_sale&limit=50`);
  } catch (error) {
    if (error?.statusCode === 404) {
      return await mlFetch(`${caminho}?limit=50`);
    }

    throw error;
  }
}

function encontrarCampoRecursivo(valor, campo, visitados = new Set()) {
  if (!valor || typeof valor !== 'object' || visitados.has(valor)) return undefined;
  visitados.add(valor);

  if (Object.prototype.hasOwnProperty.call(valor, campo)) return valor[campo];
  for (const item of Array.isArray(valor) ? valor : Object.values(valor)) {
    const encontrado = encontrarCampoRecursivo(item, campo, visitados);
    if (encontrado !== undefined) return encontrado;
  }
  return undefined;
}

function encontrarOpcaoGuia(valor, optionId, visitados = new Set()) {
  if (!valor || typeof valor !== 'object' || visitados.has(valor)) return null;
  visitados.add(valor);

  if (String(valor.option_id || '').toUpperCase() === optionId) return valor;
  for (const item of Array.isArray(valor) ? valor : Object.values(valor)) {
    const encontrado = encontrarOpcaoGuia(item, optionId, visitados);
    if (encontrado) return encontrado;
  }
  return null;
}

async function tentarEnviarMensagemPersonalizadaInicial({ packId, mensagem }) {
  let guia;
  try {
    guia = await mlFetch(
      `/messages/action_guide/packs/${encodeURIComponent(packId)}?tag=post_sale`
    );
  } catch (error) {
    // Packs antigos ou casos de exceção continuam usando o endpoint legado.
    if ([400, 404, 405].includes(Number(error?.statusCode))) return false;
    throw error;
  }

  const opcao = encontrarOpcaoGuia(guia, 'OTHER');
  if (!opcao || opcao.available === false || opcao.enabled === false) return false;

  try {
    const caps = await mlFetch(
      `/messages/action_guide/packs/${encodeURIComponent(packId)}/caps_available?tag=post_sale`
    );
    const capDisponivel = encontrarCampoRecursivo(caps, 'cap_available');
    if (capDisponivel !== undefined && Number(capDisponivel) <= 0) {
      throw new MercadoLivreError(
        'O Mercado Livre não disponibilizou uma mensagem personalizada para esta venda no momento.',
        409
      );
    }
  } catch (error) {
    if (error instanceof MercadoLivreError) throw error;
    // Se o endpoint de cap não existir em uma integração legada, o POST abaixo
    // continua sendo a fonte final de verdade do Mercado Livre.
    if (![400, 404, 405].includes(Number(error?.statusCode))) throw error;
  }

  await mlFetch(
    `/messages/action_guide/packs/${encodeURIComponent(packId)}/option?tag=post_sale`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: 'OTHER', text: mensagem })
    }
  );
  return true;
}

async function persistirContatoVenda(vendaId, dados = {}) {
  const db = getDb();
  const packId = texto(dados.packId, 120);
  const buyerId = texto(dados.buyerId, 40);
  const nickname = texto(dados.nickname, 80);

  if (!vendaId || (!packId && !buyerId && !nickname)) return;

  await db.run(
    `UPDATE vendas SET
       ml_pack_id = COALESCE(?, ml_pack_id),
       ml_buyer_id = COALESCE(?, ml_buyer_id),
       ml_buyer_nickname = COALESCE(NULLIF(?, ''), ml_buyer_nickname),
       last_updated = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [packId || null, buyerId || null, nickname, vendaId]
  );
}

export async function obterMensagensVenda(vendaId) {
  const db = getDb();
  const venda = await db.get('SELECT * FROM vendas WHERE id = ?', [vendaId]);

  if (!venda) {
    const error = new MercadoLivreError('Venda não encontrada.', 404);
    throw error;
  }

  const integracao = await obterIntegracao();

  if (!integracao) {
    return {
      mensagens: [],
      conversaDisponivel: false,
      aviso:
        'Conecte a conta do Mercado Livre em Marketplaces para ver e responder o chat desta venda.'
    };
  }

  let packId = texto(venda.ml_pack_id || venda.order_id, 120);
  let buyerId = texto(venda.ml_buyer_id, 40);
  let nickname = texto(venda.ml_buyer_nickname, 80);

  if (venda.order_id && (!buyerId || !venda.ml_pack_id)) {
    try {
      const pedido = await obterPedidoMl(venda.order_id);
      packId = texto(pedido?.pack_id || pedido?.id || packId, 120);
      buyerId = texto(pedido?.buyer?.id || buyerId, 40);
      nickname = texto(pedido?.buyer?.nickname || nickname, 80);
      await persistirContatoVenda(venda.id, { packId, buyerId, nickname });
    } catch {
      // Segue com o que já está salvo no banco.
    }
  }

  if (!packId) {
    return {
      mensagens: [],
      conversaDisponivel: false,
      aviso: 'Esta venda ainda não tem o identificador de conversa do Mercado Livre.'
    };
  }

  try {
    const dados = await buscarMensagensPack(packId, integracao.user_id);
    const lista = Array.isArray(dados?.messages)
      ? dados.messages
      : Array.isArray(dados)
        ? dados
        : [];

    return {
      mensagens: lista
        .map((item, indice) =>
          mapearMensagemPack(item, integracao.user_id, indice, venda.id)
        )
        .filter((item) => item.texto || item.anexos.length)
        .sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))),
      conversaDisponivel: dados?.conversation_status?.status !== 'blocked',
      aviso: avisoConversa(dados),
      limiteMensagem: Math.min(4000, Math.max(1, Number(dados?.seller_max_message_length) || 350)),
      packId,
      buyerId
    };
  } catch (error) {
    if (error?.statusCode === 404) {
      return {
        mensagens: [],
        conversaDisponivel: true,
        packId,
        buyerId,
        aviso: 'Ainda não há mensagens nesta venda.'
      };
    }

    return {
      mensagens: [],
      conversaDisponivel: false,
      packId,
      buyerId,
      aviso:
        error?.message ||
        'Não foi possível carregar o chat desta venda no Mercado Livre.'
    };
  }
}

export async function enviarMensagemVenda(vendaId, mensagem) {
  const conteudo = String(mensagem ?? '').trim();

  if (!conteudo) {
    throw new MercadoLivreError('Escreva uma mensagem antes de enviar.', 400);
  }

  const db = getDb();
  const venda = await db.get('SELECT * FROM vendas WHERE id = ?', [vendaId]);

  if (!venda) {
    throw new MercadoLivreError('Venda não encontrada.', 404);
  }

  const integracao = await obterIntegracaoObrigatoria();
  let packId = texto(venda.ml_pack_id || venda.order_id, 120);
  let buyerId = texto(venda.ml_buyer_id, 40);

  if (!buyerId || !packId) {
    const pedido = await obterPedidoMl(venda.order_id);
    packId = texto(pedido?.pack_id || pedido?.id || packId, 120);
    buyerId = texto(pedido?.buyer?.id || buyerId, 40);
    await persistirContatoVenda(venda.id, {
      packId,
      buyerId,
      nickname: texto(pedido?.buyer?.nickname, 80)
    });
  }

  if (!packId || !buyerId) {
    throw new MercadoLivreError(
      'Não foi possível identificar o comprador desta venda no Mercado Livre.',
      400
    );
  }

  const dados = await buscarMensagensPack(packId, integracao.user_id).catch((error) => {
    if (error.statusCode === 404) return {};
    throw error;
  });

  const mensagensExistentes = Array.isArray(dados?.messages)
    ? dados.messages
    : Array.isArray(dados)
      ? dados
      : [];

  if (mensagensExistentes.length === 0) {
    const enviouPeloGuia = await tentarEnviarMensagemPersonalizadaInicial({
      packId,
      mensagem: conteudo
    });
    if (enviouPeloGuia) return obterMensagensVenda(venda.id);
  }

  const envio = prepararMensagemVenda({ dados, packId, sellerId: integracao.user_id, buyerId, siteId: integracao.site_id || 'MLB', mensagem: conteudo });
  await mlFetch(
    envio.caminho,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envio.corpo)
    }
  );

  return obterMensagensVenda(venda.id);
}

export async function obterAnexoMensagemVenda(vendaId, mensagemId, anexoId, renovou = false) {
  if (!/^[a-zA-Z0-9_-]{1,150}$/.test(mensagemId) || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,249}$/.test(anexoId)) {
    throw new MercadoLivreError('Anexo inválido.', 400);
  }
  const venda = await getDb().get('SELECT order_id, ml_pack_id FROM vendas WHERE id = ?', [vendaId]);
  if (!venda) throw new MercadoLivreError('Venda não encontrada.', 404);
  const integracao = await obterIntegracaoObrigatoria();
  const dados = await mlFetch(`/messages/${encodeURIComponent(mensagemId)}?tag=post_sale`);
  const mensagem = Array.isArray(dados?.messages) ? dados.messages.find((item) => String(item.id || item.message_id) === mensagemId) : dados;
  const recursos = mensagem?.message_resources || [];
  const packId = String(venda.ml_pack_id || venda.order_id);
  const pertence = recursos.some((recurso) => recurso.name === 'packs' && String(recurso.id) === packId) &&
    recursos.some((recurso) => recurso.name === 'sellers' && String(recurso.id) === String(integracao.user_id));
  const legado = mensagem?.resource === 'orders' && String(mensagem.resource_id) === String(venda.order_id) &&
    [mensagem?.from?.user_id, mensagem?.to?.user_id].some((id) => String(id) === String(integracao.user_id));
  if (!pertence && !legado) throw new MercadoLivreError('O anexo não pertence à conversa desta venda.', 404);
  const anexo = anexosMensagemPack(mensagem).find((item) => item.id === anexoId);
  if (!anexo || anexo.bloqueado) throw new MercadoLivreError('Anexo indisponível para visualização.', 404);
  const parametros = new URLSearchParams({ tag: 'post_sale', site_id: integracao.site_id || 'MLB' });
  const resposta = await fetch(`${apiBase()}/messages/attachments/${encodeURIComponent(anexoId)}?${parametros}`, {
    headers: { Authorization: `Bearer ${await obterAccessToken()}` }
  });
  if (resposta.status === 401 && !renovou) {
    await renovarToken(await obterIntegracao());
    return obterAnexoMensagemVenda(vendaId, mensagemId, anexoId, true);
  }
  if (!resposta.ok) throw new MercadoLivreError('Não foi possível baixar o anexo no Mercado Livre.', resposta.status === 404 ? 404 : 502);
  const limite = 25 * 1024 * 1024;
  if (Number(resposta.headers.get('content-length')) > limite) {
    await resposta.body?.cancel();
    throw new MercadoLivreError('O anexo excede o limite de 25 MB.', 502);
  }
  const buffer = Buffer.from(await resposta.arrayBuffer());
  if (buffer.length > limite) throw new MercadoLivreError('O anexo excede o limite de 25 MB.', 502);
  const mime = String(resposta.headers.get('content-type') || anexo.tipo).split(';')[0].trim().toLowerCase();
  const tipo = /^(image\/(jpeg|png|gif|webp|heif|heic)|application\/pdf)$/.test(mime) ? mime : 'application/octet-stream';
  return { buffer, tipo, nome: anexo.nome };
}

export async function obterMensagensReclamacao(mlClaimId) {
  const id = texto(mlClaimId, 100);

  if (!id) return [];

  const dados = await mlFetch(
    `/post-purchase/v1/claims/${encodeURIComponent(id)}/messages`
  );
  const lista = Array.isArray(dados) ? dados : dados?.messages || [];

  return lista.map((item, indice) => ({
    id: item?.id || `${id}-${indice}`,
    remetente: texto(item?.sender_role, 40) || 'desconhecido',
    destinatario: texto(item?.receiver_role, 40) || '',
    mensagem: texto(htmlParaTexto(item?.message), 6000),
    data: dataSql(item?.date_created || item?.date || null),
    anexos: Array.isArray(item?.attachments)
      ? item.attachments.map((anexo) => ({
          nome: texto(anexo?.name || anexo?.filename, 200),
          url: texto(anexo?.url || anexo?.thumbnail, 2000)
        }))
      : []
  }));
}

export async function obterReputacaoMl({ atualizar = false } = {}) {
  const db = getDb();
  const pendentes = await db.get(
    'SELECT COUNT(*) AS total FROM perguntas_ml WHERE respondida = 0'
  );
  const cache = await db.get(
    `SELECT dados, datetime(atualizado_em, 'localtime') AS atualizado_em
     FROM ml_reputacao_cache WHERE id = 1`
  );

  if (cache?.dados && !atualizar) {
    try {
      const mapeada = mapearReputacaoMl(
        { ...JSON.parse(cache.dados), atualizado_em: cache.atualizado_em },
        pendentes?.total
      );

      if (mapeada) return mapeada;
    } catch {
      // Cache corrompido: busca novamente na API.
    }
  }

  const integracao = await obterIntegracao();

  if (!integracao) {
    if (cache?.dados) {
      try {
        return mapearReputacaoMl(
          { ...JSON.parse(cache.dados), atualizado_em: cache.atualizado_em },
          pendentes?.total
        );
      } catch {
        return null;
      }
    }

    return null;
  }

  try {
    const usuario = await mlFetch(
      `/users/${encodeURIComponent(integracao.user_id)}`
    );
    const dados = {
      seller_reputation: usuario?.seller_reputation || null,
      usuario: {
        id: usuario?.id,
        nickname: usuario?.nickname,
        site_id: usuario?.site_id
      }
    };

    if (!dados.seller_reputation) {
      throw new MercadoLivreError(
        'O Mercado Livre não retornou a reputação do vendedor.',
        502
      );
    }

    await db.run(
      `INSERT INTO ml_reputacao_cache (id, dados, atualizado_em)
       VALUES (1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         dados = excluded.dados,
         atualizado_em = CURRENT_TIMESTAMP`,
      [JSON.stringify(dados)]
    );

    return mapearReputacaoMl(
      { ...dados, atualizado_em: new Date().toISOString() },
      pendentes?.total
    );
  } catch (error) {
    if (cache?.dados) {
      try {
        return mapearReputacaoMl(
          { ...JSON.parse(cache.dados), atualizado_em: cache.atualizado_em },
          pendentes?.total
        );
      } catch {
        // Sem cache válido: propaga o erro original.
      }
    }

    throw error;
  }
}

export async function sincronizarReputacao() {
  return comSincronizacao('reputacao', async () => {
    const reputacao = await obterReputacaoMl({ atualizar: true });

    return {
      itens: reputacao ? 1 : 0,
      criados: 0,
      atualizados: reputacao ? 1 : 0,
      ignorados: reputacao ? 0 : 1
    };
  });
}

function atributosParaPublicacao(peca) {
  let atributosInformados = {};

  try {
    const parseado =
      typeof peca.atributos === 'string'
        ? JSON.parse(peca.atributos || '{}')
        : peca.atributos;
    if (parseado && typeof parseado === 'object' && !Array.isArray(parseado)) {
      atributosInformados = parseado;
    }
  } catch {
    throw new MercadoLivreError(
      'Os atributos do anúncio estão inválidos. Corrija a ficha antes de aprovar.',
      400
    );
  }

  const atributos = new Map();

  for (const [id, valor] of Object.entries(atributosInformados)) {
    const chave = texto(id, 80).toUpperCase();
    const nome = texto(
      typeof valor === 'object' && valor !== null
        ? valor.value_name || valor.value_id
        : valor,
      200
    );

    if (chave && nome) atributos.set(chave, { id: chave, value_name: nome });
  }

  const conhecidos = {
    BRAND: peca.marca,
    MODEL: peca.modelo,
    VEHICLE_YEAR: peca.ano,
    PART_NUMBER: peca.numero_oem,
    GTIN: peca.gtin,
    SELLER_SKU: peca.sku
  };

  for (const [id, valor] of Object.entries(conhecidos)) {
    const nome = texto(valor, 200);
    if (nome && !atributos.has(id)) atributos.set(id, { id, value_name: nome });
  }

  return [...atributos.values()];
}

function urlImagemPublica(caminho, origem) {
  let url;

  try {
    url = new URL(caminho, origem);
  } catch {
    throw new MercadoLivreError(
      'A URL pública das fotos do anúncio é inválida.',
      400
    );
  }

  if (url.protocol !== 'https:') {
    throw new MercadoLivreError(
      'Configure BACKEND_PUBLIC_URL com HTTPS para publicar fotos no Mercado Livre.',
      400
    );
  }

  return url.toString();
}

export async function publicarAnuncioPeca(
  pecaId,
  { publicBaseUrl, titulo, descricao, preco, quantidade, ...dadosExtras } = {}
) {
  const db = getDb();
  const id = Number(pecaId);
  const pecaAtual = Number.isInteger(id)
    ? await db.get('SELECT * FROM pecas WHERE id = ?', [id])
    : null;

  if (!pecaAtual) {
    throw new MercadoLivreError('Peça não encontrada.', 404);
  }

  if (pecaAtual.ml_item_id) {
    throw new MercadoLivreError(
      'A peça já está vinculada a um anúncio do Mercado Livre.',
      409
    );
  }

  const peca = {
    ...pecaAtual,
    ...dadosExtras,
    ml_titulo: titulo ?? pecaAtual.ml_titulo,
    descricao: descricao ?? pecaAtual.descricao,
    preco: preco ?? pecaAtual.preco,
    quantidade: quantidade ?? pecaAtual.quantidade
  };
  const nomeAnuncio = texto(peca.ml_titulo || peca.nome, 60);
  const precoAnuncio = numero(peca.preco);
  const quantidadeAnuncio = Math.trunc(numero(peca.quantidade));
  const descricaoAnuncio = texto(peca.descricao, 5000);
  const integracao = await obterIntegracaoObrigatoria();
  const configuracao = await obterConfiguracaoMl();
  const siteId = texto(
    integracao.site_id || configuracao.siteId,
    20
  ).toUpperCase();

  if (!nomeAnuncio || !descricaoAnuncio || precoAnuncio <= 0) {
    throw new MercadoLivreError(
      'O anúncio precisa de título, descrição e preço maior que zero.',
      400
    );
  }

  if (quantidadeAnuncio <= 0) {
    throw new MercadoLivreError(
      'O anúncio precisa ter ao menos uma unidade em estoque.',
      400
    );
  }

  const imagens = await db.all(
    `SELECT caminho FROM peca_imagens
     WHERE peca_id = ?
     ORDER BY is_principal DESC, ordem ASC, id ASC
     LIMIT 20`,
    [id]
  );
  const origem = texto(
    publicBaseUrl || process.env.BACKEND_PUBLIC_URL || process.env.API_PUBLIC_URL,
    1000
  ).replace(/\/+$/, '');

  if (!origem && imagens.length > 0) {
    throw new MercadoLivreError(
      'Configure BACKEND_PUBLIC_URL com o endereço HTTPS público da API para publicar as fotos.',
      400
    );
  }

  const pictures = imagens.map((imagem) => ({
    source: urlImagemPublica(imagem.caminho, origem)
  }));
  const thumbnail = normalizarImagemMl(peca.ml_thumbnail);

  if (pictures.length === 0 && thumbnail) {
    pictures.push({ source: thumbnail });
  }

  if (pictures.length === 0) {
    throw new MercadoLivreError(
      'Adicione ao menos uma foto pública à peça antes de aprovar a publicação.',
      400
    );
  }

  let categoryId = texto(peca.ml_category_id, 80);

  if (!categoryId) {
    const consulta = texto(
      [peca.categoria, peca.nome, peca.carro].filter(Boolean).join(' '),
      300
    );
    const sugestoes = await mlFetch(
      `/sites/${encodeURIComponent(siteId)}/domain_discovery/search?q=${encodeURIComponent(
        consulta
      )}`
    );
    const sugestao = Array.isArray(sugestoes)
      ? sugestoes.find((item) => item?.category_id)
      : null;
    categoryId = texto(sugestao?.category_id, 80);
  }

  if (!categoryId) {
    throw new MercadoLivreError(
      'Não foi possível determinar a categoria do anúncio no Mercado Livre.',
      400
    );
  }

  const tipoAnuncio = texto(peca.tipo_anuncio, 40)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const listingTypeId = ['gold_pro', 'gold_special', 'free'].includes(
    tipoAnuncio
  )
    ? tipoAnuncio
    : tipoAnuncio === 'premium'
      ? 'gold_pro'
      : tipoAnuncio === 'gratis'
        ? 'free'
        : 'gold_special';
  const condition =
    ['novo', 'new'].includes(
      texto(peca.condicao, 40).toLowerCase()
    )
      ? 'new'
      : ['recondicionado', 'refurbished'].includes(texto(peca.condicao, 40).toLowerCase())
        ? 'refurbished' : 'used';
  const currencyId = siteId === 'MLB' ? 'BRL' : '';

  if (!currencyId) {
    throw new MercadoLivreError(
      `A publicação automática ainda não está configurada para o site ${siteId}.`,
      400
    );
  }

  const [ficha, usuario] = await Promise.all([
    obterFichaCategoria(categoryId, mlFetch),
    mlFetch(`/users/${integracao.user_id}`)
  ]);
  const corpoPublicacao = completarPublicacao({
    site_id: siteId, title: nomeAnuncio, category_id: categoryId,
    price: precoAnuncio, currency_id: currencyId, available_quantity: quantidadeAnuncio,
    buying_mode: texto(peca.modo_compra, 40) || 'buy_it_now', listing_type_id: listingTypeId,
    condition, pictures, attributes: atributosParaPublicacao(peca)
  }, peca, ficha, usuario);
  montarCompatibilidades(lerConfigMl(peca.ml_config));
  await mlFetch('/items/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpoPublicacao)
  });
  const item = await mlFetch('/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpoPublicacao)
  });
  const itemId = texto(item?.id, 100);

  if (!itemId) {
    throw new MercadoLivreError(
      'O Mercado Livre não retornou o identificador do novo anúncio.',
      502
    );
  }

  const statusInicial = texto(item?.status, 40) || 'active';

  await db.run(
    `UPDATE pecas SET
       ml_item_id = ?,
       ml_permalink = ?,
       ml_status = ?,
       ml_ativo = ?,
       ml_category_id = ?,
       ml_thumbnail = ?,
       ml_titulo = ?,
       ml_sincronizado_em = ?
     WHERE id = ?`,
    [
      itemId,
      texto(item?.permalink, 500) || null,
      statusInicial,
      statusInicial === 'active' ? 1 : 0,
      categoryId,
      normalizarImagemMl(item?.thumbnail) || pictures[0]?.source || null,
      nomeAnuncio,
      new Date().toISOString(),
      id
    ]
  );

  const pausado = await mlFetch(`/items/${encodeURIComponent(itemId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'paused' })
  });
  const statusPausado = texto(pausado?.status, 40);

  if (!statusPausado) {
    throw new MercadoLivreError(
      'O Mercado Livre não confirmou a pausa temporária do anúncio.',
      502
    );
  }

  await db.run(
    `UPDATE pecas SET ml_status = ?, ml_ativo = ?, ml_sincronizado_em = ?
     WHERE id = ?`,
    [
      statusPausado,
      statusPausado === 'active' ? 1 : 0,
      new Date().toISOString(),
      id
    ]
  );

  if (statusPausado !== 'paused') {
    throw new MercadoLivreError(
      `O anúncio foi criado, mas o Mercado Livre não confirmou a pausa (status: ${statusPausado}).`,
      502
    );
  }

  await atualizarCompatibilidadesPeca(id, peca.ml_config);
  await mlFetch(`/items/${encodeURIComponent(itemId)}/description`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plain_text: descricaoAnuncio })
  });
  const ativado = await mlFetch(`/items/${encodeURIComponent(itemId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' })
  });
  const statusAnuncio = texto(ativado?.status, 40);

  if (!statusAnuncio) {
    throw new MercadoLivreError(
      'O Mercado Livre não confirmou o status do anúncio recém-criado.',
      502
    );
  }

  await db.run(
    `UPDATE pecas SET
       ml_status = ?,
       ml_ativo = ?,
       ml_permalink = COALESCE(?, ml_permalink),
       ml_thumbnail = COALESCE(?, ml_thumbnail),
       ml_sincronizado_em = ?
     WHERE id = ?`,
    [
      statusAnuncio,
      statusAnuncio === 'active' ? 1 : 0,
      texto(ativado?.permalink, 500) || null,
      normalizarImagemMl(ativado?.thumbnail) || null,
      new Date().toISOString(),
      id
    ]
  );

  return {
    ok: true,
    item_id: itemId,
    permalink: texto(ativado?.permalink || item?.permalink, 500) || null,
    status: statusAnuncio
  };
}

export async function atualizarCompatibilidadesPeca(pecaId, configInformada) {
  const peca = await getDb().get('SELECT ml_item_id, ml_config FROM pecas WHERE id = ?', [pecaId]);
  const familias = montarCompatibilidades(lerConfigMl(configInformada ?? peca?.ml_config));
  if (!familias.length) return;
  if (!peca?.ml_item_id) throw new MercadoLivreError('Publique o anúncio antes de enviar compatibilidades.', 400);
  await mlFetch(`/items/${encodeURIComponent(peca.ml_item_id)}/compatibilities`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products_families: familias })
  });
}

export async function atualizarAnuncioPeca(pecaId, dados = {}) {
  const db = getDb();
  const id = Number(pecaId);
  const peca = Number.isInteger(id)
    ? await db.get('SELECT * FROM pecas WHERE id = ?', [id])
    : null;

  if (!peca) {
    throw new MercadoLivreError('Peça não encontrada.', 404);
  }

  if (!peca.ml_item_id) {
    throw new MercadoLivreError(
      'Esta peça não está vinculada a um anúncio do Mercado Livre.',
      400
    );
  }

  const corpo = {};
  let descricaoAtualizada = null;

  if (dados.descricao !== undefined) {
    const descricao = texto(dados.descricao, 50000);

    if (!descricao) {
      throw new MercadoLivreError('A descrição não pode ficar vazia.', 400);
    }

    descricaoAtualizada = descricao;
  }

  if (dados.quantidade !== undefined) {
    const quantidade = Math.trunc(numero(dados.quantidade));

    if (quantidade < 0) {
      throw new MercadoLivreError(
        'A quantidade não pode ser negativa.',
        400
      );
    }

    corpo.available_quantity = quantidade;
  }

  if (dados.preco !== undefined) {
    const preco = numero(dados.preco);

    if (preco <= 0) {
      throw new MercadoLivreError('O preço deve ser maior que zero.', 400);
    }

    corpo.price = preco;
  }

  if (dados.titulo !== undefined) {
    const titulo = texto(dados.titulo, 60);

    if (!titulo) {
      throw new MercadoLivreError('O título não pode ficar vazio.', 400);
    }

    corpo.title = titulo;
  }

  if (dados.status !== undefined) {
    const status = String(dados.status || '').trim().toLowerCase();

    if (!['active', 'paused', 'closed'].includes(status)) {
      throw new MercadoLivreError(
        'Status do anúncio inválido. Use active, paused ou closed.',
        400
      );
    }

    corpo.status = status;
  }

  if (Object.keys(corpo).length === 0 && !descricaoAtualizada) {
    throw new MercadoLivreError(
      'Informe quantidade, preço, título ou descrição para atualizar o anúncio.',
      400
    );
  }

  let status = '';

  if (Object.keys(corpo).length > 0) {
    const resposta = await mlFetch(
      `/items/${encodeURIComponent(peca.ml_item_id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
      }
    );
    status = texto(resposta?.status, 40);
  }

  if (descricaoAtualizada) {
    await mlFetch(
      `/items/${encodeURIComponent(peca.ml_item_id)}/description`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plain_text: descricaoAtualizada })
      }
    );
  }

  await db.run(
    `UPDATE pecas SET
       quantidade = COALESCE(?, quantidade),
       preco = COALESCE(?, preco),
       ml_titulo = COALESCE(?, ml_titulo),
       descricao = COALESCE(?, descricao),
       ml_status = COALESCE(?, ml_status),
       ml_ativo = CASE
         WHEN ? = '' THEN ml_ativo
         WHEN ? = 'active' THEN 1
         ELSE 0
       END,
       ml_sincronizado_em = ?
     WHERE id = ?`,
    [
      corpo.available_quantity ?? null,
      corpo.price ?? null,
      corpo.title ?? null,
      descricaoAtualizada,
      status || null,
      status,
      status,
      new Date().toISOString(),
      peca.id
    ]
  );

  return {
    ok: true,
    item_id: peca.ml_item_id,
    ...corpo,
    descricao_atualizada: Boolean(descricaoAtualizada)
  };
}

export async function encerrarAnuncioPeca(pecaId) {
  const db = getDb();
  const id = Number(pecaId);
  const peca = Number.isInteger(id)
    ? await db.get('SELECT * FROM pecas WHERE id = ?', [id])
    : null;

  if (!peca) {
    throw new MercadoLivreError('Peça não encontrada.', 404);
  }

  let encerradoNoMl = false;

  if (peca.ml_item_id) {
    try {
      await mlFetch(`/items/${encodeURIComponent(peca.ml_item_id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' })
      });
      encerradoNoMl = true;
    } catch (error) {
      if (error?.statusCode !== 404) {
        throw new MercadoLivreError(
          `Não foi possível excluir o anúncio no Mercado Livre: ${error.message}`,
          error?.statusCode || 502
        );
      }
    }
  }

  await db.run(
    `UPDATE pecas SET
       ml_item_id = NULL,
       ml_permalink = NULL,
       ml_status = 'closed',
       ml_ativo = 0,
       ml_sincronizado_em = ?
     WHERE id = ?`,
    [new Date().toISOString(), peca.id]
  );

  return {
    ok: true,
    item_id: peca.ml_item_id,
    encerrado_no_ml: encerradoNoMl,
    mensagem: encerradoNoMl
      ? 'Anúncio excluído no Mercado Livre e desvinculado do estoque.'
      : 'Vínculo do anúncio removido do estoque.'
  };
}

async function executarSincronizacaoWebhook(recurso) {
  if (sincronizacoesEmAndamento.has(recurso)) return;

  if (recurso === 'pecas') {
    await sincronizarPecas();
  } else if (recurso === 'vendas') {
    await sincronizarVendas({ dias: 7 });
  } else if (recurso === 'perguntas') {
    await sincronizarPerguntas();
  } else if (recurso === 'reclamacoes') {
    await sincronizarReclamacoes();
  }
}

export async function processarWebhook(payload = {}) {
  const integracao = await obterIntegracao();

  if (!integracao) {
    return { ok: true, ignorado: true, motivo: 'Integração não conectada' };
  }

  if (
    payload.user_id &&
    String(payload.user_id) !== String(integracao.user_id)
  ) {
    return { ok: true, ignorado: true, motivo: 'Outro vendedor' };
  }

  const topico = String(payload.topic || '').toLowerCase();
  const mapa = {
    items: 'pecas',
    orders: 'vendas',
    orders_v2: 'vendas',
    questions: 'perguntas',
    claims: 'reclamacoes',
    messages: 'perguntas'
  };
  const recurso = mapa[topico];

  if (!recurso) {
    return {
      ok: true,
      ignorado: true,
      motivo: `Tópico não tratado: ${topico || 'desconhecido'}`
    };
  }

  void executarSincronizacaoWebhook(recurso).catch((error) => {
    console.error(
      `Erro na sincronização por webhook (${recurso}):`,
      error.message
    );
  });

  return {
    ok: true,
    topico,
    recurso,
    resource: texto(payload.resource, 500)
  };
}

export async function sincronizarTudo() {
  const resultados = [];
  const operacoes = [
    ['pecas', () => sincronizarPecas()],
    ['vendas', () => sincronizarVendas({ dias: 30 })],
    ['perguntas', () => sincronizarPerguntas()],
    ['reclamacoes', () => sincronizarReclamacoes()],
    ['reputacao', () => sincronizarReputacao()]
  ];

  for (const [recurso, operacao] of operacoes) {
    try {
      resultados.push(await operacao());
    } catch (error) {
      resultados.push({
        recurso,
        status: 'erro',
        mensagem: error.message
      });
    }
  }

  return {
    ok: resultados.every((resultado) => resultado.status !== 'erro'),
    resultados
  };
}
