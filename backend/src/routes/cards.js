import express from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { handler, HttpError, requireString, requireUuid, cleanOrNull } from '../utils.js';

const router = express.Router();
const COLUMNS = 'id, issuer, card_name, network, bill_due_date, statement_date, last_4_digits, created_at, updated_at';

function parseCard(body = {}) {
  return {
    issuer: requireString(body.issuer, 'Issuer'),
    card_name: requireString(body.card_name, 'Card name'),
    network: requireString(body.network, 'Network'),
    bill_due_date: requireString(body.bill_due_date, 'Bill due date'),
    statement_date: requireString(body.statement_date, 'Statement date'),
    last_4_digits: cleanOrNull(body.last_4_digits),
  };
}

function translateError(err, card) {
  if (err.code === '23505') {
    return new HttpError(409, `A card with issuer "${card.issuer}" and name "${card.card_name}" already exists.`);
  }
  return err;
}

// GET /api/cards
router.get('/', handler(async (_req, res) => {
  const { rows } = await query(`SELECT ${COLUMNS} FROM cards ORDER BY created_at ASC, id`);
  res.json(rows);
}));

// POST /api/cards  (create; an optional client-supplied "id" is accepted)
router.post('/', requireAdmin, handler(async (req, res) => {
  const c = parseCard(req.body);
  const id = req.body?.id ? requireUuid(req.body.id) : null;
  try {
    const { rows } = await query(
      `INSERT INTO cards (id, issuer, card_name, network, bill_due_date, statement_date, last_4_digits)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
      [id, c.issuer, c.card_name, c.network, c.bill_due_date, c.statement_date, c.last_4_digits]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    throw translateError(err, c);
  }
}));

// PUT /api/cards/:id  (update)
router.put('/:id', requireAdmin, handler(async (req, res) => {
  const id = requireUuid(req.params.id);
  const c = parseCard(req.body);
  try {
    const { rows } = await query(
      `UPDATE cards
          SET issuer=$2, card_name=$3, network=$4, bill_due_date=$5, statement_date=$6,
              last_4_digits=$7, updated_at=now()
        WHERE id=$1
        RETURNING ${COLUMNS}`,
      [id, c.issuer, c.card_name, c.network, c.bill_due_date, c.statement_date, c.last_4_digits]
    );
    if (!rows.length) throw new HttpError(404, 'Card not found.');
    res.json(rows[0]);
  } catch (err) {
    throw translateError(err, c);
  }
}));

// DELETE /api/cards/:id  (also removes the card's bills and transactions via ON DELETE CASCADE)
router.delete('/:id', requireAdmin, handler(async (req, res) => {
  await query('DELETE FROM cards WHERE id=$1', [requireUuid(req.params.id)]);
  res.status(204).end();
}));

export default router;
