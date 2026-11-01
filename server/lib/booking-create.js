import { db, getSettings, logActivity } from '../db.js';
import { broadcast, broadcastBadges } from './sse.js';
import { getBookingById } from './bookings.js';
import { makePublicCode } from './seed.js';
import { collectItem, isValidDateKey, isoForLocal, localKeyOf, slotsForDate } from './slots.js';
import { normalizePhone, prettyPhone, checkToken, consumeToken } from './verification.js';
import { priceForBooking, priceAddons as priceAddonLines } from './pricing.js';
import { redeemPromo } from './marketing.js';
import { attachReferral, spendBonus } from './loyalty.js';

const MAX_NAME = 80;
const MAX_NOTE = 600;
const MAX_ADDON_QTY = 20;

export function initialStatus() {
  return db
    .prepare('SELECT id FROM statuses WHERE is_initial = 1 AND deleted_at IS NULL ORDER BY sort_order LIMIT 1')
    .get();
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function findClient(phone, email) {
  const rows = db
    .prepare('SELECT id, phone, email FROM clients WHERE deleted_at IS NULL ORDER BY id DESC')
    .all();
  const phoneDigits = digits(phone);
  if (phoneDigits) {
    const byPhone = rows.find((row) => digits(row.phone) === phoneDigits);
    if (byPhone) return byPhone.id;
  }
  if (email) {
    const byEmail = rows.find((row) => row.email && row.email.toLowerCase() === String(email).toLowerCase());
    if (byEmail) return byEmail.id;
  }
  return null;
}

function upsertClient({ name, phone, email, instagram, note, isAdmin }) {
  const existing = findClient(phone, email);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(
      `UPDATE clients SET
         name = COALESCE(NULLIF(?, ''), name),
         phone = COALESCE(NULLIF(?, ''), phone),
         email = COALESCE(NULLIF(?, ''), email),
         instagram = COALESCE(NULLIF(?, ''), instagram),
         updated_at = ?
       WHERE id = ?`
    ).run(name, phone, email || '', instagram || '', now, existing);
    if (note) {
      db.prepare('UPDATE clients SET notes = COALESCE(notes, ?) WHERE id = ? AND notes IS NULL').run(note, existing);
    }
    return { id: existing, created: false };
  }
  const info = db
    .prepare(
      `INSERT INTO clients (name, phone, email, instagram, notes, created_at, updated_at, is_vip)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .run(name, phone || null, email || null, instagram || null, note || null, now, now);
  return { id: Number(info.lastInsertRowid), created: true };
}

/* Цены и опции считает общий движок — тот же, что показывает формула на сайте. */
function priceAddons(addons, requested) {
  return priceAddonLines(addons, requested);
}

export function validatePayload(payload) {
  const errors = {};
  const name = String(payload?.name || '').trim();
  if (name.length < 2) errors.name = 'Укажите имя — минимум 2 символа';
  if (name.length > MAX_NAME) errors.name = 'Слишком длинное имя';

  const phone = normalizePhone(payload?.phone);
  if (!phone) errors.phone = 'Введите номер телефона полностью';

  const email = String(payload?.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[a-zA-Zа-яА-Я]{2,}$/.test(email)) errors.email = 'Проверьте адрес почты';

  const note = String(payload?.note || '').trim();
  if (note.length > MAX_NOTE) errors.note = 'Заметка слишком длинная';

  const serviceId = payload?.serviceId ? Number(payload.serviceId) : null;
  const packageId = payload?.packageId ? Number(payload.packageId) : null;
  if (!serviceId && !packageId) errors.service = 'Выберите услугу или пакет';
  if (serviceId && packageId) errors.service = 'Выберите что-то одно';

  const date = String(payload?.date || '');
  const time = String(payload?.time || '');
  if (!isValidDateKey(date)) errors.slot = 'Выберите дату съёмки';
  else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.slot = 'Выберите время съёмки';

  return { errors, name, phone, email, note, serviceId, packageId, date, time };
}

export function addonsTotalPreview(item, requested) {
  return priceAddons(item.addons, requested);
}

/**
 * Создание записи. Проверяет слот ещё раз внутри транзакции — так двойная запись невозможна
 * даже если два клиента выбрали одно время одновременно.
 */
export function createBooking({ payload, source = 'client', verificationToken, force = false }) {
  const settings = getSettings();
  const schedule = settings.schedule;
  const { errors, name, phone, email, note, serviceId, packageId, date, time } = validatePayload(payload);
  if (Object.keys(errors).length) {
    return { status: 422, body: { error: 'validation_failed', message: 'Проверьте поля формы', fields: errors } };
  }

  const item = collectItem({ serviceId, packageId });
  if (!item) {
    return { status: 404, body: { error: 'service_not_found', message: 'Услуга недоступна для записи' } };
  }

  const isClient = source === 'client';
  if (isClient && !schedule.accepting) {
    return { status: 409, body: { error: 'not_accepting', message: 'Онлайн-запись временно закрыта' } };
  }
  if (isClient && settings.bookingForm?.requireVerification && !checkToken(phone, verificationToken)) {
    return {
      status: 403,
      body: { error: 'phone_not_verified', message: 'Подтвердите номер телефона, чтобы завершить запись' }
    };
  }
  if (isClient && settings.agreement?.enabled && settings.agreement?.consentText && payload?.agreed !== true) {
    return { status: 422, body: { error: 'agreement_required', message: 'Нужно согласие с условиями' } };
  }

  const startsAt = isoForLocal(date, time);
  const available = slotsForDate(schedule, item, date, {
    ignoreNotice: !isClient || force,
    force: force || !isClient,
    step: settings.bookingForm?.slotStepMin || 30
  });
  if (!force && !available.some((slot) => slot.iso === startsAt)) {
    return {
      status: 409,
      body: { error: 'slot_taken', message: 'Это время только что заняли. Выберите другое' }
    };
  }

  const { addons } = priceAddons(item.addons, payload?.addons);
  const useBonus = payload?.useBonus === true;
  const quote = priceForBooking({
    serviceId,
    packageId,
    addons,
    code: payload?.promoCode || payload?.code,
    phone,
    clientId: null,
    useBonus,
    bonusRequested: payload?.bonusAmount
  });
  if (quote.error) {
    return { status: 404, body: { error: quote.error, message: quote.message } };
  }
  if (quote.promoError) {
    return { status: 422, body: { error: 'promo_invalid', message: quote.promoError, field: 'promoCode' } };
  }
  const price = quote.price;
  const status = initialStatus();
  if (!status) {
    return { status: 500, body: { error: 'no_initial_status', message: 'Не настроены статусы записей' } };
  }

  const now = new Date().toISOString();
  let bookingId = null;
  let clientId = null;

  const commit = db.transaction(() => {
    const busy = db
      .prepare(
        `SELECT COUNT(*) AS n FROM bookings b
         LEFT JOIN statuses st ON st.id = b.status_id
         WHERE b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0
           AND b.starts_at < ? AND datetime(b.starts_at, '+' || b.duration_min || ' minutes') > ?`
      )
      .get(new Date(new Date(startsAt).getTime() + item.duration * 60000).toISOString(), startsAt).n;
    if (busy > 0) throw new Error('slot_taken');

    const client = upsertClient({
      name,
      phone,
      email,
      instagram: payload?.instagram,
      note,
      isAdmin: !isClient
    });
    clientId = client.id;

    const info = db
      .prepare(
        `INSERT INTO bookings (public_code, client_id, service_id, package_id, starts_at, duration_min,
                               price, list_price, discount_amount, discount_id, coupon_id, coupon_code,
                               certificate_id, certificate_code, addons, status_id, source, notes, client_note,
                               bonus_spent, referral_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
      )
      .run(
        makePublicCode(),
        client.id,
        serviceId,
        packageId,
        startsAt,
        item.duration,
        price,
        quote.listPrice,
        quote.listPrice - price,
        quote.discount?.id ?? null,
        quote.promo?.type === 'coupon' ? quote.promo.id : null,
        quote.promo?.type === 'coupon' ? quote.promo.code : null,
        quote.promo?.type === 'certificate' ? quote.promo.id : null,
        quote.promo?.type === 'certificate' ? quote.promo.code : null,
        JSON.stringify(addons),
        status.id,
        source,
        note || null,
        quote.bonus?.used ? quote.bonus.applied : 0,
        payload?.ref ? String(payload.ref).trim().toUpperCase().slice(0, 12) : null,
        now,
        now
      );
    bookingId = Number(info.lastInsertRowid);

    db.prepare(
      `INSERT INTO booking_events (booking_id, type, title, message, actor)
       VALUES (?, 'created', ?, ?, ?)`
    ).run(
      bookingId,
      isClient ? 'Клиент отправил заявку' : 'Запись создана фотографом',
      `${item.name} · ${item.duration} мин · ${price}${quote.discountTotal > 0 ? ` · скидка ${quote.discountTotal}` : ''}`,
      isClient ? 'client' : 'photographer'
    );

    redeemPromo({ quote, bookingId, clientId: client.id, phone });

    if (quote.bonus?.used && quote.bonus.applied > 0) {
      spendBonus({
        clientId: client.id,
        bookingId,
        amount: quote.bonus.applied,
        reason: 'Оплата баллами'
      });
    }

    if (payload?.ref) {
      attachReferral({
        bookingId,
        clientId: client.id,
        phone,
        name,
        refCode: payload.ref
      });
    }

    db.prepare(
      `INSERT INTO notifications (kind, title, subtitle, action_label, action_url, is_read)
       VALUES ('booking', ?, ?, 'Открыть записи', '/admin/bookings', 0)`
    ).run(
      isClient ? 'Новая заявка на съёмку' : 'Добавлена запись',
      `${name} · ${prettyPhone(phone)} · ${item.name}`
    );

    logActivity({
      type: 'booking',
      title: isClient ? 'Новая заявка с сайта' : 'Запись создана вручную',
      description: `${name} · ${item.name}`,
      entity: 'booking',
      entityId: bookingId,
      actor: isClient ? 'client' : 'photographer'
    });

    if (client.created) {
      logActivity({
        type: 'client',
        title: 'Новый клиент',
        description: `${name} · ${prettyPhone(phone)}`,
        entity: 'client',
        entityId: client.id,
        actor: isClient ? 'client' : 'photographer'
      });
    }
  });

  try {
    commit();
  } catch (err) {
    if (err?.message === 'slot_taken') {
      return { status: 409, body: { error: 'slot_taken', message: 'Это время только что заняли. Выберите другое' } };
    }
    throw err;
  }

  if (isClient) consumeToken(phone, verificationToken);

  broadcast('booking', { id: bookingId, action: 'created', source });
  broadcastBadges();

  return {
    status: 201,
    body: {
      booking: getBookingById(bookingId),
      clientId,
      message: isClient ? 'Заявка отправлена фотографу' : 'Запись создана',
      localDate: localKeyOf(startsAt)
    }
  };
}
