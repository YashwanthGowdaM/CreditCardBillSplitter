import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { pool, waitForDatabase } from './db.js';
import { HttpError } from './utils.js';

import healthRoutes from './routes/health.js';
import adminRoutes from './routes/admin.js';
import cardRoutes from './routes/cards.js';
import peopleRoutes from './routes/people.js';
import billRoutes from './routes/bills.js';
import transactionRoutes from './routes/transactions.js';
import backupRoutes from './routes/backup.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); // we run behind the Nginx proxy -> real client IP for rate limiting

app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '50mb' })); // backups can be large

// Simple request log:  GET /api/cards 200 12ms
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`));
  next();
});

// ---- API routes -------------------------------------------------------------
app.use('/api/health', healthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/backup', backupRoutes);

app.get('/', (_req, res) =>
  res.json({ service: 'cardsplit-backend', message: 'CardSplit API is running.', health: '/api/health' })
);

app.use((_req, _res, next) => next(new HttpError(404, 'Route not found.')));

// ---- Central error handler --------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });

  // Friendly messages for common PostgreSQL errors
  if (err.code === '22P02') return res.status(400).json({ error: 'Invalid value or id format.' });
  if (err.code === '23503') return res.status(400).json({ error: 'A related record (card, person or bill) does not exist.' });
  if (err.code === '23505') return res.status(409).json({ error: 'A record with the same unique value already exists.' });
  if (err.code === '23502') return res.status(400).json({ error: 'A required field is missing.' });

  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error.' : err.message });
});

// ---- Start ------------------------------------------------------------------
async function main() {
  await waitForDatabase();
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[api] CardSplit backend listening on port ${config.port}`);
    if (config.adminPassword === 'admin123') {
      console.warn('[security] ADMIN_PASSWORD is still the default "admin123" - change it in your .env file!');
    }
  });

  const shutdown = (signal) => {
    console.log(`[api] ${signal} received, shutting down...`);
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[fatal]', err.message);
  process.exit(1);
});
