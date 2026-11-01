import { db } from '../db.js';
import { TZ_OFFSET_HOURS, localToday } from './bookings.js';
import { minutesOf } from './schedule.js';

const TZ_MS = TZ_OFFSET_HOURS * 3600 * 1000;
const SUM_SELECT = `SELECT s.id, s.price, s.duration_min, s.buffer_min, s.addons
  FROM services s WHERE s.id = ? AND s.deleted_at IS NULL AND s.is_active = 1`;
const PKG_SELECT = `SELECT p.id, p.price, p.service_ids, p.addons
  FROM packages p WHERE p.id = ? AND p.deleted_at IS NULL AND p.is_active = 1`;

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function isValidDateKey(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

export function isoWeekday(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function minutesToTime(total) {
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** ISO timestamp for a local (Europe/Minsk) date and time. */
export function isoForLocal(dateKey, time) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = String(time).split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - TZ_MS).toISOString();
}

export function localKeyOf(iso) {
  return new Date(new Date(iso).getTime() + TZ_MS).toISOString().slice(0, 10);
}

export function localMinutesOf(iso) {
  const shifted = new Date(new Date(iso).getTime() + TZ_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function dayRange(dateKey) {
  const start = isoForLocal(dateKey, '00:00');
  return { start, end: new Date(new Date(start).getTime() + 86400000).toISOString() };
}

/** Рабочие окна дня с учётом перерывов и исключений — в минутах от полуночи. */
export function windowsForDate(schedule, dateKey) {
  const exception = (schedule.exceptions || []).find((item) => item.date === dateKey);
  if (exception?.closed) return [];

  let start;
  let end;
  let breaks = [];

  if (exception && exception.start && exception.end) {
    start = exception.start;
    end = exception.end;
  } else {
    const day = (schedule.week || []).find((item) => Number(item.day) === isoWeekday(dateKey));
    if (!day || !day.enabled) return [];
    start = day.start;
    end = day.end;
    if (day.breakStart && day.breakEnd) breaks = [{ start: day.breakStart, end: day.breakEnd }];
  }

  let segments = [{ from: minutesOf(start), to: minutesOf(end) }];
  for (const pause of breaks) {
    const from = minutesOf(pause.start);
    const to = minutesOf(pause.end);
    segments = segments.flatMap((segment) => {
      if (to <= segment.from || from >= segment.to) return [segment];
      const parts = [];
      if (from > segment.from) parts.push({ from: segment.from, to: from });
      if (to < segment.to) parts.push({ from: to, to: segment.to });
      return parts;
    });
  }
  return segments.filter((segment) => segment.to > segment.from);
}

/** Занятые интервалы дня (без буфера) — в минутах от полуночи. */
export function busyForDate(dateKey) {
  const range = dayRange(dateKey);
  const rows = db
    .prepare(
      `SELECT b.starts_at, b.duration_min
       FROM bookings b
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0
         AND b.starts_at >= ? AND b.starts_at < ?`
    )
    .all(range.start, range.end);
  /* Личные события из внешнего календаря тоже занимают время. */
  const external = db
    .prepare(
      `SELECT starts_at, ends_at, all_day FROM external_events
       WHERE ends_at > ? AND starts_at < ?`
    )
    .all(range.start, range.end);

  const busy = rows.map((row) => {
    const start = localMinutesOf(row.starts_at);
    return { from: start, to: start + Math.max(10, Number(row.duration_min) || 60) };
  });

  for (const row of external) {
    if (row.all_day) {
      busy.push({ from: 0, to: 24 * 60 });
      continue;
    }
    const startIso = new Date(row.starts_at);
    const endIso = new Date(row.ends_at);
    const startMin = localMinutesOf(startIso.toISOString());
    let endMin = localMinutesOf(endIso.toISOString());
    if (endMin <= startMin && localKeyOf(endIso.toISOString()) > localKeyOf(startIso.toISOString())) endMin = 24 * 60;
    busy.push({ from: startMin, to: endMin });
  }

  return busy;
}

export function collectItem({ serviceId, packageId }) {
  if (serviceId) {
    const row = db.prepare(SUM_SELECT).get(Number(serviceId));
    if (!row) return null;
    return {
      kind: 'service',
      id: row.id,
      name: db.prepare('SELECT name FROM services WHERE id = ?').get(row.id).name,
      price: Math.round(row.price),
      duration: Math.max(10, Number(row.duration_min) || 60),
      buffer: Math.max(0, Number(row.buffer_min) || 0),
      addons: parseJson(row.addons, [])
    };
  }
  if (packageId) {
    const row = db.prepare(PKG_SELECT).get(Number(packageId));
    if (!row) return null;
    const serviceIds = parseJson(row.service_ids, []).map(Number).filter(Boolean);
    const services = serviceIds
      .map((id) => db.prepare('SELECT name, duration_min FROM services WHERE id = ? AND deleted_at IS NULL').get(id))
      .filter(Boolean);
    const duration = services.reduce((sum, item) => sum + Math.max(10, Number(item.duration_min) || 60), 0) || 90;
    return {
      kind: 'package',
      id: row.id,
      name: db.prepare('SELECT name FROM packages WHERE id = ?').get(row.id).name,
      price: Math.round(row.price),
      duration,
      buffer: 0,
      addons: parseJson(row.addons, []),
      services: services.map((item) => item.name)
    };
  }
  return null;
}

/**
 * Свободные начала съёмки на конкретный день.
 * Учитывает рабочие часы, перерывы, исключения, занятость и минимальный запас времени.
 */
export function slotsForDate(schedule, item, dateKey, { ignoreNotice = false, force = false, step } = {}) {
  if (!isValidDateKey(dateKey) || !item) return [];
  const today = localToday();
  const horizon = addDays(today, Math.max(1, Number(schedule.horizonDays) || 90));
  if (!force && (dateKey < today || dateKey > horizon)) return [];

  const windows = windowsForDate(schedule, dateKey);
  if (!windows.length) return [];

  const gap = Math.max(0, Number(schedule.bufferMin) || 0, Number(item.buffer) || 0);
  const busy = busyForDate(dateKey).map((span) => ({ from: span.from - gap, to: span.to + gap }));
  const noticeLimit = ignoreNotice || force ? Date.now() : Date.now() + (Number(schedule.minNoticeHours) || 0) * 3600 * 1000;
  const stride = Math.max(10, Math.min(120, Number(step) || 30));
  const duration = item.duration;

  const result = [];
  for (const window of windows) {
    for (let start = window.from; start + duration <= window.to; start += stride) {
      const iso = isoForLocal(dateKey, minutesToTime(start));
      if (new Date(iso).getTime() < noticeLimit) continue;
      if (busy.some((span) => start < span.to && start + duration > span.from)) continue;
      result.push({ time: minutesToTime(start), iso });
    }
  }
  return result;
}

/** Количество свободных слотов по дням месяца — для календаря на шаге «Дата». */
export function availabilityForMonth(schedule, item, month, { step } = {}) {
  const [year, monthNumber] = month.split('-').map(Number);
  const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const days = {};
  let firstFree = null;
  for (let day = 1; day <= total; day += 1) {
    const key = `${month}-${String(day).padStart(2, '0')}`;
    const windows = windowsForDate(schedule, key);
    if (!windows.length) continue;
    const slots = slotsForDate(schedule, item, key, { step });
    if (slots.length) {
      days[key] = { count: slots.length, first: slots[0].time, last: slots[slots.length - 1].time };
      if (!firstFree) firstFree = key;
    }
  }
  return { month, days, firstFree };
}

export function isScheduleOpen(schedule) {
  return schedule?.accepting !== false;
}
