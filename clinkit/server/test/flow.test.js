// Auth + order state machine + payment mock flow (no HTTP layer needed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../src/middleware/auth.js';
import { db, newId, transitionOrder } from '../src/db/memory.js';
import { authorizePayment, capturePayment, cancelPayment } from '../src/services/stripe.js';
import { computeTotals } from '../src/core/pricing.js';

test('scrypt hashing round-trips; wrong password rejected', () => {
  const h = hashPassword('correct horse battery');
  assert.ok(verifyPassword('correct horse battery', h));
  assert.ok(!verifyPassword('wrong', h));
  assert.ok(!verifyPassword('x', 'garbage'));
});

test('JWT sign/verify: valid, tampered, expired', () => {
  const t = signToken({ sub: 'u1', role: 'buyer' });
  assert.equal(verifyToken(t)?.sub, 'u1');
  assert.equal(verifyToken(t.slice(0, -2) + 'xx'), null);
  const expired = signToken({ sub: 'u1', role: 'buyer' }, -10);
  assert.equal(verifyToken(expired), null);
  assert.equal(verifyToken('not.a.jwt'), null);
});

test('order state machine enforces legal transitions only', () => {
  const order = { id: newId(), status: 'requested' };
  transitionOrder(order, 'bidding');
  transitionOrder(order, 'matched');
  transitionOrder(order, 'shopping');
  assert.throws(() => transitionOrder(order, 'delivered'), /invalid transition/);
  transitionOrder(order, 'purchased');
  transitionOrder(order, 'enroute');
  transitionOrder(order, 'delivered');
  transitionOrder(order, 'completed');
  assert.throws(() => transitionOrder(order, 'cancelled'), /invalid transition/);
});

test('mock Stripe: authorize → capture with platform split; void on cancel', async () => {
  const totals = computeTotals({ itemsBaseCents: 727, storeToBuyerMi: 2.1 });
  const auth = await authorizePayment({
    orderId: 'o1', buyerTotalCents: totals.buyerTotalCents,
    platformFeeCents: totals.platformFeeCents, runnerAccountId: 'acct_mock_r1',
  });
  assert.equal(auth.status, 'requires_capture');
  assert.ok(auth.paymentIntentId.startsWith('pi_'));

  const cap = await capturePayment({ orderId: 'o1', paymentIntentId: auth.paymentIntentId, finalAmountCents: totals.buyerTotalCents });
  assert.equal(cap.status, 'succeeded');
  assert.equal(cap.capturedCents, totals.buyerTotalCents);

  const void1 = await cancelPayment({ orderId: 'o2', paymentIntentId: 'pi_mock_x' });
  assert.equal(void1.status, 'canceled');
});

test('bid accept economics: runner countering at 8% beats default 10% for the buyer', () => {
  const at10 = computeTotals({ itemsBaseCents: 727, runnerMarkupPct: 10, storeToBuyerMi: 2.1 });
  const at8 = computeTotals({ itemsBaseCents: 727, runnerMarkupPct: 8, storeToBuyerMi: 2.1 });
  assert.ok(at8.buyerTotalCents < at10.buyerTotalCents);
  assert.ok(at8.runnerEarningsCents < at10.runnerEarningsCents);
  // Platform always earns its 5% of the fee base.
  assert.equal(at8.platformFeeCents, Math.round((727 + at8.runnerMarkupCents + at8.deliveryFeeCents) * 0.05));
  db.orders.clear(); // keep suite hermetic
});
