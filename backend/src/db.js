import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;

// PostgreSQL NUMERIC / BIGINT come back as strings by default.
// The frontend expects real numbers, so convert them once, here.
types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC
types.setTypeParser(20, (v) => parseInt(v, 10)); // BIGINT

export const pool = new Pool({
  ...config.db,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => console.error('[db] unexpected idle-client error:', err.message));

export const query = (text, params) => pool.query(text, params);

/** Run several statements atomically: all succeed, or none are saved. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** The database container may still be starting - keep retrying for a while. */
export async function waitForDatabase(retries = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log(`[db] connected to ${config.db.host}:${config.db.port}/${config.db.database}`);
      return;
    } catch (err) {
      console.log(`[db] not ready yet (${attempt}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Could not connect to the database. Is the database service running?');
}
