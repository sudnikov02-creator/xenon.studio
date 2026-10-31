import { db } from '../db.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const ADDON_TYPES = ['toggle', 'quantity'];

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function clampNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeAddons(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && typeof item === 'object')
    .slice(0, 12)
    .map((item, index) => {
      const type = ADDON_TYPES.includes(item.type) ? item.type : 'toggle';
      return {
        id: typeof item.id === 'string' && item.id ? item.id.slice(0, 40) : `addon-${index + 1}`,
        name: String(item.name || '').trim().slice(0, 60) || `Опция ${index + 1}`,
        type,
        price: Math.max(0, Math.round(clampNumber(item.price, 0))),
        ...(type === 'quantity' ? { unit: String(item.unit || 'шт').trim().slice(0, 12) || 'шт' } : {})
      };
    });
}

export function mapService(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    price: Math.round(row.price),
    duration: row.duration_min,
    buffer: row.buffer_min,
    addons: parseJson(row.addons, []),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    bookings: row.bookings ?? 0,
    createdAt: row.created_at
  };
}

export function mapPackage(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    price: Math.round(row.price),
    serviceIds: parseJson(row.service_ids, []).map(Number).filter(Boolean),
    addons: parseJson(row.addons, []),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    bookings: row.bookings ?? 0,
    createdAt: row.created_at
  };
}

export function listServices({ includeArchived = false } = {}) {
  const rows = db
    .prepare(
      `SELECT s.*, (
         SELECT COUNT(*) FROM bookings b WHERE b.service_id = s.id AND b.deleted_at IS NULL
       ) AS bookings
       FROM services s
       WHERE ${includeArchived ? '1 = 1' : 's.deleted_at IS NULL'}
       ORDER BY s.sort_order ASC, s.id ASC`
    )
    .all();
  return rows.map(mapService);
}

export function listPackages({ includeArchived = false } = {}) {
  const rows = db
    .prepare(
      `SELECT p.*, (
         SELECT COUNT(*) FROM bookings b WHERE b.package_id = p.id AND b.deleted_at IS NULL
       ) AS bookings
       FROM packages p
       WHERE ${includeArchived ? '1 = 1' : 'p.deleted_at IS NULL'}
       ORDER BY p.sort_order ASC, p.id ASC`
    )
    .all();
  return rows.map(mapPackage);
}

function validateCommon(payload, { hasDuration = false } = {}) {
  const name = String(payload.name || '').trim();
  if (name.length < 2) return { error: 'Введите название — минимум 2 символа', field: 'name' };
  if (name.length > 80) return { error: 'Название длиннее 80 символов', field: 'name' };

  const price = clampNumber(payload.price, NaN);
  if (!Number.isFinite(price) || price < 0) return { error: 'Укажите цену числом', field: 'price' };
  if (price > 10_000_000) return { error: 'Слишком большая цена', field: 'price' };

  const description = String(payload.description || '').trim().slice(0, 600);

  if (hasDuration) {
    const duration = Math.round(clampNumber(payload.duration, 0));
    if (duration < 15 || duration > 1440) return { error: 'Длительность — от 15 до 1440 минут', field: 'duration' };
    const buffer = Math.round(clampNumber(payload.buffer, 0));
    if (buffer < 0 || buffer > 240) return { error: 'Буфер — от 0 до 240 минут', field: 'buffer' };
    return { value: { name, price, description, duration, buffer } };
  }

  return { value: { name, price, description } };
}

