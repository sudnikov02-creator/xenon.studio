import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { pushPublicKey, saveSubscription, removeSubscription, subscriptionCount, sendPush } from '../lib/push.js';

const router = express.Router();

router.get('/key', (req, res) => {
  res.json({ publicKey: pushPublicKey() });
});

router.get('/status', requireAuth, (req, res) => {
  res.json({ supported: Boolean(pushPublicKey()), subscriptions: subscriptionCount() });
});

router.post('/subscribe', requireAuth, (req, res) => {
  const ok = saveSubscription(req.body?.subscription, 'photographer');
  if (!ok) return res.status(422).json({ error: 'invalid_subscription', message: 'Некорректная подписка' });
  res.status(201).json({ ok: true, subscriptions: subscriptionCount() });
});

router.post('/unsubscribe', requireAuth, (req, res) => {
  if (req.body?.endpoint) removeSubscription(req.body.endpoint);
  res.json({ ok: true, subscriptions: subscriptionCount() });
});

router.post('/test', requireAuth, async (req, res) => {
  const result = await sendPush({
    title: 'xenon.studio',
    body: 'Пуш-уведомления работают — вы получите их о новых заявках.',
    url: '/admin'
  });
  res.json({ ok: true, ...result });
});

export default router;
