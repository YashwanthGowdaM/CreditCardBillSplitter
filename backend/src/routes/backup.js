import express from 'express';
import { query, withTransaction } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { handler, HttpError, toValidUuid, requireString } from '../utils.js';
import { upsertTransaction } from './transactions.js';

const router = express.Router();

// GET /api/backup/export  ->  one JSON document with everything (same shape as the original app's backup)
router.get('/export', handler(async (_req, res) => {
  const [cards, people, bills, transactions] = await Promise.all([
    query('SELECT id, issuer, card_name, network, bill_due_date, statement_date, last_4_digits, created_at, updated_at FROM cards ORDER BY created_at'),
    query('SELECT id, name, phone, notes, created_at, updated_at FROM people ORDER BY name'),
    query('SELECT id, card_id, card_name, file_name, file_size, storage_path, total_debits, transaction_count, uploaded_at FROM uploaded_bills ORDER BY uploaded_at DESC'),
    query(`SELECT t.id, t.bill_id, t.card_id, t.card_name, t.date, t.description, t.amount,
                  a.person_id AS cost_to_person_id, p.name AS cost_to_person_name, t.created_at
             FROM transactions t
             LEFT JOIN transaction_assignments a ON a.transaction_id = t.id
             LEFT JOIN people p ON p.id = a.person_id
            ORDER BY t.seq`),
  ]);

  res.json({
    exportedAt: new Date().toISOString(),
    version: '1.0',
    data: { cards: cards.rows, people: people.rows, bills: bills.rows, transactions: transactions.rows },
  });
}));

// POST /api/backup/import   { data: { cards, people, bills, transactions } }
// MERGES the backup into the database by id (existing records are updated, nothing is deleted).
// The whole import is one transaction: if anything is wrong, nothing is saved.
router.post('/import', requireAdmin, handler(async (req, res) => {
  const data = req.body?.data;
  if (!data || typeof data !== 'object') throw new HttpError(400, 'Invalid backup file format.');
  const { cards = [], people = [], bills = [], transactions = [] } = data;
  if (![cards, people, bills, transactions].every(Array.isArray)) {
    throw new HttpError(400, 'Invalid backup file format: cards, people, bills and transactions must be arrays.');
  }

  await withTransaction(async (client) => {
    for (const c of cards) {
      await client.query(
        `INSERT INTO cards (id, issuer, card_name, network, bill_due_date, statement_date, last_4_digits, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()))
         ON CONFLICT (id) DO UPDATE SET issuer=EXCLUDED.issuer, card_name=EXCLUDED.card_name,
           network=EXCLUDED.network, bill_due_date=EXCLUDED.bill_due_date,
           statement_date=EXCLUDED.statement_date, last_4_digits=EXCLUDED.last_4_digits, updated_at=now()`,
        [toValidUuid(c.id), requireString(c.issuer, 'issuer'), requireString(c.card_name, 'card_name'),
         requireString(c.network, 'network'), requireString(c.bill_due_date, 'bill_due_date'),
         requireString(c.statement_date, 'statement_date'), c.last_4_digits || null, c.created_at ?? null]
      );
    }

    for (const p of people) {
      await client.query(
        `INSERT INTO people (id, name, phone, notes, created_at)
         VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, phone=EXCLUDED.phone, notes=EXCLUDED.notes, updated_at=now()`,
        [toValidUuid(p.id), requireString(p.name, 'name'), p.phone || null, p.notes || null, p.created_at ?? null]
      );
    }

    for (const b of bills) {
      await client.query(
        `INSERT INTO uploaded_bills (id, card_id, card_name, file_name, file_size, storage_path, total_debits, transaction_count, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, now()))
         ON CONFLICT (id) DO UPDATE SET card_id=EXCLUDED.card_id, card_name=EXCLUDED.card_name,
           file_name=EXCLUDED.file_name, file_size=EXCLUDED.file_size, storage_path=EXCLUDED.storage_path,
           total_debits=EXCLUDED.total_debits, transaction_count=EXCLUDED.transaction_count`,
        [toValidUuid(b.id), toValidUuid(b.card_id), requireString(b.card_name, 'card_name'),
         requireString(b.file_name, 'file_name'), b.file_size ?? null, b.storage_path || null,
         Number(b.total_debits) || 0, Number(b.transaction_count) || 0, b.uploaded_at ?? null]
      );
    }

    for (const t of transactions) await upsertTransaction(client, t);
  });

  res.json({
    ok: true,
    imported: { cards: cards.length, people: people.length, bills: bills.length, transactions: transactions.length },
  });
}));

export default router;
