import test from 'node:test';
import assert from 'node:assert/strict';
import { montarPayloadPeca, origensAposEdicao } from '../src/services/pecaPayload.js';

test('pausar anúncio preserva ficha e configuração em atualização parcial', () => {
  const atual = {
    id: 21, nome: 'Farol novo Toyota', sku: 'SKU 21', categoria: 'Faróis e Lanternas',
    condicao: 'novo', garantia: 'Garantia de fábrica de 12 meses', tipo_anuncio: 'clássico',
    localizacao: 'Prateleira B-4', video_url: 'https://www.youtube.com/watch?v=existing',
    carro: 'Toyota Corolla 2018', descricao: 'Ficha completa', quantidade: 2, preco: 450,
    atributos: '{"BRAND":"Toyota","PART_NUMBER":"81150"}', ml_ativo: 1,
    ml_config: JSON.stringify({ shipping: { mode: 'me2', free_shipping: true, local_pick_up: true }, sale_terms: { WARRANTY_TYPE: 'Garantia de fábrica', WARRANTY_TIME: '12 meses' } }),
  };
  const payload = montarPayloadPeca({ ml_ativo: 0 }, atual);
  assert.equal(payload.ml_ativo, 0);
  for (const campo of ['nome', 'sku', 'carro', 'descricao', 'categoria', 'condicao', 'garantia', 'tipo_anuncio', 'localizacao', 'video_url', 'quantidade', 'preco']) assert.equal(payload[campo], atual[campo], campo);
  assert.deepEqual(JSON.parse(payload.atributos), JSON.parse(atual.atributos));
  assert.deepEqual(JSON.parse(payload.ml_config), JSON.parse(atual.ml_config));
  assert.equal(montarPayloadPeca({ ml_ativo: 1 }, { ...atual, ml_ativo: 0 }).ml_ativo, 1);
});

test('defaults comerciais são aplicados somente ao cadastro novo e alterações explícitas são respeitadas', () => {
  const novo = montarPayloadPeca({ nome: 'Farol', preco: 100, quantidade: 1 });
  assert.equal(novo.condicao, 'usado');
  assert.equal(novo.garantia, 'Sem garantia');
  assert.equal(novo.tipo_anuncio, 'premium');
  const atual = { id: 21, nome: 'Farol', condicao: 'novo', garantia: '12 meses', tipo_anuncio: 'clássico', localizacao: 'B4' };
  const alterado = montarPayloadPeca({ condicao: 'recondicionado', garantia: '', tipo_anuncio: 'premium', localizacao: 'C2' }, atual);
  assert.equal(alterado.condicao, 'recondicionado');
  assert.equal(alterado.garantia, '');
  assert.equal(alterado.tipo_anuncio, 'premium');
  assert.equal(alterado.localizacao, 'C2');
});

test('status e formulário sem mudança de categoria preservam origem automática', () => {
  const atual = { id: 21, nome: 'Farol Toyota', categoria: 'Faróis e Lanternas', categoria_origem: 'nome_ml', carro: 'Toyota Corolla', aplicacao_origem: 'titulo_ml', ml_ativo: 1 };
  const pausa = montarPayloadPeca({ ml_ativo: 0 }, atual);
  assert.deepEqual(origensAposEdicao({ ml_ativo: 0 }, atual, pausa), { categoria_origem: 'nome_ml', aplicacao_origem: 'titulo_ml' });
  const semMudanca = { categoria: atual.categoria, carro: atual.carro };
  assert.deepEqual(origensAposEdicao(semMudanca, atual, montarPayloadPeca(semMudanca, atual)), { categoria_origem: 'nome_ml', aplicacao_origem: 'titulo_ml' });
  const manual = { categoria: 'Outros', carro: 'Toyota Corolla 2018' };
  assert.deepEqual(origensAposEdicao(manual, atual, montarPayloadPeca(manual, atual)), { categoria_origem: 'cadastro', aplicacao_origem: 'cadastro' });
});
