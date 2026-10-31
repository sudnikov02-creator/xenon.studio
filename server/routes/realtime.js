import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { sseHandler, badges } from '../lib/sse.js';

const router = express.Router();

router.get('/events', requireAuth, sseHandler);

router.get('/badges', requireAuth, (req, res) => {
  res.json(badges());
});

export default router;

export const pushRouter = express.Router();
