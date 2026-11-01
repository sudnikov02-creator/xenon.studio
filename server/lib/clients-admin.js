import { db, logActivity } from '../db.js';
import { localToday, toLocalDate } from './bookings.js';

const MAX_NOTE = 2000;
const MAX_NAME = 80;
const MAX_TAGS = 8;

const BASE_SELECT = `
  SELECT c.id, c.name, c.phone, c.email, c.telegram_username, c.instagram, c.notes, c.tags,
         c.is_vip, c.is_blacklisted, c.created_at, c.updated_at,
         (SELECT COUNT(*) FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS bookings,
         (SELECT COUNT(*) FROM bookings b
            LEFT JOIN statuses st ON st.id = b.status_id
            WHERE b.client_id = c.id AND b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0) AS paid,
         (SELECT COALESCE(SUM(b.price), 0) FROM bookings b
            LEFT JOIN statuses st ON st.id = b.status_id
            WHERE b.client_id = c.id AND b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0) AS spent,
         (SELECT MAX(b.starts_at) FROM bookings b
            LEFT JOIN statuses st ON st.id = b.status_id
            WHERE b.client_id = c.id AND b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0
              AND b.starts_at < datetime('now')) AS last_at,
         (SELECT MIN(b.starts_at) FROM bookings b
            LEFT JOIN statuses st ON st.id = b.status_id
            WHERE b.client_id = c.id AND b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0
              AND b.starts_at >= datetime('now')) AS next_at
  FROM clients c
`;

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function toIso(value) {
  if (!value) return null;
  if (String(value).includes('T')) return new Date(value).toISOString();
  return new Date(`${String(value).replace(' ', 'T')}Z`).toISOString();
}

function mapClient(row, today) {
  const bookings = Number(row.bookings) || 0;
  const spent = Math.round(Number(row.spent) || 0);
  const paid = Number(row.paid) || 0;
  const avgCheck = paid > 0 ? Math.round(spent / paid) : 0;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    telegram: row.telegram_username,
    instagram: row.instagram,
    notes: row.notes,
    tags: parseJson(row.tags, []),
    isVip: Boolean(row.is_vip),
    isBlacklisted: Boolean(row.is_blacklisted),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    bookings,
    spent,
    avgCheck,
    lastVisit: toIso(row.last_at),
    lastVisitDate: row.last_at ? toLocalDate(toIso(row.last_at)) : null,
    nextVisit: toIso(row.next_at),
    nextVisitDate: row.next_at ? toLocalDate(toIso(row.next_at)) : null,
    hasUpcoming: Boolean(row.next_at),
    segment: segmentOf(row, bookings, today)
  };
}

function segmentOf(row, bookings, today) {
  if (Number(row.is_blacklisted) === 1) return 'blacklist';
  if (Number(row.is_vip) === 1) return 'vip';
  if (row.next_at) return 'active';
  if (bookings === 0) return 'lead';
  const created = String(row.created_at || '').slice(0, 10);
  const since = new Date(`${today}T00:00:00.000Z`).getTime() - 30 * 864e5;
  if (created && new Date(`${created}T00:00:00.000Z`).getTime() >= since) return 'new';
  const last = row.last_at ? String(toIso(row.last_at)).slice(0, 10) : null;
  if (last) {
    const diff = (new Date(`${today}T00:00:00.000Z`).getTime() - new Date(`${last}T00:00:00.000Z`).getTime()) / 864e5;
    if (diff > 90) return 'sleeping';
  }
  return 'regular';
}

