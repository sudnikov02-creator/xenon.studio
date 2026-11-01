import { db, getSettings } from '../db.js';
import { addDays, localKeyOf } from './slots.js';
import { localToday, toLocalDate } from './bookings.js';

/**
 * Аналитика студии. Один расчёт на все графики: период, метрики с трендом,
 * доход по дням, топ услуг, скидки и клиентская база.
 */

const TZ_MS = 3 * 3600 * 1000;

export const PERIODS = [
  { id: '7d', label: 'Неделя', days: 7, step: 'day' },
  { id: '30d', label: 'Месяц', days: 30, step: 'day' },
  { id: '90d', label: 'Квартал', days: 90, step: 'week' },
  { id: '365d', label: 'Год', days: 365, step: 'month' }
];

function round(value) {
  return Math.round(Number(value) || 0);
}

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function periodBounds(periodId) {
  const period = PERIODS.find((item) => item.id === periodId) || PERIODS[1];
  const today = localToday();
  const from = addDays(today, -(period.days - 1));
  return { period, from, to: today };
}

function isoStart(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`).getTime() - TZ_MS > 0
    ? new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() - TZ_MS).toISOString()
    : `${dateKey}T00:00:00.000Z`;
}

function bucketKey(dateKey, step) {
  if (step === 'month') return dateKey.slice(0, 7);
  if (step === 'week') {
    const [year, month, day] = dateKey.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const shift = weekday === 0 ? -6 : 1 - weekday;
    return addDays(dateKey, shift);
  }
  return dateKey;
}

function bucketLabel(key, step) {
  if (step === 'month') {
    const [year, month] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1)))
      .replace('.', '');
  }
  const date = new Date(`${key}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(date)
    .replace('.', '');
}

function buildBuckets(from, to, step) {
  const keys = [];
  const seen = new Set();
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    const key = bucketKey(cursor, step);
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys.map((key) => ({ key, label: bucketLabel(key, step) }));
}

