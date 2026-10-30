import pg from 'pg';

const { Pool } = pg;

function substituirParametros(sql, parametros = []) {
  let indice = 0;
  return String(sql).replace(/\?/g, () => `$${++indice}`);
}

function traduzirExpressaoData(sql) {
  return String(sql)
    .replace(/COALESCE\(DATE\(([^,()]+),\s*'localtime'\),\s*''\)/gi, "COALESCE(DATE($1, 'localtime'), DATE('1900-01-01'))")
    .replace(/DATE\('now',\s*'localtime',\s*'-(\d+)\s+days?'\)/gi, "(CURRENT_DATE - INTERVAL '$1 days')::date")
    .replace(/DATE\('now',\s*'localtime'\)/gi, 'CURRENT_DATE')
    .replace(/DATE\(([^,()]+),\s*'localtime'\)/gi, "(timezone('America/Sao_Paulo', $1::timestamptz))::date")
    .replace(/DATE\(([^,()]+)\)/gi, '($1::timestamptz)::date')
    .replace(/datetime\('now',\s*'-1 hour'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '1 hour'")
    .replace(/datetime\(([^,()]+),\s*'localtime'\)/gi, "timezone('America/Sao_Paulo', $1::timestamptz)")
    .replace(/strftime\('%H',\s*([^,()]+),\s*'localtime'\)/gi, "to_char(timezone('America/Sao_Paulo', $1::timestamptz), 'HH24')")
    .replace(/datetime\(([^()]+)\)/gi, '$1');
}

function traduzirSql(sql) {
  let resultado = traduzirExpressaoData(sql)
    .replace(/\bBEGIN\s+IMMEDIATE\b/gi, 'BEGIN')
    .replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'BIGSERIAL PRIMARY KEY')
    .replace(/\bBOOLEAN\b/gi, 'INTEGER')
    .replace(/\bPRAGMA\s+journal_mode\s*=\s*WAL\b/gi, '')
    .replace(/\bCURRENT_TIMESTAMP\b/gi, 'CURRENT_TIMESTAMP');

  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(resultado)) {
    resultado = resultado.replace(/;\s*$/g, '');
    resultado = resultado.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    resultado += ' ON CONFLICT DO NOTHING';
  }

  return resultado;
}

function nomeTabelaPragma(sql) {
  return String(sql).match(/PRAGMA\s+table_info\(([^)]+)\)/i)?.[1]?.replace(/["'`]/g, '') || '';
}

async function colunasTabela(client, tabela) {
  const resultado = await client.query(
    `SELECT column_name AS name, ordinal_position AS cid
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [tabela]
  );
  return resultado.rows;
}

export function criarBancoPostgres(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.PG_POOL_MAX) || 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false }
  });

  return {
    async get(sql, parametros = []) {
      const original = String(sql);
      const tabela = nomeTabelaPragma(original);
      if (/^\s*PRAGMA\s+table_info/i.test(original)) {
        const colunas = await colunasTabela(pool, tabela);
        return colunas[0];
      }
      const resultado = await pool.query(substituirParametros(traduzirSql(original), parametros), parametros);
      return resultado.rows[0];
    },

    async all(sql, parametros = []) {
      const original = String(sql);
      const tabela = nomeTabelaPragma(original);
      if (/^\s*PRAGMA\s+table_info/i.test(original)) {
        return colunasTabela(pool, tabela);
      }
      const resultado = await pool.query(substituirParametros(traduzirSql(original), parametros), parametros);
      return resultado.rows;
    },

    async run(sql, parametros = []) {
      const tabela = String(sql).match(/INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+([\w]+)/i)?.[1];
      const temId = tabela && !['configuracoes', 'ml_oauth_states'].includes(tabela);
      let consulta = substituirParametros(traduzirSql(sql), parametros);
      if (temId && /^\s*INSERT\s/i.test(consulta) && !/\bRETURNING\b/i.test(consulta)) {
        consulta = consulta.replace(/;\s*$/g, '') + ' RETURNING id';
      }
      const resultado = await pool.query(consulta, parametros);
      return {
        changes: resultado.rowCount || 0,
        lastID: resultado.rows[0]?.id
      };
    },

    async exec(sql) {
      const original = String(sql);
      if (/^\s*(PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i.test(original)) return;
      const partes = original
        .split(';')
        .map((parte) => parte.trim())
        .filter(Boolean)
        .filter((parte) => !/^(PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i.test(parte))
        .map((parte) => traduzirSql(parte));
      for (const parte of partes) await pool.query(parte);
    },

    async close() {
      await pool.end();
    }
  };
}
