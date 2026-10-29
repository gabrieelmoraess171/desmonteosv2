import test from 'node:test';
import assert from 'node:assert/strict';
import { completarPublicacao, obterFichaCategoria, valoresMl, montarCompatibilidades } from '../src/services/mlCadastroService.js';

const ficha = {
  categoria: { settings: { max_pictures_per_item: 2 }, children_categories: [] },
  atributos: [{ id: 'BRAND', name: 'Marca', tags: { required: true }, values: [{ id: '10', name: 'Marca original' }] }],
  termos: [{ id: 'WARRANTY_TYPE', values: [{ id: '2230280', name: 'Garantia do vendedor' }] }, { id: 'WARRANTY_TIME' }]
};
const corpo = () => ({ title: 'Peça usada', condition: 'used', pictures: [{ source: 'https://imagens.test/foto.jpg' }], attributes: [{ id: 'BRAND', value_name: 'Marca original' }] });

test('monta atributos oficiais, garantia, frete e nome de família para contas migradas', () => {
  const resultado = completarPublicacao(corpo(), {
    peso_kg: 1.2, altura_cm: 10, largura_cm: 20, comprimento_cm: 30,
    ml_config: JSON.stringify({ family_name: 'Peça original', sale_terms: { WARRANTY_TYPE: 'Garantia do vendedor', WARRANTY_TIME: '90 dias' }, shipping: { mode: 'me2', free_shipping: true } })
  }, ficha, { tags: ['user_product_seller'] });
  assert.equal(resultado.title, undefined);
  assert.equal(resultado.family_name, 'Peça original');
  assert.deepEqual(resultado.attributes, [{ id: 'BRAND', value_id: '10', value_name: 'Marca original' }]);
  assert.equal(resultado.sale_terms[0].value_id, '2230280');
  assert.equal(resultado.shipping.dimensions, '10x20x30,1200');
});

test('bloqueia atributos obrigatórios ausentes e limites de fotos', () => {
  assert.throws(() => completarPublicacao({ ...corpo(), attributes: [] }, {}, ficha, {}), /Marca/);
  assert.throws(() => completarPublicacao({ ...corpo(), pictures: [{}, {}, {}] }, {}, ficha, {}), /até 2 fotos/);
  assert.equal(completarPublicacao(corpo(), {}, ficha, {}).title, 'Peça usada');
});

test('preserva não se aplica e rejeita categoria inválida antes de consultar', async () => {
  assert.deepEqual(valoresMl({ GTIN: '-1' }, [{ id: 'GTIN', tags: { allow_na: true } }]), [{ id: 'GTIN', value_id: '-1' }]);
  await assert.rejects(obterFichaCategoria('../users', () => assert.fail('não deve consultar')), /categoria válida/);
});

test('compatibilidades exigem marca, modelo e ano e enviam somente grupos preenchidos', () => {
  assert.throws(() => montarCompatibilidades({ compatibilities: [{ attributes: { BRAND: 'GM' } }] }), /marca, modelo e ano/);
  const grupos = montarCompatibilidades({ compatibilities: [{ attributes: { BRAND: 'Chevrolet', CAR_AND_VAN_MODEL: 'Onix', YEAR: '2020', CAR_AND_VAN_ENGINE: '' }, note: 'Somente versão especificada' }] });
  assert.equal(grupos[0].domain_id, 'MLB-CARS_AND_VANS_FOR_COMPATIBILITIES');
  assert.equal(grupos[0].attributes.length, 3);
});
