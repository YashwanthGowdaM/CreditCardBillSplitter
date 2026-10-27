import express from 'express';
import { query, withTransaction } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { handler, HttpError, requireString, requireUuid, toValidUuid, isUuid } from '../utils.js';

const router = express.Router();

// A transaction together with the person it is assigned to (if any).
const SELECT_TX = `
  SELECT t.id, t.bill_id, t.card_id, t.card_name, t.date, t.description, t.amount,
         a.person_id AS cost_to_person_id,
         p.name      AS cost_to_person_name,
         t.created_at
    FROM transactions t
    LEFT JOIN transaction_assignments a ON a.transaction_id = t.id
    LEFT JOIN people p                  ON p.id = a.person_id`;

// GET /api/transactions
router.get('/', handler(async (_req, res) => {
  const { rows } = await query(`${SELECT_TX} ORDER BY t.seq ASC`);
  res.json(rows);
}));

/**
 * Insert-or-update one transaction (and its optional assignment) using an open DB client.
 * Shared with the backup-import route.
 */
export async function upsertTransaction(client, t) {
  const id = toValidUuid(t.id) ?? null;
  const amount = Number(t.amount);
  if (!Number.isFinite(amount)) throw new HttpError(400, `Transaction "${t.description ?? ''}" has an invalid amount.`);

  const { rows } = await client.query(
    `INSERT INTO transactions (id, bill_id, card_id, card_name, date, description, amount, created_at)
     VALUES (COALESCE($1::uuid, gen_random_uuid()),
             (SELECT id FROM uploaded_bills WHERE id = $2::uuid),   -- NULL if that bill does not exist
             $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()))
     ON CONFLICT (id) DO UPDATE SET
       bill_id=EXCLUDED.bill_id, card_id=EXCLUDED.card_id, card_name=EXCLUDED.card_name,
       date=EXCLUDED.date, description=EXCLUDED.description, amount=EXCLUDED.amount
     RETURNING id`,
    [
      id,
      t.bill_id && isUuid(toValidUuid(t.bill_id)) ? toValidUuid(t.bill_id) : null,
      requireUuid(toValidUuid(t.card_id), 'card_id'),
      requireString(t.card_name, 'card_name'),
      requireString(t.date, 'date'),
      String(t.description ?? '').trim() || '(no description)',
      amount,
      t.created_at ?? null,
    ]
  );

  if (t.cost_to_person_id) {
    // Only assign if that person still exists
    await client.query(
      `INSERT INTO transaction_assignments (transaction_id, person_id)
       SELECT $1::uuid, $2::uuid WHERE EXISTS (SELECT 1 FROM people WHERE id = $2::uuid)
       ON CONFLICT (transaction_id) DO UPDATE SET person_id = EXCLUDED.person_id, assigned_at = now()`,
      [rows[0].id, toValidUuid(t.cost_to_person_id)]
    );
  }
  return rows[0].id;
}

// POST /api/transactions/batch   { "transactions": [ ... ] }   (all-or-nothing)
router.post('/batch', requireAdmin, handler(async (req, res) => {
  const list = req.body?.transactions;
  if (!Array.isArray(list)) throw new HttpError(400, '"transactions" must be an array.');
  await withTransaction(async (client) => {
    for (const t of list) await upsertTransaction(client, t);
  });
  res.status(201).json({ saved: list.length });
}));

// PUT /api/transactions/:id/assignment   { "person_id": "<uuid>" | null }
router.put('/:id/assignment', requireAdmin, handler(async (req, res) => {
  const txId = requireUuid(req.params.id);
  const personId = req.body?.person_id ?? null;

  if (personId) {
    requireUuid(personId, 'person_id');
    const { rowCount } = await query(
      `INSERT INTO transaction_assignments (transaction_id, person_id)
       SELECT t.id, p.id FROM transactions t, people p WHERE t.id = $1 AND p.id = $2
       ON CONFLICT (transaction_id) DO UPDATE SET person_id = EXCLUDED.person_id, assigned_at = now()`,
      [txId, personId]
    );
    if (!rowCount) throw new HttpError(404, 'Transaction or person not found.');
  } else {
    await query('DELETE FROM transaction_assignments WHERE transaction_id = $1', [txId]);
  }
  res.json({ ok: true });
}));

// DELETE /api/transactions/:id
router.delete('/:id', requireAdmin, handler(async (req, res) => {
  await query('DELETE FROM transactions WHERE id = $1', [requireUuid(req.params.id)]);
  res.status(204).end();
}));

// DELETE /api/transactions   -> "Clear All": removes every transaction AND every uploaded-bill record
router.delete('/', requireAdmin, handler(async (_req, res) => {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM transaction_assignments');
    await client.query('DELETE FROM transactions');
    await client.query('DELETE FROM uploaded_bills');
  });
  res.status(204).end();
}));

export default router;
