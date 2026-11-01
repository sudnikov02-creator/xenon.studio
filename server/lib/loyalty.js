import crypto from 'node:crypto';
import { db, getSettings, saveSettings, logActivity, normalizeMarketing } from '../db.js';

/**
 * Программа лояльности — один из двух режимов: бонусы или рефералы.
 * Баллы живут в отдельном счёте клиента, начисления и списания — только через транзакции,
 * поэтому баланс всегда можно пересчитать и показать историю.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_REASON = 160;
const MAX_NAME = 80;

function dayKey(value = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function addDays(day, days) {
  const base = new Date(`${day}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function still(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, MAX_REASON) : fallback;
}

/* ------------------------------ настройки ------------------------------ */

export function loyaltySettings() {
  return getSettings().marketing;
}

export function saveLoyaltySettings(patch = {}) {
  const current = loyaltySettings();
  const merged = normalizeMarketing(
    {
      ...current,
      ...(patch.mode ? { mode: patch.mode } : {}),
      bonus: { ...current.bonus, ...(patch.bonus || {}) },
      referral: { ...current.referral, ...(patch.referral || {}) }
    },
    current
  );
  const saved = saveSettings({ marketing: merged });
  logActivity({
    type: 'marketing',
    title: 'Настройки лояльности обновлены',
    description: merged.mode === 'bonus' ? 'Режим: бонусы' : 'Режим: рефералы',
    entity: 'marketing'
  });
  return saved.marketing;
}

/* ------------------------------ счета клиентов ------------------------------ */

function ensureAccount(clientId) {
  db.prepare('INSERT OR IGNORE INTO bonus_accounts (client_id, balance, total_earned, total_spent) VALUES (?, 0, 0, 0)').run(
    clientId
  );
  return db.prepare('SELECT * FROM bonus_accounts WHERE client_id = ?').get(clientId);
}

export function bonusAvailable(clientId) {
  if (!clientId) return 0;
  const today = dayKey();
  const earned = round(
    db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS s FROM bonus_transactions
         WHERE client_id = ? AND amount > 0 AND (expires_at IS NULL OR expires_at >= ?)`
      )
      .get(clientId, today).s
  );
  const spent = round(
    db.prepare('SELECT COALESCE(SUM(-amount), 0) AS s FROM bonus_transactions WHERE client_id = ? AND amount < 0').get(clientId).s
  );
  return Math.max(earned - spent, 0);
}

function syncAccount(clientId) {
  ensureAccount(clientId);
  const today = dayKey();
  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN amount > 0 AND (expires_at IS NULL OR expires_at >= ?) THEN amount ELSE 0 END), 0) AS live,
         COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS earned,
         COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS spent
       FROM bonus_transactions WHERE client_id = ?`
    )
    .get(today, clientId);
  db.prepare('UPDATE bonus_accounts SET balance = ?, total_earned = ?, total_spent = ?, updated_at = ? WHERE client_id = ?').run(
    Math.max(round(totals.live) - round(totals.spent), 0),
    round(totals.earned),
    round(totals.spent),
    new Date().toISOString(),
    clientId
  );
  return Math.max(round(totals.live) - round(totals.spent), 0);
}

