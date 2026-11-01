import express from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { broadcast, broadcastBadges } from '../lib/sse.js';
import { getBookingById } from '../lib/bookings.js';
import { createBooking } from '../lib/booking-create.js';
import { getSettings } from '../db.js';
import {
  bookingDetail,
  cancelBooking,
  changeStatus,
  deleteBooking,
  listBookingsPaged,
  rescheduleAvailability,
  rescheduleBooking,
  rescheduleSlots,
  statusList,
  updateNotes
} from '../lib/bookings-admin.js';

const router = express.Router();

const MAX_COMMENT = 600;

function bookingRow(id) {
  return db
    .prepare(
      `SELECT b.*, st.name AS status_name, st.sort_order AS status_order, st.is_initial, st.is_final, st.is_cancelled,
              c.name AS client_name, s.name AS service_name, p.name AS package_name
       FROM bookings b
       LEFT JOIN statuses st ON st.id = b.status_id
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE b.id = ? AND b.deleted_at IS NULL`
    )
    .get(id);
}

function cancelledStatusId() {
  const existing = db
    .prepare("SELECT id FROM statuses WHERE is_cancelled = 1 AND deleted_at IS NULL ORDER BY sort_order LIMIT 1")
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

function writeEvent(bookingId, { type, title, message, actor = 'photographer' }) {
  db.prepare(
    `INSERT INTO booking_events (booking_id, type, title, message, actor) VALUES (?, ?, ?, ?, ?)`
  ).run(bookingId, type, title, message || null, actor);
}

function cleanComment(value) {
  if (value === undefined || value === null) return null;
  const comment = String(value).trim();
  if (!comment) return null;
  return comment.slice(0, MAX_COMMENT);
}

router.get('/statuses', requireAuth, (req, res) => {
  res.json(statusList());
});

router.get('/', requireAuth, (req, res) => {
  res.json(
    listBookingsPaged({
      status: req.query.status || 'all',
      period: req.query.period || 'all',
      from: req.query.from || null,
      to: req.query.to || null,
      q: req.query.q || '',
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort || 'date',
      includeCancelled: req.query.includeCancelled === '1'
    })
  );
});

router.get('/:id(\\d+)', requireAuth, (req, res) => {
  const detail = bookingDetail(Number(req.params.id));
  if (!detail) return res.status(404).json({ error: 'not_found', message: 'Запись не найдена' });
  res.json(detail);
});

router.get('/:id(\\d+)/slots', requireAuth, (req, res) => {
  const settings = getSettings();
  const result = rescheduleSlots(Number(req.params.id), String(req.query.date || ''), {
    schedule: settings.schedule,
    step: settings.bookingForm?.slotStepMin || 30
  });
  res.status(result.status).json(result.body);
});

router.get('/:id(\\d+)/availability', requireAuth, (req, res) => {
  const settings = getSettings();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || ''))
    ? String(req.query.month)
    : new Date().toISOString().slice(0, 7);
  const result = rescheduleAvailability(Number(req.params.id), month, {
    schedule: settings.schedule,
    step: settings.bookingForm?.slotStepMin || 30
  });
  res.status(result.status).json(result.body);
});

router.patch('/:id(\\d+)', requireAuth, (req, res) => {
  const result = updateNotes(Number(req.params.id), req.body || {});
  if (result.status === 200) {
    broadcast('booking', { id: Number(req.params.id), action: 'updated' });
  }
  res.status(result.status).json(result.body);
});

router.post('/:id(\\d+)/status', requireAuth, (req, res) => {
  const result = changeStatus(Number(req.params.id), req.body?.statusId, req.body?.comment);
  if (result.status === 200) {
    broadcast('booking', { id: Number(req.params.id), action: 'status' });
    broadcastBadges();
  }
  res.status(result.status).json(result.body);
});

router.post('/:id(\\d+)/reschedule', requireAuth, (req, res) => {
  const result = rescheduleBooking(Number(req.params.id), req.body || {});
  if (result.status === 200) {
    broadcast('booking', { id: Number(req.params.id), action: 'reschedule' });
  }
  res.status(result.status).json(result.body);
});

