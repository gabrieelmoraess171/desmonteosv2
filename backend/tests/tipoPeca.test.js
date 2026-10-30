import test from 'node:test';
import assert from 'node:assert/strict';
import { tipoPeca } from '../src/services/tipoPeca.js';
import { mapearReputacaoMl } from '../src/services/mlReputacao.js';

test('agrupa peças semelhantes independentemente de lado, acento e veículo', () => {
  assert.equal(tipoPeca('Maçaneta porta dianteira direita Hilux'), 'Maçaneta');
  assert.equal(tipoPeca('Macaneta traseira esquerda Ford'), 'Maçaneta');
  assert.equal(tipoPeca('Console Central Corolla'), 'Console');
  assert.equal(tipoPeca('Console Apoio Braço Civic'), 'Console');
  assert.equal(tipoPeca('Peça especial ABC'), 'Peça especial ABC');
});

test('usa o nível e o selo oficiais sem confundir com a estimativa local', () => {
  const reputacao = mapearReputacaoMl({ seller_reputation: { level_id: '5_green', power_seller_status: 'platinum', metrics: { claims: { rate: 0.06 } } } });
  assert.equal(reputacao.termometro, 5);
  assert.equal(reputacao.selo, 'MercadoLíder Platinum');
  assert.equal(reputacao.cor, 'success');
  assert.ok(reputacao.score < 95);
  assert.equal(mapearReputacaoMl({ seller_reputation: {} }).termometro, 0);
});
