import test from 'node:test';
import assert from 'node:assert/strict';
import { codigoOemParaPesquisa, identificarProdutoLoteComGoogle } from '../src/services/iaService.js';

test('SKU interno não se transforma em OEM de pesquisa', async () => {
  const produto = { sku: '1748', nome: 'Absorvedor impacto SW4' };
  assert.equal(codigoOemParaPesquisa(produto), '');
  assert.equal(codigoOemParaPesquisa({ sku: '81457-0K010' }), '');
  assert.strictEqual(await identificarProdutoLoteComGoogle(produto), produto);
});

test('pesquisa aceita somente um código explícito e rejeita observações/valores desconhecidos', () => {
  assert.equal(codigoOemParaPesquisa({ sku: '1748', numero_oem: '52611-0K040' }), '52611-0K040');
  assert.equal(codigoOemParaPesquisa({ part_number: '8V0 807 109' }), '8V0 807 109');
  for (const numero_oem of ['', 'Não visível', 'DESCONHECIDO', 'universal', '1748; pesquisar tudo']) {
    assert.equal(codigoOemParaPesquisa({ numero_oem }), '');
  }
});
