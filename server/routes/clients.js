import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { broadcast } from '../lib/sse.js';
import { clientDetail, createClient, deleteClient, listClients, updateClient } from '../lib/clients-admin.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(
    listClients({
      q: req.query.q || '',
      segment: req.query.segment || 'all',
      sort: req.query.sort || 'recent',
      page: req.query.page,
      limit: req.query.limit
    })
  );
});

router.post('/', (req, res) => {
  const result = createClient(req.body || {});
  if (result.status === 201) broadcast('client', { action: 'created', id: result.body.client.id });
  res.status(result.status).json(result.body);
});

router.get('/:id(\\d+)', (req, res) => {
  const detail = clientDetail(Number(req.params.id));
  if (!detail) return res.status(404).json({ error: 'not_found', message: 'Клиент не найден' });
  res.json(detail);
});

router.patch('/:id(\\d+)', (req, res) => {
  const result = updateClient(Number(req.params.id), req.body || {});
  if (result.status === 200) broadcast('client', { action: 'updated', id: Number(req.params.id) });
  res.status(result.status).json(result.body);
});

router.delete('/:id(\\d+)', (req, res) => {
  const result = deleteClient(Number(req.params.id));
  if (result.status === 200) broadcast('client', { action: 'deleted', id: Number(req.params.id) });
  res.status(result.status).json(result.body);
});

export default router;
