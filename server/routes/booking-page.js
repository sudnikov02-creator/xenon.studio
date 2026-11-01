import express from 'express';
import { rateLimit } from '../lib/auth.js';
import { bookingStreamHandler } from '../lib/sse.js';
import {
  clientAvailability,
  clientBookingView,
  clientCancel,
  clientReschedule,
  clientSlots
} from '../lib/booking-page.js';

const router = express.Router();

router.get('/bookings/:code', (req, res) => {
  const view = clientBookingView(req.params.code);
  if (!view) return res.status(404).json({ error: 'not_found', message: 'Запись по этой ссылке не найдена' });
  res.json(view);
});

router.get('/bookings/:code/availability', (req, res) => {
  const result = clientAvailability(req.params.code, req.query.month);
  res.status(result.status).json(result.body);
});

router.get('/bookings/:code/slots', (req, res) => {
  const result = clientSlots(req.params.code, String(req.query.date || ''));
  res.status(result.status).json(result.body);
});

router.get('/bookings/:code/stream', (req, res) => {
  const view = clientBookingView(req.params.code);
  if (!view) return res.status(404).json({ error: 'not_found', message: 'Запись не найдена' });
  bookingStreamHandler(req, res, view.code);
});

router.post('/bookings/:code/reschedule', (req, res) => {
  const limit = rateLimit(`client-reschedule:${req.ip}`, 12, 10 * 60 * 1000);
  if (!limit.allowed) {
    return res
      .status(429)
      .json({ error: 'rate_limited', message: 'Слишком много попыток — попробуйте через несколько минут' });
  }
  const result = clientReschedule(req.params.code, req.body || {});
  res.status(result.status).json(result.body);
});

router.post('/bookings/:code/cancel', (req, res) => {
  const limit = rateLimit(`client-cancel:${req.ip}`, 8, 10 * 60 * 1000);
  if (!limit.allowed) {
    return res
      .status(429)
      .json({ error: 'rate_limited', message: 'Слишком много попыток — попробуйте через несколько минут' });
  }
  const result = clientCancel(req.params.code, req.body || {});
  res.status(result.status).json(result.body);
});

export default router;
