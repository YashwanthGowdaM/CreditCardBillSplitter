import express from 'express';
import { loginRateLimit, passwordMatches } from '../middleware/auth.js';

const router = express.Router();

// POST /api/admin/verify   { "password": "..." }  ->  200 {valid:true} | 401
router.post('/verify', loginRateLimit, (req, res) => {
  if (passwordMatches(req.body?.password)) return res.json({ valid: true });
  res.status(401).json({ valid: false, error: 'Incorrect admin password.' });
});

export default router;
