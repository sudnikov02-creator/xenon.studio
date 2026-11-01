import { db, logActivity } from '../db.js';
import { TZ_OFFSET_HOURS, getBookingById, localToday, mapBooking } from './bookings.js';
import { collectItem, isoForLocal, localKeyOf, slotsForDate, isValidDateKey } from './slots.js';

const TZ_MS = TZ_OFFSET_HOURS * 3600 * 1000;
const MAX_COMMENT = 600;
const MAX_NOTE = 1200;

const DETAIL_SELECT = `
  SELECT b.id, b.public_code, b.starts_at, b.duration_min, b.price, b.addons, b.notes, b.client_note,
         b.gallery_url, b.source, b.created_at, b.updated_at,
         c.id AS client_id, c.name AS client_name, c.phone, c.email, c.telegram_username,
         c.instagram, c.is_vip, c.notes AS client_notes,
         s.id AS service_id, s.name AS service_name, s.description AS service_description,
         p.id AS package_id, p.name AS package_name,
         st.id AS status_id, st.name AS status_name, st.color AS status_color,
         st.is_initial, st.is_final, st.is_cancelled, st.sort_order AS status_order
  FROM bookings b
  LEFT JOIN clients c ON c.id = b.client_id
  LEFT JOIN services s ON s.id = b.service_id
  LEFT JOIN packages p ON p.id = b.package_id
  LEFT JOIN statuses st ON st.id = b.status_id
`;

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function statusList() {
  const rows = db
    .prepare(
      `SELECT st.id, st.name, st.color, st.sort_order, st.is_initial, st.is_final, st.is_cancelled,
              (SELECT COUNT(*) FROM bookings b
                 WHERE b.status_id = st.id AND b.deleted_at IS NULL) AS count
       FROM statuses st
       WHERE st.deleted_at IS NULL
       ORDER BY st.sort_order ASC, st.id ASC`
    )
    .all();
  const total = db
    .prepare('SELECT COUNT(*) AS n FROM bookings b WHERE b.deleted_at IS NULL')
    .get().n;
  const today = localToday();
  const dayStart = new Date(`${today}T00:00:00.000Z`).getTime() - TZ_MS;
  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings b
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0
         AND b.starts_at >= ? AND b.starts_at < ?`
    )
    .get(new Date(dayStart).toISOString(), new Date(dayStart + 864e5).toISOString()).n;
  return {
    statuses: rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      order: row.sort_order,
      isInitial: Boolean(row.is_initial),
      isFinal: Boolean(row.is_final),
      isCancelled: Boolean(row.is_cancelled),
      count: row.count
    })),
    total,
    today,
    todayCount
  };
}

function periodRange(period, from, to) {
  const today = localToday();
  const dayStart = (key) => new Date(`${key}T00:00:00.000Z`).getTime() - TZ_MS;

  if (period === 'today') {
    return { start: new Date(dayStart(today)).toISOString(), end: new Date(dayStart(today) + 864e5).toISOString() };
  }
  if (period === 'upcoming') {
    return { start: new Date().toISOString(), end: null };
  }
  if (period === 'past') {
    return { start: null, end: new Date().toISOString() };
  }
  if (period === 'week') {
    const [year, month, day] = today.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = (date.getUTCDay() + 6) % 7;
    const start = new Date(dayStart(today) - weekday * 864e5);
    return { start: start.toISOString(), end: new Date(start.getTime() + 7 * 864e5).toISOString() };
  }
  if (period === 'month' || period === 'custom') {
    const start = isValidDateKey(from) ? from : `${today.slice(0, 7)}-01`;
    const startMs = dayStart(start);
    if (isValidDateKey(to)) {
      return { start: new Date(startMs).toISOString(), end: new Date(dayStart(to) + 864e5).toISOString() };
    }
    const [year, month] = start.split('-').map(Number);
    const end = new Date(Date.UTC(year, month, 1)).getTime() - TZ_MS;
    return { start: new Date(startMs).toISOString(), end: new Date(end).toISOString() };
  }
  return { start: from && isValidDateKey(from) ? new Date(dayStart(from)).toISOString() : null, end: to && isValidDateKey(to) ? new Date(dayStart(to) + 864e5).toISOString() : null };
}

/**
 * Постраничный список записей с фильтрами по статусу, периоду и поиском.
 * includeCancelled=false скрывает отклонённые — так же, как на дашборде.
 */
export function listBookingsPaged({
  status = 'all',
  period = 'all',
  from = null,
  to = null,
  q = '',
  page = 1,
  limit = 12,
  sort = 'date',
  includeCancelled = false
} = {}) {
  const clauses = ['b.deleted_at IS NULL'];
  const params = [];

  if (status !== 'all') {
    if (String(status).startsWith('status:')) {
      clauses.push('b.status_id = ?');
      params.push(Number(status.slice(7)));
    } else if (status === 'pending') {
      clauses.push('st.is_initial = 1');
    } else if (status === 'active') {
      clauses.push('COALESCE(st.is_cancelled, 0) = 0 AND st.is_final = 0');
    } else if (status === 'done') {
      clauses.push('st.is_final = 1');
    } else if (status === 'cancelled') {
      clauses.push('COALESCE(st.is_cancelled, 0) = 1');
    }
  } else if (!includeCancelled) {
    clauses.push('COALESCE(st.is_cancelled, 0) = 0');
  }

  const range = periodRange(period, from, to);
  if (range.start) {
    clauses.push('b.starts_at >= ?');
    params.push(range.start);
  }
  if (range.end) {
    clauses.push('b.starts_at < ?');
    params.push(range.end);
  }

  const term = String(q || '').trim();
  if (term) {
    const like = `%${term.replace(/[%_]/g, '')}%`;
    const digits = term.replace(/\D/g, '');
    clauses.push(
      `(c.name LIKE ? OR s.name LIKE ? OR p.name LIKE ? OR b.public_code LIKE ?${
        digits.length >= 3 ? " OR REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+', '') LIKE ?" : ''
      })`
    );
    params.push(like, like, like, like);
    if (digits.length >= 3) params.push(`%${digits}%`);
  }

  const where = clauses.join(' AND ');
  // По дате съёмки: сначала предстоящие (ближайшие сверху), затем прошедшие (свежие сверху).
  const order =
    sort === 'created'
      ? 'b.created_at DESC'
      : sort === 'price'
        ? 'b.price DESC, b.starts_at ASC'
        : 'CASE WHEN b.starts_at >= ? THEN 0 ELSE 1 END ASC, CASE WHEN b.starts_at >= ? THEN b.starts_at END ASC, b.starts_at DESC';

  const safeLimit = Math.min(50, Math.max(5, Number(limit) || 12));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;

  const total = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM bookings b
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN packages p ON p.id = b.package_id
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE ${where}`
    )
    .get(...params).n;

  const nowIso = new Date().toISOString();
  const orderParams = sort === 'date' ? [nowIso, nowIso] : [];

  const rows = db
    .prepare(`${DETAIL_SELECT} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, ...orderParams, safeLimit, offset);

  return {
    items: rows.map(mapBooking),
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: offset + rows.length < total,
    status: String(status),
    period,
    range: { start: range.start, end: range.end }
  };
}

export function bookingDetail(id) {
  const row = db.prepare(`${DETAIL_SELECT} WHERE b.id = ? AND b.deleted_at IS NULL`).get(Number(id));
  if (!row) return null;
  const events = db
    .prepare(
      `SELECT id, type, title, message, actor, created_at
       FROM booking_events WHERE booking_id = ? ORDER BY created_at ASC, id ASC`
    )
    .all(row.id)
    .map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      message: event.message,
      actor: event.actor,
      createdAt: event.created_at
    }));

  const serviceIds = db.prepare('SELECT service_ids FROM packages WHERE id = ?').get(row.package_id);
  const packageServices = row.package_id
    ? parseJson(serviceIds?.service_ids, [])
        .map((id) => db.prepare('SELECT name, duration_min FROM services WHERE id = ?').get(Number(id)))
        .filter(Boolean)
        .map((item) => ({ name: item.name, duration: item.duration_min }))
    : [];

  return {
    booking: mapBooking(row),
    source: row.source,
    clientNote: row.client_note,
    client: row.client_id
      ? {
          id: row.client_id,
          name: row.client_name,
          phone: row.phone,
          email: row.email,
          telegram: row.telegram_username,
          instagram: row.instagram,
          isVip: Boolean(row.is_vip),
          notes: row.client_notes
        }
      : null,
    service: row.service_id
      ? { id: row.service_id, name: row.service_name, description: row.service_description }
      : null,
    package: row.package_id ? { id: row.package_id, name: row.package_name, services: packageServices } : null,
    events
  };
}

function writeEvent(bookingId, { type, title, message = null, actor = 'photographer' }) {
  db.prepare(
    'INSERT INTO booking_events (booking_id, type, title, message, actor) VALUES (?, ?, ?, ?, ?)'
  ).run(bookingId, type, title, message, actor);
}

function cleanText(value, max) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

export function changeStatus(id, statusId, comment) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!booking) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  const next = db
    .prepare('SELECT * FROM statuses WHERE id = ? AND deleted_at IS NULL')
    .get(Number(statusId));
  if (!next) return { status: 422, body: { error: 'invalid_status', message: 'Такого статуса нет' } };
  if (Number(booking.status_id) === Number(next.id)) {
    return { status: 409, body: { error: 'same_status', message: 'Этот статус уже стоит' } };
  }

  const note = cleanText(comment, MAX_COMMENT);
  const now = new Date().toISOString();
  const commit = db.transaction(() => {
    db.prepare('UPDATE bookings SET status_id = ?, updated_at = ? WHERE id = ?').run(next.id, now, booking.id);
    writeEvent(booking.id, {
      type: 'status',
      title: `Статус изменён: ${next.name}`,
      message: note
    });
    logActivity({
      type: 'booking',
      title: 'Статус записи изменён',
      description: `${next.name} · ${getBookingById(booking.id)?.client?.name || 'Клиент'}`,
      entity: 'booking',
      entityId: booking.id
    });
  });
  commit();
  return { status: 200, body: bookingDetail(booking.id), changed: 'status' };
}

export function rescheduleBooking(id, { date, time, comment }) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!booking) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  if (!isValidDateKey(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) {
    return { status: 422, body: { error: 'invalid_slot', message: 'Выберите новую дату и время' } };
  }
  const startsAt = isoForLocal(date, time);
  if (startsAt === booking.starts_at) {
    return { status: 409, body: { error: 'same_slot', message: 'Это то же самое время' } };
  }

  const endsAt = new Date(new Date(startsAt).getTime() + booking.duration_min * 60000).toISOString();
  const clash = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings b
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0 AND b.id <> ?
         AND b.starts_at < ? AND datetime(b.starts_at, '+' || b.duration_min || ' minutes') > ?`
    )
    .get(booking.id, endsAt, startsAt).n;
  if (clash > 0) {
    return { status: 409, body: { error: 'slot_taken', message: 'На это время уже есть запись' } };
  }

  const note = cleanText(comment, MAX_COMMENT);
  const previous = booking.starts_at;
  const now = new Date().toISOString();
  const commit = db.transaction(() => {
    db.prepare('UPDATE bookings SET starts_at = ?, updated_at = ? WHERE id = ?').run(startsAt, now, booking.id);
    writeEvent(booking.id, {
      type: 'reschedule',
      title: 'Запись перенесена',
      message: `${localKeyOf(previous)} → ${localKeyOf(startsAt)}${note ? ` · ${note}` : ''}`
    });
    logActivity({
      type: 'booking',
      title: 'Запись перенесена',
      description: `${getBookingById(booking.id)?.client?.name || 'Клиент'} · ${date} ${time}`,
      entity: 'booking',
      entityId: booking.id
    });
  });
  commit();
  return { status: 200, body: bookingDetail(booking.id), changed: 'reschedule' };
}

