import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { badges, broadcast, broadcastBadges } from '../lib/sse.js';
import { conversationDetail, ensureConversation, listConversations, markRead, sendMessage } from '../lib/messaging.js';

const router = express.Router();
router.use(requireAuth);

router.get('/conversations', (req, res) => {
  res.json(
    listConversations({
      q: req.query.q || '',
      filter: req.query.filter || 'all',
      page: req.query.page,
      limit: req.query.limit
    })
  );
});

router.post('/conversations', (req, res) => {
  const result = ensureConversation(Number((req.body || {}).clientId));
  if (result.status === 201) {
    broadcast('conversation', { action: 'created', id: result.body.id });
    res.status(201).json(result.body);
    return;
  }
  res.status(result.status).json(result.body);
});

router.get('/conversations/:id(\\d+)', (req, res) => {
  const detail = conversationDetail(Number(req.params.id));
  if (!detail) return res.status(404).json({ error: 'not_found', message: 'Диалог не найден' });
  res.json(detail);
});

router.post('/conversations/:id(\\d+)/read', (req, res) => {
  const result = markRead(Number(req.params.id));
  if (result.status === 200) broadcastBadges();
  res.status(result.status).json({ ...result.body, badges: badges() });
});

router.post('/conversations/:id(\\d+)/send', (req, res) => {
  const result = sendMessage(Number(req.params.id), req.body || {});
  if (result.status === 201) {
    broadcast('message', {
      conversationId: Number(req.params.id),
      message: result.body.message,
      conversation: result.body.conversation
    });
    broadcastBadges();
  }
  res.status(result.status).json(result.body);
});

export default router;
