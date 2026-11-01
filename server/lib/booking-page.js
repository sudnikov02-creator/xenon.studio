import { db, getSettings, logActivity } from '../db.js';
import { localToday, toLocalDate } from './bookings.js';
import {
  availabilityForMonth,
  collectItem,
  isoForLocal,
  isValidDateKey,
  localKeyOf,
  slotsForDate
} from './slots.js';
import { broadcastBookingUpdate } from './sse.js';

const MAX_REASON = 600;
const DEFAULT_TZ_OFFSET = 3;

const PAGE_SELECT = `
  SELECT b.id, b.public_code, b.starts_at, b.duration_min, b.price, b.addons, b.notes, b.client_note,
         b.gallery_url, b.source, b.created_at, b.updated_at,
         c.id AS client_id, c.name AS client_name, c.phone, c.email, c.instagram, c.telegram_username,
         s.id AS service_id, s.name AS service_name, s.description AS service_description,
         p.id AS package_id, p.name AS package_name, p.service_ids,
         st.id AS status_id, st.name AS status_name, st.color AS status_color,
         st.is_initial, st.is_final, st.is_cancelled, st.sort_order AS status_order,
         st.client_can_reschedule, st.client_can_cancel
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

/** SQLite datetime('now') → ISO, чтобы браузер не принял UTC за локальное время. */
function toIso(value) {
  if (!value) return null;
  if (String(value).includes('T')) return new Date(value).toISOString();
  return new Date(`${String(value).replace(' ', 'T')}Z`).toISOString();
}

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase();
}

function findRow(code) {
  const key = normalizeCode(code);
  if (!key || key.length < 4) return null;
  return db.prepare(`${PAGE_SELECT} WHERE UPPER(b.public_code) = ? AND b.deleted_at IS NULL`).get(key) || null;
}

function localTimeOf(iso) {
  const offset = DEFAULT_TZ_OFFSET * 3600 * 1000;
  const shifted = new Date(new Date(iso).getTime() + offset);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
}

function packageServices(row) {
  if (!row.package_id) return [];
  const ids = parseJson(row.service_ids, []).map(Number).filter(Boolean);
  return ids
    .map((id) => db.prepare('SELECT name, duration_min FROM services WHERE id = ? AND deleted_at IS NULL').get(id))
    .filter(Boolean)
    .map((item) => ({ name: item.name, duration: item.duration_min }));
}

/** Права клиента на перенос/отмену + человеческая причина, если нельзя. */
export function clientPermissions(row, settings) {
  const minNotice = Math.max(0, Number(settings.minNoticeHours) || 0);
  const now = Date.now();
  const startMs = new Date(row.starts_at).getTime();
  const hoursLeft = Math.round((startMs - now) / 3600000);
  const accepting = settings.schedule?.accepting !== false;

  let rescheduleReason = null;
  if (row.is_cancelled) rescheduleReason = 'Запись отменена — переносить нечего.';
  else if (row.is_final) rescheduleReason = 'Съёмка завершена — перенос уже недоступен.';
  else if (!row.client_can_reschedule) rescheduleReason = 'По этой записи перенос недоступен — напишите фотографу.';
  else if (!accepting) rescheduleReason = 'Запись на съёмки временно приостановлена.';
  else if (startMs - now < minNotice * 3600000)
    rescheduleReason =
      hoursLeft > 0
        ? `До съёмки меньше ${minNotice} ч — перенос недоступен, лучше позвонить фотографу.`
        : 'Время съёмки уже прошло.';

  let cancelReason = null;
  if (row.is_cancelled) cancelReason = 'Запись уже отменена.';
  else if (row.is_final) cancelReason = 'Съёмка завершена — отменять нечего.';
  else if (!row.client_can_cancel) cancelReason = 'Отмена по этой записи недоступна — напишите фотографу.';
  else if (startMs <= now) cancelReason = 'Время съёмки уже прошло.';

  return {
    canReschedule: !rescheduleReason,
    canCancel: !cancelReason,
    rescheduleReason,
    cancelReason,
    hoursLeft,
    minNoticeHours: minNotice,
    lateCancel: !cancelReason && startMs - now < minNotice * 3600000
  };
}

function clientEvents(bookingId) {
  return db
    .prepare(
      `SELECT id, type, title, message, actor,
              strftime('%Y-%m-%dT%H:%M:%fZ', created_at) AS created_at
       FROM booking_events
       WHERE booking_id = ? AND type IN ('created', 'status', 'reschedule', 'cancel')
       ORDER BY datetime(created_at) ASC, id ASC`
    )
    .all(bookingId)
    .map((event) => ({
      id: event.id,
      type: event.type,
      title:
        event.type === 'created'
          ? 'Заявка создана'
          : event.type === 'reschedule' && event.actor === 'client'
            ? 'Вы перенесли запись'
            : event.type === 'cancel' && event.actor === 'client'
              ? 'Вы отменили запись'
              : event.title,
      message: event.message,
      actor: event.actor === 'client' ? 'client' : 'photographer',
      createdAt: toIso(event.created_at)
    }));
}

function studioInfo(settings) {
  return {
    siteName: settings.siteName,
    photographerName: settings.photographerName,
    brandTagline: settings.brandTagline,
    logoUrl: settings.logoUrl,
    timezone: settings.timezone,
    currencySymbol: settings.currencySymbol,
    decimalSeparator: settings.decimalSeparator,
    contacts: settings.contacts || { phone: '', telegram: '', instagram: '', email: '' }
  };
}

export function clientBookingView(code) {
  const row = findRow(code);
  if (!row) return null;
  const settings = getSettings();

  return {
    code: row.public_code,
    today: localToday(),
    booking: {
      code: row.public_code,
      startsAt: row.starts_at,
      localDate: toLocalDate(row.starts_at),
      localTime: localTimeOf(row.starts_at),
      duration: row.duration_min,
      price: row.price,
      addons: parseJson(row.addons, []),
      clientNote: row.client_note,
      galleryUrl: row.gallery_url,
      createdAt: toIso(row.created_at)
    },
    client: {
      name: row.client_name || 'Клиент',
      phone: row.phone,
      instagram: row.instagram
    },
    status: row.status_id
      ? {
          name: row.status_name,
          color: row.status_color,
          isFinal: Boolean(row.is_final),
          isCancelled: Boolean(row.is_cancelled),
          order: row.status_order
        }
      : null,
    service: row.service_id
      ? { name: row.service_name, description: row.service_description }
      : null,
    package: row.package_id
      ? { name: row.package_name, services: packageServices(row) }
      : null,
    events: clientEvents(row.id),
    permissions: clientPermissions(row, settings),
    studio: studioInfo(settings),
    agreement:
      settings.agreement?.enabled && settings.agreement?.text
        ? { enabled: true, text: settings.agreement.text }
        : { enabled: false, text: '' },
    schedule: {
      minNoticeHours: Number(settings.minNoticeHours) || 0,
      horizonDays: Number(settings.bookingHorizonDays) || 90,
      accepting: settings.schedule?.accepting !== false,
      stepMin: Number(settings.bookingForm?.slotStepMin) || 30
    }
  };
}

function itemFor(row) {
  return (
    collectItem({
      serviceId: row.service_id ? Number(row.service_id) : null,
      packageId: row.package_id ? Number(row.package_id) : null
    }) || { id: 0, name: row.service_name || row.package_name || 'Съёмка', price: row.price, duration: row.duration_min, buffer: 0, addons: [] }
  );
}

export function clientAvailability(code, month) {
  const row = findRow(code);
  if (!row) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  const settings = getSettings();
  const target = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || '')) ? String(month) : localToday().slice(0, 7);
  const { days } = availabilityForMonth(settings.schedule, itemFor(row), target, {
    step: settings.bookingForm?.slotStepMin || 30
  });
  return { status: 200, body: { month: target, days, today: localToday() } };
}

export function clientSlots(code, date) {
  const row = findRow(code);
  if (!row) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  if (!isValidDateKey(date)) {
    return { status: 422, body: { error: 'invalid_date', message: 'Некорректная дата' } };
  }
  const settings = getSettings();
  const slots = slotsForDate(settings.schedule, itemFor(row), date, {
    step: settings.bookingForm?.slotStepMin || 30
  });
  return {
    status: 200,
    body: { date, slots, duration: row.duration_min, current: row.starts_at, currentLocal: toLocalDate(row.starts_at) }
  };
}

function notifyStudio(title, subtitle) {
  db.prepare(
    `INSERT INTO notifications (kind, title, subtitle, action_label, action_url, is_read)
     VALUES ('booking', ?, ?, 'Открыть записи', '/admin/bookings', 0)`
  ).run(title, subtitle || null);
}

function cleanReason(value) {
  const text = String(value || '').trim();
  return text ? text.slice(0, MAX_REASON) : null;
}

export function clientReschedule(code, { date, time, comment } = {}) {
  const row = findRow(code);
  if (!row) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  const settings = getSettings();
  const permissions = clientPermissions(row, settings);
  if (!permissions.canReschedule) {
    return { status: 403, body: { error: 'not_allowed', message: permissions.rescheduleReason || 'Перенос недоступен' } };
  }
  if (!isValidDateKey(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) {
    return { status: 422, body: { error: 'invalid_slot', message: 'Выберите новую дату и время' } };
  }
  const startsAt = isoForLocal(date, time);
  if (startsAt === row.starts_at) {
    return { status: 409, body: { error: 'same_slot', message: 'Это то же самое время' } };
  }
  const minNotice = Math.max(0, Number(settings.minNoticeHours) || 0);
  const horizon = Math.max(1, Number(settings.bookingHorizonDays) || 90);
  if (date > addDaysKey(localToday(), horizon)) {
    return { status: 422, body: { error: 'too_far', message: 'Это время за пределами окна записи' } };
  }
  if (date < localToday()) {
    return { status: 422, body: { error: 'too_late', message: 'Выберите будущую дату' } };
  }
  // Проверяем ровно по сетке свободного времени: рабочие часы, перерывы, запас времени, занятость.
  const allowed = slotsForDate(settings.schedule, itemFor(row), date, {
    step: settings.bookingForm?.slotStepMin || 30
  });
  if (!allowed.some((slot) => slot.time === time)) {
    return {
      status: 422,
      body: {
        error: 'invalid_slot',
        message: `Это время недоступно. Минимальный запас до съёмки — ${minNotice} ч.`
      }
    };
  }

  const endsAt = new Date(new Date(startsAt).getTime() + row.duration_min * 60000).toISOString();
  const clash = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings b
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0 AND b.id <> ?
         AND b.starts_at < ? AND datetime(b.starts_at, '+' || b.duration_min || ' minutes') > ?`
    )
    .get(row.id, endsAt, startsAt).n;
  if (clash > 0) {
    return { status: 409, body: { error: 'slot_taken', message: 'На это время уже есть запись' } };
  }

  const previous = row.starts_at;
  const reason = cleanReason(comment);
  const now = new Date().toISOString();
  const commit = db.transaction(() => {
    db.prepare('UPDATE bookings SET starts_at = ?, updated_at = ? WHERE id = ?').run(startsAt, now, row.id);
    db.prepare(
      'INSERT INTO booking_events (booking_id, type, title, message, actor) VALUES (?, ?, ?, ?, ?)'
    ).run(
      row.id,
      'reschedule',
      'Запись перенесена клиентом',
      `${localKeyOf(previous)} → ${localKeyOf(startsAt)}${reason ? ` · ${reason}` : ''}`,
      'client'
    );
    notifyStudio(
      'Клиент перенёс запись',
      `${row.client_name || 'Клиент'} · ${localKeyOf(startsAt)} в ${time}`
    );
    logActivity({
      type: 'booking',
      title: 'Клиент перенёс запись',
      description: `${row.client_name || 'Клиент'} · ${localKeyOf(previous)} → ${localKeyOf(startsAt)}`,
      entity: 'booking',
      entityId: row.id,
      actor: 'client'
    });
  });
  commit();

  broadcastBookingUpdate(row.id, { action: 'reschedule' });
  return { status: 200, body: clientBookingView(row.public_code) };
}

