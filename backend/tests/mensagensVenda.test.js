import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initDatabase } from '../src/database.js';
import { mapearMensagemPack, prepararMensagemVenda, obterMensagensVenda, enviarMensagemVenda, obterAnexoMensagemVenda } from '../src/services/mercadoLivreService.js';

test('mensagem somente com foto é preservada nos formatos atual e legado', () => {
  for (const chave of ['message_attachments', 'attachments']) {
    const mensagem = mapearMensagemPack({ id: 'mensagem1', from: { user_id: 20 }, [chave]: [{ filename: '20_foto.jpeg', original_filename: 'Foto da peça.jpeg', type: 'image/jpeg' }] }, '30', 0, 1);
    assert.equal(mensagem.texto, '');
    assert.equal(mensagem.papel, 'comprador');
    assert.equal(mensagem.anexos[0].url, '/api/vendas/1/mensagens/mensagem1/anexos/20_foto.jpeg');
  }
});

test('envio usa pós-venda, respeita bloqueio e limite e distingue conversas com agente', () => {
  const contexto = { packId: '10', sellerId: '30', buyerId: '20', siteId: 'MLB', mensagem: 'Certinho amigo', dados: { conversation_status: { status: 'active' }, seller_max_message_length: 3500 } };
  assert.equal(prepararMensagemVenda(contexto).caminho, '/messages/packs/10/sellers/30?tag=post_sale');
  assert.equal(prepararMensagemVenda(contexto).corpo.to.user_id, '20');
  assert.equal(prepararMensagemVenda({ ...contexto, dados: { conversation_status: { status: 'active', path: '/packs/10/sellers/30/conversations/agent' } } }).corpo.to.user_id, '3037675074');
  assert.throws(() => prepararMensagemVenda({ ...contexto, dados: { conversation_status: { status: 'blocked', substatus: 'blocked_by_claim' } } }), /reclamação/);
  assert.throws(() => prepararMensagemVenda({ ...contexto, mensagem: 'a'.repeat(3501) }), /3500 caracteres/);
  assert.equal(prepararMensagemVenda({ ...contexto, mensagem: 'Linha 1\r\nLinha 2' }).corpo.text, 'Linha 1\nLinha 2');
});

test('chat e anexo consultam a conversa correta, sem expor token ou permitir arquivo de outro pedido', async () => {
  const cwd = process.cwd();
  const pasta = await mkdtemp(path.join(os.tmpdir(), 'desmonte-chat-'));
  const originalFetch = globalThis.fetch;
  let db;
  try {
    process.chdir(pasta);
    db = await initDatabase();
    await db.run("INSERT INTO ml_integracao (id, user_id, site_id, access_token) VALUES (1, '30', 'MLB', 'token-ficticio')");
    const inserida = await db.run("INSERT INTO vendas (order_id, ml_pack_id, ml_buyer_id, plataforma) VALUES ('10', '10', '20', 'Mercado Livre')");
    const mensagem = { id: 'mensagem1', from: { user_id: 20 }, message_resources: [{ name: 'packs', id: '10' }, { name: 'sellers', id: '30' }], message_attachments: [{ filename: '20_foto.png', type: 'image/png', potential_security_threat: false }] };
    const dados = { messages: [mensagem], conversation_status: { status: 'active' }, seller_max_message_length: 3500 };
    const envios = [];
    let downloads = 0;
    globalThis.fetch = async (url, opcoes = {}) => {
      const endereco = new URL(url);
      if (endereco.pathname === '/messages/packs/10/sellers/30') {
        assert.equal(endereco.searchParams.get('tag'), 'post_sale');
        if (opcoes.method === 'POST') { envios.push(JSON.parse(opcoes.body)); return Response.json({ id: 'enviada' }); }
        return Response.json(dados);
      }
      if (endereco.pathname === '/messages/mensagem1') return Response.json({ messages: [mensagem] });
      if (endereco.pathname === '/messages/attachments/20_foto.png') {
        downloads++;
        assert.equal(endereco.searchParams.get('site_id'), 'MLB');
        return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } });
      }
      throw new Error(`Requisição inesperada: ${endereco.pathname}`);
    };
    const chat = await obterMensagensVenda(inserida.lastID);
    assert.equal(chat.mensagens.length, 1);
    assert.equal(chat.mensagens[0].anexos.length, 1);
    assert.equal(JSON.stringify(chat).includes('token-ficticio'), false);
    await enviarMensagemVenda(inserida.lastID, 'Certinho amigo');
    assert.deepEqual(envios, [{ from: { user_id: '30' }, to: { user_id: '20' }, text: 'Certinho amigo' }]);
    const arquivo = await obterAnexoMensagemVenda(inserida.lastID, 'mensagem1', '20_foto.png');
    assert.equal(arquivo.tipo, 'image/png');
    assert.equal(arquivo.buffer.length, 4);
    mensagem.message_resources[0].id = 'outro-pedido';
    await assert.rejects(obterAnexoMensagemVenda(inserida.lastID, 'mensagem1', '20_foto.png'), /não pertence/);
    assert.equal(downloads, 1);
    dados.conversation_status = { status: 'blocked', substatus: 'blocked_by_claim' };
    assert.equal((await obterMensagensVenda(inserida.lastID)).conversaDisponivel, false);
    await assert.rejects(enviarMensagemVenda(inserida.lastID, 'Outra mensagem'), /reclamação/);
    assert.equal(envios.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (db) await db.close();
    process.chdir(cwd);
    assert.equal(path.dirname(path.resolve(pasta)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(pasta).startsWith('desmonte-chat-'));
    await rm(pasta, { recursive: true, force: true });
  }
});
