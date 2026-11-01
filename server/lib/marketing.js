import crypto from 'node:crypto';
import { db, logActivity } from '../db.js';

const MAX_NAME = 90;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function toIso(value) {
  if (!value) return null;
  if (String(value).includes('T')) return new Date(value).toISOString();
  return new Date(`${String(value).replace(' ', 'T')}Z`).toISOString();
}

function dayKey(value = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function randomCode(length = 8, group = 4) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out.match(new RegExp(`.{1,${group}}`, 'g')).join('-');
}

function uniqueCode(table, length, group) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = randomCode(length, group);
    const exists = db.prepare(`SELECT 1 FROM ${table} WHERE UPPER(code) = ?`).get(code);
    if (!exists) return code;
  }
  return `${randomCode(length, group)}-${Date.now().toString().slice(-3)}`;
}

function normalizeCode(value, { allowEmpty = false } = {}) {
  const clean = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
  if (!clean && !allowEmpty) return null;
  return clean || null;
}

function validDay(value) {
  if (!value) return null;
  const clean = String(value).slice(0, 10);
  return DAY_RE.test(clean) ? clean : null;
}

function fail(status, error, message, field) {
  return { status, body: { error, message, ...(field ? { field } : {}) } };
}

/* ------------------------------ скидки ------------------------------ */

function statusOfDiscount(row, today) {
  if (!row.is_active) return 'off';
  if (row.starts_on && String(row.starts_on).slice(0, 10) > today) return 'scheduled';
  if (row.ends_on && String(row.ends_on).slice(0, 10) < today) return 'expired';
  return 'active';
}

function mapDiscount(row, today = dayKey()) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    value: Number(row.value),
    scope: row.scope,
    itemIds: parseJson(row.item_ids, []),
    minAmount: round(row.min_amount),
    audience: row.audience,
    auto: Boolean(row.auto),
    stackable: Boolean(row.stackable),
    priority: Number(row.priority),
    startsOn: row.starts_on ? String(row.starts_on).slice(0, 10) : null,
    endsOn: row.ends_on ? String(row.ends_on).slice(0, 10) : null,
    isActive: Boolean(row.is_active),
    usedCount: Number(row.used_count),
    note: row.note,
    status: statusOfDiscount(row, today),
    applied: round(
      db
        .prepare(
          `SELECT COALESCE(SUM(discount_amount), 0) AS s FROM bookings
           WHERE discount_id = ? AND deleted_at IS NULL`
        )
        .get(row.id).s
    ),
    coupons: db.prepare('SELECT COUNT(*) AS n FROM coupons WHERE discount_id = ? AND deleted_at IS NULL').get(row.id).n,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

export function listDiscounts() {
  const today = dayKey();
  const rows = db.prepare('SELECT * FROM discounts WHERE deleted_at IS NULL ORDER BY priority DESC, id DESC').all();
  const items = rows.map((row) => mapDiscount(row, today));
  return {
    items,
    counts: {
      all: items.length,
      active: items.filter((item) => item.status === 'active').length,
      off: items.filter((item) => item.status !== 'active').length,
      saved: items.reduce((sum, item) => sum + item.applied, 0)
    }
  };
}

function discountPayload(body = {}) {
  const name = String(body.name || '').trim().slice(0, MAX_NAME);
  if (name.length < 2) return { error: fail(422, 'invalid_name', 'Укажите название скидки', 'name') };
  const kind = body.kind === 'fixed' ? 'fixed' : 'percent';
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) return { error: fail(422, 'invalid_value', 'Размер скидки больше нуля', 'value') };
  if (kind === 'percent' && value > 100) return { error: fail(422, 'invalid_value', 'Процент не больше 100', 'value') };

  const scope = ['all', 'service', 'package'].includes(body.scope) ? body.scope : 'all';
  const ids = Array.isArray(body.itemIds) ? body.itemIds.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  if (scope !== 'all' && ids.length === 0) {
    return { error: fail(422, 'no_items', 'Выберите услуги или пакеты', 'itemIds') };
  }

  const startsOn = validDay(body.startsOn);
  const endsOn = validDay(body.endsOn);
  if (startsOn && endsOn && endsOn < startsOn) {
    return { error: fail(422, 'invalid_period', 'Дата окончания раньше начала', 'endsOn') };
  }

  return {
    payload: {
      name,
      kind,
      value: kind === 'percent' ? Math.min(value, 100) : value,
      scope,
      item_ids: JSON.stringify(scope === 'all' ? [] : ids),
      min_amount: Math.max(round(body.minAmount), 0),
      audience: ['all', 'vip', 'repeat', 'new'].includes(body.audience) ? body.audience : 'all',
      auto: body.auto === false ? 0 : 1,
      stackable: body.stackable ? 1 : 0,
      priority: Number.isFinite(Number(body.priority)) ? Math.round(Number(body.priority)) : 0,
      starts_on: startsOn,
      ends_on: endsOn,
      is_active: body.isActive === false ? 0 : 1,
      note: body.note ? String(body.note).trim().slice(0, 300) : null
    }
  };
}

