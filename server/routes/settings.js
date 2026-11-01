import express from 'express';
import { getSettings, saveSettings, logActivity } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { broadcast } from '../lib/sse.js';

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json({ settings: getSettings() });
});

router.patch('/', requireAuth, (req, res) => {
  const patch = req.body || {};
  if (patch.schedule !== undefined) {
    if (!patch.schedule || typeof patch.schedule !== 'object' || Array.isArray(patch.schedule)) {
      return res.status(422).json({ error: 'invalid_schedule', message: 'Некорректное расписание' });
    }
    if (patch.schedule.week !== undefined && !Array.isArray(patch.schedule.week)) {
      return res.status(422).json({ error: 'invalid_schedule', message: 'Некорректные рабочие дни' });
    }
  }
  if (patch.bookingForm !== undefined) {
    if (!patch.bookingForm || typeof patch.bookingForm !== 'object' || Array.isArray(patch.bookingForm)) {
      return res.status(422).json({ error: 'invalid_booking_form', message: 'Некорректные настройки формы' });
    }
    const form = patch.bookingForm;
    const steps = [15, 30, 45, 60];
    patch.bookingForm = {
      requireVerification: form.requireVerification !== false,
      slotStepMin: steps.includes(Number(form.slotStepMin)) ? Number(form.slotStepMin) : 30,
      askNote: form.askNote !== false,
      askInstagram: form.askInstagram === true,
      introText: String(form.introText || '').trim().slice(0, 240)
    };
  }
  if (patch.contacts !== undefined) {
    if (!patch.contacts || typeof patch.contacts !== 'object' || Array.isArray(patch.contacts)) {
      return res.status(422).json({ error: 'invalid_contacts', message: 'Некорректные контакты' });
    }
    const text = (value, max) => String(value ?? '').trim().slice(0, max);
    patch.contacts = {
      phone: text(patch.contacts.phone, 40),
      telegram: text(patch.contacts.telegram, 60).replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, ''),
      instagram: text(patch.contacts.instagram, 60).replace(/^@/, '').replace(/^https?:\/\/instagram\.com\//i, ''),
      email: text(patch.contacts.email, 120)
    };
  }
  const current = getSettings();
  const merged = { ...patch };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && current[key] && typeof current[key] === 'object') {
      merged[key] = { ...current[key], ...value };
    }
  }
  if (merged.accentColor && !/^#[0-9a-f]{6}$/i.test(merged.accentColor)) {
    return res.status(422).json({ error: 'invalid_color', message: 'Некорректный цвет' });
  }
  const settings = saveSettings(merged);
  broadcast('settings', settings);
  if (patch.schedule !== undefined) {
    logActivity({ type: 'schedule', title: 'Расписание обновлено', description: settings.siteName });
  }
  if (patch.photographerName !== undefined || patch.siteName !== undefined) {
    logActivity({ type: 'settings', title: 'Настройки студии обновлены', description: settings.siteName });
  }
  res.json({ settings });
});

export default router;