function writeTransaction({ clientId, bookingId = null, kind = 'earn', amount, reason, expiresAt = null }) {
  const value = round(amount);
  if (!clientId || value === 0) return null;
  const info = db
    .prepare(
      `INSERT INTO bonus_transactions (client_id, booking_id, kind, amount, reason, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(clientId, bookingId, kind, value, still(reason) || null, expiresAt, new Date().toISOString());
  syncAccount(clientId);
  return Number(info.lastInsertRowid);
}

export function addBonus(clientId, amount, reason) {
  return writeTransaction({ clientId, amount, kind: 'adjust', reason });
}

export function spendBonus({ clientId, bookingId, amount, reason }) {
  const available = bonusAvailable(clientId);
  const value = Math.min(round(amount), available);
  if (value <= 0) return 0;
  writeTransaction({ clientId, bookingId, kind: 'spend', amount: -value, reason: still(reason, 'Оплата баллами') });
  db.prepare('UPDATE bookings SET bonus_spent = ? WHERE id = ?').run(value, bookingId);
  return value;
}

/* ------------------------------ реферальные коды ------------------------------ */

function randomCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

export function clientRefCode(clientId) {
  const row = db.prepare('SELECT id, ref_code FROM clients WHERE id = ? AND deleted_at IS NULL').get(Number(clientId));
  if (!row) return null;
  if (row.ref_code) return row.ref_code;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = randomCode(6);
    const busy = db.prepare('SELECT 1 FROM clients WHERE ref_code = ?').get(code);
    if (busy) continue;
    db.prepare('UPDATE clients SET ref_code = ?, updated_at = ? WHERE id = ?').run(code, new Date().toISOString(), row.id);
    return code;
  }
  return null;
}

export function inviterByCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  return db.prepare('SELECT * FROM clients WHERE ref_code = ? AND deleted_at IS NULL').get(clean) || null;
}

/* ------------------------------ рефералы ------------------------------ */

const REFERRAL_STATUSES = ['pending', 'rewarded', 'cancelled'];

function referralStatus(value, fallback = 'all') {
  return REFERRAL_STATUSES.includes(value) ? value : fallback;
}

function mapReferral(row, today = dayKey()) {
  const inviter = db.prepare('SELECT id, name, phone, ref_code FROM clients WHERE id = ?').get(row.inviter_client_id);
  const invited = row.invited_client_id
    ? db.prepare('SELECT id, name, phone FROM clients WHERE id = ?').get(row.invited_client_id)
    : null;
  return {
    id: row.id,
    status: row.status,
    code: row.code || inviter?.ref_code || null,
    inviter: inviter
      ? { id: inviter.id, name: inviter.name, phone: inviter.phone, refCode: inviter.ref_code || null }
      : null,
    invited: {
      id: invited?.id || null,
      name: invited?.name || row.invited_name || 'Без имени',
      phone: invited?.phone || row.invited_phone || null
    },
    bookingId: row.booking_id,
    rewardInviter: round(row.reward_inviter),
    rewardInvited: round(row.reward_invited),
    note: row.note,
    rewardedAt: row.rewarded_at,
    createdAt: row.created_at,
    waitingDays: row.status === 'pending' ? Math.max(Math.floor((Date.parse(today) - Date.parse(String(row.created_at).slice(0, 10))) / 86400000), 0) : 0
  };
}

export function listReferrals({ status = 'all', q = '' } = {}) {
  const filter = referralStatus(status);
  const search = String(q || '').trim().toLowerCase();
  const rows = db.prepare('SELECT * FROM referrals ORDER BY created_at DESC, id DESC').all().map((row) => mapReferral(row));
  const items = rows.filter((item) => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (!search) return true;
    return [item.inviter?.name, item.invited.name, item.invited.phone, item.code]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search) || digits(value).includes(digits(search) || '\u0000'));
  });
  return {
    items,
    counts: {
      all: rows.length,
      pending: rows.filter((item) => item.status === 'pending').length,
      rewarded: rows.filter((item) => item.status === 'rewarded').length,
      cancelled: rows.filter((item) => item.status === 'cancelled').length
    },
    rewardTotal: rows.filter((item) => item.status === 'rewarded').reduce((sum, item) => sum + item.rewardInviter + item.rewardInvited, 0)
  };
}

function createReferralRow({ inviterClientId, invitedClientId, invitedName, invitedPhone, code, bookingId, note, status = 'pending' }) {
  const settings = loyaltySettings();
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO referrals (inviter_client_id, invited_client_id, invited_name, invited_phone, code, status,
                              booking_id, reward_inviter, reward_invited, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      inviterClientId,
      invitedClientId || null,
      invitedName ? String(invitedName).slice(0, MAX_NAME) : null,
      invitedPhone ? String(invitedPhone).slice(0, 40) : null,
      code || null,
      status,
      bookingId || null,
      settings.referral.rewardInviter,
      settings.referral.rewardInvited,
      note ? still(note) : null,
      now,
      now
    );
  return Number(info.lastInsertRowid);
}

export function createReferral(body = {}) {
  const inviterId = Number(body.inviterClientId);
  const inviter = db.prepare('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL').get(inviterId);
  if (!inviter) return { status: 422, body: { error: 'no_inviter', message: 'Выберите клиента, который рекомендует' } };
  const invitedName = String(body.invitedName || '').trim();
  if (invitedName.length < 2) {
    return { status: 422, body: { error: 'invalid_name', message: 'Укажите имя приглашённого', field: 'invitedName' } };
  }
  const invitedPhone = String(body.invitedPhone || '').trim();
  if (invitedPhone && digits(invitedPhone).length < 6) {
    return { status: 422, body: { error: 'invalid_phone', message: 'Проверьте телефон', field: 'invitedPhone' } };
  }
  const code = clientRefCode(inviterId);
  const id = createReferralRow({
    inviterClientId: inviterId,
    invitedName,
    invitedPhone: invitedPhone || null,
    code,
    note: body.note
  });
  logActivity({
    type: 'marketing',
    title: 'Добавлена рекомендация',
    description: `${inviter.name} → ${invitedName}`,
    entity: 'referral',
    entityId: id
  });
  return { status: 201, body: { referral: mapReferral(db.prepare('SELECT * FROM referrals WHERE id = ?').get(id)) } };
}

export function rewardReferral(id, { manual = true } = {}) {
  const row = db.prepare('SELECT * FROM referrals WHERE id = ?').get(Number(id));
  if (!row) return { status: 404, body: { error: 'not_found', message: 'Рекомендация не найдена' } };
  if (row.status === 'rewarded') return { status: 409, body: { error: 'already_rewarded', message: 'Вознаграждение уже начислено' } };
  if (row.status === 'cancelled') return { status: 409, body: { error: 'cancelled', message: 'Рекомендация отменена' } };

  const now = new Date().toISOString();
  const commit = db.transaction(() => {
    db.prepare("UPDATE referrals SET status = 'rewarded', rewarded_at = ?, updated_at = ? WHERE id = ?").run(now, now, row.id);
    if (round(row.reward_inviter) > 0) {
      writeTransaction({
        clientId: row.inviter_client_id,
        bookingId: row.booking_id,
        kind: 'referral',
        amount: round(row.reward_inviter),
        reason: 'Вознаграждение за рекомендацию'
      });
    }
    if (round(row.reward_invited) > 0 && row.invited_client_id) {
      writeTransaction({
        clientId: row.invited_client_id,
        bookingId: row.booking_id,
        kind: 'referral',
        amount: round(row.reward_invited),
        reason: 'Бонус за приглашение'
      });
    }
  });
  commit();
  const inviter = db.prepare('SELECT name FROM clients WHERE id = ?').get(row.inviter_client_id);
  logActivity({
    type: 'marketing',
    title: 'Начислено за рекомендацию',
    description: `${inviter?.name || 'Клиент'} · ${round(row.reward_inviter)} баллов`,
    entity: 'referral',
    entityId: row.id
  });
  return {
    status: 200,
    body: {
      referral: mapReferral(db.prepare('SELECT * FROM referrals WHERE id = ?').get(row.id)),
      manual
    }
  };
}

export function cancelReferral(id) {
  const row = db.prepare('SELECT * FROM referrals WHERE id = ?').get(Number(id));
  if (!row) return { status: 404, body: { error: 'not_found', message: 'Рекомендация не найдена' } };
  if (row.status === 'rewarded') {
    return { status: 409, body: { error: 'already_rewarded', message: 'Вознаграждение уже начислено — отменить нельзя' } };
  }
  db.prepare("UPDATE referrals SET status = 'cancelled', updated_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
  return { status: 200, body: { ok: true, id: row.id } };
}

/** Скидка приглашённому на первую съёмку — участвует в общем движке цен. */
export function referralDiscount(clientId) {
  if (!clientId) return null;
  const settings = loyaltySettings();
  if (settings.mode !== 'referral' || !settings.referral.enabled) return null;
  if (round(settings.referral.discountInvited) <= 0) return null;
  const row = db
    .prepare("SELECT * FROM referrals WHERE invited_client_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1")
    .get(Number(clientId));
  if (!row) return null;
  const inviter = db.prepare('SELECT name FROM clients WHERE id = ?').get(row.inviter_client_id);
  return {
    source: 'referral',
    id: row.id,
    name: inviter?.name ? `Приглашение от ${inviter.name}` : 'Скидка по приглашению',
    kind: 'fixed',
    value: round(settings.referral.discountInvited),
    amount: round(settings.referral.discountInvited)
  };
}

/** Привязка рекомендации при создании записи с реферальной ссылкой. */
export function attachReferral({ bookingId, clientId, phone, name, refCode }) {
  const settings = loyaltySettings();
  if (settings.mode !== 'referral' || !settings.referral.enabled) return null;
  const inviter = inviterByCode(refCode);
  if (!inviter) return null;
  if (Number(inviter.id) === Number(clientId)) return null;
  const exists = db.prepare('SELECT id FROM referrals WHERE invited_client_id = ?').get(Number(clientId));
  if (exists) return null;

  const greeted = round(settings.referral.rewardInvited) > 0;
  const immediate = settings.referral.trigger === 'signup';
  const id = createReferralRow({
    inviterClientId: inviter.id,
    invitedClientId: clientId,
    invitedName: name,
    invitedPhone: phone,
    code: inviter.ref_code,
    bookingId,
    note: greeted ? 'Ссылка клиента' : null,
    status: immediate ? 'rewarded' : 'pending'
  });
  db.prepare('UPDATE bookings SET referral_code = ? WHERE id = ?').run(inviter.ref_code, bookingId);
  if (immediate) {
    return rewardReferral(id, { manual: false }).body.referral;
  }
  logActivity({
    type: 'marketing',
    title: 'Клиент пришёл по рекомендации',
    description: `${inviter.name} → ${name}`,
    entity: 'referral',
    entityId: id
  });
  return mapReferral(db.prepare('SELECT * FROM referrals WHERE id = ?').get(id));
}

/**
 * Запись дошла до финального статуса: начисляем бонусы и закрываем рекомендацию.
 * Повторный вызов безопасен — начисления проверяются по записи.
 */
export function onBookingCompleted(bookingId) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL').get(Number(bookingId));
  if (!booking) return { accrued: 0, referral: null };
  const settings = loyaltySettings();
  let accrued = 0;
  let referral = null;

  if (settings.mode === 'bonus' && settings.bonus.enabled && booking.client_id) {
    const already = db.prepare("SELECT 1 FROM bonus_transactions WHERE booking_id = ? AND kind = 'earn'").get(booking.id);
    if (!already && round(booking.price) >= round(settings.bonus.minSpend)) {
      let amount = round((round(booking.price) * settings.bonus.percent) / 100);
      if (round(settings.bonus.maxPerBooking) > 0) amount = Math.min(amount, round(settings.bonus.maxPerBooking));
      if (amount > 0) {
        const expiresAt = round(settings.bonus.expireDays) > 0 ? addDays(dayKey(), round(settings.bonus.expireDays)) : null;
        writeTransaction({
          clientId: booking.client_id,
          bookingId: booking.id,
          kind: 'earn',
          amount,
          reason: `Кешбэк ${settings.bonus.percent}% за съёмку`,
          expiresAt
        });
        db.prepare('UPDATE bookings SET bonus_earned = ? WHERE id = ?').run(amount, booking.id);
        accrued = amount;
        const client = db.prepare('SELECT name FROM clients WHERE id = ?').get(booking.client_id);
        db.prepare(
          `INSERT INTO notifications (kind, title, subtitle, action_label, action_url, is_read)
           VALUES ('marketing', ?, ?, 'Открыть клиента', ?, 0)`
        ).run('Начислены бонусы', `${client?.name || 'Клиент'} · +${amount} баллов`, `/admin/clients`);
        logActivity({
          type: 'marketing',
          title: 'Начислены бонусы',
          description: `${client?.name || 'Клиент'} · +${amount}`,
          entity: 'booking',
          entityId: booking.id
        });
      }
    }
  }

  const row =
    db.prepare("SELECT * FROM referrals WHERE booking_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").get(booking.id) ||
    (booking.referral_code
      ? db.prepare("SELECT * FROM referrals WHERE code = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").get(booking.referral_code)
      : null);
  if (row) {
    const result = rewardReferral(row.id, { manual: false });
    referral = result.status === 200 ? result.body.referral : null;
  }

  return { accrued, referral };
}

/* ------------------------------ выдача для панели ------------------------------ */

function clientRows(search = '') {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.phone, c.email, c.is_vip, c.ref_code,
              (SELECT COUNT(*) FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS bookings,
              (SELECT COUNT(*) FROM referrals r WHERE r.inviter_client_id = c.id) AS invited,
              (SELECT COALESCE(SUM(bt.amount), 0) FROM bonus_transactions bt WHERE bt.client_id = c.id) AS net
       FROM clients c WHERE c.deleted_at IS NULL ORDER BY c.name COLLATE NOCASE`
    )
    .all();
  const query = String(search || '').trim().toLowerCase();
  const filtered = query
    ? rows.filter((row) =>
        [row.name, row.phone, row.email, row.ref_code]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query) || (digits(query) && digits(value).includes(digits(query))))
      )
    : rows;
  return filtered.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    isVip: Boolean(row.is_vip),
    refCode: row.ref_code || null,
    bookings: row.bookings,
    invited: row.invited,
    balance: bonusAvailable(row.id)
  }));
}