router.post('/:id(\\d+)/cancel', requireAuth, (req, res) => {
  const result = cancelBooking(Number(req.params.id), req.body?.comment);
  if (result.status === 200) {
    broadcast('booking', { id: Number(req.params.id), action: 'cancelled' });
    broadcastBadges();
  }
  res.status(result.status).json(result.body);
});

router.delete('/:id(\\d+)', requireAuth, (req, res) => {
  const result = deleteBooking(Number(req.params.id));
  if (result.status === 200) {
    broadcast('booking', { id: Number(req.params.id), action: 'deleted' });
    broadcastBadges();
  }
  res.status(result.status).json(result.body);
});

/** Ручная запись фотографа: без проверки телефона и без ограничения «минимальный запас». */
router.post('/', requireAuth, (req, res) => {
  const result = createBooking({
    payload: req.body || {},
    source: 'admin',
    force: req.body?.force === true
  });
  res.status(result.status).json(result.body);
});

router.post('/:id/accept', requireAuth, (req, res) => {
  const booking = bookingRow(Number(req.params.id));
  if (!booking) return res.status(404).json({ error: 'not_found', message: 'Запись не найдена' });
  if (booking.is_cancelled) {
    return res.status(409).json({ error: 'already_declined', message: 'Заявка уже отклонена' });
  }
  if (!booking.is_initial) {
    return res.status(409).json({ error: 'already_processed', message: 'Заявка уже обработана' });
  }

  const next = db
    .prepare(
      `SELECT * FROM statuses
       WHERE deleted_at IS NULL AND is_cancelled = 0 AND sort_order > ?
       ORDER BY sort_order LIMIT 1`
    )
    .get(booking.status_order);
  if (!next) {
    return res.status(409).json({ error: 'no_next_status', message: 'Не найден следующий статус' });
  }

  const comment = cleanComment(req.body?.comment);
  const now = new Date().toISOString();

  const commit = db.transaction(() => {
    db.prepare('UPDATE bookings SET status_id = ?, updated_at = ? WHERE id = ?').run(next.id, now, booking.id);
    writeEvent(booking.id, {
      type: 'status',
      title: `Статус изменён: ${next.name}`,
      message: comment
    });
    logActivity({
      type: 'booking',
      title: 'Заявка подтверждена',
      description: `${booking.client_name || 'Клиент'} · ${booking.service_name || booking.package_name || 'Съёмка'}`,
      entity: 'booking',
      entityId: booking.id
    });
  });
  commit();

  broadcast('booking', { id: booking.id, action: 'accepted', status: next.name });
  broadcastBadges();

  res.json({ booking: getBookingById(booking.id) });
});

router.post('/:id/decline', requireAuth, (req, res) => {
  const booking = bookingRow(Number(req.params.id));
  if (!booking) return res.status(404).json({ error: 'not_found', message: 'Запись не найдена' });
  if (booking.is_cancelled) {
    return res.status(409).json({ error: 'already_declined', message: 'Заявка уже отклонена' });
  }

  const statusId = cancelledStatusId();
  const comment = cleanComment(req.body?.comment);
  const now = new Date().toISOString();

  const commit = db.transaction(() => {
    db.prepare('UPDATE bookings SET status_id = ?, updated_at = ? WHERE id = ?').run(statusId, now, booking.id);
    writeEvent(booking.id, {
      type: 'status',
      title: 'Заявка отклонена',
      message: comment
    });
    logActivity({
      type: 'booking',
      title: 'Заявка отклонена',
      description: `${booking.client_name || 'Клиент'} · ${booking.service_name || booking.package_name || 'Съёмка'}`,
      entity: 'booking',
      entityId: booking.id
    });
  });
  commit();

  broadcast('booking', { id: booking.id, action: 'declined' });
  broadcastBadges();

  res.json({ booking: getBookingById(booking.id) });
});

export default router;
