import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';
import { getDb, initDatabase } from '../src/database.js';

const { Pool } = pg;
const sqlitePath = process.env.SQLITE_PATH || './database.sqlite';
const databaseUrl = String(process.env.DATABASE_URL || '').trim();

if (!databaseUrl) {
  throw new Error('Defina DATABASE_URL antes de executar a migração.');
}

function identificarTabela(nome) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nome)) {
    throw new Error(`Nome de tabela inválido: ${nome}`);
  }
  return `"${nome}"`;
}

function identificarColuna(nome) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nome)) {
    throw new Error(`Nome de coluna inválido: ${nome}`);
  }
  return `"${nome}"`;
}

async function migrarTabela(sqlite, pool, tabela) {
  const colunas = await sqlite.all(`PRAGMA table_info(${identificarTabela(tabela)})`);
  const nomes = colunas.map((coluna) => coluna.name);
  if (!nomes.length) return { tabela, linhas: 0 };

  const linhas = await sqlite.all(`SELECT * FROM ${identificarTabela(tabela)}`);
  if (!linhas.length) return { tabela, linhas: 0 };

  const colunasSql = nomes.map(identificarColuna).join(', ');
  for (let inicio = 0; inicio < linhas.length; inicio += 50) {
    const lote = linhas.slice(inicio, inicio + 50);
    const parametros = [];
    const valores = lote.map((linha, indiceLinha) => {
      const linhaSql = nomes.map((nome, indiceColuna) => {
        parametros.push(linha[nome]);
        return `$${indiceLinha * nomes.length + indiceColuna + 1}`;
      });
      return `(${linhaSql.join(', ')})`;
    });
    const consulta = `INSERT INTO ${identificarTabela(tabela)} (${colunasSql}) VALUES ${valores.join(', ')} ON CONFLICT DO NOTHING`;
    await pool.query(consulta, parametros);
  }

  if (nomes.includes('id')) {
    await pool.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${identificarTabela(tabela)}`,
      [tabela]
    );
  }

  return { tabela, linhas: linhas.length };
}

const sqlite = await open({ filename: sqlitePath, driver: sqlite3.Database });
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 3
});

try {
  await initDatabase();
  await getDb().close();
  const tabelas = await sqlite.all(
    `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name`
  );

  const prioridade = new Map([
    ['pecas', 1],
    ['lotes', 2],
    ['produtos', 3],
    ['vendas', 4],
    ['venda_itens', 5],
    ['ml_envios', 6],
    ['aprovacoes_anuncio', 7]
  ]);
  tabelas.sort((a, b) => (prioridade.get(a.name) || 50) - (prioridade.get(b.name) || 50));

  const resultados = [];
  for (const item of tabelas) {
    console.log(`Migrando ${item.name}...`);
    resultados.push(await migrarTabela(sqlite, pool, item.name));
  }

  console.log(JSON.stringify({ ok: true, resultados }, null, 2));
} finally {
  await sqlite.close();
  await pool.end();
}
