import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { broadcast } from '../lib/sse.js';
import {
  buildIcs,
  calendarData,
  clearExternalEvents,
  ensureExportToken,
  exportTokenValid,
  externalEventsList,
  rotateExportToken,
  syncExternalCalendar
} from '../lib/calendar.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(
    calendarData({
      view: req.query.view || 'month',
      date: req.query.date,
      serviceId: req.query.serviceId ? Number(req.query.serviceId) : null
    })
  );
});

/* Подписка для Apple Calendar: ссылка на .ics и её перевыпуск. */
router.get('/export', (req, res) => {
  const token = ensureExportToken();
  const data = calendarData({ view: 'month' });
  res.json({ token, calendar: { ...data.calendar, exportToken: token } });
});

router.post('/export/rotate', (req, res) => {
  const token = rotateExportToken();
  broadcast('calendar', { action: 'token' });
  res.json({ token });
});

/* Импорт личных событий из внешнего календаря. */
router.post('/sync', async (req, res) => {
  const result = await syncExternalCalendar({ url: req.body?.url });
  if (result.status === 200) broadcast('calendar', { action: 'synced' });
  res.status(result.status).json(result.body);
});

router.get('/external', (req, res) => {
  res.json(externalEventsList());
});

router.delete('/external', (req, res) => {
  const result = clearExternalEvents();
  broadcast('calendar', { action: 'cleared' });
  res.status(result.status).json(result.body);
});

/* Публичная лента .ics — без авторизации, но по секретному токену. */
export function icsFeedHandler(req, res) {
  if (!exportTokenValid(req.params.token)) {
    return res.status(404).type('text/plain').send('Календарь не найден');
  }
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buildIcs());
}

export default router;
