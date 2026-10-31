import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { buildDashboard, calendarMonth, currentMonth, isValidMonth } from '../lib/bookings.js';

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const month = isValidMonth(req.query.month) ? req.query.month : currentMonth();
  res.json(buildDashboard(month));
});

router.get('/calendar', requireAuth, (req, res) => {
  const month = isValidMonth(req.query.month) ? req.query.month : currentMonth();
  res.json(calendarMonth(month));
});

export default router;
