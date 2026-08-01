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
    providers: [
      ...PROVIDER_NAMES.map((name) => ({
        name,
        mode: providerLive(name) ? 'live' : 'mock',
        breaker: breakerState(name),
      })),
      { name: 'support_ai', mode: process.env.ANTHROPIC_API_KEY ? 'live (claude)' : 'policy-router', breaker: 'n/a' },
    ],
  });
});

// Prop 22 settlement: close the last elapsed 14-day period and pay any top-ups.
// Idempotent — run from cron daily (ops runbook §6) or manually after launch.
adminRouter.post('/prop22/settle', async (req, res, next) => {
  try {
    const { runSettlement } = await import('../services/prop22Settle.js');
    res.json(await runSettlement({ city: req.body?.city }));
  } catch (err) { next(err); }
});

// Escalation console: tickets the AI support agent handed to humans.
adminRouter.get('/tickets', (req, res) => {
  const tickets = [...(db.tickets?.values() ?? [])].sort(
    (a, b) => (a.severity === 'high' ? -1 : 1) - (b.severity === 'high' ? -1 : 1) || b.createdAt.localeCompare(a.createdAt),
  );
  res.json({ open: tickets.filter((t) => t.status === 'open'), resolved: tickets.filter((t) => t.status !== 'open').length });
});

adminRouter.post('/tickets/:id/resolve', (req, res) => {
  const ticket = db.tickets?.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });
  ticket.status = 'resolved';
  ticket.resolution = String(req.body?.resolution ?? 'resolved').slice(0, 1000);
  ticket.resolvedAt = new Date().toISOString();
  res.json(ticket);
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
