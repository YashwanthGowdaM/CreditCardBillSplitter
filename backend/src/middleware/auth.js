import crypto from 'node:crypto';
import { config } from '../config.js';

// Hash both sides first so timingSafeEqual always compares equal-length buffers.
const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

export const passwordMatches = (input) =>
  crypto.timingSafeEqual(digest(String(input ?? '').trim()), digest(config.adminPassword));

/**
 * Guards every write endpoint (POST / PUT / DELETE).
 * The browser sends the password in the `x-admin-password` header after the
 * user has unlocked the UI. Reading data is always allowed.
 */
export function requireAdmin(req, res, next) {
  if (passwordMatches(req.get('x-admin-password'))) return next();
  res.status(401).json({ error: 'Admin authorization required. Unlock the app with the admin password.' });
}

/** Tiny in-memory brute-force protection for the password check endpoint. */
const attempts = new Map(); // ip -> { count, resetAt }
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;

export function loginRateLimit(req, res, next) {
  const now = Date.now();
  const entry = attempts.get(req.ip);
  if (entry && entry.resetAt > now && entry.count >= MAX_FAILS) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in a few minutes.' });
  }
  res.on('finish', () => {
    if (res.statusCode === 401) {
      const cur = attempts.get(req.ip);
      if (!cur || cur.resetAt <= now) attempts.set(req.ip, { count: 1, resetAt: now + WINDOW_MS });
      else cur.count += 1;
    } else if (res.statusCode === 200) {
      attempts.delete(req.ip);
    }
  });
  next();
}