export function listBonusClients({ q = '', limit = 60 } = {}) {
  const rows = clientRows(q).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'ru'));
  return { items: rows.slice(0, Math.min(Math.max(Number(limit) || 60, 1), 200)) };
}

export function bonusHistory(clientId) {
  const client = db.prepare('SELECT id, name, phone FROM clients WHERE id = ? AND deleted_at IS NULL').get(Number(clientId));
  if (!client) return null;
  const items = db
    .prepare(
      `SELECT id, booking_id, kind, amount, reason, expires_at, created_at
       FROM bonus_transactions WHERE client_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`
    )
    .all(clientId)
    .map((row) => ({
      id: row.id,
      bookingId: row.booking_id,
      kind: row.kind,
      amount: round(row.amount),
      reason: row.reason,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    }));
  return { client: { ...client, refCode: clientRefCode(client.id) }, balance: bonusAvailable(client.id), items };
}

export function adjustBonus(clientId, body = {}) {
  const amount = round(body.amount);
  if (!amount) return { status: 422, body: { error: 'invalid_amount', message: 'Укажите сумму баллов' } };
  const client = db.prepare('SELECT id, name FROM clients WHERE id = ? AND deleted_at IS NULL').get(Number(clientId));
  if (!client) return { status: 404, body: { error: 'not_found', message: 'Клиент не найден' } };
  if (amount < 0 && bonusAvailable(client.id) < Math.abs(amount)) {
    return { status: 422, body: { error: 'not_enough', message: 'На счёте клиента недостаточно баллов' } };
  }
  const reason = still(body.reason, amount > 0 ? 'Начисление вручную' : 'Списание вручную');
  writeTransaction({ clientId: client.id, amount, kind: 'adjust', reason });
  logActivity({
    type: 'marketing',
    title: amount > 0 ? 'Бонусы начислены вручную' : 'Бонусы списаны вручную',
    description: `${client.name} · ${amount > 0 ? '+' : ''}${amount}`,
    entity: 'client',
    entityId: client.id
  });
  return { status: 200, body: { balance: bonusAvailable(client.id), client: { id: client.id, name: client.name } } };
}

