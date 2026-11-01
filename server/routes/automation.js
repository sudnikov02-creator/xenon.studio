import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { broadcast } from '../lib/sse.js';
import {
  clearLog,
  createRule,
  createTemplate,
  deleteRule,
  deleteTemplate,
  ensureTemplates,
  listRules,
  listTemplates,
  previewTemplate,
  runRule,
  tick,
  updateRule,
  updateTemplate
} from '../lib/automation.js';

const router = express.Router();
router.use(requireAuth);

/* --- шаблоны --- */

router.get('/templates', (req, res) => {
  ensureTemplates();
  res.json(listTemplates());
});

router.post('/templates/preview', (req, res) => {
  res.json(previewTemplate(req.body || {}));
});

router.post('/templates', (req, res) => {
  const result = createTemplate(req.body || {});
  if (result.status === 201) broadcast('automation', { kind: 'template', action: 'created' });
  res.status(result.status).json(result.body);
});

router.patch('/templates/:id([0-9]+)', (req, res) => {
  const result = updateTemplate(Number(req.params.id), req.body || {});
  if (result.status === 200) broadcast('automation', { kind: 'template', action: 'updated' });
  res.status(result.status).json(result.body);
});

router.delete('/templates/:id([0-9]+)', (req, res) => {
  const result = deleteTemplate(Number(req.params.id));
  if (result.status === 200) broadcast('automation', { kind: 'template', action: 'deleted' });
  res.status(result.status).json(result.body);
});

/* --- сценарии --- */

router.get('/rules', (req, res) => {
  ensureTemplates();
  res.json(listRules());
});

router.post('/rules', (req, res) => {
  const result = createRule(req.body || {});
  if (result.status === 201) broadcast('automation', { kind: 'rule', action: 'created' });
  res.status(result.status).json(result.body);
});

router.patch('/rules/:id([0-9]+)', (req, res) => {
  const result = updateRule(Number(req.params.id), req.body || {});
  if (result.status === 200) broadcast('automation', { kind: 'rule', action: 'updated' });
  res.status(result.status).json(result.body);
});

router.delete('/rules/:id([0-9]+)', (req, res) => {
  const result = deleteRule(Number(req.params.id));
  if (result.status === 200) broadcast('automation', { kind: 'rule', action: 'deleted' });
  res.status(result.status).json(result.body);
});

router.post('/rules/:id([0-9]+)/run', (req, res) => {
  const result = runRule(Number(req.params.id));
  if (result.status === 200) broadcast('automation', { kind: 'rule', action: 'ran' });
  res.status(result.status).json(result.body);
});

/* --- журнал и планировщик --- */

router.get('/log', (req, res) => {
  const data = listRules();
  res.json({ items: data.log });
});

router.delete('/log', (req, res) => {
  const result = clearLog();
  res.status(result.status).json(result.body);
});

router.post('/tick', (req, res) => {
  const results = tick();
  if (results.length) broadcast('automation', { kind: 'tick', count: results.length });
  res.json({ ran: results.length, results });
});

export default router;
