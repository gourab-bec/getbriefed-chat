// Prop 22 settlement executor: fixed 14-day windows, top-up payment, idempotency, tips.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db, newId } from '../src/db/memory.js';
import { runSettlement, lastClosedPeriod, LAUNCH_EPOCH } from '../src/services/prop22Settle.js';

const DAY = 24 * 3600 * 1000;

function seedOrder({ runnerId, endOffsetDays, engagedMs, engagedMiles, netCents, tipsCents = 0 }) {
  const end = LAUNCH_EPOCH + endOffsetDays * DAY;
  const id = newId();
  db.orders.set(id, {
    id, runnerId, status: 'completed',
    engagedEndAt: new Date(end).toISOString(),
    prop22: { engagedMs, engagedMiles, milesSource: 'gps' },
    totals: { runnerEarningsCents: netCents },
    tipsCents,
  });
  return id;
}

test('no period closes before day 14; first window is [epoch, epoch+14d)', () => {
  assert.equal(lastClosedPeriod(LAUNCH_EPOCH + 5 * DAY), null);
  const p = lastClosedPeriod(LAUNCH_EPOCH + 15 * DAY);
  assert.equal(p.start, LAUNCH_EPOCH);
  assert.equal(p.end, LAUNCH_EPOCH + 14 * DAY);
});

test('settlement pays top-up for an under-floor runner and is idempotent', async () => {
  db.orders.clear(); db.prop22Settlements = new Map();
  db.runners.set('r-slow', { userId: 'r-slow', stripeAccountId: 'acct_mock_slow' });
  // 10 orders × 45 engaged min × 3 mi, only $3 net each → far under floor.
  for (let i = 0; i < 10; i++) {
    seedOrder({ runnerId: 'r-slow', endOffsetDays: 2 + i, engagedMs: 45 * 60000, engagedMiles: 3, netCents: 300 });
  }
  const now = LAUNCH_EPOCH + 15 * DAY;
  const first = await runSettlement({ now });
  assert.equal(first.settled.length, 1);
  const s = first.settled[0];
  const expectedFloor = Math.round(2028 * 7.5) + Math.round(37 * 30); // 7.5h + 30mi
  assert.equal(s.floorCents, expectedFloor);
  assert.equal(s.topUpCents, expectedFloor - 3000);
  assert.ok(s.transferId?.startsWith('tr_'), 'top-up paid via transfer');

  const again = await runSettlement({ now });
  assert.equal(again.settled[0].skipped, 'already settled');
});

test('tips count toward the floor — well-tipped runner gets no top-up', async () => {
  db.orders.clear(); db.prop22Settlements = new Map();
  db.runners.set('r-tipped', { userId: 'r-tipped', stripeAccountId: 'acct_mock_t' });
  for (let i = 0; i < 5; i++) {
    seedOrder({ runnerId: 'r-tipped', endOffsetDays: 3 + i, engagedMs: 30 * 60000, engagedMiles: 2, netCents: 900, tipsCents: 800 });
  }
  const { settled } = await runSettlement({ now: LAUNCH_EPOCH + 15 * DAY });
  assert.equal(settled[0].topUpCents, 0);
  assert.equal(settled[0].transferId, null);
  assert.equal(settled[0].netEarningsCents, 5 * 1700);
});

test('orders outside the closed window are excluded', async () => {
  db.orders.clear(); db.prop22Settlements = new Map();
  db.runners.set('r-x', { userId: 'r-x', stripeAccountId: 'acct_mock_x' });
  seedOrder({ runnerId: 'r-x', endOffsetDays: 16, engagedMs: 60 * 60000, engagedMiles: 5, netCents: 100 }); // period 2, still open
  const { settled } = await runSettlement({ now: LAUNCH_EPOCH + 15 * DAY });
  assert.equal(settled.length, 0);
  db.orders.clear(); // hygiene for other suites
});
