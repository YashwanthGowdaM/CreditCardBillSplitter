import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// GET /api/health  ->  used by Docker health checks and by the UI status badge
router.get('/', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', service: 'cardsplit-backend', database: 'connected', uptimeSeconds: Math.round(process.uptime()) });
  } catch (err) {
    res.status(503).json({ status: 'error', service: 'cardsplit-backend', database: 'unreachable', error: err.message });
  }
});

export default router;
