import { db, getSettings } from '../db.js';

/**
 * Движок цен. Один расчёт используется и публичной формой, и панелью, и созданием записи,
 * поэтому скидка на экране всегда совпадает со скидкой в базе.
 *
 * Порядок применения:
 *   1. базовая цена услуги или пакета + опции;
 *   2. автоматические скидки (VIP, лояльность, акции) — берётся самая крупная;
 *   3. промокод — считается от остатка;
 *   4. сертификат — списывается с остатка.
 */

const MAX_ADDON_QTY = 20;

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function dayKey(value = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function round(value) {
  return Math.round(Number(value) || 0);
}

/* --- товар и опции --- */

export function itemSnapshot({ serviceId, packageId }) {
  if (serviceId) {
    const row = db
      .prepare(
        `SELECT id, name, price, duration_min AS duration, addons FROM services
         WHERE id = ? AND deleted_at IS NULL AND is_active = 1`
      )
      .get(Number(serviceId));
    if (!row) return null;
    return { kind: 'service', id: row.id, name: row.name, price: round(row.price), duration: row.duration, addons: parseJson(row.addons, []) };
  }
  if (packageId) {
    const row = db
      .prepare(
        `SELECT id, name, price, duration_min AS duration, addons FROM packages
         WHERE id = ? AND deleted_at IS NULL AND is_active = 1`
      )
      .get(Number(packageId));
    if (!row) return null;
    return { kind: 'package', id: row.id, name: row.name, price: round(row.price), duration: row.duration, addons: parseJson(row.addons, []) };
  }
  return null;
}

export function priceAddons(addonList, requested) {
  const list = Array.isArray(requested) ? requested : [];
  const chosen = [];
  let extra = 0;
  for (const item of list) {
    const source = addonList.find((addon) => addon.id === item?.id || addon.name === item?.name);
    if (!source) continue;
    if (source.type === 'quantity') {
      const qty = Math.max(0, Math.min(MAX_ADDON_QTY, Math.round(Number(item.qty) || 0)));
      if (!qty) continue;
      chosen.push({ id: source.id, name: source.name, type: 'quantity', price: round(source.price), unit: source.unit || 'шт', qty });
      extra += round(source.price) * qty;
    } else if (item.selected !== false && item.qty !== 0) {
      chosen.push({ id: source.id, name: source.name, type: 'toggle', price: round(source.price), qty: 1 });
      extra += round(source.price);
    }
  }
  return { addons: chosen, extra: round(extra) };
}

/* --- клиент: статус, история --- */

function clientSnapshot(clientId) {
  if (!clientId) return null;
  const row = db
    .prepare(
      `SELECT id, name, is_vip, is_blacklisted,
              (SELECT COUNT(*) FROM bookings b
                 LEFT JOIN statuses st ON st.id = b.status_id
                 WHERE b.client_id = c.id AND b.deleted_at IS NULL AND st.is_final = 1) AS completed
       FROM clients c WHERE c.id = ? AND c.deleted_at IS NULL`
    )
    .get(Number(clientId));
  if (!row) return null;
  return { id: row.id, name: row.name, isVip: Boolean(row.is_vip), isBlacklisted: Boolean(row.is_blacklisted), completed: row.completed };
}

function clientByPhone(phone) {
  const target = digits(phone);
  if (target.length < 6) return null;
  const rows = db.prepare('SELECT id, phone FROM clients WHERE deleted_at IS NULL').all();
  const found = rows.find((row) => digits(row.phone) === target);
  return found ? clientSnapshot(found.id) : null;
}

/* --- скидки --- */

function discountActive(row, today) {
  if (!row.is_active || row.deleted_at) return false;
  if (row.starts_on && String(row.starts_on).slice(0, 10) > today) return false;
  if (row.ends_on && String(row.ends_on).slice(0, 10) < today) return false;
  return true;
}

function discountFits(row, { subtotal, item, client }) {
  if (subtotal <= 0) return false;
  if (round(row.min_amount) > subtotal) return false;

  const ids = parseJson(row.item_ids, []);
  if (row.scope === 'service' && (!item || item.kind !== 'service' || !ids.includes(item.id))) return false;
  if (row.scope === 'package' && (!item || item.kind !== 'package' || !ids.includes(item.id))) return false;

  if (row.audience === 'vip' && !client?.isVip) return false;
  if (row.audience === 'repeat' && (!client || client.completed < 1)) return false;
  if (row.audience === 'new' && client && client.completed > 0) return false;
  return true;
}

function discountAmount(row, base) {
  if (row.kind === 'fixed') return Math.min(round(row.value), base);
  const percent = Math.min(Math.max(Number(row.value) || 0, 0), 100);
  return Math.min(round((base * percent) / 100), base);
}

function autoDiscounts({ subtotal, item, client, today }) {
  const settings = getSettings();
  const found = [];

  if (client?.isVip && settings.vipDiscount?.enabled) {
    const percent = Math.min(Math.max(Number(settings.vipDiscount.percent) || 0, 0), 100);
    const amount = Math.min(round((subtotal * percent) / 100), subtotal);
    if (amount > 0) {
      found.push({ source: 'vip', id: null, name: 'Скидка VIP-клиента', kind: 'percent', value: percent, amount });
    }
  }

  const loyalty = settings.loyalty;
  if (loyalty?.enabled && client && client.completed >= Math.max(Number(loyalty.afterSessions) || 0, 1)) {
    const percent = Math.min(Math.max(Number(loyalty.percent) || 0, 0), 100);
    const amount = Math.min(round((subtotal * percent) / 100), subtotal);
    if (amount > 0) {
      found.push({
        source: 'loyalty',
        id: null,
        name: `Скидка постоянного клиента · ${client.completed} съёмок`,
        kind: 'percent',
        value: percent,
        amount
      });
    }
  }

  const rows = db
    .prepare('SELECT * FROM discounts WHERE deleted_at IS NULL AND is_active = 1 AND auto = 1 ORDER BY priority DESC, id ASC')
    .all();
  for (const row of rows) {
    if (!discountActive(row, today)) continue;
    if (!discountFits(row, { subtotal, item, client })) continue;
    const amount = discountAmount(row, subtotal);
    if (amount <= 0) continue;
    found.push({ source: 'discount', id: row.id, name: row.name, kind: row.kind, value: Number(row.value), amount });
  }

  return found.sort((a, b) => b.amount - a.amount);
}

/* --- промокоды --- */

function findCoupon(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  return db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ? AND deleted_at IS NULL').get(clean);
}

function couponProblem(row, { subtotal, today, phone }) {
  if (!row) return 'Промокод не найден';
  if (!row.is_active) return 'Промокод больше не действует';
  if (row.starts_on && String(row.starts_on).slice(0, 10) > today) return 'Промокод ещё не начал действовать';
  if (row.ends_on && String(row.ends_on).slice(0, 10) < today) return 'Срок действия промокода истёк';
  if (Number(row.limit_total) > 0 && Number(row.used_count) >= Number(row.limit_total)) {
    return 'Лимит использований промокода исчерпан';
  }
  if (round(row.min_amount) > subtotal) {
    return `Промокод действует от ${round(row.min_amount)}`;
  }
  const limitPerClient = Number(row.limit_per_client) || 0;
  if (limitPerClient > 0 && phone) {
    const used = db
      .prepare('SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ? AND phone = ?')
      .get(row.id, digits(phone)).n;
    if (used >= limitPerClient) return 'Вы уже использовали этот промокод';
  }
  return null;
}

function couponAmount(row, base) {
  if (row.discount_id) {
    const linked = db.prepare('SELECT * FROM discounts WHERE id = ? AND deleted_at IS NULL').get(row.discount_id);
    if (linked) return discountAmount(linked, base);
  }
  return discountAmount(row, base);
}

/* --- сертификаты --- */

function findCertificate(code) {
  const clean = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!clean) return null;
  return db.prepare("SELECT * FROM certificates WHERE REPLACE(UPPER(code), ' ', '') = ? AND deleted_at IS NULL").get(clean);
}

