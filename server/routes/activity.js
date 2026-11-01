import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { addNote, listActivity } from '../lib/activity.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(
    listActivity({
      type: req.query.type || 'all',
      actor: req.query.actor || 'all',
      q: req.query.q || '',
      page: req.query.page || 1,
      limit: req.query.limit
    })
  );
});

router.post('/', (req, res) => {
  const result = addNote(req.body || {});
  res.status(result.status).json(result.body);
});

export default router;
