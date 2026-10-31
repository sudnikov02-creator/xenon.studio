import { db } from '../db.js';

/** Studio timezone offset used for day/month boundaries (Europe/Minsk, UTC+3). */
export const TZ_OFFSET_HOURS = 3;
const TZ_MS = TZ_OFFSET_HOURS * 3600 * 1000;

export function toLocalDate(iso) {
  return new Date(new Date(iso).getTime() + TZ_MS).toISOString().slice(0, 10);
}

export function localToday() {
  return toLocalDate(new Date().toISOString());
}

export function currentMonth() {
  return localToday().slice(0, 7);
}

export function isValidMonth(month) {
  return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function monthRange(month) {
  const [year, m] = month.split('-').map(Number);
  const start = Date.UTC(year, m - 1, 1, 0, 0, 0) - TZ_MS;
  const end = Date.UTC(year, m, 1, 0, 0, 0) - TZ_MS;
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month) {
  const [year, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, m - 1, 1))
  );
}

export function monthDays(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

const SUMMARY_SELECT = `
  SELECT b.id, b.public_code, b.starts_at, b.duration_min, b.price, b.addons, b.notes, b.gallery_url,
         b.created_at, b.updated_at,
         c.id AS client_id, c.name AS client_name, c.phone, c.email,
         c.telegram_username, c.instagram,
         s.id AS service_id, s.name AS service_name,
         p.id AS package_id, p.name AS package_name,
         st.id AS status_id, st.name AS status_name, st.color AS status_color,
         st.is_initial, st.is_final, st.is_cancelled, st.sort_order AS status_order
  FROM bookings b
  LEFT JOIN clients c ON c.id = b.client_id
  LEFT JOIN services s ON s.id = b.service_id
  LEFT JOIN packages p ON p.id = b.package_id
  LEFT JOIN statuses st ON st.id = b.status_id
`;

function parseAddons(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.public_code,
    startsAt: row.starts_at,
    localDate: toLocalDate(row.starts_at),
    duration: row.duration_min,
    price: row.price,
    addons: parseAddons(row.addons),
    notes: row.notes,
    galleryUrl: row.gallery_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    client: row.client_id
      ? {
          id: row.client_id,
          name: row.client_name,
          phone: row.phone,
          email: row.email,
          telegram: row.telegram_username,
          instagram: row.instagram
        }
      : null,
    service: row.service_id ? { id: row.service_id, name: row.service_name } : null,
    package: row.package_id ? { id: row.package_id, name: row.package_name } : null,
    status: row.status_id
      ? {
          id: row.status_id,
          name: row.status_name,
          color: row.status_color,
          isInitial: Boolean(row.is_initial),
          isFinal: Boolean(row.is_final),
          isCancelled: Boolean(row.is_cancelled),
          order: row.status_order
        }
      : null
  };
}

export function getBookingById(id) {
  return mapBooking(db.prepare(`${SUMMARY_SELECT} WHERE b.id = ? AND b.deleted_at IS NULL`).get(id));
}

export function listBookings({ start, end, pendingOnly = false, order = 'ASC', limit = 100 } = {}) {
  const clauses = ['b.deleted_at IS NULL', 'COALESCE(st.is_cancelled, 0) = 0'];
  const params = [];
  if (start) {
    clauses.push('b.starts_at >= ?');
    params.push(start);
  }
  if (end) {
    clauses.push('b.starts_at < ?');
    params.push(end);
  }
  if (pendingOnly) clauses.push('st.is_initial = 1');
  const rows = db
    .prepare(`${SUMMARY_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY b.starts_at ${order === 'DESC' ? 'DESC' : 'ASC'} LIMIT ?`)
    .all(...params, limit);
  return rows.map(mapBooking);
}