function addDaysKey(key, days) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
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

export function clientCancel(code, { reason } = {}) {
  const row = findRow(code);
  if (!row) return { status: 404, body: { error: 'not_found', message: 'Запись не найдена' } };
  const settings = getSettings();
  const permissions = clientPermissions(row, settings);
  if (!permissions.canCancel) {
    return { status: 403, body: { error: 'not_allowed', message: permissions.cancelReason || 'Отмена недоступна' } };
  }

  const statusId = cancelledStatusId();
  const note = cleanReason(reason);
  const now = new Date().toISOString();
  const commit = db.transaction(() => {
    db.prepare('UPDATE bookings SET status_id = ?, updated_at = ? WHERE id = ?').run(statusId, now, row.id);
    db.prepare(
      'INSERT INTO booking_events (booking_id, type, title, message, actor) VALUES (?, ?, ?, ?, ?)'
    ).run(row.id, 'cancel', 'Запись отменена клиентом', note, 'client');
    notifyStudio('Клиент отменил запись', `${row.client_name || 'Клиент'} · ${localKeyOf(row.starts_at)}${note ? ` · ${note}` : ''}`);
    logActivity({
      type: 'booking',
      title: 'Клиент отменил запись',
      description: `${row.client_name || 'Клиент'} · ${localKeyOf(row.starts_at)}`,
      entity: 'booking',
      entityId: row.id,
      actor: 'client'
    });
  });
  commit();

  broadcastBookingUpdate(row.id, { action: 'cancel' });
  return { status: 200, body: clientBookingView(row.public_code) };
}