export function saveService(payload, id = null) {
  const base = validateCommon(payload, { hasDuration: true });
  if (base.error) return base;
  const { name, price, description, duration, buffer } = base.value;
  const addons = JSON.stringify(normalizeAddons(payload.addons));
  const isActive = payload.isActive === undefined ? 1 : payload.isActive ? 1 : 0;

  if (id) {
    const existing = db.prepare('SELECT id FROM services WHERE id = ? AND deleted_at IS NULL').get(id);
    if (!existing) return { notFound: true };
    db.prepare(
      `UPDATE services SET name = ?, description = ?, price = ?, duration_min = ?, buffer_min = ?,
         addons = ?, is_active = ? WHERE id = ?`
    ).run(name, description, price, duration, buffer, addons, isActive, id);
    return { service: mapService(db.prepare('SELECT * FROM services WHERE id = ?').get(id)) };
  }

  const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM services').get().next;
  const info = db
    .prepare(
      `INSERT INTO services (name, description, price, duration_min, buffer_min, addons, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, description, price, duration, buffer, addons, isActive, nextOrder);
  return { service: mapService(db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid)) };
}

export function savePackage(payload, id = null) {
  const base = validateCommon(payload);
  if (base.error) return base;
  const { name, price, description } = base.value;
  const addons = JSON.stringify(normalizeAddons(payload.addons));
  const isActive = payload.isActive === undefined ? 1 : payload.isActive ? 1 : 0;
  const ids = Array.isArray(payload.serviceIds) ? payload.serviceIds.map(Number).filter(Boolean) : [];
  const known = ids.length
    ? db
        .prepare(`SELECT id FROM services WHERE deleted_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`)
        .all(...ids)
        .map((row) => row.id)
    : [];
  if (ids.length > 0 && known.length === 0) {
    return { error: 'Выберите хотя бы одну услугу из списка', field: 'serviceIds' };
  }
  const serviceIds = JSON.stringify(known);

  if (id) {
    const existing = db.prepare('SELECT id FROM packages WHERE id = ? AND deleted_at IS NULL').get(id);
    if (!existing) return { notFound: true };
    db.prepare(
      `UPDATE packages SET name = ?, description = ?, price = ?, service_ids = ?, addons = ?, is_active = ?
       WHERE id = ?`
    ).run(name, description, price, serviceIds, addons, isActive, id);
    return { package: mapPackage(db.prepare('SELECT * FROM packages WHERE id = ?').get(id)) };
  }

  const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM packages').get().next;
  const info = db
    .prepare(
      `INSERT INTO packages (name, description, price, service_ids, addons, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, description, price, serviceIds, addons, isActive, nextOrder);
  return { package: mapPackage(db.prepare('SELECT * FROM packages WHERE id = ?').get(info.lastInsertRowid)) };
}

export function archiveRow(kind, id) {
  const table = kind === 'package' ? 'packages' : 'services';
  const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id);
  if (!existing) return false;
  db.prepare(`UPDATE ${table} SET deleted_at = ?, is_active = 0 WHERE id = ?`).run(new Date().toISOString(), id);
  return true;
}

export function reorderRows(kind, ids) {
  const table = kind === 'package' ? 'packages' : 'services';
  const statement = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ? AND deleted_at IS NULL`);
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Boolean))];
  const run = db.transaction(() => {
    unique.forEach((id, index) => statement.run(index, id));
  });
  run();
  return unique.length;
}

export function shiftRow(kind, id, direction) {
  const list = kind === 'package' ? listPackages() : listServices();
  const index = list.findIndex((row) => row.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return false;
  const ordered = [...list];
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  reorderRows(kind, ordered.map((row) => row.id));
  return true;
}

export function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function duplicateRow(kind, id) {
  if (kind === 'package') {
    const row = db.prepare('SELECT * FROM packages WHERE id = ? AND deleted_at IS NULL').get(id);
    if (!row) return { notFound: true };
    return savePackage({
      name: `${row.name} (копия)`.slice(0, 80),
      description: row.description,
      price: row.price,
      serviceIds: parseJson(row.service_ids, []),
      addons: parseJson(row.addons, []),
      isActive: false
    });
  }
  const row = db.prepare('SELECT * FROM services WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!row) return { notFound: true };
  return saveService({
    name: `${row.name} (копия)`.slice(0, 80),
    description: row.description,
    price: row.price,
    duration: row.duration_min,
    buffer: row.buffer_min,
    addons: parseJson(row.addons, []),
    isActive: false
  });
}
