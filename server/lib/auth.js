import crypto from 'node:crypto';
import { db } from '../db.js';

export const SESSION_COOKIE = 'xenon_session';
const SESSION_DAYS = 30;

export function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?)').run(
    token,
    userId,
    expires,
    (req.headers['user-agent'] || '').slice(0, 250),
    req.ip || null
  );
  return { token, expires };
}

export function sessionCookieOptions(req, expires) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: new Date(expires)
  };
}

export function userForToken(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.created_at, u.last_login_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, new Date().toISOString());
  return row || null;
}

export function currentUser(req) {
  return userForToken(req.cookies?.[SESSION_COOKIE]);
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized', message: 'Требуется вход в систему' });
  req.user = user;
  next();
}

export function destroySession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

/* --- naive in-memory rate limiter for auth endpoints --- */
const attempts = new Map();
export function rateLimit(key, limit = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count += 1;
  attempts.set(key, entry);
  return {
    allowed: entry.count <= limit,
    retryAfterSec: Math.ceil((entry.reset - now) / 1000)
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) if (now > entry.reset) attempts.delete(key);
}, 10 * 60 * 1000).unref?.();
