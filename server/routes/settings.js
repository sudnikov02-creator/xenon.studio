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
  if (patch.photographerName !== undefined || patch.siteName !== undefined) {
    logActivity({ type: 'settings', title: 'Настройки студии обновлены', description: settings.siteName });
  }
  res.json({ settings });
});

export default router;
