import crypto from 'node:crypto';
import { db, getSettings, saveSettings, logActivity } from '../db.js';
import { localToday } from './bookings.js';
import { addDays, localKeyOf, localMinutesOf, windowsForDate } from './slots.js';

/**
 * Календарь студии: день, неделя и месяц в одном источнике данных,
 * плюс обмен с Apple Calendar — публичная .ics-подписка и импорт личных событий,
 * чтобы занятость из чужого календаря закрывала слоты.
 */

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MAX_IMPORT = 2000;

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function round(value) {
  return Math.round(Number(value) || 0);
}

export function isValidDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function monthKeyOf(dateKey) {
  return String(dateKey).slice(0, 7);
}

/** Первый день недели (понедельник) для даты. */
export function startOfWeek(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const shift = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dateKey, shift);
}

export function calendarBounds(view, dateKey) {
  if (view === 'day') return { from: dateKey, to: dateKey };
  if (view === 'week') {
    const from = startOfWeek(dateKey);
    return { from, to: addDays(from, 6) };
  }
  const [year, month] = dateKey.split('-').map(Number);
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = new Date(Date.UTC(year, month, 0)).getUTCDate();
  /* Показываем сетку месяца целиком, включая дни соседних недель. */
  return {
    from: startOfWeek(first),
    to: addDays(startOfWeek(`${year}-${String(month).padStart(2, '0')}-${monthEnd}`), 6)
  };
}

