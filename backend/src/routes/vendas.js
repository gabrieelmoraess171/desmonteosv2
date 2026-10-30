import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  upsertVenda,
  listarVendas,
  obterVendaPorId,
  obterNotificacoes
} from '../services/vendasService.js';
import { obterVendasMlHoje } from '../services/dashboardService.js';
import {
  etiquetaDisponivel,
  listarEnvios
} from '../services/enviosService.js';
import {
  enviarMensagemVenda,
  avisarEntregaCombinada,
  obterEtiquetasEnviosMl,
  enviarXmlNfeMl,
  obterMensagensVenda,
  obterAnexoMensagemVenda,
  sincronizarEnvios,
  sincronizarVendas
} from '../services/mercadoLivreService.js';
import { getDb } from '../database.js';
import { autenticar } from '../middleware/auth.js';
import {
  caminhoXmlNfe,
  limparPreparacaoXmlNfe,
  limparUploadsTemporarios,
  mensagemErroUploadXml,
  prepararXmlNfe,
  persistirXmlNfe,
  removerArquivoXmlNfe,
  uploadXmlNfe
} from '../services/nfeXmlService.js';

const router = express.Router();

function statusErro(error) {
  return Number(error?.statusCode) || 500;
}

function dataLocalISO() {
  const agora = new Date();
  return new Date(
    agora.getTime() - agora.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
}

function receberXmls(campo, limite) {
  return (req, res, next) => {
    const middleware = uploadXmlNfe.array(campo, limite);

    middleware(req, res, (error) => {
      if (!error) return next();

      const arquivos = Array.isArray(req.files) ? req.files : [];

      limparUploadsTemporarios(arquivos).finally(() => {
        res.status(400).json({ error: mensagemErroUploadXml(error) });
      });
    });
  };
}

function normalizarComparacao(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizarNomeCompleto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function termosNomeArquivo(valor) {
  return normalizarNomeCompleto(valor)
    .split(' ')
    .filter((termo) => termo.length >= 3 && !['ZIP', 'XML'].includes(termo));
}

function textoBuscaEnvio(envio) {
  return normalizarNomeCompleto(
    [envio.titulo, envio.venda_peca_nome, envio.sku, envio.venda_peca_sku]
      .filter(Boolean)
      .join(' ')
  );
}

export function pontuacaoDestinatario(envio, destinatario) {
  const nomeXml = normalizarNomeCompleto(destinatario.nome);
  const nomesPedido = [
    envio.receiver_name,
    envio.venda_cliente
  ]
    .map(normalizarNomeCompleto)
    .filter((nome) => nome.split(' ').length >= 2);
  const nomeCorrespondente = Boolean(
    nomeXml &&
      nomeXml.split(' ').length >= 2 &&
      nomesPedido.includes(nomeXml)
  );
  const documentoXml = String(destinatario.documento || '').replace(/\D/g, '');
  const documentoPedido = String(envio.venda_cpf || '').replace(/\D/g, '');
  const documentoCorrespondente = Boolean(
    documentoXml &&
      documentoPedido &&
      documentoXml === documentoPedido
  );
  const documentoValido = [11, 14].includes(documentoXml.length);
  const enderecoXml = normalizarComparacao(destinatario.endereco);
  const enderecosPedido = [envio.receiver_address, envio.venda_endereco]
    .map(normalizarComparacao)
    .filter((endereco) => endereco.length >= 5);
  const enderecoCorrespondente = enderecosPedido.some(
    (endereco) =>
      enderecoXml.length >= 5 &&
      (endereco.includes(enderecoXml) || enderecoXml.includes(endereco))
  );

  if (
    !nomeCorrespondente ||
    !documentoValido ||
    !documentoCorrespondente ||
    !enderecoCorrespondente
  ) {
    return 0;
  }

  return 1;
}

async function encontrarEnvioDoXml(file, preparado) {
  const db = getDb();
  const destinatario = preparado.destinatario;
  const envios = await db.all(
    `SELECT e.*,
            v.cliente AS venda_cliente,
            v.cliente_cpf AS venda_cpf,
            v.cliente_endereco AS venda_endereco,
            p.nome AS venda_peca_nome,
            p.sku AS venda_peca_sku,
            COALESCE(
              NULLIF(e.pack_id, ''),
              NULLIF(v.ml_pack_id, ''),
              e.order_id
            ) AS fiscal_pack_id
       FROM ml_envios e
       LEFT JOIN vendas v ON v.order_id = e.order_id
       LEFT JOIN pecas p ON p.id = v.peca_id
      WHERE e.order_id IS NOT NULL`
  );
  const candidatos = envios
    .map((envio) => ({
      envio,
      pontuacao: pontuacaoDestinatario(envio, destinatario)
    }))
    .filter((item) => item.pontuacao > 0);

  if (candidatos.length === 0) {
    const termosArquivo = termosNomeArquivo(file.originalname);
    const candidatosPorNome = envios
      .map((envio) => {
        const texto = textoBuscaEnvio(envio);
        const encontrados = termosArquivo.filter((termo) => texto.includes(termo));
        return { envio, encontrados };
      })
      .filter(
        (item) =>
          termosArquivo.length >= 2 &&
          item.encontrados.length === termosArquivo.length
      )
      .sort((a, b) => b.encontrados.length - a.encontrados.length);

    const melhor = candidatosPorNome[0];
    const segundo = candidatosPorNome[1];

    if (melhor && (!segundo || segundo.encontrados.length < melhor.encontrados.length)) {
      return melhor.envio;
    }

    throw new Error(
      `${file.originalname}: nome completo, CPF e endereço do comprador no XML não correspondem aos dados fiscais de nenhuma venda sincronizada. Sincronize novamente as vendas e confira os dados do comprador.`
    );
  }

  if (candidatos.length !== 1) {
    throw new Error(
      `${file.originalname}: nome completo, CPF e endereço da NF-e correspondem a mais de uma venda; não associei o XML para evitar enviar ao pedido errado.`
    );
  }

  return candidatos[0].envio;
}

async function salvarXmlDoPedido(envio, file, preparado) {
  const db = getDb();

  await enviarXmlNfeMl(
    envio.shipment_id,
    preparado.conteudo
  );

  const xml = await persistirXmlNfe(file, preparado);
  const enviadoEm = new Date().toISOString();

  try {
    const resultado = await db.run(
      `UPDATE ml_envios
          SET nfe_xml_arquivo = ?,
              nfe_xml_nome = ?,
              nfe_xml_enviado_em = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE shipment_id = ?`,
      [xml.arquivo, xml.nome, enviadoEm, envio.shipment_id]
    );

    if (!resultado.changes) {
      throw new Error(
        `O Mercado Livre recebeu o XML, mas não foi possível vinculá-lo ao pedido ${envio.order_id}.`
      );
    }
  } catch (error) {
    await removerArquivoXmlNfe(xml.arquivo);
    throw error;
  }

  if (envio.nfe_xml_arquivo) {
    await removerArquivoXmlNfe(envio.nfe_xml_arquivo);
  }

  return {
    order_id: String(envio.order_id),
    nfe_xml_disponivel: true,
    nfe_xml_nome: xml.nome,
    nfe_xml_enviado_em: enviadoEm
  };
}

// Vendas do dia vindas do Mercado Livre (para o fechamento financeiro).
router.get('/hoje-ml', async (req, res) => {
  try {
    res.json(await obterVendasMlHoje(getDb(), req.query.data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/notificacoes', async (req, res) => {
  try {
    res.json(await obterNotificacoes(req.query));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Central de envios do Mercado Livre. A leitura usa somente o cache local;
// a primeira carga e as atualizações são disparadas pelo endpoint de
// sincronização para não bloquear a abertura da tela.
router.post('/envios/:orderId/avisar-entrega', async (req, res) => {
  try {
    if (req.body?.confirmada !== true) {
      return res.status(400).json({ error: 'Confirme que o comprador já recebeu o produto.' });
    }
    res.json(await avisarEntregaCombinada(req.params.orderId));
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.get('/envios', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    const periodo = Math.min(
      365,
      Math.max(1, Number(req.query.periodo) || 60)
    );

    res.json(await listarEnvios({ periodo }));
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.post('/envios/sincronizar', async (req, res) => {
  try {
    const dias = Math.min(
      365,
      Math.max(1, Number(req.body?.dias) || 60)
    );
    const limite = Math.min(
      500,
      Math.max(1, Number(req.body?.limite) || 200)
    );
    const resultado = await sincronizarEnvios({
      dias,
      limite,
      forcar: req.body?.forcar === true
    });

    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.post('/envios/etiquetas', async (req, res) => {
  try {
    const shipmentIds = Array.isArray(req.body?.shipmentIds)
      ? req.body.shipmentIds.map((id) => String(id || '').trim())
      : [];

    if (
      shipmentIds.length === 0 ||
      shipmentIds.length > 50 ||
      shipmentIds.some((id) => !/^\d{1,100}$/.test(id)) ||
      new Set(shipmentIds).size !== shipmentIds.length
    ) {
      return res.status(400).json({
        error: 'Selecione entre 1 e 50 envios válidos para imprimir.'
      });
    }

    const placeholders = shipmentIds.map(() => '?').join(', ');
    const enviosEncontrados = await getDb().all(
      `SELECT shipment_id, status, substatus, etiqueta_emitida_em
         FROM ml_envios
        WHERE shipment_id IN (${placeholders})
          AND order_id IS NOT NULL`,
      shipmentIds
    );
    const enviosPorId = new Map(
      enviosEncontrados.map((envio) => [
        String(envio.shipment_id),
        envio
      ])
    );
    const ausentes = shipmentIds.filter((id) => !enviosPorId.has(id));

    if (ausentes.length > 0) {
      return res.status(404).json({
        error: `Não encontrei estes envios sincronizados: ${ausentes.join(', ')}.`
      });
    }

    const indisponiveis = shipmentIds.filter((id) => {
      const envio = enviosPorId.get(id);
      return !etiquetaDisponivel(
        envio.status,
        envio.substatus,
        envio.etiqueta_emitida_em
      );
    });

    if (indisponiveis.length > 0) {
      return res.status(409).json({
        error: `A etiqueta ainda não está disponível para estes envios: ${indisponiveis.join(', ')}.`
      });
    }

    const pdf = await obterEtiquetasEnviosMl(shipmentIds);
    const emitidaEm = new Date().toISOString();
    const resultado = await getDb().run(
      `UPDATE ml_envios
          SET etiqueta_emitida_em = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE shipment_id IN (${placeholders})`,
      [emitidaEm, ...shipmentIds]
    );

    if (resultado.changes !== shipmentIds.length) {
      throw new Error(
        'O PDF foi obtido, mas não foi possível registrar todas as etiquetas emitidas.'
      );
    }

    res.set({
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/pdf',
      'X-Etiquetas-Emitidas-Em': emitidaEm,
      'Content-Disposition': 'inline; filename="etiquetas-mercado-livre.pdf"'
    });
    res.send(pdf);
  } catch (error) {
    res.status(statusErro(error)).json({
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível obter as etiquetas do Mercado Livre.'
    });
  }
});

router.post(
  '/envios/nfe-xml/lote',
  receberXmls('files', 20),
  async (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];

    try {
      if (files.length === 0) {
        return res.status(400).json({
          error: 'Selecione ao menos um arquivo XML ou ZIP.'
        });
      }

      const sucessos = [];
      const falhas = [];
      const pedidosDoLote = new Set();

      for (const file of files) {
        let preparado = null;

        try {
          preparado = await prepararXmlNfe(file);
          const envio = await encontrarEnvioDoXml(file, preparado);
          const orderId = String(envio.order_id);

          if (pedidosDoLote.has(orderId)) {
            throw new Error(
              `${file.originalname}: outro arquivo deste lote já foi associado ao mesmo pedido.`
            );
          }

          const salvo = await salvarXmlDoPedido(envio, file, preparado);
          pedidosDoLote.add(orderId);
          sucessos.push(salvo);
        } catch (error) {
          falhas.push({
            arquivo: path.basename(file.originalname),
            erro: error instanceof Error ? error.message : 'Erro inesperado.'
          });
        } finally {
          if (preparado) await limparPreparacaoXmlNfe(preparado);
        }
      }

      res.status(falhas.length > 0 ? 207 : 200).json({
        ok: falhas.length === 0,
        enviados: sucessos.length,
        falhas,
        envios: sucessos
      });
    } finally {
      await limparUploadsTemporarios(files);
    }
  }
);

router.get('/envios/:orderId/nfe-xml', async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim();
    const envio = await getDb().get(
      'SELECT nfe_xml_arquivo, nfe_xml_nome FROM ml_envios WHERE order_id = ?',
      [orderId]
    );
    const caminho = caminhoXmlNfe(envio?.nfe_xml_arquivo);

    if (!caminho || !envio?.nfe_xml_nome) {
      return res.status(404).json({ error: 'XML de NF-e não encontrado.' });
    }

    await fs.promises.access(caminho, fs.constants.R_OK);
    res.set('Cache-Control', 'private, no-store');
    res.download(caminho, envio.nfe_xml_nome, (error) => {
      if (error && !res.headersSent) {
        res.status(500).json({ error: 'Não foi possível baixar o XML.' });
      }
    });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return res.status(404).json({ error: 'Arquivo XML não encontrado.' });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro ao baixar o XML.'
    });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await listarVendas(req.query));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/mensagens', async (req, res) => {
  try {
    res.json(await obterMensagensVenda(Number(req.params.id)));
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.get('/:id/mensagens/:mensagemId/anexos/:anexoId', async (req, res) => {
  try {
    const anexo = await obterAnexoMensagemVenda(Number(req.params.id), req.params.mensagemId, req.params.anexoId);
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.attachment(anexo.nome);
    if (req.query.download !== '1' && anexo.tipo !== 'application/octet-stream') {
      res.set('Content-Disposition', res.get('Content-Disposition').replace(/^attachment/, 'inline'));
    }
    res.type(anexo.tipo).send(anexo.buffer);
  } catch (error) { res.status(statusErro(error)).json({ error: error.message }); }
});

router.post('/:id/mensagens', async (req, res) => {
  try {
    res.json(
      await enviarMensagemVenda(Number(req.params.id), req.body?.mensagem)
    );
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await obterVendaPorId(req.params.id));
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.post('/sincronizar', async (req, res) => {
  try {
    res.json(await sincronizarVendas({ dias: Number(req.body?.dias) || 30 }));
  } catch (error) {
    res.status(statusErro(error)).json({ error: error.message });
  }
});

router.patch('/:id/agendamento-financeiro', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID da venda inválido' });
    }

    const status = String(req.body?.status || '').trim().toLowerCase();
    const permitidos = ['pendente', 'disponivel', 'agendada', 'enviada'];
    if (!permitidos.includes(status)) {
      return res.status(400).json({
        error: 'Status inválido. Use pendente, disponivel, agendada ou enviada.'
      });
    }

    let dataAgendada = null;
    if (status === 'agendada') {
      dataAgendada = String(req.body?.data || '').trim().slice(0, 10);
      const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(dataAgendada);
      const dataNormalizada = new Date(`${dataAgendada}T00:00:00Z`);
      if (
        !dataValida ||
        Number.isNaN(dataNormalizada.getTime()) ||
        dataNormalizada.toISOString().slice(0, 10) !== dataAgendada
      ) {
        return res.status(400).json({
          error: 'Informe uma data válida para o agendamento.'
        });
      }
    } else if (status === 'disponivel') {
      dataAgendada = dataLocalISO();
    }

    const enviada = status === 'enviada';
    const resultado = await getDb().run(
      `UPDATE vendas
          SET financeiro_status = ?,
              financeiro_agendada_para = ?,
              enviada_financeiro = ?,
              enviada_financeiro_em = ?,
              last_updated = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        status,
        dataAgendada,
        enviada ? 1 : 0,
        enviada ? new Date().toISOString() : null,
        id
      ]
    );
    if (!resultado.changes) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    res.json({
      ok: true,
      status,
      data: dataAgendada,
      enviada_financeiro: enviada ? 1 : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Marca/desmarca uma venda como já enviada ao WhatsApp do financeiro.
router.patch('/:id/enviada-financeiro', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID da venda inválido' });
    }

    const enviada = req.body?.enviada !== false;
    const resultado = await getDb().run(
      `UPDATE vendas
          SET enviada_financeiro = ?,
              financeiro_status = ?,
              financeiro_agendada_para = CASE
                WHEN ? = 1 THEN NULL
                ELSE DATE('now', 'localtime')
              END,
              enviada_financeiro_em = ?,
              last_updated = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        enviada ? 1 : 0,
        enviada ? 'enviada' : 'disponivel',
        enviada ? 1 : 0,
        enviada ? new Date().toISOString() : null,
        id
      ]
    );

    if (!resultado.changes) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    res.json({ ok: true, enviada });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registro manual: mesmo shape de payload da importação, sem extensão.
// Se API_TOKEN estiver configurado, exige Bearer token.
router.post('/manual', autenticar, async (req, res) => {
  try {
    const resultado = await upsertVenda(req.body, { plataforma: 'Manual' });
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Importação em lote: mesma função, várias linhas.
router.post('/import', autenticar, async (req, res) => {
  const lista = Array.isArray(req.body) ? req.body : req.body?.vendas;

  if (!Array.isArray(lista) || lista.length === 0) {
    return res.status(400).json({ error: 'Lista vazia' });
  }

  if (lista.length > 500) {
    return res.status(400).json({ error: 'Envie no máximo 500 vendas por lote' });
  }

  let sucesso = 0;
  const falhas = [];

  for (const item of lista) {
    try {
      await upsertVenda(item, { plataforma: 'Importação' });
      sucesso += 1;
    } catch (error) {
      falhas.push({
        order_id: item?.order_id ?? null,
        erro: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  res.json({ ok: true, sucesso, falhas });
});

export default router;
