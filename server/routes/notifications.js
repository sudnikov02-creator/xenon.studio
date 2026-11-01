import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { badges, broadcast, broadcastBadges } from '../lib/sse.js';

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 60);
  const items = db
    .prepare(
      `SELECT id, kind, title, subtitle, action_label AS actionLabel, action_url AS actionUrl,
              is_read AS isRead, created_at AS createdAt
       FROM notifications ORDER BY datetime(created_at) DESC, id DESC LIMIT ?`
    )
    .all(limit);
  res.json({ items, badges: badges() });
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
