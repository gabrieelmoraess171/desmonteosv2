import test from 'node:test';
import assert from 'node:assert/strict';
import { tipoPeca } from '../src/services/tipoPeca.js';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { obterRankingTiposPeca } from '../src/services/dashboardService.js';
import { mapearReputacaoMl } from '../src/services/mlReputacao.js';

test('agrupa peças semelhantes independentemente de lado, acento e veículo', () => {
  assert.equal(tipoPeca('Maçaneta porta dianteira direita Hilux'), 'Maçaneta');
  assert.equal(tipoPeca('Macaneta traseira esquerda Ford'), 'Maçaneta');
  assert.equal(tipoPeca('Console Central Corolla'), 'Console');
  assert.equal(tipoPeca('Console Apoio Braço Civic'), 'Console');
  assert.equal(tipoPeca('Peça especial ABC'), 'Peça');
});

test('usa o nível e o selo oficiais sem confundir com a estimativa local', () => {
  const reputacao = mapearReputacaoMl({ seller_reputation: { level_id: '5_green', power_seller_status: 'platinum', metrics: { claims: { rate: 0.06 } } } });
  assert.equal(reputacao.termometro, 5);
  assert.equal(reputacao.selo, 'MercadoLíder Platinum');
  assert.equal(reputacao.cor, 'success');
  assert.ok(reputacao.score < 95);
  assert.equal(mapearReputacaoMl({ seller_reputation: {} }).termometro, 0);
});


test('usa somente o primeiro tipo e não confunde acessórios com o produto citado depois', () => {
  const exemplos = [
    ['Alma do Para-choque Toyota', 'Alma'],
    ['Almas Para Choque Hilux', 'Alma'],
    ['Absorvedor Impacto Dianteiro Toyota Hilux SW4', 'Absorvedor'],
    ['Absorvedores do Parachoque Ford', 'Absorvedor'],
    ['Tampão Estepe Carpete Assoalho Jaguar F Pace 2016 2019 Preto', 'Tampão'],
    ['TAMPOES porta malas Corolla', 'Tampão'],
    ['Suporte Para-choque Dianteiro', 'Suporte'],
    ['Moldura Maçaneta Porta', 'Moldura'],
    ['Acabamento Moldura Retrovisor', 'Acabamento'],
    ['Friso Porta Dianteira', 'Friso'],
  ];
  for (const [nome, esperado] of exemplos) assert.equal(tipoPeca(nome), esperado, nome);
});

test('normaliza compostos e plurais conhecidos sem cortar nomes arbitrariamente', () => {
  for (const nome of ['Para-choque Corolla', 'Parachoque Ford', 'Para choque SW4', 'PARA-CHOQUES Honda']) {
    assert.equal(tipoPeca(nome), 'Para-choque', nome);
  }
  assert.equal(tipoPeca('Faróis Jaguar'), 'Farol');
  assert.equal(tipoPeca('Paineis Corolla'), 'Painel');
  assert.equal(tipoPeca('Porta-malas Ford'), 'Porta-malas');
  assert.equal(tipoPeca('Porta Luvas Jaguar'), 'Porta-luvas');
  assert.equal(tipoPeca('Porta Dianteira Jaguar'), 'Porta');
  assert.equal(tipoPeca('Semi-eixos Corolla'), 'Semieixo');
  assert.equal(tipoPeca('Quebra-sóis Gol'), 'Quebra-sol');
  assert.equal(tipoPeca('Chassis Hilux'), 'Chassis');
  assert.equal(tipoPeca('  • Maçanetas Corolla  '), 'Maçaneta');
  for (const nome of ['', '   ', null, undefined, '!!!']) assert.equal(tipoPeca(nome), 'Produto sem nome');
});

