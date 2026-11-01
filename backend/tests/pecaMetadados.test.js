import test from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { classificarCategoria, normalizarCategoria } from '../src/utils/categorias.js';
import { comMetadadosPeca, dataPublicacaoMl, metadadosPeca, revisarMetadadosLocais } from '../src/services/pecaMetadados.js';

test('categoriza o tipo da peça e não palavras do veículo ou descrição', () => {
  assert.equal(classificarCategoria('Absorvedor Imapcto Dianteiro Toyota Hilux SW4 2016'), 'Almas e Absorvedores de Impacto');
  assert.equal(classificarCategoria('Absorvedor Impacto Dianteiro Toyota Hilux SW4 2016'), 'Almas e Absorvedores de Impacto');
  assert.equal(classificarCategoria('Alma do Para-choque Honda Civic'), 'Almas e Absorvedores de Impacto');
  assert.equal(classificarCategoria('Para-choque Toyota Hilux', 'acompanha porta e farol'), 'Parachoques');
  assert.equal(classificarCategoria('Módulo do Motor Corolla', 'porta dianteira'), 'Elétrica');
  assert.equal(classificarCategoria('Acabamento Alavanca Câmbio Nissan Sentra'), 'Acabamentos e Molduras');
  assert.equal(classificarCategoria('Tampão Estepe Carpete Jaguar F Pace Preto'), 'Interior');
  assert.equal(classificarCategoria('Disco de Freio', 'x'), 'Freios');
  assert.equal(classificarCategoria('Peça XYZ', 'porta farol motor', 'Toyota'), 'Outros');
  assert.equal(normalizarCategoria('Outros', 'Peça customizada'), 'Outros');
});

test('aplicação usa atributos veiculares e não confunde fabricante da peça com carro', () => {
  const peca = { nome: 'Retrovisor', atributos: JSON.stringify({ BRAND: 'Bosch', MODEL: 'AX-900' }) };
  assert.equal(metadadosPeca(peca).aplicacao, '');
  const item = { attributes: [{ id: 'CAR_AND_VAN_BRAND', value_name: 'Toyota' }, { id: 'CAR_AND_VAN_MODEL', value_name: 'Hilux SW4' }, { id: 'VEHICLE_YEAR', value_name: '2016 a 2020' }] };
  assert.equal(metadadosPeca(peca, item).aplicacao, 'Toyota Hilux SW4 2016 a 2020');
  assert.equal(metadadosPeca(peca, item).aplicacao_origem, 'atributos_ml');
  assert.equal(metadadosPeca({ ...peca, carro: 'Toyota Hilux SW4 2.8 2018 Diesel' }, item).aplicacao, 'Toyota Hilux SW4 2.8 2018 Diesel');
});

test('preserva aplicação do título e substitui somente evidência gerada por compatibilidades reais', () => {
  const peca = { nome: 'Absorvedor Impacto Toyota Hilux SW4 2016 2020 Preto', ml_item_id: 'MLB1', categoria: 'Portas e Capôs' };
  const fallback = metadadosPeca(peca);
  assert.equal(fallback.aplicacao, 'Toyota Hilux SW4 2016 2020 Preto');
  assert.equal(fallback.aplicacao_origem, 'titulo_ml');
  assert.equal(fallback.categoria, 'Almas e Absorvedores de Impacto');
  const item = { compatibilidades: [{ catalog_product_name: 'Toyota Hilux SW4 2.8 2018' }, { catalog_product_name: 'Toyota Hilux SW4 2.8 2018' }] };
  assert.equal(metadadosPeca({ ...peca, carro: fallback.aplicacao, aplicacao_origem: fallback.aplicacao_origem }, item).aplicacao, 'Toyota Hilux SW4 2.8 2018');
  assert.equal(metadadosPeca({ ...peca, carro: 'Cadastro manual preciso' }, item).aplicacao, 'Cadastro manual preciso');
});

