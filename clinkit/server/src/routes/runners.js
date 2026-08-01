import { Router } from 'express';
import { db } from '../db/memory.js';
import { requireAuth } from '../middleware/auth.js';
import { runnerLocationSet, runnerLocationRemove } from '../redis.js';
import { periodSettlement, healthcareStipendTier, P22_RATES_2026 } from '../core/prop22.js';

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

// Prop 22 transparency: the runner's current 14-day earning period — engaged time/miles,
// net earnings vs the guaranteed floor, and any top-up accruing. The same settlement runs
// in ops at period close and pays the top-up via Stripe transfer by the next period.
runnersRouter.get('/prop22', requireAuth('runner'), (req, res) => {
  const periodStart = Date.now() - P22_RATES_2026.periodMaxDays * 24 * 3600 * 1000;
  const completed = [...db.orders.values()].filter(
    (o) => o.runnerId === req.user.sub && o.status === 'completed' && o.prop22 &&
           Date.parse(o.engagedEndAt) >= periodStart,
  );
  const settlement = periodSettlement({
    orders: completed.map((o) => ({
      engagedMs: o.prop22.engagedMs,
      engagedMiles: o.prop22.engagedMiles,
      netEarningsCents: o.totals.runnerEarningsCents,
      tipsCents: o.tipsCents ?? 0,
    })),
    city: req.query.city, // city-specific min wage where an ordinance exceeds the state wage
  });
  const weeks = P22_RATES_2026.periodMaxDays / 7;
  res.json({
    periodDays: P22_RATES_2026.periodMaxDays,
    rates: { engagedHourFloor: '120% of applicable minimum wage', perMileCents: P22_RATES_2026.perMileCents },
    ...settlement,
    healthcareStipendTier: healthcareStipendTier(settlement.engagedHours / weeks),
  });
});

runnersRouter.get('/me', requireAuth('runner'), (req, res) => {
  const runner = db.runners.get(req.user.sub);
  if (!runner) return res.status(404).json({ error: 'runner profile missing' });
  const payouts = [...db.payments.values()]
    .filter((p) => db.orders.get(p.orderId)?.runnerId === req.user.sub && p.statusLocal === 'captured')
    .map((p) => ({ orderId: p.orderId, payoutCents: db.orders.get(p.orderId).totals.runnerPayoutCents }));
  res.json({ ...runner, payouts });
});