export function createDiscount(body) {
  const parsed = discountPayload(body);
  if (parsed.error) return parsed.error;
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO discounts (name, kind, value, scope, item_ids, min_amount, audience, auto, stackable,
                              priority, starts_on, ends_on, is_active, note, created_at, updated_at)
       VALUES (@name, @kind, @value, @scope, @item_ids, @min_amount, @audience, @auto, @stackable,
               @priority, @starts_on, @ends_on, @is_active, @note, @created_at, @updated_at)`
    )
    .run({ ...parsed.payload, created_at: now, updated_at: now });
  const row = db.prepare('SELECT * FROM discounts WHERE id = ?').get(info.lastInsertRowid);
  logActivity({ type: 'marketing', title: 'Создана скидка', description: row.name, entity: 'discount', entityId: row.id });
  return { status: 201, body: { discount: mapDiscount(row) } };
}

export function updateDiscount(id, body) {
  const row = db.prepare('SELECT * FROM discounts WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!row) return fail(404, 'not_found', 'Скидка не найдена');
  const parsed = discountPayload({ ...mapDiscount(row), ...body });
  if (parsed.error) return parsed.error;
  const info = db
    .prepare(
      `UPDATE discounts SET name = @name, kind = @kind, value = @value, scope = @scope, item_ids = @item_ids,
              min_amount = @min_amount, audience = @audience, auto = @auto, stackable = @stackable,
              priority = @priority, starts_on = @starts_on, ends_on = @ends_on, is_active = @is_active,
              note = @note, updated_at = @updated_at
       WHERE id = @id`
    )
    .run({ ...parsed.payload, updated_at: new Date().toISOString(), id });
  const fresh = db.prepare('SELECT * FROM discounts WHERE id = ?').get(id);
  logActivity({ type: 'marketing', title: 'Скидка обновлена', description: fresh.name, entity: 'discount', entityId: id });
  return { status: 200, body: { discount: mapDiscount(fresh), changed: info.changes } };
}

export function deleteDiscount(id) {
  const row = db.prepare('SELECT * FROM discounts WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!row) return fail(404, 'not_found', 'Скидка не найдена');
  db.transaction(() => {
    db.prepare('UPDATE discounts SET deleted_at = ?, is_active = 0 WHERE id = ?').run(new Date().toISOString(), id);
    db.prepare('UPDATE coupons SET is_active = 0, discount_id = NULL WHERE discount_id = ?').run(id);
  })();
  logActivity({ type: 'marketing', title: 'Скидка удалена', description: row.name, entity: 'discount', entityId: id });
  return { status: 200, body: { ok: true, id } };
}

/* ------------------------------ промокоды ------------------------------ */

function couponStatus(row, today) {
  if (!row.is_active) return 'off';
  if (row.ends_on && String(row.ends_on).slice(0, 10) < today) return 'expired';
  if (Number(row.limit_total) > 0 && Number(row.used_count) >= Number(row.limit_total)) return 'exhausted';
  if (row.starts_on && String(row.starts_on).slice(0, 10) > today) return 'scheduled';
  return 'active';
}

function mapCoupon(row, today = dayKey()) {
  const linked = row.discount_id
    ? db.prepare('SELECT name FROM discounts WHERE id = ?').get(row.discount_id)?.name || null
    : null;
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    kind: row.kind,
    value: Number(row.value),
    discountId: row.discount_id,
    discountName: linked,
    limitTotal: Number(row.limit_total),
    limitPerClient: Number(row.limit_per_client),
    usedCount: Number(row.used_count),
    minAmount: round(row.min_amount),
    startsOn: row.starts_on ? String(row.starts_on).slice(0, 10) : null,
    endsOn: row.ends_on ? String(row.ends_on).slice(0, 10) : null,
    isActive: Boolean(row.is_active),
    note: row.note,
    status: couponStatus(row, today),
    saved: round(
      db.prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM coupon_redemptions WHERE coupon_id = ?').get(row.id).s
    ),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

export function listCoupons({ status = 'all', q = '' } = {}) {
  const today = dayKey();
  const term = String(q || '').trim().toLowerCase();
  let items = db
    .prepare('SELECT * FROM coupons WHERE deleted_at IS NULL ORDER BY datetime(created_at) DESC, id DESC')
    .all()
    .map((row) => mapCoupon(row, today));

  const counts = {
    all: items.length,
    active: items.filter((item) => item.status === 'active').length,
    used: items.filter((item) => item.usedCount > 0).length,
    exhausted: items.filter((item) => item.status === 'exhausted' || item.status === 'expired').length
  };

  if (status === 'active') items = items.filter((item) => item.status === 'active');
  if (status === 'used') items = items.filter((item) => item.usedCount > 0);
  if (status === 'off') items = items.filter((item) => item.status !== 'active');
  if (term) {
    items = items.filter((item) =>
      `${item.code} ${item.title || ''} ${item.note || ''} ${item.discountName || ''}`.toLowerCase().includes(term)
    );
  }

  return { items, counts, status, total: items.length };
}

function couponPayload(body = {}, { creating }) {
  const codeProvided = String(body.code || '').trim();
  const code = creating && !codeProvided ? uniqueCode('coupons', 8, 4) : normalizeCode(codeProvided);
  if (!code) return { error: fail(422, 'invalid_code', 'Промокод: латинские буквы и цифры', 'code') };

  const duplicate = db
    .prepare('SELECT id FROM coupons WHERE UPPER(code) = ? AND deleted_at IS NULL AND id <> ?')
    .get(code, Number(body.id) || 0);
  if (duplicate) return { error: fail(409, 'code_taken', 'Такой промокод уже есть', 'code') };

  const discountId = body.discountId ? Number(body.discountId) : null;
  const linked = discountId
    ? db.prepare('SELECT id, kind, value FROM discounts WHERE id = ? AND deleted_at IS NULL').get(discountId)
    : null;
  if (discountId && !linked) return { error: fail(422, 'unknown_discount', 'Скидка не найдена', 'discountId') };

  const kind = linked ? linked.kind : body.kind === 'fixed' ? 'fixed' : 'percent';
  const rawValue = linked ? Number(linked.value) : Number(body.value);
  if (!linked && (!Number.isFinite(rawValue) || rawValue <= 0)) {
    return { error: fail(422, 'invalid_value', 'Размер скидки больше нуля', 'value') };
  }
  if (!linked && kind === 'percent' && rawValue > 100) {
    return { error: fail(422, 'invalid_value', 'Процент не больше 100', 'value') };
  }

  const startsOn = validDay(body.startsOn);
  const endsOn = validDay(body.endsOn);
  if (startsOn && endsOn && endsOn < startsOn) {
    return { error: fail(422, 'invalid_period', 'Дата окончания раньше начала', 'endsOn') };
  }

  return {
    payload: {
      code,
      title: body.title ? String(body.title).trim().slice(0, MAX_NAME) : null,
      kind,
      value: kind === 'percent' ? Math.min(rawValue, 100) : rawValue,
      discount_id: linked ? linked.id : null,
      limit_total: Math.max(round(body.limitTotal), 0),
      limit_per_client: Math.max(round(body.limitPerClient), 1),
      min_amount: Math.max(round(body.minAmount), 0),
      starts_on: startsOn,
      ends_on: endsOn,
      is_active: body.isActive === false ? 0 : 1,
      note: body.note ? String(body.note).trim().slice(0, 300) : null
    }
  };
}

export function createCoupon(body) {
  const parsed = couponPayload(body, { creating: true });
  if (parsed.error) return parsed.error;
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO coupons (code, title, kind, value, discount_id, limit_total, limit_per_client, min_amount,
                            starts_on, ends_on, is_active, note, created_at, updated_at)
       VALUES (@code, @title, @kind, @value, @discount_id, @limit_total, @limit_per_client, @min_amount,
               @starts_on, @ends_on, @is_active, @note, @created_at, @updated_at)`
    )
    .run({ ...parsed.payload, created_at: now, updated_at: now });
  const row = db.prepare('SELECT * FROM coupons WHERE id = ?').get(info.lastInsertRowid);
  logActivity({ type: 'marketing', title: 'Создан промокод', description: row.code, entity: 'coupon', entityId: row.id });
  return { status: 201, body: { coupon: mapCoupon(row) } };
}

