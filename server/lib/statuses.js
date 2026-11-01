import { db, logActivity } from '../db.js';

const MAX_NAME = 40;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const MAX_ACTIONS = 8;

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/** Быстрые действия статуса (используются в карточке записи в следующих этапах). */
function normalizeActions(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && typeof item === 'object')
    .slice(0, MAX_ACTIONS)
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id ? item.id.slice(0, 40) : `action-${index + 1}`,
      label: String(item.label || '').trim().slice(0, 40),
      kind: ['message', 'note', 'gallery'].includes(item.kind) ? item.kind : 'message'
    }))
    .filter((item) => item.label);
}

export function mapStatus(row, counts = {}) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    order: row.sort_order,
    isInitial: Boolean(row.is_initial),
    isFinal: Boolean(row.is_final),
    isCancelled: Boolean(row.is_cancelled),
    clientCanReschedule: Boolean(row.client_can_reschedule),
    clientCanCancel: Boolean(row.client_can_cancel),
    actions: parseJson(row.actions, []),
    bookings: counts.total ?? 0,
    upcoming: counts.upcoming ?? 0,
    createdAt: row.created_at
  };
}

function countFor(statusId, todayIso) {
  return db
    .prepare(
      `SELECT
         SUM(CASE WHEN b.deleted_at IS NULL THEN 1 ELSE 0 END) AS total,
         SUM(CASE WHEN b.deleted_at IS NULL AND b.starts_at >= ? THEN 1 ELSE 0 END) AS upcoming
       FROM bookings b WHERE b.status_id = ?`
    )
    .get(todayIso, statusId);
}

export function listStatuses() {
  const rows = db
    .prepare('SELECT * FROM statuses WHERE deleted_at IS NULL ORDER BY sort_order ASC, id ASC')
    .all();
  const nowIso = new Date().toISOString();
  const statuses = rows.map((row) => {
    const counts = countFor(row.id, nowIso) || { total: 0, upcoming: 0 };
    return mapStatus(row, { total: Number(counts.total) || 0, upcoming: Number(counts.upcoming) || 0 });
  });
  const archived = db
    .prepare('SELECT COUNT(*) AS n FROM statuses WHERE deleted_at IS NOT NULL')
    .get().n;
  return {
    statuses,
    total: statuses.reduce((sum, item) => sum + item.bookings, 0),
    archived,
    initialId: statuses.find((item) => item.isInitial)?.id ?? null,
    cancelledId: statuses.find((item) => item.isCancelled)?.id ?? null
  };
}

function validate(payload, { current = null } = {}) {
  const name = String(payload?.name ?? current?.name ?? '').trim();
  if (!name) return { field: 'name', error: 'Название статуса не может быть пустым' };
  if (name.length > MAX_NAME) return { field: 'name', error: `Название — не длиннее ${MAX_NAME} символов` };

  const duplicate = db
    .prepare('SELECT id FROM statuses WHERE deleted_at IS NULL AND LOWER(name) = LOWER(?) AND id <> ?')
    .get(name, current?.id ?? 0);
  if (duplicate) return { field: 'name', error: 'Такой статус уже есть' };

  const color = String(payload?.color ?? current?.color ?? '').trim();
  if (!COLOR_RE.test(color)) return { field: 'color', error: 'Выберите цвет статуса' };

  return {
    value: {
      name,
      color: color.toLowerCase(),
      isInitial: payload?.isInitial === undefined ? Boolean(current?.is_initial) : payload.isInitial === true,
      isFinal: payload?.isFinal === undefined ? Boolean(current?.is_final) : payload.isFinal === true,
      isCancelled:
        payload?.isCancelled === undefined ? Boolean(current?.is_cancelled) : payload.isCancelled === true,
      clientCanReschedule:
        payload?.clientCanReschedule === undefined
          ? current
            ? Boolean(current.client_can_reschedule)
            : true
          : payload.clientCanReschedule === true,
      clientCanCancel:
        payload?.clientCanCancel === undefined
          ? current
            ? Boolean(current.client_can_cancel)
            : true
          : payload.clientCanCancel === true,
      actions: payload?.actions === undefined ? parseJson(current?.actions, []) : normalizeActions(payload.actions)
    }
  };
}

