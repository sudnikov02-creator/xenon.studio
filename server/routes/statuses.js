import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { broadcast, broadcastBadges } from '../lib/sse.js';
import {
  createStatus,
  deleteStatus,
  listStatuses,
  reorderStatuses,
  shiftStatus,
  updateStatus
} from '../lib/statuses.js';

const router = express.Router();
router.use(requireAuth);

function fail(res, result) {
  if (result?.notFound) {
    return res.status(404).json({ error: 'not_found', message: 'Статус не найден' });
  }
  return res.status(422).json({ error: 'validation', message: result?.error || 'Проверьте поля', field: result?.field });
}

router.get('/', (req, res) => {
  res.json(listStatuses());
});

router.post('/', (req, res) => {
  const result = createStatus(req.body || {});
  if (result.error || result.notFound) return fail(res, result);
  broadcast('status', { action: 'created', id: result.status.id });
  broadcastBadges();
  res.status(201).json(result);
});

router.post('/reorder', (req, res) => {
  const result = reorderStatuses(req.body?.ids);
  if (result.error || result.notFound) return fail(res, result);
  broadcast('status', { action: 'reordered' });
  res.json(result);
});

router.post('/:id(\\d+)/shift', (req, res) => {
  const result = shiftStatus(Number(req.params.id), Number(req.body?.direction) === -1 ? -1 : 1);
  broadcast('status', { action: 'reordered', id: Number(req.params.id) });
  res.json(result);
});

router.patch('/:id(\\d+)', (req, res) => {
  const result = updateStatus(Number(req.params.id), req.body || {});
  if (result.error || result.notFound) return fail(res, result);
  broadcast('status', { action: 'updated', id: result.status.id });
  broadcast('booking', { action: 'status-updated', id: result.status.id });
  res.json(result);
});

router.delete('/:id(\\d+)', (req, res) => {
  const result = deleteStatus(Number(req.params.id), { moveTo: req.query.moveTo });
  if (result.error || result.notFound) return fail(res, result);
  broadcast('status', { action: 'deleted', id: result.removed });
  broadcast('booking', { action: 'status-deleted' });
  broadcastBadges();
  res.json(result);
});

export default router;
