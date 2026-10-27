import express from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { handler, HttpError, requireString, requireUuid, cleanOrNull } from '../utils.js';

const router = express.Router();
const COLUMNS = 'id, name, phone, notes, created_at, updated_at';

const parsePerson = (body = {}) => ({
  name: requireString(body.name, 'Name'),
  phone: cleanOrNull(body.phone),
  notes: cleanOrNull(body.notes),
});

const translateError = (err, p) =>
  err.code === '23505' ? new HttpError(409, `Person with name "${p.name}" already exists.`) : err;

// GET /api/people
router.get('/', handler(async (_req, res) => {
  const { rows } = await query(`SELECT ${COLUMNS} FROM people ORDER BY name ASC`);
  res.json(rows);
}));

// POST /api/people
router.post('/', requireAdmin, handler(async (req, res) => {
  const p = parsePerson(req.body);
  const id = req.body?.id ? requireUuid(req.body.id) : null;
  try {
    const { rows } = await query(
      `INSERT INTO people (id, name, phone, notes)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [id, p.name, p.phone, p.notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    throw translateError(err, p);
  }
}));

// PUT /api/people/:id
router.put('/:id', requireAdmin, handler(async (req, res) => {
  const id = requireUuid(req.params.id);
  const p = parsePerson(req.body);
  try {
    const { rows } = await query(
      `UPDATE people SET name=$2, phone=$3, notes=$4, updated_at=now()
        WHERE id=$1 RETURNING ${COLUMNS}`,
      [id, p.name, p.phone, p.notes]
    );
    if (!rows.length) throw new HttpError(404, 'Person not found.');
    res.json(rows[0]);
  } catch (err) {
    throw translateError(err, p);
  }
}));

// DELETE /api/people/:id  (their transactions simply become "unassigned")
router.delete('/:id', requireAdmin, handler(async (req, res) => {
  await query('DELETE FROM people WHERE id=$1', [requireUuid(req.params.id)]);
  res.status(204).end();
}));

export default router;
