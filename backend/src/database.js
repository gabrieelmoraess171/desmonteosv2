import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import {
  classificarCategoria,
  normalizarCategoria,
  sugerirCategoriaMl
} from './utils/categorias.js';
import { criarBancoPostgres } from './postgresCompat.js';

const DBSOURCE = './database.sqlite';

let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    throw new Error('Banco de dados ainda não foi inicializado');
  }

  return dbInstance;
}

export async function initDatabase() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  const db = databaseUrl
    ? criarBancoPostgres(databaseUrl)
    : await open({
        filename: DBSOURCE,
        driver: sqlite3.Database
      });

  // Tabela de peças
  await db.exec(`
    CREATE TABLE IF NOT EXISTS pecas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      carro TEXT,
      descricao TEXT,
      quantidade INTEGER DEFAULT 0,
      preco REAL DEFAULT 0.0,
      ml_ativo BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec('PRAGMA journal_mode = WAL');

  // Campos comerciais e ficha técnica usados no cadastro/ML.
  const colunasPecas = await db.all('PRAGMA table_info(pecas)');
  const nomesColunasPecas = new Set(colunasPecas.map((coluna) => coluna.name));

  const novasColunasPecas = {
    sku: 'TEXT',
    categoria: "TEXT DEFAULT ''",
    categoria_ml: "TEXT DEFAULT ''",
    marca: "TEXT DEFAULT ''",
    modelo: "TEXT DEFAULT ''",
    ano: "TEXT DEFAULT ''",
    condicao: "TEXT DEFAULT 'usado'",
    numero_oem: "TEXT DEFAULT ''",
    garantia: "TEXT DEFAULT ''",
    peso_kg: 'REAL DEFAULT 0',
    comprimento_cm: 'REAL DEFAULT 0',
    largura_cm: 'REAL DEFAULT 0',
    altura_cm: 'REAL DEFAULT 0',
    atributos: "TEXT DEFAULT '{}'",
    ml_titulo: "TEXT DEFAULT ''",
    tipo_anuncio: "TEXT DEFAULT 'clássico'",
    gtin: "TEXT DEFAULT ''",
    localizacao: "TEXT DEFAULT ''",
    video_url: "TEXT DEFAULT ''",
    modo_compra: "TEXT DEFAULT 'buy_it_now'",
    ml_item_id: 'TEXT',
    ml_permalink: 'TEXT',
    ml_status: "TEXT DEFAULT ''",
    ml_category_id: "TEXT DEFAULT ''",
    ml_thumbnail: 'TEXT',
    ml_health: 'REAL',
    ml_sincronizado_em: 'TEXT'
  };

  for (const [nome, definicao] of Object.entries(novasColunasPecas)) {
    if (!nomesColunasPecas.has(nome)) {
      await db.exec(`ALTER TABLE pecas ADD COLUMN ${nome} ${definicao}`);
    }
  }

  // Categoriza automaticamente as peças antigas que ainda não têm categoria.
  const pecasSemCategoria = await db.all(
    `SELECT id, nome, descricao, carro
     FROM pecas
     WHERE categoria IS NULL OR TRIM(categoria) = ''`
  );

  for (const peca of pecasSemCategoria) {
    const categoria = classificarCategoria(
      peca.nome,
      peca.descricao,
      peca.carro
    );

    await db.run(
      `UPDATE pecas
       SET categoria = ?,
           categoria_ml = CASE
             WHEN categoria_ml IS NULL OR TRIM(categoria_ml) = '' THEN ?
             ELSE categoria_ml
           END
       WHERE id = ?`,
      [categoria, sugerirCategoriaMl(categoria), peca.id]
    );
  }

  // Preenche a categoria sugerida de anúncios que já têm categoria.
  const pecasSemCategoriaMl = await db.all(
    `SELECT id, categoria FROM pecas
     WHERE categoria_ml IS NULL OR TRIM(categoria_ml) = ''`
  );

  for (const peca of pecasSemCategoriaMl) {
    const categoria = normalizarCategoria(peca.categoria);
    await db.run('UPDATE pecas SET categoria_ml = ? WHERE id = ?', [
      sugerirCategoriaMl(categoria),
      peca.id
    ]);
  }

  // Fotos dos produtos cadastrados (usadas nos anúncios)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS peca_imagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      peca_id INTEGER NOT NULL,
      caminho TEXT NOT NULL,
      nome_arquivo TEXT,
      is_principal INTEGER DEFAULT 0,
      ordem INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (peca_id) REFERENCES pecas(id) ON DELETE CASCADE
    )
  `);

  // Perguntas do Mercado Livre
  await db.exec(`
    CREATE TABLE IF NOT EXISTS perguntas_ml (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      peca_id INTEGER,
      pergunta TEXT,
      resposta TEXT,
      sugestao_ia TEXT DEFAULT '',
      sugestao_fonte TEXT DEFAULT '',
      respondida BOOLEAN DEFAULT 0,
      data_pergunta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (peca_id) REFERENCES pecas(id)
    )
  `);

  const colunasPerguntas = await db.all('PRAGMA table_info(perguntas_ml)');
  const nomesColunasPerguntas = colunasPerguntas.map((coluna) => coluna.name);

  if (!nomesColunasPerguntas.includes('sugestao_ia')) {
    await db.exec(
      "ALTER TABLE perguntas_ml ADD COLUMN sugestao_ia TEXT DEFAULT ''"
    );
  }

  if (!nomesColunasPerguntas.includes('sugestao_fonte')) {
    await db.exec(
      "ALTER TABLE perguntas_ml ADD COLUMN sugestao_fonte TEXT DEFAULT ''"
    );
  }

  const novasColunasPerguntas = {
    ml_question_id: 'TEXT',
    ml_item_id: 'TEXT',
    ml_status: "TEXT DEFAULT ''",
    data_resposta: 'TEXT',
    atualizado_em: 'TEXT'
  };

  for (const [nome, definicao] of Object.entries(novasColunasPerguntas)) {
    if (!nomesColunasPerguntas.includes(nome)) {
      await db.exec(`ALTER TABLE perguntas_ml ADD COLUMN ${nome} ${definicao}`);
    }
  }

  // Reclamações abertas no Mercado Livre
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reclamacoes_ml (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      peca_id INTEGER,
      pedido_id TEXT,
      motivo TEXT,
      descricao TEXT,
      status TEXT DEFAULT 'aberta',
      data_reclamacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolvido_em TIMESTAMP,
      FOREIGN KEY (peca_id) REFERENCES pecas(id)
    )
  `);

  const colunasReclamacoes = await db.all('PRAGMA table_info(reclamacoes_ml)');
  const nomesColunasReclamacoes = colunasReclamacoes.map(
    (coluna) => coluna.name
  );

  const novasColunasReclamacoes = {
    ml_claim_id: 'TEXT',
    ml_status: "TEXT DEFAULT ''",
    atualizado_em: 'TEXT'
  };

  for (const [nome, definicao] of Object.entries(novasColunasReclamacoes)) {
    if (!nomesColunasReclamacoes.includes(nome)) {
      await db.exec(
        `ALTER TABLE reclamacoes_ml ADD COLUMN ${nome} ${definicao}`
      );
    }
  }

  // Tabela de vendas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      peca_id INTEGER,
      valor REAL,
      plataforma TEXT DEFAULT 'Mercado Livre',
      cliente TEXT DEFAULT '',
      metodo_pagamento TEXT DEFAULT '',
      status TEXT DEFAULT 'concluida',
      data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (peca_id) REFERENCES pecas(id)
    )
  `);

  // Migração para bancos criados antes das colunas cliente/metodo_pagamento
  const colunasVendas = await db.all('PRAGMA table_info(vendas)');
  const nomesColunas = colunasVendas.map((coluna) => coluna.name);

  if (!nomesColunas.includes('cliente')) {
    await db.exec("ALTER TABLE vendas ADD COLUMN cliente TEXT DEFAULT ''");
  }

  if (!nomesColunas.includes('metodo_pagamento')) {
    await db.exec("ALTER TABLE vendas ADD COLUMN metodo_pagamento TEXT DEFAULT ''");
  }

  // Campos de pedido vindos de marketplaces/importação
  const novasColunasVendas = {
    order_id: 'TEXT',
    cliente_email: "TEXT DEFAULT ''",
    cliente_fone: "TEXT DEFAULT ''",
    cliente_cpf: "TEXT DEFAULT ''",
    cliente_endereco: "TEXT DEFAULT ''",
    last_updated: 'TEXT',
    itens_count: 'INTEGER DEFAULT 0',
    data_recebimento: 'TEXT',
    taxa_ml: 'REAL DEFAULT 0',
    ml_pack_id: 'TEXT',
    ml_status: "TEXT DEFAULT ''",
    ml_buyer_id: 'TEXT',
    ml_buyer_nickname: "TEXT DEFAULT ''",
    data_prevista_recebimento: 'TEXT',
    enviada_financeiro: 'INTEGER DEFAULT 0',
    enviada_financeiro_em: 'TEXT',
    financeiro_status: "TEXT DEFAULT 'disponivel'",
    financeiro_agendada_para: 'TEXT'
  };

  for (const [nome, definicao] of Object.entries(novasColunasVendas)) {
    if (!nomesColunas.includes(nome)) {
      await db.exec(`ALTER TABLE vendas ADD COLUMN ${nome} ${definicao}`);
    }
  }

  if (!nomesColunas.includes('financeiro_status')) {
    await db.run(
      `UPDATE vendas
          SET financeiro_status = CASE
            WHEN enviada_financeiro = 1 THEN 'enviada'
            ELSE 'pendente'
          END`
    );
  }

  await db.run(
    `UPDATE vendas
        SET financeiro_status = 'pendente'
      WHERE financeiro_status = 'disponivel'
        AND COALESCE(enviada_financeiro, 0) = 0
        AND financeiro_agendada_para IS NULL
        AND COALESCE(DATE(data_venda, 'localtime'), '') <> DATE('now', 'localtime')`
  );

  // Preferências centrais e credencial do único proprietário da operação.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Itens de um pedido/venda
  await db.exec(`
    CREATE TABLE IF NOT EXISTS venda_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      sku TEXT NOT NULL,
      descricao TEXT,
      quantidade INTEGER NOT NULL DEFAULT 1,
      preco_unitario REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE
    )
  `);

  // Lotes de fotografias importadas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      modo TEXT DEFAULT 'mixed',
      veiculo_origem TEXT,
      detectar_sku INTEGER DEFAULT 1,
      status TEXT DEFAULT 'importando',
      fotos_count INTEGER DEFAULT 0,
      produtos_count INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processado_em TIMESTAMP
    )
  `);

  // Produtos identificados dentro de um lote
  await db.exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL,
      nome TEXT,
      lote_id INTEGER NOT NULL,
      status_revisao TEXT DEFAULT 'pendente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE CASCADE
    )
  `);

  // Imagens vinculadas aos produtos
  await db.exec(`
    CREATE TABLE IF NOT EXISTS produto_imagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER,
      caminho TEXT NOT NULL,
      nome_arquivo TEXT,
      tipo TEXT DEFAULT 'produto',
      ordem INTEGER DEFAULT 0,
      is_principal INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL
    )
  `);

  // Análises de IA ficam preparadas para a próxima etapa do fluxo
  await db.exec(`
    CREATE TABLE IF NOT EXISTS analises_ia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL,
      provedor TEXT,
      modelo TEXT,
      resultado TEXT,
      confianca_geral REAL,
      status TEXT DEFAULT 'pendente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_produtos_lote ON produtos(lote_id);
    CREATE INDEX IF NOT EXISTS idx_produto_imagens_produto ON produto_imagens(produto_id);
    CREATE INDEX IF NOT EXISTS idx_lotes_status ON lotes(status);
    CREATE INDEX IF NOT EXISTS idx_peca_imagens_peca ON peca_imagens(peca_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_order_id ON vendas(order_id) WHERE order_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_venda_itens_venda ON venda_itens(venda_id);
    CREATE INDEX IF NOT EXISTS idx_venda_itens_sku ON venda_itens(sku);
    CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda);
    CREATE INDEX IF NOT EXISTS idx_vendas_plataforma ON vendas(plataforma);
    CREATE INDEX IF NOT EXISTS idx_pecas_ml ON pecas(ml_ativo);
    CREATE INDEX IF NOT EXISTS idx_pecas_categoria ON pecas(categoria);
    CREATE INDEX IF NOT EXISTS idx_perguntas_respondida ON perguntas_ml(respondida);
    CREATE INDEX IF NOT EXISTS idx_reclamacoes_status ON reclamacoes_ml(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pecas_sku
      ON pecas(sku) WHERE sku IS NOT NULL AND TRIM(sku) <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pecas_ml_item_id
      ON pecas(ml_item_id) WHERE ml_item_id IS NOT NULL AND TRIM(ml_item_id) <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_perguntas_ml_question_id
      ON perguntas_ml(ml_question_id)
      WHERE ml_question_id IS NOT NULL AND TRIM(ml_question_id) <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reclamacoes_ml_claim_id
      ON reclamacoes_ml(ml_claim_id)
      WHERE ml_claim_id IS NOT NULL AND TRIM(ml_claim_id) <> '';
    CREATE INDEX IF NOT EXISTS idx_vendas_ml_pack_id ON vendas(ml_pack_id);
  `);

  // Integração autenticada com o Mercado Livre.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ml_integracao (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      user_id TEXT,
      nickname TEXT,
      email TEXT,
      site_id TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      scope TEXT,
      conectado_em TEXT,
      atualizado_em TEXT,
      erro TEXT
    );

    CREATE TABLE IF NOT EXISTS ml_oauth_states (
      state TEXT PRIMARY KEY,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ml_sincronizacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recurso TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'executando',
      itens INTEGER DEFAULT 0,
      criados INTEGER DEFAULT 0,
      atualizados INTEGER DEFAULT 0,
      ignorados INTEGER DEFAULT 0,
      mensagem TEXT,
      iniciado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      finalizado_em TEXT
    );

    CREATE TABLE IF NOT EXISTS ml_reputacao_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      dados TEXT NOT NULL,
      atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ml_envios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id TEXT NOT NULL,
      order_id TEXT,
      pack_id TEXT,
      venda_id INTEGER,
      status TEXT DEFAULT '',
      substatus TEXT DEFAULT '',
      logistic_type TEXT DEFAULT '',
      tracking_method TEXT DEFAULT '',
      tracking_number TEXT,
      pay_before TEXT,
      estimated_delivery TEXT,
      date_created TEXT,
      date_ready_to_ship TEXT,
      date_shipped TEXT,
      date_delivered TEXT,
      date_cancelled TEXT,
      receiver_name TEXT DEFAULT '',
      receiver_address TEXT DEFAULT '',
      receiver_city TEXT DEFAULT '',
      receiver_state TEXT DEFAULT '',
      receiver_zip TEXT DEFAULT '',
      titulo TEXT DEFAULT '',
      sku TEXT DEFAULT '',
      cliente TEXT DEFAULT '',
      valor REAL DEFAULT 0,
      metodo_pagamento TEXT DEFAULT '',
      ml_item_id TEXT,
      itens TEXT DEFAULT '[]',
      sincronizado_em TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS aprovacoes_anuncio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      peca_id INTEGER NOT NULL,
      titulo TEXT,
      descricao TEXT,
      preco REAL,
      quantidade INTEGER,
      ml_ativo INTEGER,
      status TEXT NOT NULL DEFAULT 'pendente',
      observacao TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      decidido_em TEXT,
      FOREIGN KEY (peca_id) REFERENCES pecas(id)
    );

    CREATE INDEX IF NOT EXISTS idx_ml_sincronizacoes_data
      ON ml_sincronizacoes(iniciado_em);

    CREATE INDEX IF NOT EXISTS idx_aprovacoes_anuncio_status
      ON aprovacoes_anuncio(status);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_envios_shipment
      ON ml_envios(shipment_id);
    CREATE INDEX IF NOT EXISTS idx_ml_envios_order
      ON ml_envios(order_id);
    CREATE INDEX IF NOT EXISTS idx_ml_envios_status
      ON ml_envios(status);
    CREATE INDEX IF NOT EXISTS idx_ml_envios_pay_before
      ON ml_envios(pay_before);
    CREATE INDEX IF NOT EXISTS idx_ml_envios_created
      ON ml_envios(date_created);
  `);

  const colunasAprovacoes = await db.all(
    'PRAGMA table_info(aprovacoes_anuncio)'
  );

  if (!colunasAprovacoes.some((coluna) => coluna.name === 'dados_json')) {
    await db.exec(
      "ALTER TABLE aprovacoes_anuncio ADD COLUMN dados_json TEXT DEFAULT '{}'"
    );
  }

  const colunasOauthStates = await db.all(
    'PRAGMA table_info(ml_oauth_states)'
  );

  if (
    !colunasOauthStates.some((coluna) => coluna.name === 'code_verifier')
  ) {
    await db.exec(
      'ALTER TABLE ml_oauth_states ADD COLUMN code_verifier TEXT'
    );
  }

  const colunasEnvios = await db.all('PRAGMA table_info(ml_envios)');
  const colunasEnviosAdicionais = [
    ['nfe_xml_arquivo', 'TEXT'],
    ['nfe_xml_nome', 'TEXT'],
    ['nfe_xml_enviado_em', 'TEXT'],
    ['etiqueta_emitida_em', 'TEXT'],
    ['combinar_comprador', 'INTEGER DEFAULT 0'],
    ['despacho_informado_em', 'TEXT']
  ];

  for (const [coluna, tipo] of colunasEnviosAdicionais) {
    if (!colunasEnvios.some((item) => item.name === coluna)) {
      await db.exec(`ALTER TABLE ml_envios ADD COLUMN ${coluna} ${tipo}`);
    }
  }

  const colunasFicha = await db.all('PRAGMA table_info(pecas)');
  if (!colunasFicha.some((coluna) => coluna.name === 'ml_config')) {
    await db.exec("ALTER TABLE pecas ADD COLUMN ml_config TEXT DEFAULT '{}'");
  }
  dbInstance = db;

  console.log('✅ Banco de dados inicializado');
  return db;
}
