// Prop 22 settlement executor: closes an earning period per runner, computes the top-up
// against the floor, and pays it via Stripe transfer. Idempotent per (runner, period) —
// safe to run from cron daily; only unsettled closed periods pay out.
// Statute: compare per earning period (≤14 days); pay the difference no later than the
// next earning period. We settle on fixed 14-day windows anchored to LAUNCH_EPOCH.

import { db, newId } from '../db/memory.js';
import { periodSettlement, healthcareStipendTier, P22_RATES_2026 } from '../core/prop22.js';
import { transferFunds } from './stripe.js';
import { log } from '../logger.js';

export const LAUNCH_EPOCH = Date.parse('2026-08-01T00:00:00-07:00'); // fixed windows from launch day
const PERIOD_MS = P22_RATES_2026.periodMaxDays * 24 * 3600 * 1000;

db.prop22Settlements = db.prop22Settlements ?? new Map(); // `${runnerId}:${periodStart}` -> settlement

/** The most recent period that has fully CLOSED as of `now`. Null until one has elapsed. */
export function lastClosedPeriod(now = Date.now()) {
  const elapsed = Math.floor((now - LAUNCH_EPOCH) / PERIOD_MS);
  if (elapsed < 1) return null;
  const start = LAUNCH_EPOCH + (elapsed - 1) * PERIOD_MS;
  return { start, end: start + PERIOD_MS };
}

/**
 * Settle all runners for the last closed period. Returns per-runner results.
 * @param {{now?: number, city?: string}} opts
 */
export async function runSettlement({ now = Date.now(), city } = {}) {
  const period = lastClosedPeriod(now);
  if (!period) return { period: null, settled: [], note: 'no earning period has closed yet' };

  // Group completed, engaged orders by runner within the window.
  const byRunner = new Map();
  for (const o of db.orders.values()) {
    if (o.status !== 'completed' || !o.prop22 || !o.runnerId) continue;
    const end = Date.parse(o.engagedEndAt);
    if (!(end >= period.start && end < period.end)) continue;
    if (!byRunner.has(o.runnerId)) byRunner.set(o.runnerId, []);
    byRunner.get(o.runnerId).push(o);
  }

  const results = [];
  for (const [runnerId, orders] of byRunner) {
    const key = `${runnerId}:${period.start}`;
    if (db.prop22Settlements.has(key)) {
      results.push({ runnerId, skipped: 'already settled' });
      continue;
    }
    const settlement = periodSettlement({
      orders: orders.map((o) => ({
        engagedMs: o.prop22.engagedMs,
        engagedMiles: o.prop22.engagedMiles,
        netEarningsCents: o.totals.runnerEarningsCents,
        tipsCents: o.tipsCents ?? 0,
      })),
      city,
    });
    const weeks = P22_RATES_2026.periodMaxDays / 7;
    const record = {
      id: newId(),
      runnerId,
      periodStart: new Date(period.start).toISOString(),
      periodEnd: new Date(period.end).toISOString(),
      ...settlement,
      stipendTier: healthcareStipendTier(settlement.engagedHours / weeks),
      transferId: null,
      settledAt: new Date(now).toISOString(),
    };
    if (settlement.topUpCents > 0) {
      const runner = db.runners.get(runnerId);
      const transfer = await transferFunds({
        idempotencyKey: `p22:${key}`,
        destinationAccountId: runner?.stripeAccountId,
        amountCents: settlement.topUpCents,
        description: `Prop 22 earnings guarantee top-up ${record.periodStart.slice(0, 10)}`,
      });
      record.transferId = transfer.transferId;
      log.info('prop22_topup_paid', { runnerId, topUpCents: settlement.topUpCents, transferId: transfer.transferId });
    }
    db.prop22Settlements.set(key, record);
    results.push(record);
  }
  return { period, settled: results };
}
