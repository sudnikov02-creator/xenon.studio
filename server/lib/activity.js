import { db, logActivity } from '../db.js';

/** Журнал действий студии: лента событий с фильтрами, поиском и автором. */

const LIMIT = 25;

export const ACTIVITY_TYPES = [
  { id: 'booking', label: 'Записи', tone: 'blue' },
  { id: 'status', label: 'Статусы', tone: 'violet' },
  { id: 'client', label: 'Клиенты', tone: 'teal' },
  { id: 'message', label: 'Сообщения', tone: 'amber' },
  { id: 'marketing', label: 'Маркетинг', tone: 'rose' },
  { id: 'discount', label: 'Скидки', tone: 'rose' },
  { id: 'gallery', label: 'Галереи', tone: 'sky' },
  { id: 'review', label: 'Отзывы', tone: 'lime' },
  { id: 'settings', label: 'Настройки', tone: 'slate' }
];

const ACTORS = [
  { id: 'photographer', label: 'Фотограф' },
  { id: 'client', label: 'Клиент' },
  { id: 'system', label: 'Система' }
];

function toIso(value) {
  if (!value) return null;
  if (String(value).includes('T')) return new Date(value).toISOString();
  return new Date(`${String(value).replace(' ', 'T')}Z`).toISOString();
}

export function listActivity({ type = 'all', actor = 'all', q = '', page = 1, limit = LIMIT } = {}) {
  const clauses = [];
  const params = [];

  if (type !== 'all' && ACTIVITY_TYPES.some((item) => item.id === type)) {
    clauses.push('type = ?');
    params.push(type);
  }
  if (actor !== 'all' && ACTORS.some((item) => item.id === actor)) {
    clauses.push('actor = ?');
    params.push(actor);
  }
  const search = String(q || '').trim();
  if (search) {
    clauses.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const clause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(Number(limit) || LIMIT, 5), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const total = db.prepare(`SELECT COUNT(*) AS n FROM activity_log ${clause}`).get(...params).n;
  const rows = db
    .prepare(
      `SELECT id, type, title, description, entity, entity_id, actor, created_at
       FROM activity_log ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, safeLimit, (safePage - 1) * safeLimit);

  const counts = {};
  for (const row of db.prepare('SELECT type, COUNT(*) AS n FROM activity_log GROUP BY type').all()) {
    counts[row.type] = row.n;
  }
  const actorCounts = {};
  for (const row of db.prepare('SELECT actor, COUNT(*) AS n FROM activity_log GROUP BY actor').all()) {
    actorCounts[row.actor] = row.n;
  }

  const today = new Date().toISOString().slice(0, 10);

  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      entity: row.entity,
      entityId: row.entity_id,
      actor: row.actor,
      createdAt: toIso(row.created_at),
      day: toIso(row.created_at)?.slice(0, 10) || today,
      isToday: (toIso(row.created_at)?.slice(0, 10) || today) === today
    })),
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: safePage * safeLimit < total,
    filter: { type, actor, q: search },
    types: ACTIVITY_TYPES.map((item) => ({ ...item, count: counts[item.id] || 0 })),
    actors: ACTORS.map((item) => ({ ...item, count: actorCounts[item.id] || 0 })),
    counts: {
      all: db.prepare('SELECT COUNT(*) AS n FROM activity_log').get().n,
      today: db.prepare("SELECT COUNT(*) AS n FROM activity_log WHERE date(created_at) = date('now')").get().n
    }
  };
}

export function activityEntriesForEntity(entity, entityId) {
  return db
    .prepare(
      `SELECT id, type, title, description, actor, created_at FROM activity_log
       WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT 30`
    )
    .all(entity, entityId)
    .map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      actor: row.actor,
      createdAt: toIso(row.created_at)
    }));
}

/** Ручная заметка в журнале — фотограф может оставить пометку для себя. */
export function addNote({ title, description }) {
  const text = String(title || '').trim();
  if (text.length < 2) return { status: 422, body: { error: 'invalid_title', message: 'Введите текст заметки' } };
  const id = logActivity({
    type: 'settings',
    title: text.slice(0, 120),
    description: String(description || '').trim().slice(0, 400) || null,
    entity: 'note'
  });
  const row = db.prepare('SELECT * FROM activity_log WHERE id = ?').get(id);
  return {
    status: 201,
    body: {
      item: {
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        actor: row.actor,
        createdAt: toIso(row.created_at)
      }
    }
  };
}

export function parseJsonSafe(value, fallback) {
  try {
    return JSON.parse(value ?? '') ?? fallback;
  } catch {
    return fallback;
  }
}
