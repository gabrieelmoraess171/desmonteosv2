import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverRedirectUriMl, resolverUrlFrontend, urlPublicaBackend } from '../src/services/urlsPublicas.js';

const render = { RENDER: 'true', PORT: '10000', RENDER_EXTERNAL_URL: 'https://desmonteos-backend.onrender.com' };
const callback = 'https://desmonteos-backend.onrender.com/api/mercadolivre/oauth/callback';

test('Render usa o endereço externo no callback em vez da porta interna 10000', () => {
  assert.equal(resolverRedirectUriMl('', render), callback);
  assert.equal(resolverRedirectUriMl('http://localhost:10000/api/mercadolivre/oauth/callback', render), callback);
  assert.equal(resolverRedirectUriMl('', { ...render, ML_REDIRECT_URI: 'http://127.0.0.1:3001/api/mercadolivre/oauth/callback' }), callback);
});

test('callbacks públicos explícitos mantêm prioridade sobre a origem automática', () => {
  const personalizado = 'https://api.exemplo.com/oauth/retorno';
  assert.equal(resolverRedirectUriMl(personalizado, render), personalizado);
  assert.equal(resolverRedirectUriMl(personalizado, { ...render, ML_REDIRECT_URI: 'https://outro.exemplo.com/callback' }), 'https://outro.exemplo.com/callback');
  assert.equal(resolverRedirectUriMl(personalizado, { ...render, ML_REDIRECT_URI: ' ' }), personalizado);
});

test('URL pública explícita permite domínio próprio, preservando o ambiente local', () => {
  assert.equal(resolverRedirectUriMl('', { ...render, BACKEND_PUBLIC_URL: 'https://api.exemplo.com/' }), 'https://api.exemplo.com/api/mercadolivre/oauth/callback');
  assert.equal(resolverRedirectUriMl('', { PORT: '3001' }), 'http://localhost:3001/api/mercadolivre/oauth/callback');
  assert.equal(urlPublicaBackend({ ...render, BACKEND_PUBLIC_URL: 'http://localhost:3001' }), render.RENDER_EXTERNAL_URL);
});

test('retorno do OAuth usa frontend público no Render e respeita configuração explícita', () => {
  assert.equal(resolverUrlFrontend(render), 'https://desmonteos.onrender.com');
  assert.equal(resolverUrlFrontend({ ...render, FRONTEND_URL: 'http://localhost:3000' }), 'https://desmonteos.onrender.com');
  assert.equal(resolverUrlFrontend({ ...render, FRONTEND_URL: 'https://painel.exemplo.com/' }), 'https://painel.exemplo.com');
  assert.equal(resolverUrlFrontend({}), 'http://localhost:3000');
});
