import express from 'express';
import crypto from 'node:crypto';
import { getDb } from '../database.js';

const router = express.Router();
const CHAVE_PIN = 'owner_pin_hash';
const VALIDADE_TOKEN_MS = 12 * 60 * 60 * 1000;
const MAX_TENTATIVAS = 6;
const JANELA_TENTATIVAS_MS = 5 * 60 * 1000;

const sessoes = new Map();
const tentativas = new Map();

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function conferirPin(pin, armazenado) {
  const [salt, hash] = String(armazenado || '').split(':');

  if (!salt || !hash) return false;

  const calculado = crypto.scryptSync(pin, salt, 64);
  const esperado = Buffer.from(hash, 'hex');

  if (calculado.length !== esperado.length) return false;

  return crypto.timingSafeEqual(calculado, esperado);
}

function pinValido(pin) {
  return /^\d{4,8}$/.test(String(pin || '').trim());
}

function tokenDaRequisicao(req) {
  const cabecalho = String(req.headers['x-owner-token'] || '').trim();
  if (cabecalho) return cabecalho;

  const autorizacao = String(req.headers.authorization || '').trim();
  if (autorizacao.toLowerCase().startsWith('bearer ')) {
    return autorizacao.slice(7).trim();
  }

  return '';
}

function sessaoValida(req) {
  const token = tokenDaRequisicao(req);
  if (!token) return false;

  const expiraEm = sessoes.get(token);

  if (!expiraEm) return false;

  if (Date.now() > expiraEm) {
    sessoes.delete(token);
    return false;
  }

  sessoes.set(token, Date.now() + VALIDADE_TOKEN_MS);
  return true;
}

export function exigirProprietario(req, res, next) {
  if (!sessaoValida(req)) {
    return res.status(401).json({
      error: 'Desbloqueie o acesso do proprietário para continuar.'
    });
  }

  return next();
}

function criarToken() {
  const token = crypto.randomBytes(32).toString('hex');
  sessoes.set(token, Date.now() + VALIDADE_TOKEN_MS);
  return token;
}

function chaveTentativa(req) {
  return String(req.ip || req.socket?.remoteAddress || 'local');
}

function bloqueadoPorTentativas(req) {
  const chave = chaveTentativa(req);
  const registro = tentativas.get(chave);

  if (!registro) return false;

  if (Date.now() - registro.inicio > JANELA_TENTATIVAS_MS) {
    tentativas.delete(chave);
    return false;
  }

  return registro.quantidade >= MAX_TENTATIVAS;
}

function registrarFalha(req) {
  const chave = chaveTentativa(req);
  const registro = tentativas.get(chave);

  if (!registro || Date.now() - registro.inicio > JANELA_TENTATIVAS_MS) {
    tentativas.set(chave, { quantidade: 1, inicio: Date.now() });
    return;
  }

  registro.quantidade += 1;
}

async function lerConfiguracao(db, chave) {
  const linha = await db.get(
    'SELECT valor FROM configuracoes WHERE chave = ?',
    [chave]
  );
  return linha?.valor || '';
}

async function gravarConfiguracao(db, chave, valor) {
  await db.run(
    `INSERT INTO configuracoes (chave, valor, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(chave) DO UPDATE SET
       valor = excluded.valor,
       updated_at = CURRENT_TIMESTAMP`,
    [chave, valor]
  );
}

router.get('/status', async (req, res) => {
  try {
    const db = getDb();
    const pin = await lerConfiguracao(db, CHAVE_PIN);

    res.json({
      configurado: Boolean(pin),
      autenticado: sessaoValida(req)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/configurar', async (req, res) => {
  try {
    const pin = String(req.body?.pin || '').trim();

    if (!pinValido(pin)) {
      return res
        .status(400)
        .json({ error: 'Crie um PIN numérico de 4 a 8 dígitos.' });
    }

    const db = getDb();
    const existente = await lerConfiguracao(db, CHAVE_PIN);

    if (existente) {
      return res
        .status(409)
        .json({ error: 'O PIN do proprietário já foi configurado.' });
    }

    await gravarConfiguracao(db, CHAVE_PIN, hashPin(pin));
    const token = criarToken();

    res.json({
      ok: true,
      token,
      mensagem: 'PIN do proprietário criado com sucesso.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/entrar', async (req, res) => {
  try {
    if (bloqueadoPorTentativas(req)) {
      return res.status(429).json({
        error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
      });
    }

    const pin = String(req.body?.pin || '').trim();

    if (!pinValido(pin)) {
      registrarFalha(req);
      return res.status(400).json({ error: 'PIN inválido.' });
    }

    const db = getDb();
    const armazenado = await lerConfiguracao(db, CHAVE_PIN);

    if (!armazenado) {
      return res.status(404).json({
        error: 'O PIN do proprietário ainda não foi configurado.'
      });
    }

    if (!conferirPin(pin, armazenado)) {
      registrarFalha(req);
      return res.status(401).json({ error: 'PIN incorreto.' });
    }

    tentativas.delete(chaveTentativa(req));
    const token = criarToken();

    res.json({ ok: true, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sair', (req, res) => {
  const token = tokenDaRequisicao(req);
  if (token) sessoes.delete(token);
  res.json({ ok: true });
});

router.post('/alterar-pin', async (req, res) => {
  try {
    if (!sessaoValida(req)) {
      return res.status(401).json({ error: 'Acesso do proprietário necessário.' });
    }

    const pinAtual = String(req.body?.pin_atual || '').trim();
    const pinNovo = String(req.body?.pin_novo || '').trim();

    if (!pinValido(pinNovo)) {
      return res
        .status(400)
        .json({ error: 'O novo PIN deve ter de 4 a 8 dígitos.' });
    }

    const db = getDb();
    const armazenado = await lerConfiguracao(db, CHAVE_PIN);

    if (!armazenado || !conferirPin(pinAtual, armazenado)) {
      return res.status(401).json({ error: 'PIN atual incorreto.' });
    }

    await gravarConfiguracao(db, CHAVE_PIN, hashPin(pinNovo));
    const token = criarToken();

    res.json({ ok: true, token, mensagem: 'PIN atualizado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