export function updateCoupon(id, body) {
  const row = db.prepare('SELECT * FROM coupons WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!row) return fail(404, 'not_found', 'Промокод не найден');
  const parsed = couponPayload({ ...mapCoupon(row), ...body, id }, { creating: false });
  if (parsed.error) return parsed.error;
  db.prepare(
    `UPDATE coupons SET code = @code, title = @title, kind = @kind, value = @value, discount_id = @discount_id,
            limit_total = @limit_total, limit_per_client = @limit_per_client, min_amount = @min_amount,
            starts_on = @starts_on, ends_on = @ends_on, is_active = @is_active, note = @note, updated_at = @updated_at
     WHERE id = @id`
  ).run({ ...parsed.payload, updated_at: new Date().toISOString(), id });
  const fresh = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
  return { status: 200, body: { coupon: mapCoupon(fresh) } };
}

export function deleteCoupon(id) {
  const row = db.prepare('SELECT * FROM coupons WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!row) return fail(404, 'not_found', 'Промокод не найден');
  db.prepare('UPDATE coupons SET deleted_at = ?, is_active = 0 WHERE id = ?').run(new Date().toISOString(), id);
  logActivity({ type: 'marketing', title: 'Промокод удалён', description: row.code, entity: 'coupon', entityId: id });
  return { status: 200, body: { ok: true, id } };
}

/* ------------------------------ сертификаты ------------------------------ */

function certificateStatus(row, today) {
  if (row.status === 'blocked') return 'blocked';
  if (Number(row.remaining) <= 0) return 'used';
  if (row.expires_at && String(row.expires_at).slice(0, 10) < today) return 'expired';
  return 'active';
}

function mapCertificate(row, today = dayKey()) {
  const service = row.service_id
    ? db.prepare('SELECT id, name FROM services WHERE id = ?').get(row.service_id)
    : null;
  const history = db
    .prepare(
      `SELECT r.id, r.amount, r.created_at, b.public_code AS code, b.starts_at
       FROM certificate_redemptions r
       LEFT JOIN bookings b ON b.id = r.booking_id
       WHERE r.certificate_id = ? ORDER BY datetime(r.created_at) DESC LIMIT 10`
    )
    .all(row.id)
    .map((item) => ({
      id: item.id,
      amount: round(item.amount),
      createdAt: toIso(item.created_at),
      code: item.code,
      startsAt: toIso(item.starts_at)
    }));
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    amount: round(row.amount),
    remaining: round(row.remaining),
    spent: round(Number(row.amount) - Number(row.remaining)),
    serviceId: row.service_id,
    serviceName: service?.name || null,
    recipient: row.recipient,
    phone: row.phone,
    email: row.email,
    clientId: row.client_id,
    purchasedAt: row.purchased_at ? String(row.purchased_at).slice(0, 10) : null,
    expiresAt: row.expires_at ? String(row.expires_at).slice(0, 10) : null,
    status: certificateStatus(row, today),
    note: row.note,
    history,
    createdAt: toIso(row.created_at)
  };
}

export function listCertificates({ status = 'all', q = '' } = {}) {
  const today = dayKey();
  const term = String(q || '').trim().toLowerCase();
  let items = db
    .prepare('SELECT * FROM certificates WHERE deleted_at IS NULL ORDER BY datetime(created_at) DESC, id DESC')
    .all()
    .map((row) => mapCertificate(row, today));

  const counts = {
    all: items.length,
    active: items.filter((item) => item.status === 'active').length,
    used: items.filter((item) => item.status === 'used').length,
    expired: items.filter((item) => item.status === 'expired' || item.status === 'blocked').length,
    balance: items.filter((item) => item.status === 'active').reduce((sum, item) => sum + item.remaining, 0)
  };

  if (status === 'active') items = items.filter((item) => item.status === 'active');
  if (status === 'used') items = items.filter((item) => item.status === 'used');
  if (status === 'expired') items = items.filter((item) => item.status === 'expired' || item.status === 'blocked');
  if (term) {
    items = items.filter((item) =>
      `${item.code} ${item.recipient || ''} ${item.phone || ''} ${item.email || ''}`.toLowerCase().includes(term)
    );
  }

  return { items, counts, status, total: items.length, today };
}

function certificatePayload(body = {}, { creating, id }) {
  const codeProvided = String(body.code || '').trim();
  const code = creating && !codeProvided ? uniqueCode('certificates', 12, 4) : normalizeCode(codeProvided);
  if (!code) return { error: fail(422, 'invalid_code', 'Код сертификата: латинские буквы и цифры', 'code') };
  const duplicate = db
    .prepare('SELECT id FROM certificates WHERE REPLACE(UPPER(code), \' \', \'\') = ? AND deleted_at IS NULL AND id <> ?')
    .get(code, Number(id) || 0);
  if (duplicate) return { error: fail(409, 'code_taken', 'Такой сертификат уже есть', 'code') };

  const kind = body.kind === 'service' ? 'service' : 'amount';
  const amount = round(body.amount);
  const serviceId = body.serviceId ? Number(body.serviceId) : null;
  if (kind === 'amount' && amount <= 0) {
    return { error: fail(422, 'invalid_amount', 'Номинал сертификата больше нуля', 'amount') };
  }
  if (kind === 'service' && !serviceId) {
    return { error: fail(422, 'no_service', 'Выберите услугу для сертификата', 'serviceId') };
  }
  if (serviceId && !db.prepare('SELECT 1 FROM services WHERE id = ? AND deleted_at IS NULL').get(serviceId)) {
    return { error: fail(422, 'unknown_service', 'Услуга не найдена', 'serviceId') };
  }

  const purchasedAt = validDay(body.purchasedAt) || dayKey();
  const expiresAt = validDay(body.expiresAt);
  if (expiresAt && expiresAt < purchasedAt) {
    return { error: fail(422, 'invalid_period', 'Срок действия раньше даты покупки', 'expiresAt') };
  }

  return {
    payload: {
      code,
      kind,
      amount: kind === 'service' ? amount || 0 : amount,
      service_id: kind === 'service' ? serviceId : serviceId || null,
      recipient: body.recipient ? String(body.recipient).trim().slice(0, MAX_NAME) : null,
      phone: body.phone ? String(body.phone).trim().slice(0, 40) : null,
      email: body.email ? String(body.email).trim().slice(0, 120) : null,
      purchased_at: purchasedAt,
      expires_at: expiresAt,
      note: body.note ? String(body.note).trim().slice(0, 300) : null
    }
  };
}

export function createCertificate(body) {
  const parsed = certificatePayload(body, { creating: true });
  if (parsed.error) return parsed.error;
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO certificates (code, kind, amount, remaining, service_id, recipient, phone, email,
                                 purchased_at, expires_at, status, note, created_at, updated_at)
       VALUES (@code, @kind, @amount, @amount, @service_id, @recipient, @phone, @email,
               @purchased_at, @expires_at, 'active', @note, @created_at, @updated_at)`
    )
    .run({ ...parsed.payload, created_at: now, updated_at: now });
  const row = db.prepare('SELECT * FROM certificates WHERE id = ?').get(info.lastInsertRowid);
  logActivity({
    type: 'marketing',
    title: 'Выпущен сертификат',
    description: `${row.code}${row.recipient ? ` · ${row.recipient}` : ''}`,
    entity: 'certificate',
    entityId: row.id
  });
  return { status: 201, body: { certificate: mapCertificate(row) } };
}

export function updateCertificate(id, body) {
  const row = db.prepare('SELECT * FROM certificates WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!row) return fail(404, 'not_found', 'Сертификат не найден');

  if (body.status && ['active', 'blocked'].includes(body.status)) {
    db.prepare('UPDATE certificates SET status = ?, updated_at = ? WHERE id = ?').run(
      body.status,
      new Date().toISOString(),
      id
    );
  }

  const current = mapCertificate(db.prepare('SELECT * FROM certificates WHERE id = ?').get(id));
  const touchingMain = ['code', 'kind', 'amount', 'serviceId', 'recipient', 'phone', 'email', 'purchasedAt', 'expiresAt', 'note'].some(
    (key) => body[key] !== undefined
  );
  if (touchingMain) {
    const parsed = certificatePayload({ ...current, ...body, purchasedAt: body.purchasedAt ?? current.purchasedAt }, { creating: false, id });
    if (parsed.error) return parsed.error;
    const spent = Math.max(Number(row.amount) - Number(row.remaining), 0);
    const remaining = Math.max(parsed.payload.amount - spent, 0);
    db.prepare(
      `UPDATE certificates SET code = @code, kind = @kind, amount = @amount, remaining = @remaining,
              service_id = @service_id, recipient = @recipient, phone = @phone, email = @email,
              purchased_at = @purchased_at, expires_at = @expires_at, note = @note, updated_at = @updated_at
       WHERE id = @id`
    ).run({ ...parsed.payload, remaining, updated_at: new Date().toISOString(), id });
  }

  const fresh = db.prepare('SELECT * FROM certificates WHERE id = ?').get(id);
  return { status: 200, body: { certificate: mapCertificate(fresh) } };
}

export function deleteCertificate(id) {
  const row = db.prepare('SELECT * FROM certificates WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!row) return fail(404, 'not_found', 'Сертификат не найден');
  if (Number(row.remaining) < Number(row.amount)) {
    return fail(409, 'already_used', 'Сертификат уже использован — удалить нельзя, можно заблокировать');
  }
  db.prepare('UPDATE certificates SET deleted_at = ?, status = ? WHERE id = ?').run(
    new Date().toISOString(),
    'blocked',
    id
  );
  logActivity({ type: 'marketing', title: 'Сертификат удалён', description: row.code, entity: 'certificate', entityId: id });
  return { status: 200, body: { ok: true, id } };
}

/* ------------------------------ сводка ------------------------------ */

export function marketingOverview() {
  const today = dayKey();
  const month = `${today.slice(0, 7)}`;
  const discounts = listDiscounts();
  const coupons = listCoupons();
  const certificates = listCertificates();
  const monthSaved = round(
    db
      .prepare(
        `SELECT COALESCE(SUM(discount_amount), 0) AS s FROM bookings
         WHERE deleted_at IS NULL AND substr(starts_at, 1, 7) = ?`
      )
      .get(month).s
  );
  const issued = round(
    db.prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM certificates WHERE deleted_at IS NULL').get().s
  );
  return {
    month,
    saved: monthSaved,
    discounts: discounts.counts,
    coupons: coupons.counts,
    certificates: certificates.counts,
    issued,
    topCoupons: coupons.items
      .filter((item) => item.usedCount > 0)
      .sort((a, b) => b.usedCount - a.usedCount)
      .slice(0, 3)
      .map((item) => ({ id: item.id, code: item.code, usedCount: item.usedCount, saved: item.saved }))
  };
}

/* ------------------------------ списание при записи ------------------------------ */

/** Фиксирует использование промокода и сертификата. Вызывается внутри транзакции записи. */
export function redeemPromo({ quote, bookingId, clientId, phone }) {
  const result = { coupon: null, certificate: null };
  if (!quote?.promo) return result;
  const now = new Date().toISOString();

  if (quote.promo.type === 'coupon') {
    db.prepare('UPDATE coupons SET used_count = used_count + 1, updated_at = ? WHERE id = ?').run(now, quote.promo.id);
    db.prepare(
      `INSERT INTO coupon_redemptions (coupon_id, booking_id, client_id, phone, amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(quote.promo.id, bookingId, clientId || null, phone ? String(phone).replace(/\D/g, '') : null, quote.promo.amount, now);
    result.coupon = quote.promo;
  }

  if (quote.promo.type === 'certificate') {
    const row = db.prepare('SELECT * FROM certificates WHERE id = ?').get(quote.promo.id);
    if (row) {
      const remaining = Math.max(Number(row.remaining) - quote.promo.amount, 0);
      db.prepare('UPDATE certificates SET remaining = ?, status = ?, updated_at = ? WHERE id = ?').run(
        remaining,
        remaining <= 0 ? 'used' : row.status,
        now,
        row.id
      );
      db.prepare(
        `INSERT INTO certificate_redemptions (certificate_id, booking_id, client_id, amount, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(row.id, bookingId, clientId || null, quote.promo.amount, now);
      result.certificate = { ...quote.promo, remaining };
    }
  }

  if (quote.discount?.id) {
    db.prepare('UPDATE discounts SET used_count = used_count + 1, updated_at = ? WHERE id = ?').run(
      now,
      quote.discount.id
    );
  }

  return result;
}

export const CODE_PREVIEW = { coupon: () => uniqueCode('coupons', 8, 4), certificate: () => uniqueCode('certificates', 12, 4) };