/** Один стартовый и один «отменяющий» статус: остальные сбрасываем. */
function applyUniqueFlags(id, flags) {
  if (flags.isInitial) {
    db.prepare('UPDATE statuses SET is_initial = 0 WHERE id <> ? AND is_initial = 1').run(id);
  }
  if (flags.isCancelled) {
    db.prepare('UPDATE statuses SET is_cancelled = 0 WHERE id <> ? AND is_cancelled = 1').run(id);
  }
}

function liveStatuses() {
  return db
    .prepare('SELECT * FROM statuses WHERE deleted_at IS NULL ORDER BY sort_order ASC, id ASC')
    .all();
}

export function createStatus(payload) {
  const checked = validate(payload);
  if (checked.error) return checked;

  const list = liveStatuses();
  if (list.length >= 20) return { field: 'name', error: 'Больше 20 статусов не поддерживается' };

  const maxOrder = list.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0);
  const value = checked.value;
  const info = db
    .prepare(
      `INSERT INTO statuses (name, color, sort_order, is_initial, is_final, is_cancelled,
                             client_can_reschedule, client_can_cancel, actions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      value.name,
      value.color,
      maxOrder + 10,
      value.isInitial ? 1 : 0,
      value.isFinal ? 1 : 0,
      value.isCancelled ? 1 : 0,
      value.clientCanReschedule ? 1 : 0,
      value.clientCanCancel ? 1 : 0,
      JSON.stringify(value.actions)
    );
  const id = Number(info.lastInsertRowid);
  applyUniqueFlags(id, value);
  logActivity({ type: 'settings', title: 'Статус создан', description: value.name, entity: 'status', entityId: id });
  return { status: mapStatus(db.prepare('SELECT * FROM statuses WHERE id = ?').get(id)), ...listStatuses() };
}

export function updateStatus(id, payload) {
  const current = db.prepare('SELECT * FROM statuses WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!current) return { notFound: true };
  const checked = validate(payload, { current });
  if (checked.error) return checked;
  const value = checked.value;

  if (current.is_initial && value.isInitial === false) {
    const others = liveStatuses().filter((row) => row.id !== current.id);
    if (!others.length) return { field: 'isInitial', error: 'Должен остаться хотя бы один стартовый статус' };
    const bookings = db
      .prepare("SELECT COUNT(*) AS n FROM bookings b JOIN statuses st ON st.id = b.status_id WHERE b.status_id = ? AND st.is_initial = 1 AND b.deleted_at IS NULL")
      .get(current.id).n;
    if (bookings > 0) {
      return {
        field: 'isInitial',
        error: 'В этом статусе есть записи — сначала переведите их, потом снимите флаг'
      };
    }
  }
  if (current.is_cancelled && value.isCancelled === false) {
    const others = liveStatuses().filter((row) => row.id !== current.id);
    if (!others.length) return { field: 'isCancelled', error: 'Должен остаться хотя бы один статус отмены' };
  }

  db.prepare(
    `UPDATE statuses SET name = ?, color = ?, is_initial = ?, is_final = ?, is_cancelled = ?,
            client_can_reschedule = ?, client_can_cancel = ?, actions = ?
     WHERE id = ?`
  ).run(
    value.name,
    value.color,
    value.isInitial ? 1 : 0,
    value.isFinal ? 1 : 0,
    value.isCancelled ? 1 : 0,
    value.clientCanReschedule ? 1 : 0,
    value.clientCanCancel ? 1 : 0,
    JSON.stringify(value.actions),
    current.id
  );
  applyUniqueFlags(current.id, value);
  logActivity({
    type: 'settings',
    title: 'Статус обновлён',
    description: value.name,
    entity: 'status',
    entityId: current.id
  });
  return { status: mapStatus(db.prepare('SELECT * FROM statuses WHERE id = ?').get(current.id)), ...listStatuses() };
}

export function reorderStatuses(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { field: 'ids', error: 'Некорректный порядок' };
  const live = liveStatuses();
  const liveIds = live.map((row) => row.id);
  const isCancelled = new Set(live.filter((row) => row.is_cancelled).map((row) => row.id));
  const ordered = ids.map(Number).filter((id) => liveIds.includes(id));
  for (const id of liveIds) if (!ordered.includes(id)) ordered.push(id);
  // Статусы отмены всегда в конце цепочки — чтобы не разрывать рабочий поток.
  const final = ordered.filter((id) => isCancelled.has(id));
  const main = ordered.filter((id) => !isCancelled.has(id));
  ordered.length = 0;
  ordered.push(...main, ...final);
  const commit = db.transaction(() => {
    ordered.forEach((id, index) => {
      db.prepare('UPDATE statuses SET sort_order = ? WHERE id = ?').run((index + 1) * 10, id);
    });
  });
  commit();
  return { ...listStatuses() };
}

export function shiftStatus(id, direction) {
  const list = listStatuses().statuses;
  const index = list.findIndex((row) => row.id === Number(id));
  const target = index + (Number(direction) === -1 ? -1 : 1);
  if (index < 0 || target < 0 || target >= list.length) return { shifted: false, ...listStatuses() };
  const ordered = [...list];
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  reorderStatuses(ordered.map((row) => row.id));
  return { shifted: true, ...listStatuses() };
}

/**
 * Удаление статуса: записи переводим в целевой статус (по умолчанию — первый живой),
 * чтобы в базе не оставалось «подвешенных» записей.
 */
export function deleteStatus(id, { moveTo } = {}) {
  const current = db.prepare('SELECT * FROM statuses WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!current) return { notFound: true };

  const others = liveStatuses().filter((row) => row.id !== current.id);
  if (!others.length) return { field: 'id', error: 'Нельзя удалить единственный статус' };

  const target = others.find((row) => row.id === Number(moveTo)) || others[0];
  if (current.is_initial && target.is_cancelled) {
    return { field: 'moveTo', error: 'Записи нельзя перевести в статус отмены' };
  }

  const affected = db
    .prepare('SELECT id, public_code FROM bookings WHERE status_id = ? AND deleted_at IS NULL')
    .all(current.id);

  const now = new Date().toISOString();
  const commit = db.transaction(() => {
    for (const booking of affected) {
      db.prepare('UPDATE bookings SET status_id = ?, updated_at = ? WHERE id = ?').run(target.id, now, booking.id);
      db.prepare(
        'INSERT INTO booking_events (booking_id, type, title, message, actor) VALUES (?, ?, ?, ?, ?)'
      ).run(booking.id, 'status', `Статус изменён: ${target.name}`, `Статус «${current.name}» удалён`, 'photographer');
    }
    db.prepare('UPDATE statuses SET deleted_at = ? WHERE id = ?').run(now, current.id);
    if (current.is_initial) {
      db.prepare('UPDATE statuses SET is_initial = 1 WHERE id = ?').run(target.id);
    }
    if (current.is_cancelled) {
      const fallback = liveStatuses().find((row) => row.is_cancelled) || others.find((row) => row.id !== target.id);
      if (fallback && !fallback.is_cancelled) {
        db.prepare('UPDATE statuses SET is_cancelled = 1 WHERE id = ?').run(fallback.id);
      }
    }
  });
  commit();

  logActivity({
    type: 'settings',
    title: 'Статус удалён',
    description: `${current.name} → ${target.name}`,
    entity: 'status',
    entityId: current.id
  });

  return { removed: current.id, movedTo: target.id, moved: affected.length, ...listStatuses() };
}

export function normaliseStatusName(value) {
  return String(value || '').trim().slice(0, MAX_NAME);
}
