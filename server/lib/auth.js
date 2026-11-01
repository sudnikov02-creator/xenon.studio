import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, logActivity } from '../db.js';
import { bootstrapStudio } from './studio-bootstrap.js';

export const SESSION_COOKIE = 'xenon_session';
const SESSION_DAYS = 30;
/* Подпись cookie. На serverless-хостинге файл базы живёт в /tmp и пересоздаётся при холодном
   старте, поэтому сессия не может опираться только на таблицу sessions — иначе любой переход
   по разделам «выкидывает» фотографа из кабинета. Подписанная cookie проверяется на любом
   инстансе; секрет можно переопределить переменной XENON_SECRET. */
const SECRET = process.env.XENON_SECRET || 'xenon.studio/session-v1';

function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

function fingerprint(passwordHash) {
  return crypto.createHmac('sha256', SECRET).update(String(passwordHash || '')).digest('base64url').slice(0, 16);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/* --- подписанный токен: v1.<base64url(payload)>.<hmac> --- */

export function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `v1.${body}.${sign(body)}`;
}

export function readToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  if (!safeEqual(parts[2], sign(parts[1]))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload || typeof payload.uid !== 'number' || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSession(userId, req) {
  const row = db.prepare('SELECT id, email, name, password_hash FROM users WHERE id = ?').get(userId);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  const token = signToken({
    uid: row.id,
    email: row.email,
    name: row.name,
    fp: fingerprint(row.password_hash),
    exp: Date.now() + SESSION_DAYS * 864e5
  });
  db.prepare('INSERT OR REPLACE INTO sessions (token, user_id, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?)').run(
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

/* Пользователь по токену: сначала ищем в базе этого инстанса, а если база была пересоздана
   хостингом — восстанавливаем владельца студии из самой cookie, чтобы не терять вход. */
export function userForToken(token) {
  const payload = readToken(token);
  if (!payload) return null;

  const select = 'SELECT id, email, name, password_hash, created_at, last_login_at FROM users WHERE ';
  const row =
    db.prepare(`${select}id = ?`).get(payload.uid) || db.prepare(`${select}lower(email) = lower(?)`).get(payload.email || '');

  if (!row) return restoreUser(payload);
  if (payload.fp && !String(row.password_hash).startsWith('restored:') && payload.fp !== fingerprint(row.password_hash)) {
    return null;
  }
  return row;
}

/* Восстановление после холодного старта: база пустая, но cookie подписана нами.
   Создаём владельца заново и поднимаем базовую цепочку статусов. */
function restoreUser(payload) {
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (users > 0) return null;
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) return null;
  const name = String(payload.name || 'Фотограф').trim() || 'Фотограф';
  const placeholder = `restored:${crypto.randomBytes(16).toString('hex')}`;
  const info = db
    .prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
    .run(email, placeholder, name);
  try {
    bootstrapStudio({ photographerName: name });
  } catch (err) {
    console.error('[restore] bootstrap failed', err);
  }
  try {
    logActivity({
      type: 'auth',
      title: 'Студия восстановлена после перезапуска сервера',
      description: 'Задайте новый пароль в профиле — это защитит вход',
      entity: 'user',
      entityId: Number(info.lastInsertRowid)
    });
  } catch {
    /* журнал не критичен */
  }
  return db
    .prepare('SELECT id, email, name, password_hash, created_at, last_login_at FROM users WHERE id = ?')
    .get(info.lastInsertRowid);
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

/* Пароль, которого нет: строка после восстановления студии. Приводим её к валидному bcrypt-хэшу. */
export function isRestoredPassword(hash) {
  return String(hash || '').startsWith('restored:');
}

export function hashPassword(password) {
  return bcrypt.hashSync(String(password), 10);
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