function entriesBetween(fromKey, toKey) {
  const startIso = `${fromKey}T00:00:00.000Z`;
  const rows = db
    .prepare(
      `SELECT b.id, b.public_code, b.starts_at, b.duration_min, b.price, b.source,
              c.id AS client_id, c.name AS client_name, c.phone AS client_phone,
              COALESCE(s.name, p.name, 'Съёмка') AS item_name,
              s.id AS service_id, p.id AS package_id,
              st.id AS status_id, st.name AS status_name, st.color AS status_color,
              st.is_initial, st.is_final, st.is_cancelled
       FROM bookings b
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN packages p ON p.id = b.package_id
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.deleted_at IS NULL AND b.starts_at >= ? AND b.starts_at <= ?
       ORDER BY b.starts_at`
    )
    .all(startIso, `${addDays(toKey, 2)}T00:00:00.000Z`);

  /* Граница месяца в ISO смещена на часовой пояс, поэтому фильтруем по локальной дате. */
  const clock = (minutes) =>
    `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

  return rows
    .map((row) => {
      const dateKey = localKeyOf(row.starts_at);
      const startMin = localMinutesOf(row.starts_at);
      const duration = Math.max(10, Number(row.duration_min) || 60);
      return {
        id: row.id,
        code: row.public_code,
        date: dateKey,
        startMin,
        endMin: startMin + duration,
        time: clock(startMin),
        endTime: clock(startMin + duration),
        duration,
        price: round(row.price),
        source: row.source,
        client: row.client_id ? { id: row.client_id, name: row.client_name, phone: row.client_phone } : null,
        item: { name: row.item_name, serviceId: row.service_id, packageId: row.package_id },
        status: row.status_id
          ? {
              id: row.status_id,
              name: row.status_name,
              color: row.status_color,
              isInitial: Boolean(row.is_initial),
              isFinal: Boolean(row.is_final),
              isCancelled: Boolean(row.is_cancelled)
            }
          : null
      };
    })
    .filter((item) => item.date >= fromKey && item.date <= toKey);
}

function externalBetween(fromKey, toKey) {
  const rows = db
    .prepare('SELECT * FROM external_events WHERE ends_at > ? AND starts_at < ? ORDER BY starts_at')
    .all(`${fromKey}T00:00:00.000Z`, `${addDays(toKey, 2)}T00:00:00.000Z`);
  return rows
    .map((row) => ({
      id: `ext-${row.id}`,
      title: row.title || 'Событие',
      date: localKeyOf(row.starts_at),
      startMin: row.all_day ? 0 : localMinutesOf(row.starts_at),
      endMin: row.all_day ? 24 * 60 : localMinutesOf(row.ends_at) || 24 * 60,
      allDay: Boolean(row.all_day),
      source: row.source
    }))
    .filter((item) => item.date >= fromKey && item.date <= toKey);
}

export function calendarData({ view = 'month', date, serviceId = null } = {}) {
  const settings = getSettings();
  const schedule = settings.schedule;
  const today = localToday();
  const anchor = isValidDateKey(date) ? date : today;
  const mode = ['day', 'week', 'month'].includes(view) ? view : 'month';
  const { from, to } = calendarBounds(mode, anchor);

  const entries = entriesBetween(from, to);
  const external = externalBetween(from, to);

  const days = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    const windows = windowsForDate(schedule, cursor);
    const dayEntries = entries.filter((item) => item.date === cursor);
    const dayExternal = external.filter((item) => item.date === cursor);
    days.push({
      date: cursor,
      weekday: WEEKDAYS[(new Date(`${cursor}T00:00:00.000Z`).getUTCDay() + 6) % 7],
      day: Number(cursor.slice(8, 10)),
      month: Number(cursor.slice(5, 7)),
      isToday: cursor === today,
      isPast: cursor < today,
      closed: windows.length === 0,
      windows: windows.map((segment) => ({ from: segment.from, to: segment.to })),
      bookings: dayEntries.filter((item) => serviceId ? Number(item.item.serviceId) === Number(serviceId) : true),
      external: dayExternal,
      revenue: dayEntries.filter((item) => !item.status?.isCancelled).reduce((sum, item) => sum + item.price, 0),
      count: dayEntries.filter((item) => !item.status?.isCancelled).length
    });
  }

  const active = entries.filter((item) => !item.status?.isCancelled);
  return {
    view: mode,
    date: anchor,
    today,
    from,
    to,
    weekdays: WEEKDAYS,
    days,
    totals: {
      bookings: active.length,
      pending: entries.filter((item) => item.status?.isInitial).length,
      cancelled: entries.filter((item) => item.status?.isCancelled).length,
      revenue: active.reduce((sum, item) => sum + item.price, 0),
      external: external.length
    },
    schedule: {
      minNoticeHours: schedule.minNoticeHours,
      horizonDays: schedule.horizonDays,
      step: settings.bookingForm?.slotStepMin || 30
    },
    calendar: {
      enabled: Boolean(settings.appleCalendar?.enabled),
      url: settings.appleCalendar?.url || '',
      exportToken: settings.appleCalendar?.exportToken || null,
      lastSyncAt: settings.appleCalendar?.lastSyncAt || null,
      lastSyncCount: settings.appleCalendar?.lastSyncCount || 0,
      lastSyncError: settings.appleCalendar?.lastSyncError || null
    }
  };
}

/* ------------------------------ экспорт .ics ------------------------------ */

function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsStamp(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function ensureExportToken() {
  const settings = getSettings();
  if (settings.appleCalendar?.exportToken) return settings.appleCalendar.exportToken;
  const token = crypto.randomBytes(18).toString('hex');
  saveSettings({
    appleCalendar: { ...settings.appleCalendar, exportToken: token, enabled: true }
  });
  return token;
}

export function rotateExportToken() {
  const settings = getSettings();
  const token = crypto.randomBytes(18).toString('hex');
  saveSettings({ appleCalendar: { ...settings.appleCalendar, exportToken: token } });
  return token;
}

export function exportTokenValid(token) {
  const settings = getSettings();
  const stored = settings.appleCalendar?.exportToken;
  return Boolean(stored && token && String(token) === String(stored));
}

/** Публичная подписка: все записи студии в формате iCalendar. */
export function buildIcs() {
  const settings = getSettings();
  const rows = db
    .prepare(
      `SELECT b.id, b.public_code, b.starts_at, b.duration_min, b.price, b.notes,
              c.name AS client_name, COALESCE(s.name, p.name, 'Съёмка') AS item_name,
              st.name AS status_name, st.is_cancelled
       FROM bookings b
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN packages p ON p.id = b.package_id
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0
       ORDER BY b.starts_at`
    )
    .all();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//xenon.studio//Studio calendar//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(settings.siteName || 'xenon.studio')}`,
    'X-WR-TIMEZONE:Europe/Minsk'
  ];

  for (const row of rows) {
    const start = new Date(row.starts_at);
    const end = new Date(start.getTime() + (Number(row.duration_min) || 60) * 60000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:booking-${row.id}@xenon.studio`,
      `DTSTAMP:${icsStamp(new Date().toISOString())}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${icsEscape(`${row.item_name} — ${row.client_name || 'Клиент'}`)}`,
      `DESCRIPTION:${icsEscape(
        `${row.status_name || 'Запись'} · ${round(row.price)} ${settings.currencySymbol || '₽'}\nСсылка клиента: https://xenon.studio/b/${row.public_code}`
      )}`,
      'LOCATION:Студия',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

/* ------------------------------ импорт .ics ------------------------------ */

function unfold(text) {
  return String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function icsDate(value) {
  const clean = String(value || '').trim();
  const withZone = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (withZone) {
    const [, year, month, day, hour, minute, second, utc] = withZone;
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${utc ? 'Z' : ''}`;
    return { iso: new Date(utc ? iso : `${iso}+03:00`).toISOString(), allDay: false };
  }
  const dateOnly = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return { iso: new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString(), allDay: true };
  }
  return null;
}