export function loyaltyOverview() {
  const settings = loyaltySettings();
  const today = dayKey();
  const issued = round(db.prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM bonus_transactions WHERE amount > 0').get().s);
  const spent = round(
    db.prepare('SELECT COALESCE(SUM(-amount), 0) AS s FROM bonus_transactions WHERE amount < 0').get().s
  );
  const monthIssued = round(
    db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM bonus_transactions WHERE amount > 0 AND substr(created_at, 1, 7) = ?")
      .get(today.slice(0, 7)).s
  );
  const accounts = db.prepare('SELECT COUNT(*) AS n FROM bonus_accounts').get().n;
  const active = db.prepare('SELECT COUNT(*) AS n FROM bonus_accounts WHERE balance > 0').get().n;
  const referrals = listReferrals();
  const top = listBonusClients({ limit: 6 }).items.filter((item) => item.balance > 0).slice(0, 5);
  const referralShare = referrals.counts.all > 0 ? Math.round((referrals.counts.rewarded / referrals.counts.all) * 100) : 0;

  return {
    mode: settings.mode,
    settings,
    today,
    bonus: {
      balance: Math.max(issued - spent, 0),
      issued,
      spent,
      monthIssued,
      accounts,
      active,
      average: active > 0 ? Math.round((issued - spent) / active) : 0,
      pending: db
        .prepare(
          `SELECT COALESCE(SUM(r.reward_inviter), 0) AS s FROM referrals r WHERE r.status = 'pending'`
        )
        .get().s
    },
    referral: {
      ...referrals.counts,
      rewardTotal: referrals.rewardTotal,
      share: referralShare,
      pendingReward: round(
        db.prepare("SELECT COALESCE(SUM(reward_inviter), 0) AS s FROM referrals WHERE status = 'pending'").get().s
      )
    },
    topClients: top
  };
}

/* ------------------------------ интеграция с записью ------------------------------ */

/** Лимит списания баллами для конкретного заказа. */
export function bonusForQuote({ clientId, subtotal }) {
  const settings = loyaltySettings();
  if (settings.mode !== 'bonus' || !settings.bonus.enabled || !clientId) {
    return { available: 0, limit: 0, applied: 0 };
  }
  const available = bonusAvailable(clientId);
  const percent = Math.min(Math.max(round(settings.bonus.redeemPercent), 0), 100);
  const limit = Math.max(Math.floor((round(subtotal) * percent) / 100), 0);
  return { available, limit, applied: 0 };
}
