import express from 'express';
import { logActivity } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { broadcast } from '../lib/sse.js';
import {
  archiveRow,
  duplicateRow,
  listPackages,
  listServices,
  reorderRows,
  savePackage,
  saveService,
  shiftRow
} from '../lib/services.js';

const router = express.Router();
router.use(requireAuth);

function failure(res, result) {
  if (result?.notFound) {
    res.status(404).json({ error: 'not_found', message: 'Запись не найдена' });
    return;
  }
  res.status(422).json({ error: 'validation', message: result?.error || 'Проверьте поля', field: result?.field });
}

function payload(kind) {
  return kind === 'package'
    ? { packages: listPackages(), services: listServices() }
    : { services: listServices(), packages: listPackages() };
}

/* ------------------------------- services ------------------------------- */

router.get('/services', (req, res) => {
  res.json({ services: listServices(), packages: listPackages() });
});

router.post('/services', (req, res) => {
  const result = saveService(req.body || {});
  if (!result.service) return failure(res, result);
  logActivity({ type: 'service', title: 'Услуга создана', description: result.service.name, entity: 'service', entityId: result.service.id });
  broadcast('service', { kind: 'service', action: 'created', id: result.service.id });
  res.status(201).json({ service: result.service, ...payload('service') });
});

router.patch('/services/:id', (req, res) => {
  const result = saveService(req.body || {}, Number(req.params.id));
  if (!result.service) return failure(res, result);
  logActivity({ type: 'service', title: 'Услуга обновлена', description: result.service.name, entity: 'service', entityId: result.service.id });
  broadcast('service', { kind: 'service', action: 'updated', id: result.service.id });
  res.json({ service: result.service, ...payload('service') });
});

router.post('/services/:id/duplicate', (req, res) => {
  const result = duplicateRow('service', Number(req.params.id));
  if (!result.service) return failure(res, result);
  logActivity({ type: 'service', title: 'Услуга скопирована', description: result.service.name, entity: 'service', entityId: result.service.id });
  broadcast('service', { kind: 'service', action: 'created', id: result.service.id });
  res.status(201).json({ service: result.service, ...payload('service') });
});

router.post('/services/:id/shift', (req, res) => {
  const direction = Number(req.body?.direction) === -1 ? -1 : 1;
  shiftRow('service', Number(req.params.id), direction);
  broadcast('service', { kind: 'service', action: 'reordered', id: Number(req.params.id) });
  res.json(payload('service'));
});

router.delete('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!archiveRow('service', id)) {
    return res.status(404).json({ error: 'not_found', message: 'Услуга не найдена' });
  }
  logActivity({ type: 'service', title: 'Услуга удалена', description: `#${id}`, entity: 'service', entityId: id });
  broadcast('service', { kind: 'service', action: 'deleted', id });
  res.json(payload('service'));
});

router.post('/services/reorder', (req, res) => {
  reorderRows('service', req.body?.ids);
  broadcast('service', { kind: 'service', action: 'reordered' });
  res.json(payload('service'));
});

/* ------------------------------- packages ------------------------------- */

router.get('/packages', (req, res) => {
  res.json({ services: listServices(), packages: listPackages() });
});

router.post('/packages', (req, res) => {
  const result = savePackage(req.body || {});
  if (!result.package) return failure(res, result);
  logActivity({ type: 'package', title: 'Пакет создан', description: result.package.name, entity: 'package', entityId: result.package.id });
  broadcast('package', { kind: 'package', action: 'created', id: result.package.id });
  res.status(201).json({ package: result.package, ...payload('package') });
});

router.patch('/packages/:id', (req, res) => {
  const result = savePackage(req.body || {}, Number(req.params.id));
  if (!result.package) return failure(res, result);
  logActivity({ type: 'package', title: 'Пакет обновлён', description: result.package.name, entity: 'package', entityId: result.package.id });
  broadcast('package', { kind: 'package', action: 'updated', id: result.package.id });
  res.json({ package: result.package, ...payload('package') });
});

router.post('/packages/:id/duplicate', (req, res) => {
  const result = duplicateRow('package', Number(req.params.id));
  if (!result.package) return failure(res, result);
  logActivity({ type: 'package', title: 'Пакет скопирован', description: result.package.name, entity: 'package', entityId: result.package.id });
  broadcast('package', { kind: 'package', action: 'created', id: result.package.id });
  res.status(201).json({ package: result.package, ...payload('package') });
});

router.post('/packages/:id/shift', (req, res) => {
  const direction = Number(req.body?.direction) === -1 ? -1 : 1;
  shiftRow('package', Number(req.params.id), direction);
  broadcast('package', { kind: 'package', action: 'reordered', id: Number(req.params.id) });
  res.json(payload('package'));
});

router.delete('/packages/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!archiveRow('package', id)) {
    return res.status(404).json({ error: 'not_found', message: 'Пакет не найден' });
  }
  logActivity({ type: 'package', title: 'Пакет удалён', description: `#${id}`, entity: 'package', entityId: id });
  broadcast('package', { kind: 'package', action: 'deleted', id });
  res.json(payload('package'));
});

router.post('/packages/reorder', (req, res) => {
  reorderRows('package', req.body?.ids);
  broadcast('package', { kind: 'package', action: 'reordered' });
  res.json(payload('package'));
});

export default router;
