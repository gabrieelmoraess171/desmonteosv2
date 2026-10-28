import express from 'express';
import { getDb } from '../database.js';
import { obterRelatorio } from '../services/relatoriosService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const relatorio = await obterRelatorio(getDb(), req.query);
    res.json(relatorio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