export function analytics({ period = '30d', compare = true } = {}) {
  const settings = getSettings();
  const { period: preset, from, to } = periodBounds(period);
  const prevFrom = addDays(from, -(preset.days));
  const prevTo = addDays(from, -1);

  const bookings = db
    .prepare(
      `SELECT b.id, b.starts_at, b.duration_min, b.price, b.list_price, b.discount_amount, b.source,
              b.client_id, b.service_id, b.package_id, b.coupon_id, b.certificate_id, b.bonus_spent,
              COALESCE(s.name, p.name, 'Съёмка') AS item_name,
              st.name AS status_name, st.is_initial, st.is_final, st.is_cancelled
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN packages p ON p.id = b.package_id
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.deleted_at IS NULL AND b.starts_at >= ? AND b.starts_at < ?
       ORDER BY b.starts_at`
    )
    .all(isoStart(from), isoStart(addDays(to, 1)))
    .map((row) => ({
      ...row,
      date: localKeyOf(row.starts_at),
      price: round(row.price),
      listPrice: round(row.list_price || row.price),
      discount: round(row.discount_amount),
      cancelled: Boolean(row.is_cancelled),
      initial: Boolean(row.is_initial),
      final: Boolean(row.is_final)
    }));

  const active = bookings.filter((item) => !item.cancelled);
  const paid = active.filter((item) => !item.initial);

  const revenue = active.reduce((sum, item) => sum + item.price, 0);
  const workedMinutes = active.reduce((sum, item) => sum + (Number(item.duration_min) || 0), 0);
  const cancelled = bookings.filter((item) => item.cancelled).length;
  const discounts = active.reduce((sum, item) => sum + item.discount, 0);
  const bonusSpent = active.reduce((sum, item) => sum + round(item.bonus_spent), 0);

  const prevStart = new Date(isoStart(prevFrom)).getTime();
  const prevEnd = new Date(isoStart(addDays(prevTo, 1))).getTime();
  const previous = db
    .prepare(
      `SELECT b.price, b.discount_amount, st.is_initial, st.is_cancelled
       FROM bookings b LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.deleted_at IS NULL AND b.starts_at >= ? AND b.starts_at < ?`
    )
    .all(new Date(prevStart).toISOString(), new Date(prevEnd).toISOString())
    .filter((row) => !row.is_cancelled);
  const prevRevenue = previous.reduce((sum, row) => sum + round(row.price), 0);
  const prevCount = previous.length;

  const trend = (current, base) => {
    if (!compare) return null;
    if (!base) return current > 0 ? 100 : 0;
    return Math.round(((current - base) / base) * 100);
  };

  const buckets = buildBuckets(from, to, preset.step);
  const series = buckets.map((bucket) => {
    const rows = active.filter((item) => bucketKey(item.date, preset.step) === bucket.key);
    return {
      key: bucket.key,
      label: bucket.label,
      revenue: rows.reduce((sum, item) => sum + item.price, 0),
      bookings: rows.length,
      hours: Math.round((rows.reduce((sum, item) => sum + (Number(item.duration_min) || 0), 0) / 60) * 10) / 10
    };
  });
  const maxRevenue = Math.max(...series.map((item) => item.revenue), 1);

  const byService = new Map();
  for (const item of active) {
    const key = item.item_name || 'Съёмка';
    const current = byService.get(key) || { name: key, count: 0, revenue: 0, minutes: 0 };
    current.count += 1;
    current.revenue += item.price;
    current.minutes += Number(item.duration_min) || 0;
    byService.set(key, current);
  }
  const topItems = Array.from(byService.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((item) => ({ ...item, share: revenue > 0 ? Math.round((item.revenue / revenue) * 100) : 0 }));

  /* Загрузка: сколько часов в рабочих окнах периода занято съёмками. */
  const schedule = settings.schedule || { week: [] };
  let capacityMinutes = 0;
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    const exception = (schedule.exceptions || []).find((item) => item.date === cursor);
    if (exception?.closed) continue;
    const weekday = new Date(`${cursor}T00:00:00.000Z`).getUTCDay() || 7;
    const day = (schedule.week || []).find((item) => Number(item.day) === weekday);
    if (day?.enabled) {
      const [sh, sm] = String(day.start || '10:00').split(':').map(Number);
      const [eh, em] = String(day.end || '19:00').split(':').map(Number);
      capacityMinutes += Math.max(0, eh * 60 + em - (sh * 60 + sm));
    } else if (exception?.start && exception?.end) {
      const [sh, sm] = String(exception.start).split(':').map(Number);
      const [eh, em] = String(exception.end).split(':').map(Number);
      capacityMinutes += Math.max(0, eh * 60 + em - (sh * 60 + sm));
    }
  }
  const load = capacityMinutes > 0 ? Math.min(Math.round((workedMinutes / capacityMinutes) * 100), 100) : 0;

  /* Новые и вернувшиеся клиенты: считаем по первой съёмке в базе. */
  const clientRows = db
    .prepare(
      `SELECT c.id AS client_id, c.created_at,
              (SELECT MIN(b.starts_at) FROM bookings b
                 LEFT JOIN statuses st ON st.id = b.status_id
                 WHERE b.client_id = c.id AND b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0) AS first_at
       FROM clients c WHERE c.deleted_at IS NULL`
    )
    .all();
  /* Новый клиент — тот, чья первая съёмка или появление в базе попали в период. */
  const firstByClient = new Map(
    clientRows.map((row) => {
      const candidates = [row.first_at, row.created_at].filter(Boolean).map((value) => new Date(value).getTime());
      return [row.client_id, candidates.length ? new Date(Math.min(...candidates)).toISOString() : null];
    })
  );
  let newClients = 0;
  let returning = 0;
  const seenClients = new Set();
  for (const item of active) {
    if (!item.client_id || seenClients.has(item.client_id)) continue;
    seenClients.add(item.client_id);
    const first = firstByClient.get(item.client_id);
    if (first && toLocalDate(first) >= from) newClients += 1;
    else returning += 1;
  }

  const statusRows = db
    .prepare(
      `SELECT st.name, st.color, COUNT(b.id) AS count
       FROM statuses st LEFT JOIN bookings b ON b.status_id = st.id AND b.deleted_at IS NULL
         AND b.starts_at >= ? AND b.starts_at < ?
       WHERE st.deleted_at IS NULL GROUP BY st.id ORDER BY st.sort_order`
    )
    .all(isoStart(from), isoStart(addDays(to, 1)));

  const topClients = Array.from(
    active.reduce((map, item) => {
      if (!item.client_id) return map;
      const current = map.get(item.client_id) || { id: item.client_id, name: '', count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += item.price;
      map.set(item.client_id, current);
      return map;
    }, new Map()).values()
  )
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((item) => {
      const client = db.prepare('SELECT name, is_vip FROM clients WHERE id = ?').get(item.id);
      return { ...item, name: client?.name || 'Клиент', isVip: Boolean(client?.is_vip) };
    });

  const SOURCE_LABELS = {
    client: 'С сайта',
    link: 'По ссылке на запись',
    admin: 'Вручную',
    system: 'Автоматически'
  };
  const sourceCounts = active.reduce((map, item) => {
    const key = item.source || 'client';
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  const sources = Array.from(sourceCounts.entries())
    .map(([id, count]) => ({ id, label: SOURCE_LABELS[id] || id, count }))
    .sort((a, b) => b.count - a.count);

  /* Промокоды и сертификаты за период — из журналов списаний. */
  const promoRows = db
    .prepare(
      `SELECT 'coupon' AS kind, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM coupon_redemptions
       WHERE created_at >= ? AND created_at < ?
       UNION ALL
       SELECT 'certificate' AS kind, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM certificate_redemptions
       WHERE created_at >= ? AND created_at < ?`
    )
    .all(isoStart(from), isoStart(addDays(to, 1)), isoStart(from), isoStart(addDays(to, 1)));
  const promo = {
    coupons: { count: round(promoRows.find((row) => row.kind === 'coupon')?.n), amount: round(promoRows.find((row) => row.kind === 'coupon')?.amount) },
    certificates: {
      count: round(promoRows.find((row) => row.kind === 'certificate')?.n),
      amount: round(promoRows.find((row) => row.kind === 'certificate')?.amount)
    }
  };
  promo.total = promo.coupons.amount + promo.certificates.amount;

  return {
    period: preset.id,
    periods: PERIODS.map(({ id, label }) => ({ id, label })),
    from,
    to,
    currency: { symbol: settings.currencySymbol || '₽', separator: settings.decimalSeparator || 'comma' },
    metrics: {
      revenue,
      revenueTrend: trend(revenue, prevRevenue),
      bookings: active.length,
      bookingsTrend: trend(active.length, prevCount),
      avgCheck: active.length ? round(revenue / active.length) : 0,
      avgCheckTrend: trend(
        active.length ? round(revenue / active.length) : 0,
        prevCount ? round(prevRevenue / prevCount) : 0
      ),
      load,
      hours: Math.round((workedMinutes / 60) * 10) / 10,
      cancelled,
      cancelRate: bookings.length ? Math.round((cancelled / bookings.length) * 100) : 0,
      discounts,
      bonusSpent,
      newClients,
      returning,
      paid: paid.length
    },
    series,
    maxRevenue,
    topItems,
    topClients,
    statuses: statusRows.map((row) => ({ name: row.name, color: row.color, count: row.count })),
    sources,
    promo: {
      ...promo,
      saved: discounts,
      bonusSpent
    },
    bucket: preset.step
  };
}