function cancelledStatusId() {
  const existing = db
    .prepare('SELECT id FROM statuses WHERE is_cancelled = 1 AND deleted_at IS NULL ORDER BY sort_order LIMIT 1')
    .get();
  if (existing) return existing.id;
  const info = db
    .prepare(
      `INSERT INTO statuses (name, color, sort_order, is_initial, is_final, is_cancelled, client_can_reschedule, client_can_cancel)
       VALUES ('Отклонена', '#ef4444', 900, 0, 0, 1, 0, 0)`
    )
    .run();
  return Number(info.lastInsertRowid);
}

export function cancelBooking(id, comment) {
  const booking = db
    .prepare(
      `SELECT b.*, st.is_cancelled FROM bookings b
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.id = ? AND b.deleted_at IS NULL`
    )
    .get(Number(id));
  if (!booking) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  if (booking.is_cancelled) {
    return { status: 409, body: { error: 'already_cancelled', message: 'Запись уже отменена' } };
  }

  const statusId = cancelledStatusId();
  const note = cleanText(comment, MAX_COMMENT);
  const now = new Date().toISOString();
  const commit = db.transaction(() => {
    db.prepare('UPDATE bookings SET status_id = ?, updated_at = ? WHERE id = ?').run(statusId, now, booking.id);
    writeEvent(booking.id, { type: 'cancel', title: 'Запись отменена', message: note });
    logActivity({
      type: 'booking',
      title: 'Запись отменена',
      description: `${getBookingById(booking.id)?.client?.name || 'Клиент'} · ${note || 'без комментария'}`,
      entity: 'booking',
      entityId: booking.id
    });
  });
  commit();
  return { status: 200, body: bookingDetail(booking.id), changed: 'cancel' };
}

