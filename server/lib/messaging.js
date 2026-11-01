import { db, logActivity } from '../db.js';
import { localToday, toLocalDate } from './bookings.js';

const MAX_BODY = 2000;
const CHANNELS = ['telegram', 'email', 'whatsapp', 'sms'];

function toIso(value) {
  if (!value) return null;
  if (String(value).includes('T')) return new Date(value).toISOString();
  return new Date(`${String(value).replace(' ', 'T')}Z`).toISOString();
}

function channelOf(value, fallback = 'telegram') {
  return CHANNELS.includes(value) ? value : fallback;
}

function clientCard(row) {
  if (!row.client_id) return null;
  return {
    id: row.client_id,
    name: row.client_name,
    phone: row.client_phone,
    email: row.client_email,
    telegram: row.client_telegram,
    instagram: row.client_instagram,
    isVip: Boolean(row.client_vip),
    isBlacklisted: Boolean(row.client_blacklisted)
  };
}

const CONVERSATION_SELECT = `
  SELECT c.id, c.client_id, c.last_channel, c.last_message_at, c.created_at,
         cl.name AS client_name, cl.phone AS client_phone, cl.email AS client_email,
         cl.telegram_username AS client_telegram, cl.instagram AS client_instagram,
         cl.is_vip AS client_vip, cl.is_blacklisted AS client_blacklisted
  FROM conversations c
  JOIN clients cl ON cl.id = c.client_id
  WHERE cl.deleted_at IS NULL
`;

function lastMessageFor(conversationId) {
  return db
    .prepare(
      `SELECT id, direction, kind, channel, body, subject, is_read, created_at
       FROM messages WHERE conversation_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1`
    )
    .get(conversationId);
}

function unreadFor(conversationId) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND direction = 'in' AND is_read = 0")
    .get(conversationId).n;
}

function mapConversation(row) {
  const last = lastMessageFor(row.id);
  return {
    id: row.id,
    clientId: row.client_id,
    client: clientCard(row),
    channel: channelOf(row.last_channel),
    unread: unreadFor(row.id),
    total: db.prepare('SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?').get(row.id).n,
    hasBooking: Boolean(
      db
        .prepare('SELECT 1 FROM bookings WHERE client_id = ? AND deleted_at IS NULL LIMIT 1')
        .get(row.client_id)
    ),
    lastMessage: last
      ? {
          id: last.id,
          direction: last.direction,
          kind: last.kind,
          channel: channelOf(last.channel),
          body: last.body,
          subject: last.subject,
          createdAt: toIso(last.created_at)
        }
      : null,
    lastMessageAt: toIso(row.last_message_at || last?.created_at)
  };
}