test('não inventa modelos quando o ML informa apenas marca e total de catálogo por licença', () => {
  const metadata = metadadosPeca({}, { compatibilidades_info: { products: [{ source: 'CATALOGO', catalog_product_name: 'Toyota', total: 18 }] } });
  assert.equal(metadata.aplicacao, 'Catálogo Toyota (18 veículos)');
  assert.equal(metadata.aplicacao_origem, 'compatibilidades_ml');
});

test('data de publicação vem de date_created ou start_time do ML, nunca importação local', () => {
  assert.equal(dataPublicacaoMl({}, { created_at: '2026-10-31T00:00:00Z' }), null);
  assert.equal(dataPublicacaoMl({ date_created: '2020-03-01T14:35:21-03:00', start_time: '2020-03-01T14:36:00-03:00' }), '2020-03-01T17:35:21.000Z');
  assert.equal(dataPublicacaoMl({ start_time: '2020-03-01T14:36:00-03:00' }), '2020-03-01T17:36:00.000Z');
  assert.equal(dataPublicacaoMl({ date_created: 'inválida' }, { ml_publicado_em: '2020-03-01T17:35:21.000Z' }), '2020-03-01T17:35:21.000Z');
});

test('revisão local corrige cache existente sem alterar ids e categorias reais do ML', async () => {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  try {
    await db.exec(`CREATE TABLE pecas (id INTEGER PRIMARY KEY, nome TEXT, carro TEXT, categoria TEXT, atributos TEXT, ml_dados TEXT, ml_item_id TEXT, ml_publicado_em TEXT, aplicacao_origem TEXT, categoria_origem TEXT, ml_category_id TEXT)`);
    await db.run('INSERT INTO pecas (id,nome,carro,categoria,ml_item_id,ml_category_id,ml_dados) VALUES (1,?,?,?,?,?,?)', ['Absorvedor Impacto Toyota Hilux SW4', '', 'Portas e Capôs', 'MLB1', 'MLB_REAL', JSON.stringify({ date_created: '2020-03-01T14:35:21-03:00', attributes: [{ id: 'CAR_AND_VAN_MODEL', value_name: 'Hilux SW4' }, { id: 'VEHICLE_YEAR', value_name: '2016' }] })]);
    await revisarMetadadosLocais(db, { lote: 1, pausaMs: 0 });
    const peca = await db.get('SELECT * FROM pecas WHERE id = 1');
    assert.equal(peca.categoria, 'Almas e Absorvedores de Impacto');
    assert.equal(peca.carro, 'Hilux SW4 2016');
    assert.equal(peca.ml_publicado_em, '2020-03-01T17:35:21.000Z');
    assert.equal(peca.ml_category_id, 'MLB_REAL');
    assert.equal(peca.ml_item_id, 'MLB1');
    const segunda = await revisarMetadadosLocais(db, { lote: 1, pausaMs: 0 });
    assert.equal(segunda.atualizados, 0);
    assert.equal(comMetadadosPeca(peca).aplicacao, 'Hilux SW4 2016');
  } finally { await db.close(); }
});

