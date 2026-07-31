// Ops/status surface. In production, requires the X-Admin-Token header to match ADMIN_TOKEN;
// when no ADMIN_TOKEN is configured (local dev) it's open on localhost only.

import { Router } from 'express';
import { config, providerLive } from '../config.js';
import { breakerState } from '../providers/breaker.js';
import { db } from '../db/memory.js';
import { _memStats } from '../redis.js';

export const adminRouter = Router();

adminRouter.use((req, res, next) => {
  if (config.adminToken) {
    if (req.headers['x-admin-token'] !== config.adminToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  } else if (config.nodeEnv === 'production') {
    return res.status(403).json({ error: 'ADMIN_TOKEN not configured' });
  }
  next();
});

const PROVIDER_NAMES = ['kroger', 'walmart', 'instacart', 'briskly', 'google_shopping', 'stripe', 'avalara'];

adminRouter.get('/providers', (req, res) => {
  res.json({
    forceMock: process.env.PROVIDERS_MOCK === '1',
    providers: PROVIDER_NAMES.map((name) => ({
      name,
      mode: providerLive(name) ? 'live' : 'mock',
      breaker: breakerState(name),
    })),
  });
});

// Minimal weekly-metrics surface (definitions in docs/ops/04-metrics.md).
adminRouter.get('/metrics', (req, res) => {
  const orders = [...db.orders.values()];
  const completed = orders.filter((o) => o.status === 'completed');
  const gmvCents = completed.reduce((s, o) => s + o.totals.buyerTotalCents, 0);
  const platformCents = completed.reduce((s, o) => s + o.totals.platformFeeCents, 0);
  res.json({
    orders: orders.length,
    completed: completed.length,
    completionRate: orders.length ? completed.length / orders.length : null,
    gmvCents,
    platformRevenueCents: platformCents,
    takeRate: gmvCents ? platformCents / gmvCents : null,
    runnersOnline: [...db.runners.values()].filter((r) => r.online).length,
    referrals: db.referrals?.size ?? 0,
    cache: _memStats(),
  });
});
