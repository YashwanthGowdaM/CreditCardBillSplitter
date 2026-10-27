const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wrap async route handlers so thrown errors reach the central error handler. */
export const handler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Trimmed string or null (empty strings become null). */
export const cleanOrNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

export const requireString = (value, label) => {
  const s = cleanOrNull(value);
  if (!s) throw new HttpError(400, `${label} is required.`);
  return s;
};

export const requireUuid = (value, label = 'id') => {
  if (!isUuid(value)) throw new HttpError(400, `${label} must be a valid UUID.`);
  return value;
};

/**
 * Old backup files (created before the Docker version) may contain ids such as
 * "card-1". This converts any id into a valid, deterministic UUID.
 * (Same mapping the original app used, so old backups import cleanly.)
 */
export function toValidUuid(id) {
  if (!id) return null;
  if (isUuid(id)) return id;
  const known = {
    'card-1': '11111111-1111-4111-8111-111111111111',
    'card-2': '22222222-2222-4222-8222-222222222222',
    'card-3': '33333333-3333-4333-8333-333333333333',
    'person-1': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'person-2': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'person-3': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  };
  if (known[id]) return known[id];
  let hash = 0;
  for (let i = 0; i < String(id).length; i++) {
    hash = (hash << 5) - hash + String(id).charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-4000-8000-8000-${hex.padEnd(12, '0').slice(0, 12)}`;
}
