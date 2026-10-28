import { initDatabase } from '../src/database.js';
import { seedDemo } from '../src/demoSeed.js';

const db = await initDatabase();

try {
  const resultado = await seedDemo(db);
  console.log(
    `✅ Demonstração criada: ${resultado.pecas} peças, ${resultado.vendas} vendas, ` +
      `${resultado.perguntas} perguntas e ${resultado.reclamacoes} reclamações.`
  );
} catch (error) {
  console.error('❌ Não foi possível criar a demonstração:', error);
  process.exitCode = 1;
} finally {
  await db.close();
}