function certificateProblem(row, today) {
  if (!row) return 'Сертификат не найден';
  if (row.status === 'blocked') return 'Сертификат заблокирован';
  if (row.status === 'used') return 'Сертификат уже использован';
  if (row.expires_at && String(row.expires_at).slice(0, 10) < today) return 'Срок действия сертификата истёк';
  if (round(row.remaining) <= 0) return 'На сертификате не осталось средств';
  return null;
}

/* --- публичный расчёт --- */

export function quote({ serviceId, packageId, addons, code, phone, clientId, date } = {}) {
  const today = dayKey(date ? new Date(`${String(date).slice(0, 10)}T00:00:00.000Z`) : new Date());
  const item = itemSnapshot({ serviceId, packageId });
  if (!item) {
    return { error: 'service_not_found', message: 'Услуга недоступна для записи' };
  }

  const priced = priceAddons(item.addons, addons);
  const base = item.price;
  const extras = priced.extra;
  const subtotal = base + extras;

  const client = clientSnapshot(clientId) || clientByPhone(phone);
  const candidates = autoDiscounts({ subtotal, item, client, today });
  const best = candidates[0] || null;
  const discountTotal = best ? best.amount : 0;
  const afterDiscount = Math.max(subtotal - discountTotal, 0);

  let promo = null;
  let promoError = null;
  const rawCode = String(code || '').trim();
  if (rawCode) {
    const coupon = findCoupon(rawCode);
    if (coupon) {
      promoError = couponProblem(coupon, { subtotal, today, phone });
      if (!promoError) {
        const amount = Math.min(couponAmount(coupon, afterDiscount), afterDiscount);
        if (amount <= 0) promoError = 'Промокод не даёт скидку для этой услуги';
        else {
          promo = {
            type: 'coupon',
            id: coupon.id,
            code: coupon.code,
            label: coupon.title || `Промокод ${coupon.code}`,
            kind: coupon.kind,
            value: Number(coupon.value),
            amount
          };
        }
      }
    } else {
      const certificate = findCertificate(rawCode);
      if (certificate) {
        promoError = certificateProblem(certificate, today);
        if (!promoError) {
          const coverBase = certificate.kind === 'service' && certificate.service_id && certificate.service_id !== item.id;
          if (coverBase) {
            promoError = 'Сертификат действует на другую услугу';
          } else {
            const amount = Math.min(round(certificate.remaining), afterDiscount);
            if (amount <= 0) promoError = 'На сертификате не осталось средств';
            else {
              promo = {
                type: 'certificate',
                id: certificate.id,
                code: certificate.code,
                label: certificate.kind === 'service' ? 'Подарочный сертификат на услугу' : 'Подарочный сертификат',
                amount
              };
            }
          }
        }
      } else {
        promoError = 'Промокод или сертификат не найден';
      }
    }
  }

  const promoAmount = promo ? promo.amount : 0;
  const total = Math.max(afterDiscount - promoAmount, 0);

  return {
    item: { kind: item.kind, id: item.id, name: item.name, price: base, duration: item.duration },
    lines: priced.addons.map((line) => ({ id: line.id, name: line.name, qty: line.qty, total: line.price * line.qty })),
    base,
    extras,
    subtotal,
    discount: best,
    discountAlternatives: candidates.slice(1, 4),
    discountTotal,
    promo,
    promoError,
    afterDiscount,
    total,
    today
  };
}

/** Для записи: то, что нужно записать в брони, промокоды и сертификаты. */
export function priceForBooking({ serviceId, packageId, addons, code, phone, clientId }) {
  const result = quote({ serviceId, packageId, addons, code, phone, clientId });
  if (result.error) return result;
  return {
    ...result,
    price: result.total,
    listPrice: result.subtotal,
    addons: priceAddons(itemSnapshot({ serviceId, packageId })?.addons || [], addons).addons
  };
}
