import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initDatabase } from '../src/database.js';
import { classificarAba, listarEnvios, confirmarDespachoInformado } from '../src/services/enviosService.js';
import { sincronizarEnvios, avisarEntregaCombinada } from '../src/services/mercadoLivreService.js';

test('despacho tem precedência sobre prazo e retirada a combinar', () => {
  assert.equal(classificarAba('ready_to_ship', 'dropped_off', null), 'transito');
  assert.equal(classificarAba('ready_to_ship', 'picked_up', '2026-10-01'), 'transito');
  assert.equal(classificarAba('delivered', 'picked_up', null), 'finalizadas');
  assert.equal(classificarAba('cancelled', 'picked_up', null), 'cancelados');
  assert.equal(classificarAba('ready_to_ship', 'in_hub', null), 'transito');
  assert.equal(classificarAba('ready_to_ship', 'printed', null), 'hoje');
  const futuro = new Date(Date.now() + 2 * 86400000).toISOString();
  assert.equal(classificarAba('ready_to_ship', 'invoice_pending', futuro), 'proximos');
  assert.equal(classificarAba('ready_to_ship', 'ready_to_print', futuro), 'proximos');
  assert.equal(classificarAba('ready_to_ship', 'printed', futuro), 'proximos');
  assert.equal(classificarAba('paid', '', null, true), 'combinar');
  assert.equal(classificarAba('delivered', '', null, true), 'finalizadas');
  assert.equal(classificarAba('shipped', '', null, true), 'transito');
  assert.equal(classificarAba('cancelled', '', null, true), 'cancelados');
});

test('sincroniza pedidos sem envio e atualiza despacho após cinco segundos', async () => {
  const cwd = process.cwd();
  const pasta = await mkdtemp(path.join(os.tmpdir(), 'desmonte-envios-'));
  const fetchOriginal = globalThis.fetch;
  let db;
  try {
    process.chdir(pasta);
    db = await initDatabase();
    await db.run("INSERT INTO ml_integracao (id, user_id, access_token) VALUES (1, 'teste', 'token-ficticio')");
    const pedido = (id, shipping) => ({
      id, shipping, status: 'paid', date_created: new Date().toISOString(),
      total_amount: 100,
      order_items: [{ item: { id: `MLB${id}`, seller_sku: `SKU${id}`, title: 'Peça' }, quantity: 1, unit_price: 100 }],
    });
    const pedidos = [
      pedido(1, {}), pedido(2, { id: null }), pedido(3, { id: '33' }),
      { ...pedido(4, { id: null }), tags: ['no_shipping'], fulfilled: true },
      { ...pedido(5, { id: null }), tags: ['no_shipping'], status: 'cancelled', fulfilled: true },
    ];
    let substatus = 'printed';
    let consultasEnvio = 0;
    globalThis.fetch = async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === '/orders/search') return Response.json({ results: pedidos, paging: { total: pedidos.length } });
      if (pathname === '/shipments/33') {
        consultasEnvio++;
        return Response.json({ id: '33', status: 'ready_to_ship', substatus, date_created: new Date().toISOString() });
      }
      throw new Error(`Requisição inesperada: ${pathname}`);
    };
    const primeira = await sincronizarEnvios();
    assert.equal(primeira.erros, 0);
    assert.equal(primeira.criados, 5);
    let dados = await listarEnvios();
    assert.equal(dados.envios.filter((envio) => envio.aba === 'combinar').length, 2);
    assert.equal(dados.envios.find((envio) => envio.order_id === '4').aba, 'finalizadas');
    assert.equal(dados.envios.find((envio) => envio.order_id === '5').aba, 'cancelados');
    await sincronizarEnvios();
    assert.equal(consultasEnvio, 1, 'evita repetir consulta dentro do intervalo');
    await confirmarDespachoInformado('3');
    let confirmado = (await listarEnvios()).envios.find((envio) => envio.order_id === '3');
    assert.equal(confirmado.aba, 'transito');
    assert.equal(confirmado.atrasado, false);
    assert.equal(confirmado.status, 'ready_to_ship', 'preserva o status original da API');
    assert.match(confirmado.status_label, /confirmado pelo operador/);
    await db.run('UPDATE ml_envios SET sincronizado_em = ?', [new Date(Date.now() - 6000).toISOString()]);
    await sincronizarEnvios();
    confirmado = (await listarEnvios()).envios.find((envio) => envio.order_id === '3');
    assert.match(confirmado.status_label, /confirmado pelo operador/, 'a sincronização preserva a confirmação local');
    await db.run("UPDATE ml_envios SET status = 'delivered' WHERE order_id = '3'");
    assert.equal((await listarEnvios()).envios.find((envio) => envio.order_id === '3').aba, 'finalizadas');
    await db.run("UPDATE ml_envios SET status = 'ready_to_ship' WHERE order_id = '3'");
    substatus = 'dropped_off';
    await db.run('UPDATE ml_envios SET sincronizado_em = ?', [new Date(Date.now() - 6000).toISOString()]);
    await sincronizarEnvios();
    dados = await listarEnvios();
    const despachado = dados.envios.find((envio) => envio.shipment_id === '33');
    assert.equal(despachado.aba, 'transito');
    assert.equal(despachado.status_label, 'Recebido pelo Mercado Livre');
    assert.equal(despachado.etiqueta_disponivel, false);
    assert.equal(consultasEnvio, 3);
    const avisos = [];
    globalThis.fetch = async (url, opcoes) => {
      const pathname = new URL(url).pathname;
      if (pathname === '/orders/1') return Response.json(pedidos[0]);
      if (pathname === '/orders/3') return Response.json(pedidos[2]);
      if (pathname === '/orders/1/feedback') {
        avisos.push(JSON.parse(opcoes.body));
        return Response.json({ fulfilled: true });
      }
      throw new Error(`Requisição inesperada: ${pathname}`);
    };
    await assert.rejects(avisarEntregaCombinada('3'), /apenas para vendas a combinar/);
    assert.equal(avisos.length, 0);
    await avisarEntregaCombinada('1');
    assert.deepEqual(avisos, [{ fulfilled: true, rating: 'positive' }]);
    assert.equal((await listarEnvios()).envios.find((envio) => envio.order_id === '1').aba, 'finalizadas');
  } finally {
    globalThis.fetch = fetchOriginal;
    if (db) await db.close();
    process.chdir(cwd);
    assert.equal(path.dirname(path.resolve(pasta)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(pasta).startsWith('desmonte-envios-'));
    await rm(pasta, { recursive: true, force: true });
  }
});
