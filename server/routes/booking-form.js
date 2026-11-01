import express from 'express';
import { getSettings } from '../db.js';
import { listPackages, listServices } from '../lib/services.js';
import { availabilityForMonth, collectItem, isValidDateKey, slotsForDate } from '../lib/slots.js';
import { currentMonth, localToday } from '../lib/bookings.js';
import { rateLimit } from '../lib/auth.js';
import {
  confirmVerification,
  normalizePhone,
  prettyPhone,
  secondsUntilResend,
  startVerification
} from '../lib/verification.js';
import { createBooking } from '../lib/booking-create.js';
import { quote } from '../lib/pricing.js';

const router = express.Router();

function itemFromQuery(query) {
  return collectItem({
    serviceId: query.serviceId ? Number(query.serviceId) : null,
    packageId: query.packageId ? Number(query.packageId) : null
  });
}

router.get('/booking/options', (req, res) => {
  const settings = getSettings();
  const schedule = settings.schedule;
  const services = listServices()
    .filter((service) => service.isActive)
    .map(({ id, name, description, price, duration, buffer, addons }) => ({
      id,
      name,
      description,
      price,
      duration,
      buffer,
      addons
    }));
  const packages = listPackages()
    .filter((item) => item.isActive)
    .map(({ id, name, description, price, serviceIds, addons }) => ({
      id,
      name,
      description,
      price,
      serviceIds,
      addons
    }));

  res.json({
    services,
    packages,
    today: localToday(),
    month: currentMonth(),
    schedule: {
      accepting: schedule.accepting,
      minNoticeHours: schedule.minNoticeHours,
      horizonDays: schedule.horizonDays,
      bufferMin: schedule.bufferMin,
      week: schedule.week.map(({ day, enabled, start, end }) => ({ day, enabled, start, end })),
      exceptions: schedule.exceptions.filter((item) => item.date >= localToday())
    },
    form: {
      requireVerification: settings.bookingForm?.requireVerification !== false,
      slotStepMin: settings.bookingForm?.slotStepMin || 30,
      askNote: settings.bookingForm?.askNote !== false,
      askInstagram: settings.bookingForm?.askInstagram === true,
      introText: settings.bookingForm?.introText || ''
    },
    agreement: settings.agreement?.enabled
      ? { enabled: true, text: settings.agreement.text || '', consentText: settings.agreement.consentText || '' }
      : { enabled: false, text: '', consentText: '' },
    loyalty: {
      mode: settings.marketing?.mode === 'referral' ? 'referral' : 'bonus',
      bonusEnabled: settings.marketing?.mode === 'bonus' && settings.marketing?.bonus?.enabled !== false,
      redeemPercent: settings.marketing?.bonus?.redeemPercent || 0,
      referralEnabled: settings.marketing?.mode === 'referral' && settings.marketing?.referral?.enabled !== false
    },
    branding: {
      siteName: settings.siteName,
      photographerName: settings.photographerName,
      timezone: settings.timezone,
      currencySymbol: settings.currencySymbol,
      decimalSeparator: settings.decimalSeparator
    }
  });
});

router.get('/booking/availability', (req, res) => {
  const settings = getSettings();
  const item = itemFromQuery(req.query);
  if (!item) return res.status(404).json({ error: 'service_not_found', message: 'Услуга не найдена' });
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || ''))
    ? String(req.query.month)
    : currentMonth();
  const data = availabilityForMonth(settings.schedule, item, month, {
    step: settings.bookingForm?.slotStepMin || 30
  });
  res.json({ ...data, today: localToday(), accepting: settings.schedule.accepting });
});

router.get('/booking/slots', (req, res) => {
  const settings = getSettings();
  const item = itemFromQuery(req.query);
  if (!item) return res.status(404).json({ error: 'service_not_found', message: 'Услуга не найдена' });
  const date = String(req.query.date || '');
  if (!isValidDateKey(date)) {
    return res.status(422).json({ error: 'invalid_date', message: 'Некорректная дата' });
  }
  const slots = slotsForDate(settings.schedule, item, date, {
    step: settings.bookingForm?.slotStepMin || 30
  });
  res.json({
    date,
    duration: item.duration,
    slots,
    accepting: settings.schedule.accepting,
    minNoticeHours: settings.schedule.minNoticeHours
  });
});

router.post('/booking/verify/start', (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) {
    return res.status(422).json({ error: 'invalid_phone', message: 'Введите номер телефона полностью' });
  }
  const wait = secondsUntilResend(phone);
  if (wait > 0) {
    return res.status(429).json({
      error: 'too_soon',
      message: 'Код уже отправлен. Запросите новый через несколько секунд',
      retryAfterSec: wait
    });
  }
  const limit = rateLimit(`verify:${phone}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({
      error: 'rate_limited',
      message: 'Слишком много запросов кода. Попробуйте позже',
      retryAfterSec: limit.retryAfterSec
    });
  }
  const result = startVerification(phone);
  res.json({ ...result, phonePretty: prettyPhone(phone) });
});

router.post('/booking/verify/confirm', (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) {
    return res.status(422).json({ error: 'invalid_phone', message: 'Введите номер телефона полностью' });
  }
  const code = String(req.body?.code || '').replace(/\D/g, '');
  if (code.length !== 6) {
    return res.status(422).json({ error: 'invalid_code', message: 'Код состоит из 6 цифр' });
  }
  const limit = rateLimit(`confirm:${phone}`, 15, 15 * 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({ error: 'rate_limited', message: 'Слишком много попыток. Попробуйте позже' });
  }
  const result = confirmVerification(phone, code);
  if (result.error) {
    const status = result.error === 'code_not_requested' ? 409 : 422;
    return res.status(status).json({ error: result.error, message: result.message });
  }
  res.json(result);
});

/* Расчёт стоимости для формы записи: скидки, промокод и сертификат проверяются здесь же. */
router.post('/booking/quote', (req, res) => {
  const limit = rateLimit(`quote:${req.ip}`, 120, 10 * 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({ error: 'rate_limited', message: 'Слишком много запросов. Подождите немного' });
  }
  const body = req.body || {};
  const result = quote({
    serviceId: body.serviceId ? Number(body.serviceId) : null,
    packageId: body.packageId ? Number(body.packageId) : null,
    addons: body.addons,
    code: body.code,
    phone: normalizePhone(body.phone),
    date: body.date,
    useBonus: body.useBonus === true,
    bonusRequested: body.bonusAmount === undefined ? null : Number(body.bonusAmount)
  });
  if (result.error) {
    return res.status(404).json({ error: result.error, message: result.message });
  }
  const settings = getSettings();
  res.json({
    quote: result,
    currency: {
      symbol: settings.currencySymbol,
      separator: settings.decimalSeparator,
      code: settings.currencyCode
    }
  });
});

router.post('/booking', (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const limit = rateLimit(`booking:${phone || req.ip}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({ error: 'rate_limited', message: 'Слишком много заявок. Попробуйте позже' });
  }
  const result = createBooking({
    payload: req.body || {},
    source: 'client',
    verificationToken: req.body?.verificationToken
  });
  res.status(result.status).json(result.body);
});

export default router;
