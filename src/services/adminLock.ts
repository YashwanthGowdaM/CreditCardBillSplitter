/**
 * Admin Lock Service
 *
 * SECURITY NOTES
 * - There is NO built-in default password. If nothing is configured the lock
 *   fails closed (nobody can unlock) instead of falling back to a guessable value.
 * - Prefer VITE_ADMIN_PASSWORD_HASH (SHA-256 hex digest) so the plain-text
 *   password is never written to .env or shipped in the JS bundle.
 *   Generate one with:   echo -n "your-password" | sha256sum
 * - VITE_ADMIN_PASSWORD (plain text) is still accepted for backward
 *   compatibility, but it ends up in the public bundle. Migrate to the hash.
 * - This is a client-side UI gate only. Anyone with DevTools can bypass it, so
 *   real protection of the data must come from Supabase Auth + Row Level
 *   Security (see the SQL schema in Settings).
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
const ATTEMPT_KEY = 'cardsplit_lock_attempts';

interface AttemptState {
  count: number;
  lockedUntil: number;
}

function readAttempts(): AttemptState {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    return {
      count: Number(parsed?.count) || 0,
      lockedUntil: Number(parsed?.lockedUntil) || 0,
    };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function writeAttempts(state: AttemptState) {
  try {
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function getExpectedHash(): Promise<string | null> {
  const env = (import.meta as any).env ?? {};
  const hash = typeof env.VITE_ADMIN_PASSWORD_HASH === 'string' ? env.VITE_ADMIN_PASSWORD_HASH.trim().toLowerCase() : '';
  if (/^[0-9a-f]{64}$/.test(hash)) return hash;

  const plain = typeof env.VITE_ADMIN_PASSWORD === 'string' ? env.VITE_ADMIN_PASSWORD.trim() : '';
  if (plain.length > 0) return sha256Hex(plain);

  return null;
}

export function isAdminLockConfigured(): boolean {
  const env = (import.meta as any).env ?? {};
  return Boolean(
    (typeof env.VITE_ADMIN_PASSWORD_HASH === 'string' && env.VITE_ADMIN_PASSWORD_HASH.trim()) ||
      (typeof env.VITE_ADMIN_PASSWORD === 'string' && env.VITE_ADMIN_PASSWORD.trim())
  );
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'locked' | 'incorrect'; retryAfterSec?: number; attemptsLeft?: number };

export async function verifyAdminPassword(input: string): Promise<VerifyResult> {
  const now = Date.now();
  const state = readAttempts();

  if (state.lockedUntil > now) {
    return { ok: false, reason: 'locked', retryAfterSec: Math.ceil((state.lockedUntil - now) / 1000) };
  }

  const expected = await getExpectedHash();
  if (!expected) return { ok: false, reason: 'not_configured' };

  const actual = await sha256Hex(input.trim());
  if (safeEqual(actual, expected)) {
    writeAttempts({ count: 0, lockedUntil: 0 });
    return { ok: true };
  }

  const count = state.count + 1;
  if (count >= MAX_ATTEMPTS) {
    writeAttempts({ count: 0, lockedUntil: now + LOCKOUT_MS });
    return { ok: false, reason: 'locked', retryAfterSec: Math.ceil(LOCKOUT_MS / 1000) };
  }
  writeAttempts({ count, lockedUntil: 0 });
  return { ok: false, reason: 'incorrect', attemptsLeft: MAX_ATTEMPTS - count };
}