export function parseIcs(text) {
  const source = unfold(text);
  const events = [];
  const blocks = source.split('BEGIN:VEVENT').slice(1);
  for (const block of blocks) {
    const body = block.split('END:VEVENT')[0];
    const field = (name) => {
      const match = body.match(new RegExp(`^${name}[^:\\r\\n]*:(.*)$`, 'm'));
      return match ? match[1].trim() : '';
    };
    const uid = field('UID') || crypto.randomUUID();
    const start = icsDate(field('DTSTART'));
    const end = icsDate(field('DTEND')) || (start ? { iso: new Date(Date.parse(start.iso) + 3600000).toISOString() } : null);
    if (!start || !end) continue;
    events.push({
      uid: String(uid).slice(0, 120),
      title: (field('SUMMARY') || 'Событие').slice(0, 160),
      startsAt: start.iso,
      endsAt: end.iso,
      allDay: start.allDay
    });
    if (events.length >= MAX_IMPORT) break;
  }
  return events;
}

export async function syncExternalCalendar({ url } = {}) {
  const settings = getSettings();
  const target = String(url || settings.appleCalendar?.url || '').trim();
  if (!target) return { status: 422, body: { error: 'no_url', message: 'Укажите ссылку на календарь (.ics)' } };
  if (!/^https?:\/\//i.test(target)) {
    return { status: 422, body: { error: 'invalid_url', message: 'Ссылка должна начинаться с http:// или https://' } };
  }

  let text = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(target, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    text = await response.text();
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'Календарь не ответил за 9 секунд' : `Не удалось загрузить календарь: ${err.message}`;
    saveSettings({
      appleCalendar: { ...settings.appleCalendar, url: target, lastSyncAt: new Date().toISOString(), lastSyncError: message }
    });
    return { status: 502, body: { error: 'fetch_failed', message } };
  }

  const events = parseIcs(text);
  if (!events.length) {
    saveSettings({
      appleCalendar: {
        ...settings.appleCalendar,
        url: target,
        lastSyncAt: new Date().toISOString(),
        lastSyncCount: 0,
        lastSyncError: 'В календаре не нашлось событий'
      }
    });
    return { status: 200, body: { imported: 0, message: 'В календаре не нашлось событий' } };
  }

  const now = new Date().toISOString();
  const commit = db.transaction(() => {
    db.prepare('DELETE FROM external_events').run();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO external_events (uid, title, starts_at, ends_at, all_day, source, created_at)
       VALUES (?, ?, ?, ?, ?, 'apple', ?)`
    );
    for (const event of events) {
      insert.run(event.uid, event.title, event.startsAt, event.endsAt, event.allDay ? 1 : 0, now);
    }
  });
  commit();

  saveSettings({
    appleCalendar: {
      ...settings.appleCalendar,
      url: target,
      enabled: true,
      lastSyncAt: now,
      lastSyncCount: events.length,
      lastSyncError: null
    }
  });

  logActivity({
    type: 'settings',
    title: 'Синхронизация календаря',
    description: `Импортировано событий: ${events.length}`,
    entity: 'calendar'
  });

  return { status: 200, body: { imported: events.length, events: events.slice(0, 20), at: now } };
}

export function clearExternalEvents() {
  db.prepare('DELETE FROM external_events').run();
  const settings = getSettings();
  saveSettings({ appleCalendar: { ...settings.appleCalendar, lastSyncCount: 0, lastSyncAt: null, lastSyncError: null } });
  return { status: 200, body: { ok: true } };
}

export function externalEventsList() {
  const rows = db.prepare('SELECT * FROM external_events ORDER BY starts_at LIMIT 200').all();
  return {
    items: rows.map((row) => ({
      id: row.id,
      uid: row.uid,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      localDate: localKeyOf(row.starts_at),
      allDay: Boolean(row.all_day)
    }))
  };
}
