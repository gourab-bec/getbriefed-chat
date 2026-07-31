import { Router } from 'express';
import { db } from '../db/memory.js';
import { requireAuth } from '../middleware/auth.js';
import { runnerLocationSet, runnerLocationRemove } from '../redis.js';

export const runnersRouter = Router();

runnersRouter.post('/online', requireAuth('runner'), async (req, res) => {
  const { lat, lng } = req.body ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'lat/lng required' });
  const runner = db.runners.get(req.user.sub);
  if (!runner) return res.status(404).json({ error: 'runner profile missing' });
  runner.online = true;
  runner.lastPoint = { lat, lng };
  await runnerLocationSet(req.user.sub, lat, lng);
  res.json({ online: true });
});

runnersRouter.post('/offline', requireAuth('runner'), async (req, res) => {
  const runner = db.runners.get(req.user.sub);
  if (runner) runner.online = false;
  await runnerLocationRemove(req.user.sub);
  res.json({ online: false });
});

// Open orders a runner can bid on (their feed).
runnersRouter.get('/feed', requireAuth('runner'), (req, res) => {
  const open = [...db.orders.values()]
    .filter((o) => o.status === 'bidding')
    .map((o) => ({
      orderId: o.id, storeName: o.storeName, storeChain: o.storeChain,
      itemCount: o.items.length, estEarningsCents: o.totals.runnerEarningsCents,
      surge: o.surgeMultiplier, createdAt: o.createdAt,
    }));
  res.json({ orders: open });
});

runnersRouter.get('/me', requireAuth('runner'), (req, res) => {
  const runner = db.runners.get(req.user.sub);
  if (!runner) return res.status(404).json({ error: 'runner profile missing' });
  const payouts = [...db.payments.values()]
    .filter((p) => db.orders.get(p.orderId)?.runnerId === req.user.sub && p.statusLocal === 'captured')
    .map((p) => ({ orderId: p.orderId, payoutCents: db.orders.get(p.orderId).totals.runnerPayoutCents }));
  res.json({ ...runner, payouts });
});
