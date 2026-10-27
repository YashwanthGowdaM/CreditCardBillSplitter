import express from 'express';
import { query, withTransaction } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { handler, requireString, requireUuid, cleanOrNull } from '../utils.js';

const router = express.Router();
const COLUMNS = 'id, card_id, card_name, file_name, file_size, storage_path, total_debits, transaction_count, uploaded_at';

// GET /api/bills
router.get('/', handler(async (_req, res) => {
  const { rows } = await query(`SELECT ${COLUMNS} FROM uploaded_bills ORDER BY uploaded_at DESC`);
  res.json(rows);
}));

// POST /api/bills  (create or update - "upsert" - by id)
router.post('/', requireAdmin, handler(async (req, res) => {
  const b = req.body || {};
  const id = b.id ? requireUuid(b.id) : null;
  const { rows } = await query(
    `INSERT INTO uploaded_bills
       (id, card_id, card_name, file_name, file_size, storage_path, total_debits, transaction_count, uploaded_at)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, now()))
     ON CONFLICT (id) DO UPDATE SET
       card_id=EXCLUDED.card_id, card_name=EXCLUDED.card_name, file_name=EXCLUDED.file_name,
       file_size=EXCLUDED.file_size, storage_path=EXCLUDED.storage_path,
       total_debits=EXCLUDED.total_debits, transaction_count=EXCLUDED.transaction_count
     RETURNING ${COLUMNS}`,
    [
      id,
      requireUuid(b.card_id, 'card_id'),
      requireString(b.card_name, 'card_name'),
      requireString(b.file_name, 'file_name'),
      b.file_size ?? null,
      cleanOrNull(b.storage_path),
      Number(b.total_debits) || 0,
      Number(b.transaction_count) || 0,
      b.uploaded_at ?? null,
    ]
  );
  res.status(201).json(rows[0]);
}));

// DELETE /api/bills/:id  (also deletes the transactions that came from this bill)
router.delete('/:id', requireAdmin, handler(async (req, res) => {
  const id = requireUuid(req.params.id);
  await withTransaction(async (client) => {
    await client.query('DELETE FROM transactions WHERE bill_id=$1', [id]);
    await client.query('DELETE FROM uploaded_bills WHERE id=$1', [id]);
  });
  res.status(204).end();
}));

export default router;