export function listConversations({ q = '', filter = 'all', page = 1, limit = 30 } = {}) {
  const term = String(q || '').trim().toLowerCase();
  const rows = db.prepare(`${CONVERSATION_SELECT} ORDER BY datetime(COALESCE(c.last_message_at, c.created_at)) DESC`).all();
  let items = rows.map(mapConversation);

  const counts = {
    all: items.length,
    unread: items.filter((item) => item.unread > 0).length,
    unanswered: items.filter((item) => item.lastMessage?.direction === 'in').length
  };

  if (term) {
    items = items.filter((item) => {
      const haystack = [
        item.client?.name,
        item.client?.phone,
        item.client?.email,
        item.client?.telegram,
        item.client?.instagram,
        item.lastMessage?.body
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  if (filter === 'unread') items = items.filter((item) => item.unread > 0);
  if (filter === 'unanswered') items = items.filter((item) => item.lastMessage?.direction === 'in');

  const perPage = Math.min(Math.max(Number(limit) || 30, 5), 60);
  const current = Math.max(Number(page) || 1, 1);
  const total = items.length;
  const slice = items.slice((current - 1) * perPage, current * perPage);

  return {
    items: slice,
    page: current,
    limit: perPage,
    total,
    hasMore: current * perPage < total,
    counts,
    filter,
    today: localToday()
  };
}

export function conversationDetail(id) {
  const row = db.prepare(`${CONVERSATION_SELECT} AND c.id = ?`).get(id);
  if (!row) return null;
  const messages = db
    .prepare(
      `SELECT id, direction, kind, channel, body, subject, is_read, created_at
       FROM messages WHERE conversation_id = ? ORDER BY datetime(created_at) ASC, id ASC`
    )
    .all(id)
    .map((item) => ({
      id: item.id,
      direction: item.direction,
      kind: item.kind,
      channel: channelOf(item.channel),
      body: item.body,
      subject: item.subject,
      isRead: Boolean(item.is_read),
      createdAt: toIso(item.created_at)
    }));

  const bookings = db
    .prepare(
      `SELECT b.id, b.public_code AS code, b.starts_at, b.price, b.duration_min AS duration,
              s.name AS status_name, s.color AS status_color, s.is_cancelled AS status_cancelled,
              COALESCE(sv.name, pk.name) AS service_name
       FROM bookings b
       LEFT JOIN statuses s ON s.id = b.status_id
       LEFT JOIN services sv ON sv.id = b.service_id
       LEFT JOIN packages pk ON pk.id = b.package_id
       WHERE b.client_id = ? AND b.deleted_at IS NULL
       ORDER BY datetime(b.starts_at) DESC LIMIT 6`
    )
    .all(row.client_id)
    .map((item) => ({
      id: item.id,
      code: item.code,
      startsAt: toIso(item.starts_at),
      localDate: toLocalDate(toIso(item.starts_at)),
      duration: item.duration,
      price: item.price,
      service: item.service_name,
      status: item.status_name
        ? { name: item.status_name, color: item.status_color, isCancelled: Boolean(item.status_cancelled) }
        : null
    }));

  return {
    conversation: mapConversation(row),
    messages,
    bookings,
    today: localToday()
  };
}

export function markRead(id) {
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
  if (!conversation) return { status: 404, body: { error: 'not_found', message: 'Диалог не найден' } };
  const info = db
    .prepare("UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND direction = 'in' AND is_read = 0")
    .run(id);
  return { status: 200, body: { ok: true, marked: info.changes } };
}

export function sendMessage(id, payload = {}) {
  const row = db.prepare(`${CONVERSATION_SELECT} AND c.id = ?`).get(id);
  if (!row) return { status: 404, body: { error: 'not_found', message: 'Диалог не найден' } };

  const body = String(payload.body || '').trim();
  const subject = payload.subject ? String(payload.subject).trim().slice(0, 120) : null;
  if (!body) return { status: 422, body: { error: 'empty_message', message: 'Введите текст сообщения', field: 'body' } };
  if (body.length > MAX_BODY) {
    return { status: 422, body: { error: 'too_long', message: 'Сообщение длиннее 2000 символов', field: 'body' } };
  }
  if (row.client_blacklisted) {
    return {
      status: 409,
      body: { error: 'blacklisted', message: 'Клиент в чёрном списке — отправка заблокирована' }
    };
  }

  const channel = channelOf(payload.channel, channelOf(row.last_channel));
  const kind = channel === 'email' ? 'email' : channel === 'telegram' ? 'text' : 'text';
  const info = db
    .prepare(
      `INSERT INTO messages (conversation_id, direction, kind, channel, body, subject, is_read, created_at)
       VALUES (?, 'out', ?, ?, ?, ?, 1, datetime('now'))`
    )
    .run(id, kind, channel, body, subject);
  db.prepare("UPDATE conversations SET last_message_at = datetime('now'), last_channel = ? WHERE id = ?").run(
    channel,
    id
  );

  const created = db
    .prepare('SELECT id, direction, kind, channel, body, subject, is_read, created_at FROM messages WHERE id = ?')
    .get(info.lastInsertRowid);

  const message = {
    id: created.id,
    direction: created.direction,
    kind: created.kind,
    channel: channelOf(created.channel),
    body: created.body,
    subject: created.subject,
    isRead: true,
    createdAt: toIso(created.created_at)
  };

  logActivity({
    type: 'message',
    title: 'Сообщение клиенту',
    description: `${row.client_name} · ${channel === 'email' ? 'почта' : 'Telegram'}`,
    entity: 'conversation',
    entityId: id
  });

  return { status: 201, body: { message, conversation: mapConversation(row) } };
}

/* Диалог с клиентом: кнопка «Написать» из карточки клиента открывает существующий или создаёт новый. */
export function ensureConversation(clientId) {
  const client = db
    .prepare('SELECT id, name, phone, email, telegram_username FROM clients WHERE id = ? AND deleted_at IS NULL')
    .get(clientId);
  if (!client) return { status: 404, body: { error: 'not_found', message: 'Клиент не найден' } };
  const existing = db.prepare('SELECT id FROM conversations WHERE client_id = ?').get(clientId);
  if (existing) return { status: 200, body: { id: existing.id, created: false } };

  const info = db
    .prepare('INSERT INTO conversations (client_id, last_channel) VALUES (?, ?)')
    .run(clientId, client.telegram_username ? 'telegram' : client.email ? 'email' : 'telegram');
  return { status: 201, body: { id: Number(info.lastInsertRowid), created: true } };
}