test('ranking reúne as vendas por primeiro tipo, conserva os dados dos itens e usa uma consulta', async () => {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  try {
    await db.exec(`
      CREATE TABLE pecas (id INTEGER PRIMARY KEY, sku TEXT UNIQUE, nome TEXT, ml_thumbnail TEXT);
      CREATE TABLE peca_imagens (id INTEGER PRIMARY KEY, peca_id INTEGER, caminho TEXT, is_principal INTEGER, ordem INTEGER);
      CREATE TABLE vendas (id INTEGER PRIMARY KEY, order_id TEXT, status TEXT, plataforma TEXT, data_venda TEXT, cliente TEXT, peca_id INTEGER, valor REAL);
      CREATE TABLE venda_itens (venda_id INTEGER, sku TEXT, descricao TEXT, quantidade INTEGER, preco_unitario REAL);
      INSERT INTO pecas VALUES (1, 'ALMA1', 'Alma Para-choque', 'http://fotos.example/alma.jpg'),
        (2, 'ALMA2', 'Almas do Para Choque', ''), (3, 'PARA1', 'Parachoque', ''),
        (4, 'TAMP1', 'Tampão Estepe Jaguar F Pace', ''), (5, 'ABS1', 'Absorvedor Impacto SW4', ''),
        (6, 'SUP1', 'Suporte Para-choque', '');
      INSERT INTO peca_imagens VALUES (1, 2, '/uploads/alma2.jpg', 1, 0);
      INSERT INTO vendas VALUES
        (1, 'MLB-PEDIDO-1', 'concluida', 'Mercado Livre', '2026-10-30 12:00:00', 'Ana', NULL, 240),
        (2, 'MLB-PEDIDO-2', 'paid', 'Mercado Livre', '2026-10-29 12:00:00', 'Bruno', NULL, 350),
        (3, 'MLB-PEDIDO-3', 'concluida', 'Mercado Livre', '2026-10-28 12:00:00', 'Carla', NULL, 150),
        (4, 'CANCELADA', 'cancelada', 'Mercado Livre', '2026-10-30 12:00:00', 'Dora', NULL, 5000),
        (5, 'MANUAL', 'paid', 'Manual', '2026-10-30 12:00:00', 'Eva', NULL, 10000),
        (6, 'ANTIGA', 'paid', 'Mercado Livre', '2026-09-20 12:00:00', 'Fabio', NULL, 5000),
        (7, 'MLB-PEDIDO-7', 'paid', 'Mercado Livre', '2026-10-30 13:00:00', 'Gabi', 5, 249),
        (8, 'MLB-PEDIDO-8', 'paid', 'Mercado Livre', '2026-10-27 12:00:00', 'Heitor', NULL, 49);
      INSERT INTO venda_itens VALUES
        (1, 'ALMA1', 'Alma do Para-choque Toyota', 1, 100),
        (1, 'ALMA2', 'Almas Para Choque Ford', 2, 70),
        (2, 'PARA1', 'Para choque Dianteiro Ford', 1, 350),
        (3, 'TAMP1', 'Tampão Estepe Carpete Assoalho Jaguar F Pace', 1, 150),
        (4, 'ALMA1', 'Alma Para-choque', 10, 500),
        (5, 'TAMP1', 'Tampão Estepe', 20, 500),
        (6, 'TAMP1', 'Tampão Estepe', 10, 500),
        (8, 'SUP1', 'Suporte de Para-choque Dianteiro', 1, 49);
    `);
    let consultas = 0;
    const tipos = await obterRankingTiposPeca({ all: (...args) => { consultas++; return db.all(...args); } }, {
      rankingInicio: '2026-10-01', rankingFim: '2026-10-31'
    });
    assert.equal(consultas, 1);
    assert.equal(tipos.length, 5);
    assert.equal(tipos[0].tipo, 'Alma');
    assert.equal(tipos[0].vendas, 1, 'dois itens do mesmo tipo no pedido contam como uma venda');
    assert.equal(tipos[0].unidades, 3);
    assert.equal(tipos[0].faturamento, 240);
    assert.deepEqual(tipos[0].vendidos.map(venda => venda.vendaId), [1, 1]);
    assert.equal(tipos[0].vendidos[0].pedido, 'MLB-PEDIDO-1');
    assert.equal(tipos[0].vendidos[0].cliente, 'Ana');
    assert.equal(tipos[0].vendidos[0].nome, 'Alma do Para-choque Toyota');
    assert.equal(tipos[0].vendidos[0].imagem, 'https://fotos.example/alma.jpg');
    assert.equal(tipos[0].vendidos[1].imagem, '/uploads/alma2.jpg');
    assert.equal(tipos.find(tipo => tipo.tipo === 'Para-choque').unidades, 1);
    assert.equal(tipos.find(tipo => tipo.tipo === 'Tampão').unidades, 1);
    assert.equal(tipos.find(tipo => tipo.tipo === 'Absorvedor').vendidos[0].vendaId, 7);
    assert.equal(tipos.find(tipo => tipo.tipo === 'Suporte').unidades, 1);
  } finally { await db.close(); }
});

test('ranking rejeita intervalos invertidos, incompletos e datas impossíveis antes de consultar', async () => {
  const db = { all: () => { throw new Error('não deveria consultar'); } };
  for (const params of [
    { inicio: '2026-10-31', fim: '2026-10-01' },
    { rankingInicio: '2026-02-31', rankingFim: '2026-03-01' },
    { inicio: '2026-10-01' },
    { inicio: '2026-10-01 OR 1=1', fim: '2026-10-31' },
  ]) {
    await assert.rejects(obterRankingTiposPeca(db, params), error => error.statusCode === 400);
  }
});
