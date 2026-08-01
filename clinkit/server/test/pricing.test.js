import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals, deliveryFeeCents, fmt } from '../src/core/pricing.js';

test('base case: $7.27 basket, 10% markup, no surge, 2.1 mi, grocery-exempt tax', () => {
  const t = computeTotals({ itemsBaseCents: 727, storeToBuyerMi: 2.1 });
  assert.equal(t.runnerMarkupCents, 73);            // 10% of 727 → 72.7 → 73
  assert.equal(t.deliveryFeeCents, 399);            // within 3 free miles
  assert.equal(t.taxCents, 0);
  // Flat $5 platform-cost-recovery minimum: pct fee is 60¢, so a $4.40 service fee tops
  // it up — charged to the buyer, never the runner.
  assert.equal(t.minFeeTopUpCents, 500 - 60);
  assert.equal(t.platformFeeCents, 500);
  assert.equal(t.buyerTotalCents, 727 + 73 + 399 + 440); // $16.39
  assert.equal(t.runnerPayoutCents, 727 + 73 + 399 - 60); // runner unaffected by the floor
  assert.equal(t.runnerEarningsCents, 73 + 399 - 60);
});

test('take = max($5, pct of order): flat $5 minimum, percentage takes over on big baskets', () => {
  const mid = computeTotals({ itemsBaseCents: 3500, storeToBuyerMi: 2 }); // $35 basket
  assert.equal(mid.platformFeeCents, 500);           // pct fee 212¢ → topped up to the $5 min
  assert.ok(mid.minFeeTopUpCents > 0);
  const big = computeTotals({ itemsBaseCents: 6000, storeToBuyerMi: 2 }); // $60 basket
  assert.equal(big.platformFeeCents, 500);           // pct 350¢ still under the min at 5%
  const huge = computeTotals({ itemsBaseCents: 20000, storeToBuyerMi: 2 }); // $200 basket
  assert.equal(huge.minFeeTopUpCents, 0);            // pct fee 1120¢ > $5 — grows with value
  assert.ok(huge.platformFeeCents > 1000);
  // Floor never comes out of the runner: payout identical with or without top-up.
  assert.equal(mid.runnerPayoutCents, 3500 + mid.runnerMarkupCents + mid.deliveryFeeCents - Math.round((3500 + mid.runnerMarkupCents + mid.deliveryFeeCents) * 0.05));
});

test('surge multiplies markup only, never base or delivery', () => {
  const noSurge = computeTotals({ itemsBaseCents: 1000, storeToBuyerMi: 2 });
  const surged = computeTotals({ itemsBaseCents: 1000, storeToBuyerMi: 2, surgeMultiplier: 2 });
  assert.equal(surged.runnerMarkupCents, 200);
  assert.equal(noSurge.runnerMarkupCents, 100);
  assert.equal(surged.deliveryFeeCents, noSurge.deliveryFeeCents);
  assert.equal(surged.itemsBaseCents, noSurge.itemsBaseCents);
});

test('delivery fee adds $0.75/mi beyond 3 miles', () => {
  assert.equal(deliveryFeeCents(0), 399);
  assert.equal(deliveryFeeCents(3), 399);
  assert.equal(deliveryFeeCents(5), 399 + 150);
  assert.equal(deliveryFeeCents(9.5), 399 + Math.round(6.5 * 75));
});

test('taxable lines (non-grocery) add tax to buyer total only', () => {
  const t = computeTotals({ itemsBaseCents: 2000, storeToBuyerMi: 1, taxRate: 0.0825, taxableBaseCents: 2000 });
  assert.equal(t.taxCents, 165);
  // pct fee 130¢ floors up to the flat $5 minimum; tax rides on top, never fee'd.
  assert.equal(t.platformFeeCents, 500);
  assert.equal(t.buyerTotalCents, 2000 + 200 + 399 + t.minFeeTopUpCents + 165);
});

test('money identity: buyer pays = runner payout + platform fee + tax', () => {
  for (const [base, pct, surge, mi] of [[727, 10, 1, 2.1], [12345, 15, 1.5, 8], [50, 5, 2.5, 9.9]]) {
    const t = computeTotals({ itemsBaseCents: base, runnerMarkupPct: pct, surgeMultiplier: surge, storeToBuyerMi: mi });
    assert.equal(t.buyerTotalCents, t.runnerPayoutCents + t.platformFeeCents + t.taxCents);
  }
});

test('input validation', () => {
  assert.throws(() => computeTotals({ itemsBaseCents: 7.27, storeToBuyerMi: 1 }), RangeError);
  assert.throws(() => computeTotals({ itemsBaseCents: -1, storeToBuyerMi: 1 }), RangeError);
  assert.throws(() => computeTotals({ itemsBaseCents: 100, storeToBuyerMi: 1, runnerMarkupPct: 40 }), RangeError);
  assert.throws(() => computeTotals({ itemsBaseCents: 100, storeToBuyerMi: 1, surgeMultiplier: 3 }), RangeError);
  assert.equal(fmt(1236), '$12.36');
});