export function updateNotes(id, payload) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!booking) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  const notes = cleanText(payload?.notes, MAX_NOTE);
  const gallery = payload?.galleryUrl === undefined ? booking.gallery_url : cleanText(payload.galleryUrl, 400);
  db.prepare('UPDATE bookings SET notes = ?, gallery_url = ?, updated_at = ? WHERE id = ?').run(
    notes,
    gallery,
    new Date().toISOString(),
    booking.id
  );
  if (notes !== booking.notes) {
    writeEvent(booking.id, { type: 'note', title: 'Заметка обновлена', message: notes });
  }
  return { status: 200, body: bookingDetail(booking.id), changed: 'notes' };
}

export function deleteBooking(id) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!booking) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  const now = new Date().toISOString();
  db.prepare('UPDATE bookings SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, booking.id);
  logActivity({
    type: 'booking',
    title: 'Запись удалена в корзину',
    description: getBookingById(booking.id)?.client?.name || `Запись #${booking.id}`,
    entity: 'booking',
    entityId: booking.id
  });
  return { status: 200, body: { ok: true, id: booking.id }, changed: 'delete' };
}

/** Свободные слоты для переноса: показываем всё, что не занято, включая «сегодня». */
export function rescheduleSlots(id, date, { schedule, step = 30 }) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!booking) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  if (!isValidDateKey(date)) {
    return { status: 422, body: { error: 'invalid_date', message: 'Некорректная дата' } };
  }
  const item = collectItem({
    serviceId: booking.service_id || undefined,
    packageId: booking.package_id || undefined
  });
  const fallback = { id: 0, price: booking.price, duration: booking.duration_min, buffer: 0, addons: [] };
  const slots = slotsForDate(schedule, item || fallback, date, { ignoreNotice: true, force: true, step });
  const currentLocal = localKeyOf(booking.starts_at);
  return {
    status: 200,
    body: {
      date,
      duration: booking.duration_min,
      current: booking.starts_at,
      currentLocal,
      slots: slots.filter((slot) => !(currentLocal === date && slot.iso === booking.starts_at))
    }
  };
}

export function rescheduleAvailability(id, month, { schedule, step = 30 }) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!booking) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  const item =
    collectItem({ serviceId: booking.service_id || undefined, packageId: booking.package_id || undefined }) || {
      id: 0,
      price: booking.price,
      duration: booking.duration_min,
      buffer: 0,
      addons: []
    };
  const [year, monthNumber] = month.split('-').map(Number);
  const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const days = {};
  for (let day = 1; day <= total; day += 1) {
    const key = `${month}-${String(day).padStart(2, '0')}`;
    const slots = slotsForDate(schedule, item, key, { ignoreNotice: true, force: true, step });
    if (slots.length) days[key] = { count: slots.length, first: slots[0].time, last: slots[slots.length - 1].time };
  }
  return { status: 200, body: { month, days, today: localToday() } };
}
