import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { analytics } from '../lib/analytics.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(analytics({ period: req.query.period || '30d', compare: req.query.compare !== '0' }));
});

export default router;
