import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { badges, broadcast, broadcastBadges } from '../lib/sse.js';

const router = express.Router();

const KINDS = ['booking', 'message', 'review', 'system'];

router.get('/', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 60);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const filter = req.query.filter === 'unread' ? 'unread' : 'all';
  const kind = KINDS.includes(String(req.query.kind)) ? String(req.query.kind) : null;

  const where = [];
  const params = [];
  if (kind) {
    where.push('kind = ?');
    params.push(kind);
  }
  if (filter === 'unread') where.push('is_read = 0');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM notifications ${clause}`).get(...params).n;
  const items = db
    .prepare(
      `SELECT id, kind, title, subtitle, action_label AS actionLabel, action_url AS actionUrl,
              is_read AS isRead, created_at AS createdAt
       FROM notifications ${clause} ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, (page - 1) * limit);

  const unreadRow = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE is_read = 0').get();
  const byKind = {};
  for (const row of db.prepare('SELECT kind, COUNT(*) AS n FROM notifications GROUP BY kind').all()) {
    byKind[row.kind] = row.n;
  }

  res.json({
    items,
    page,
    limit,
    total,
    hasMore: page * limit < total,
    filter,
    kind: kind || 'all',
    counts: { all: db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n, unread: unreadRow.n, byKind },
    badges: badges()
  });
});

router.post('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(Number(req.params.id));
  broadcastBadges();
  res.json({ ok: true, badges: badges() });
});

router.post('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  broadcastBadges();
  res.json({ ok: true, badges: badges() });
});

export function pushNotification({ kind = 'info', title, subtitle = null, actionLabel = null, actionUrl = null }) {
  const info = db
    .prepare(
      `INSERT INTO notifications (kind, title, subtitle, action_label, action_url) VALUES (?, ?, ?, ?, ?)`
    )
    .run(kind, title, subtitle, actionLabel, actionUrl);
  const item = db
    .prepare(
      `SELECT id, kind, title, subtitle, action_label AS actionLabel, action_url AS actionUrl,
              is_read AS isRead, created_at AS createdAt FROM notifications WHERE id = ?`
    )
    .get(info.lastInsertRowid);
  broadcast('notification', item);
  broadcastBadges();
  return item;
}

export default router;