export function listClients({ q = '', segment = 'all', sort = 'recent', page = 1, limit = 20 } = {}) {
  const today = localToday();
  const clauses = ['c.deleted_at IS NULL'];
  const params = [];

  const term = String(q || '').trim();
  if (term) {
    const like = `%${term.replace(/[%_]/g, '')}%`;
    const digits = term.replace(/\D/g, '');
    clauses.push(
      `(c.name LIKE ? OR c.email LIKE ? OR c.telegram_username LIKE ? OR c.instagram LIKE ?${
        digits.length >= 3 ? " OR REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+', '') LIKE ?" : ''
      })`
    );
    params.push(like, like, like, like);
    if (digits.length >= 3) params.push(`%${digits}%`);
  }

  const rows = db.prepare(`${BASE_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY c.id ASC`).all(...params);
  let items = rows.map((row) => mapClient(row, today));

  const counts = { all: items.length, vip: 0, active: 0, new: 0, sleeping: 0, lead: 0, blacklist: 0 };
  for (const client of items) counts[client.segment] = (counts[client.segment] || 0) + 1;

  const known = ['all', 'vip', 'active', 'new', 'sleeping', 'lead', 'blacklist'];
  if (segment !== 'all' && known.includes(segment)) {
    items = items.filter((client) => client.segment === segment);
  }

  const compare = {
    recent: (a, b) => String(b.lastVisit || b.createdAt || '').localeCompare(String(a.lastVisit || a.createdAt || '')),
    created: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    spent: (a, b) => b.spent - a.spent,
    bookings: (a, b) => b.bookings - a.bookings,
    name: (a, b) => a.name.localeCompare(b.name, 'ru')
  };
  items.sort(compare[sort] || compare.recent);

  const safeLimit = Math.min(60, Math.max(5, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;
  const total = items.length;

  return {
    items: items.slice(offset, offset + safeLimit),
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: offset + safeLimit < total,
    segment,
    sort,
    counts
  };
}

export function clientDetail(id) {
  const today = localToday();
  const row = db.prepare(`${BASE_SELECT} WHERE c.id = ? AND c.deleted_at IS NULL`).get(Number(id));
  if (!row) return null;

  const bookings = db
    .prepare(
      `SELECT b.id, b.public_code, b.starts_at, b.duration_min, b.price, b.source,
              s.name AS service_name, p.name AS package_name,
              st.name AS status_name, st.color AS status_color, st.is_cancelled, st.is_final
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN packages p ON p.id = b.package_id
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.client_id = ? AND b.deleted_at IS NULL
       ORDER BY b.starts_at DESC
       LIMIT 80`
    )
    .all(row.id)
    .map((item) => ({
      id: item.id,
      code: item.public_code,
      startsAt: toIso(item.starts_at),
      localDate: toLocalDate(toIso(item.starts_at)),
      duration: item.duration_min,
      price: Math.round(item.price),
      source: item.source,
      service: item.service_name || item.package_name || 'Съёмка',
      status: item.status_name
        ? {
            name: item.status_name,
            color: item.status_color,
            isCancelled: Boolean(item.is_cancelled),
            isFinal: Boolean(item.is_final)
          }
        : null
    }));

  const cancelled = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings b JOIN statuses st ON st.id = b.status_id
       WHERE b.client_id = ? AND b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 1`
    )
    .get(row.id).n;

  return {
    client: mapClient(row, today),
    bookings,
    stats: {
      total: bookings.length,
      cancelled,
      upcoming: bookings.filter((item) => item.startsAt && new Date(item.startsAt) >= new Date()).length,
      firstVisit: bookings.length ? bookings[bookings.length - 1].localDate : null,
      services: Array.from(new Set(bookings.map((item) => item.service))).slice(0, 6)
    },
    today
  };
}

function clean(value, max) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function normalizeTags(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((tag) => String(tag || '').trim().slice(0, 24))
        .filter(Boolean)
        .slice(0, MAX_TAGS)
    )
  );
}

export function createClient(payload = {}) {
  const name = clean(payload.name, MAX_NAME);
  if (!name) return { status: 422, body: { error: 'invalid_name', message: 'Укажите имя клиента', field: 'name' } };

  const info = db
    .prepare('INSERT INTO clients (name, phone, email, telegram_username, instagram, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(
      name,
      clean(payload.phone, 40),
      clean(payload.email, 120),
      clean(payload.telegram, 60),
      clean(payload.instagram, 60),
      clean(payload.notes, MAX_NOTE),
      JSON.stringify(normalizeTags(payload.tags) || [])
    );

  logActivity({ type: 'client', title: 'Клиент добавлен', description: name, entity: 'client', entityId: Number(info.lastInsertRowid) });
  return { status: 201, body: clientDetail(Number(info.lastInsertRowid)) };
}

export function updateClient(id, payload = {}) {
  const row = db.prepare('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!row) return { status: 404, body: { error: 'not_found', message: 'Клиент не найден' } };

  const name = payload.name === undefined ? row.name : clean(payload.name, MAX_NAME);
  if (!name) return { status: 422, body: { error: 'invalid_name', message: 'Имя не может быть пустым', field: 'name' } };

  const tags = normalizeTags(payload.tags);
  const isVip = payload.isVip === undefined ? row.is_vip : payload.isVip ? 1 : 0;
  const isBlacklisted = payload.isBlacklisted === undefined ? row.is_blacklisted : payload.isBlacklisted ? 1 : 0;

  db.prepare(
    `UPDATE clients SET name = ?, phone = ?, email = ?, telegram_username = ?, instagram = ?,
            notes = ?, tags = ?, is_vip = ?, is_blacklisted = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    name,
    payload.phone === undefined ? row.phone : clean(payload.phone, 40),
    payload.email === undefined ? row.email : clean(payload.email, 120),
    payload.telegram === undefined ? row.telegram_username : clean(payload.telegram, 60),
    payload.instagram === undefined ? row.instagram : clean(payload.instagram, 60),
    payload.notes === undefined ? row.notes : clean(payload.notes, MAX_NOTE),
    tags === undefined ? row.tags : JSON.stringify(tags),
    isVip,
    isBlacklisted,
    new Date().toISOString(),
    row.id
  );

  if (Number(row.is_vip) !== Number(isVip)) {
    logActivity({
      type: 'client',
      title: isVip ? 'Клиент отмечен VIP' : 'VIP-отметка снята',
      description: name,
      entity: 'client',
      entityId: row.id
    });
  }
  if (Number(row.is_blacklisted) !== Number(isBlacklisted)) {
    logActivity({
      type: 'client',
      title: isBlacklisted ? 'Клиент в чёрном списке' : 'Клиент убран из чёрного списка',
      description: name,
      entity: 'client',
      entityId: row.id
    });
  }

  return { status: 200, body: clientDetail(row.id) };
}

export function deleteClient(id) {
  const row = db.prepare('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!row) return { status: 404, body: { error: 'not_found', message: 'Клиент не найден' } };
  const bookings = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE client_id = ? AND deleted_at IS NULL').get(row.id).n;
  if (bookings > 0) {
    return {
      status: 409,
      body: { error: 'has_bookings', message: 'У клиента есть записи — удалить нельзя, можно добавить в чёрный список' }
    };
  }
  db.prepare('UPDATE clients SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  logActivity({ type: 'client', title: 'Клиент удалён', description: row.name, entity: 'client', entityId: row.id });
  return { status: 200, body: { ok: true, id: row.id } };
}