function rangeStats(range) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(b.price), 0) AS revenue
       FROM bookings b
       LEFT JOIN statuses st ON st.id = b.status_id
       WHERE b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0
         AND b.starts_at >= ? AND b.starts_at < ?`
    )
    .get(range.start, range.end);
  return { count: row.count, revenue: Math.round(row.revenue) };
}

function newClients(range) {
  return db
    .prepare(
      `SELECT COUNT(*) AS count FROM clients
       WHERE deleted_at IS NULL AND date(created_at) >= date(?) AND date(created_at) < date(?)`
    )
    .get(range.start, range.end).count;
}

function trend(value, previous) {
  if (!previous) return value > 0 ? 100 : 0;
  return Math.round(((value - previous) / previous) * 100);
}

export function calendarMonth(month) {
  const safeMonth = isValidMonth(month) ? month : currentMonth();
  const range = monthRange(safeMonth);
  const bookings = listBookings({ start: range.start, end: range.end, limit: 500 });
  const days = {};
  for (const booking of bookings) {
    const key = booking.localDate;
    if (!days[key]) days[key] = { count: 0, pending: 0 };
    days[key].count += 1;
    if (booking.status?.isInitial) days[key].pending += 1;
  }
  return {
    month: safeMonth,
    today: localToday(),
    days,
    items: bookings.map((booking) => ({
      id: booking.id,
      localDate: booking.localDate,
      startsAt: booking.startsAt,
      clientName: booking.client?.name || 'Клиент',
      statusName: booking.status?.name || '',
      statusColor: booking.status?.color || '#2563eb',
      isInitial: Boolean(booking.status?.isInitial),
      price: booking.price
    }))
  };
}

export function revenueBreakdown(month) {
  const [year, m] = month.split('-').map(Number);
  const total = monthDays(month);
  const edges = [1, 8, 15, 22, 29, total + 1].filter((value, index, all) => index === 0 || value > all[index - 1]);
  const buckets = [];
  for (let i = 0; i < edges.length - 1; i++) {
    buckets.push({
      label: `${edges[i]}–${edges[i + 1] - 1}`,
      from: edges[i],
      to: edges[i + 1] - 1,
      current: 0,
      previous: 0
    });
  }

  const currentRange = monthRange(month);
  const previousRange = monthRange(shiftMonth(month, -1));
  const currentBookings = listBookings({ start: currentRange.start, end: currentRange.end, limit: 500 });
  const previousBookings = listBookings({ start: previousRange.start, end: previousRange.end, limit: 500 });

  const bucketFor = (localDate) => {
    const day = Number(localDate.slice(8, 10));
    return buckets.find((bucket) => day >= bucket.from && day <= bucket.to);
  };

  for (const booking of currentBookings) {
    const bucket = bucketFor(booking.localDate);
    if (bucket) bucket.current += booking.price;
  }
  for (const booking of previousBookings) {
    const bucket = bucketFor(booking.localDate);
    if (bucket) bucket.previous += booking.price;
  }

  return {
    month,
    weeks: buckets.map(({ label, current, previous }) => ({
      label,
      current: Math.round(current),
      previous: Math.round(previous)
    })),
    total: Math.round(buckets.reduce((sum, bucket) => sum + bucket.current, 0)),
    previousTotal: Math.round(buckets.reduce((sum, bucket) => sum + bucket.previous, 0)),
    bookingCount: currentBookings.length
  };
}

export function buildDashboard(month = currentMonth()) {
  const safeMonth = isValidMonth(month) ? month : currentMonth();
  const thisMonth = currentMonth();
  const currentRange = monthRange(thisMonth);
  const previousRange = monthRange(shiftMonth(thisMonth, -1));

  const current = rangeStats(currentRange);
  const previous = rangeStats(previousRange);
  const currentClients = newClients(currentRange);
  const previousClients = newClients(previousRange);
  const currentAvg = current.count ? Math.round(current.revenue / current.count) : 0;
  const previousAvg = previous.count ? Math.round(previous.revenue / previous.count) : 0;

  const today = localToday();
  const dayStart = new Date(`${today}T00:00:00.000Z`).getTime() - TZ_MS;
  const todayBookings = listBookings({
    start: new Date(dayStart).toISOString(),
    end: new Date(dayStart + 86400000).toISOString(),
    limit: 30
  });

  const pending = listBookings({ pendingOnly: true, limit: 12 });

  const nextRows = db
    .prepare(
      `${SUMMARY_SELECT}
       WHERE b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0
         AND b.starts_at > ? AND st.is_initial = 0
       ORDER BY b.starts_at ASC LIMIT 1`
    )
    .all(new Date().toISOString());
  const next = nextRows.length ? mapBooking(nextRows[0]) : null;

  const revenue = revenueBreakdown(thisMonth);

  return {
    month: thisMonth,
    today,
    metrics: {
      bookings: { value: current.count, previous: previous.count, delta: trend(current.count, previous.count) },
      revenue: { value: current.revenue, previous: previous.revenue, delta: trend(current.revenue, previous.revenue) },
      avgCheck: { value: currentAvg, previous: previousAvg, delta: trend(currentAvg, previousAvg) },
      clients: { value: currentClients, previous: previousClients, delta: trend(currentClients, previousClients) }
    },
    todayBookings,
    pending,
    next,
    calendar: calendarMonth(safeMonth),
    revenue,
    generatedAt: new Date().toISOString()
  };
}
