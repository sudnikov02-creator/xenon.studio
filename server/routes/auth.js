import express from 'express';
import bcrypt from 'bcryptjs';
import { db, logActivity } from '../db.js';
import {
  SESSION_COOKIE,
  createSession,
  sessionCookieOptions,
  currentUser,
  requireAuth,
  destroySession,
  rateLimit
} from '../lib/auth.js';
import { DEMO_EMAIL, DEMO_PASSWORD, demoSeedEnabled } from '../lib/seed.js';
import { bootstrapStudio, hasPhotographer } from '../lib/studio-bootstrap.js';

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function toIso(value) {
  if (!value) return null;
  if (String(value).includes('T')) return value;
  return `${String(value).replace(' ', 'T')}Z`;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    lastLoginAt: toIso(user.last_login_at),
    createdAt: toIso(user.created_at)
  };
}

router.get('/status', (req, res) => {
  const user = currentUser(req);
  const hasAccount = hasPhotographer();
  const demo = demoSeedEnabled() && process.env.XENON_DEMO !== '0';
  res.json({
    hasAccount,
    needsSetup: !hasAccount,
    authenticated: Boolean(user),
    user: user ? publicUser(user) : null,
    demoHint: demo ? { email: DEMO_EMAIL, password: DEMO_PASSWORD } : null
  });
});

router.post('/register', (req, res) => {
  const hasAccount = hasPhotographer();
  if (hasAccount) {
    return res.status(409).json({ error: 'account_exists', message: 'Аккаунт уже создан. Войдите в систему.' });
  }
  const { name, email, password } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(422).json({ error: 'invalid_name', message: 'Укажите имя (минимум 2 символа)' });
  }
  if (!email || !EMAIL_RE.test(String(email))) {
    return res.status(422).json({ error: 'invalid_email', message: 'Укажите корректный email' });
  }
  if (!password || String(password).length < 8) {
    return res.status(422).json({ error: 'weak_password', message: 'Пароль должен быть не короче 8 символов' });
  }

  const hash = bcrypt.hashSync(String(password), 10);
  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const info = db
    .prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
    .run(cleanEmail, hash, cleanName);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  // Новая студия получает настройки и базовую цепочку статусов — всё создаётся само.
  try {
    bootstrapStudio({ photographerName: cleanName });
  } catch (err) {
    console.error('[bootstrap] failed', err);
  }
  const { token, expires } = createSession(user.id, req);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req, expires));
  logActivity({ type: 'auth', title: 'Аккаунт фотографа создан', description: user.email, entity: 'user', entityId: user.id });
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const limit = rateLimit(`login:${req.ip}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return res
      .status(429)
      .json({ error: 'too_many_attempts', message: `Слишком много попыток. Повторите через ${Math.ceil(limit.retryAfterSec / 60)} мин.` });
  }
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(422).json({ error: 'invalid_credentials', message: 'Введите email и пароль' });
  }
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'Неверный email или пароль' });
  }
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  const { token, expires } = createSession(user.id, req);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req, expires));
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ user: publicUser(fresh) });
});

router.post('/logout', (req, res) => {
  destroySession(req);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/profile', requireAuth, (req, res) => {
  const { name, email } = req.body || {};
  const nextName = name !== undefined ? String(name).trim() : req.user.name;
  const nextEmail = email !== undefined ? String(email).trim().toLowerCase() : req.user.email;
  if (nextName.length < 2) return res.status(422).json({ error: 'invalid_name', message: 'Имя слишком короткое' });
  if (!EMAIL_RE.test(nextEmail)) return res.status(422).json({ error: 'invalid_email', message: 'Некорректный email' });
  const taken = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?) AND id <> ?').get(nextEmail, req.user.id);
  if (taken) return res.status(409).json({ error: 'email_taken', message: 'Этот email уже используется' });
  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(nextName, nextEmail, req.user.id);
  logActivity({ type: 'profile', title: 'Профиль обновлён', description: nextEmail, entity: 'user', entityId: req.user.id });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

router.post('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!currentPassword || !bcrypt.compareSync(String(currentPassword), user.password_hash)) {
    return res.status(401).json({ error: 'invalid_password', message: 'Текущий пароль указан неверно' });
  }
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(422).json({ error: 'weak_password', message: 'Новый пароль должен быть не короче 8 символов' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(newPassword), 10), user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  destroySession(req);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  logActivity({ type: 'auth', title: 'Пароль изменён', entity: 'user', entityId: user.id });
  res.json({ ok: true });
});

export default router;