test('sincronização insere e atualiza aplicação/publicação sem apagar compatibilidades em consulta parcial', async () => {
  const { upsertPecaMl } = await import('../src/services/mercadoLivreService.js');
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  const campos = ['nome', 'carro', 'descricao', 'categoria', 'categoria_ml', 'marca', 'modelo', 'ano', 'condicao', 'numero_oem', 'garantia', 'peso_kg', 'comprimento_cm', 'largura_cm', 'altura_cm', 'atributos', 'ml_titulo', 'tipo_anuncio', 'quantidade', 'preco', 'ml_ativo', 'ml_item_id', 'ml_permalink', 'ml_status', 'ml_category_id', 'ml_thumbnail', 'ml_health', 'ml_dados', 'ml_sincronizado_em', 'ml_publicado_em', 'aplicacao_origem', 'categoria_origem'];
  try {
    await db.exec(`CREATE TABLE pecas (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT UNIQUE, ${campos.map((campo) => `${campo} TEXT`).join(',')})`);
    const item = {
      id: 'MLB123', title: 'Absorvedor Imapcto Dianteiro Toyota Hilux SW4', seller_custom_field: 'P001',
      price: 249, available_quantity: 2, status: 'active', condition: 'used',
      category_id: 'MLB_REAL', date_created: '2018-06-20T09:35:00-03:00',
      attributes: [{ id: 'BRAND', value_name: 'Original' }, { id: 'CAR_AND_VAN_MODEL', value_name: 'Hilux SW4' }, { id: 'VEHICLE_YEAR', value_name: '2016 a 2020' }],
      compatibilidades: [{ catalog_product_name: 'Toyota Hilux SW4 2.8 2018 Diesel' }],
    };
    const criado = await upsertPecaMl(item, { db, obterDescricao: async () => 'Descrição original rica e completa' });
    assert.equal(criado.criado, true);
    let peca = await db.get('SELECT * FROM pecas WHERE id = ?', [criado.peca_id]);
    assert.equal(peca.carro, 'Toyota Hilux SW4 2.8 2018 Diesel');
    assert.equal(peca.categoria, 'Almas e Absorvedores de Impacto');
    assert.equal(peca.ml_category_id, 'MLB_REAL');
    assert.equal(peca.ml_publicado_em, '2018-06-20T12:35:00.000Z');
    const { compatibilidades, ...parcial } = item;
    await upsertPecaMl({ ...parcial, price: 299, status: 'paused' }, { db, obterDescricao: async () => { throw new Error('Não deveria recarregar descrição existente'); } });
    peca = await db.get('SELECT * FROM pecas WHERE id = ?', [criado.peca_id]);
    assert.equal(peca.carro, 'Toyota Hilux SW4 2.8 2018 Diesel');
    assert.equal(peca.descricao, 'Descrição original rica e completa');
    assert.equal(JSON.parse(peca.ml_dados).descricao, 'Descrição original rica e completa');
    assert.equal(JSON.parse(peca.ml_dados).compatibilidades.length, 1);
    assert.equal(peca.ml_status, 'paused');
    assert.equal(Number(peca.preco), 299);
  } finally { await db.close(); }
});

test('revisão de categorias preserva cadastro manual e tipos legados ambíguos', () => {
  const base = { nome: 'Absorvedor Impacto Toyota Hilux SW4', ml_item_id: 'MLB1', categoria: 'Portas e Capôs' };
  assert.equal(metadadosPeca(base).categoria, 'Almas e Absorvedores de Impacto');
  assert.equal(metadadosPeca(base).categoria_origem, 'nome_ml');
  assert.equal(metadadosPeca({ ...base, categoria_origem: 'cadastro' }).categoria, 'Portas e Capôs');
  const ambiguo = { ...base, nome: 'Painel Frontal Toyota Hilux', categoria: 'Portas e Capôs' };
  assert.equal(metadadosPeca(ambiguo).categoria, 'Portas e Capôs');
  assert.equal(metadadosPeca(ambiguo).categoria_origem, null);
  assert.equal(metadadosPeca({ ...base, nome: 'Nome não reconhecido', categoria: 'Interior' }).categoria, 'Interior');
});

test('resumo licenciado só por marca não substitui atributos veiculares mais precisos', () => {
  const item = { attributes: [{ id: 'CAR_AND_VAN_MODEL', value_name: 'Corolla 2.0' }, { id: 'VEHICLE_YEAR', value_name: '2020' }], compatibilidades: [{ source: 'CATALOGO', catalog_product_name: 'Toyota', total: 18 }] };
  const meta = metadadosPeca({ nome: 'Retrovisor' }, item);
  assert.equal(meta.aplicacao, 'Corolla 2.0 2020');
  assert.equal(meta.aplicacao_origem, 'atributos_ml');
});
