import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { broadcast } from '../lib/sse.js';
import {
  CODE_PREVIEW,
  createCertificate,
  createCoupon,
  createDiscount,
  deleteCertificate,
  deleteCoupon,
  deleteDiscount,
  listCertificates,
  listCoupons,
  listDiscounts,
  marketingOverview,
  updateCertificate,
  updateCoupon,
  updateDiscount
} from '../lib/marketing.js';

const router = express.Router();
router.use(requireAuth);

router.get('/overview', (req, res) => {
  res.json(marketingOverview());
});

/* --- скидки --- */

router.get('/discounts', (req, res) => {
  res.json(listDiscounts());
});

router.post('/discounts', (req, res) => {
  const result = createDiscount(req.body || {});
  if (result.status === 201) broadcast('marketing', { kind: 'discount', action: 'created', id: result.body.discount.id });
  res.status(result.status).json(result.body);
});

router.patch('/discounts/:id(\\d+)', (req, res) => {
  const result = updateDiscount(Number(req.params.id), req.body || {});
  if (result.status === 200) broadcast('marketing', { kind: 'discount', action: 'updated', id: Number(req.params.id) });
  res.status(result.status).json(result.body);
});

router.delete('/discounts/:id(\\d+)', (req, res) => {
  const result = deleteDiscount(Number(req.params.id));
  if (result.status === 200) broadcast('marketing', { kind: 'discount', action: 'deleted', id: Number(req.params.id) });
  res.status(result.status).json(result.body);
});

/* --- промокоды --- */

router.get('/coupons', (req, res) => {
  res.json(listCoupons({ status: req.query.status || 'all', q: req.query.q || '' }));
});

router.get('/coupons/code', (req, res) => {
  res.json({ code: CODE_PREVIEW.coupon() });
});

router.post('/coupons', (req, res) => {
  const result = createCoupon(req.body || {});
  if (result.status === 201) broadcast('marketing', { kind: 'coupon', action: 'created', id: result.body.coupon.id });
  res.status(result.status).json(result.body);
});

router.patch('/coupons/:id(\\d+)', (req, res) => {
  const result = updateCoupon(Number(req.params.id), req.body || {});
  if (result.status === 200) broadcast('marketing', { kind: 'coupon', action: 'updated', id: Number(req.params.id) });
  res.status(result.status).json(result.body);
});

router.delete('/coupons/:id(\\d+)', (req, res) => {
  const result = deleteCoupon(Number(req.params.id));
  if (result.status === 200) broadcast('marketing', { kind: 'coupon', action: 'deleted', id: Number(req.params.id) });
  res.status(result.status).json(result.body);
});

/* --- сертификаты --- */

router.get('/certificates', (req, res) => {
  res.json(listCertificates({ status: req.query.status || 'all', q: req.query.q || '' }));
});

router.get('/certificates/code', (req, res) => {
  res.json({ code: CODE_PREVIEW.certificate() });
});

router.post('/certificates', (req, res) => {
  const result = createCertificate(req.body || {});
  if (result.status === 201) broadcast('marketing', { kind: 'certificate', action: 'created', id: result.body.certificate.id });
  res.status(result.status).json(result.body);
});

router.patch('/certificates/:id(\\d+)', (req, res) => {
  const result = updateCertificate(Number(req.params.id), req.body || {});
  if (result.status === 200) broadcast('marketing', { kind: 'certificate', action: 'updated', id: Number(req.params.id) });
  res.status(result.status).json(result.body);
});

router.delete('/certificates/:id(\\d+)', (req, res) => {
  const result = deleteCertificate(Number(req.params.id));
  if (result.status === 200) broadcast('marketing', { kind: 'certificate', action: 'deleted', id: Number(req.params.id) });
  res.status(result.status).json(result.body);
});

export default router;
