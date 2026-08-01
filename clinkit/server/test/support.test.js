// AI support org (policy-router mode — the zero-key path that must always work).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db, newId } from '../src/db/memory.js';
import { handleSupportMessage, buildContext, createTicket } from '../src/services/supportAgent.js';

function seed() {
  db.tickets = new Map();
  db.orders.clear();
  db.users.set('b1', { id: 'b1', role: 'buyer', fullName: 'Bea', email: 'b@x.co' });
  db.users.set('r1', { id: 'r1', role: 'runner', fullName: 'Ray', email: 'r@x.co' });
  db.runners.set('r1', { userId: 'r1', backgroundCheck: 'pending' });
  const id = newId();
  db.orders.set(id, {
    id, buyerId: 'b1', runnerId: 'r1', status: 'enroute',
    storeName: 'WinCo Foods Tracy', createdAt: new Date().toISOString(),
    totals: { buyerTotalCents: 1236, runnerEarningsCents: 412 },
    prop22: { engagedMs: 30 * 60000, engagedMiles: 3 },
    engagedEndAt: new Date().toISOString(), tipsCents: 300,
  });
  return id;
}

test('buyer order-status question answers with their REAL order state', async () => {
  seed();
  const r = await handleSupportMessage({ userId: 'b1', role: 'buyer', message: 'Where is my order??' });
  assert.match(r.reply, /WinCo Foods Tracy/);
  assert.match(r.reply, /enroute/);
  assert.equal(r.escalated, false);
});

test('refund request opens a ticket and quotes real policy', async () => {
  seed();
  const r = await handleSupportMessage({ userId: 'b1', role: 'buyer', message: 'my eggs were damaged, I want a refund' });
  assert.equal(r.escalated, true);
  assert.ok(r.ticketId);
  assert.equal(db.tickets.get(r.ticketId).kind, 'refund');
  assert.match(r.reply, /\$15|24 hours/);
});

test('runner Prop 22 question returns their actual floor math', async () => {
  seed();
  // mark the order completed so it counts toward the period
  [...db.orders.values()][0].status = 'completed';
  const r = await handleSupportMessage({ userId: 'r1', role: 'runner', message: 'how does the prop 22 guarantee work? am I owed a top-up?' });
  assert.match(r.reply, /\$20\.28/);
  assert.match(r.reply, /\$0\.37/);
  assert.match(r.reply, /14 days/);
  assert.equal(r.escalated, false);
});

test('same onboarding question gets role-appropriate answers (dual competence)', async () => {
  seed();
  const runner = await handleSupportMessage({ userId: 'r1', role: 'runner', message: 'what do I need to finish onboarding?' });
  assert.match(runner.reply, /Stripe Connect/);
  assert.match(runner.reply, /background check "pending"/);
  const buyer = await handleSupportMessage({ userId: 'b1', role: 'buyer', message: 'how do I sign up to be a runner and onboard?' });
  assert.match(buyer.reply, /Become a Runner|5–20%/);
});

test('safety topics escalate IMMEDIATELY with a high-severity ticket, never AI-adjudicated', async () => {
  seed();
  const r = await handleSupportMessage({ userId: 'r1', role: 'runner', message: 'I was in an accident during a delivery' });
  assert.equal(r.escalated, true);
  const t = db.tickets.get(r.ticketId);
  assert.equal(t.severity, 'high');
  assert.equal(t.kind, 'safety_or_legal');
  assert.match(r.reply, /911/);
});

test('explicit human request escalates politely', async () => {
  seed();
  const r = await handleSupportMessage({ userId: 'b1', role: 'buyer', message: 'I want to talk to a human please' });
  assert.equal(r.escalated, true);
  assert.equal(db.tickets.get(r.ticketId).kind, 'human_requested');
});

test('context builder scopes orders by role and never leaks the other side', () => {
  seed();
  const buyerCtx = buildContext('b1', 'buyer');
  assert.equal(buyerCtx.orders.length, 1);
  assert.equal(buyerCtx.prop22, undefined);
  const runnerCtx = buildContext('r1', 'runner');
  assert.ok(runnerCtx.prop22);
  createTicket({ userId: 'b1', role: 'buyer', kind: 'test', severity: 'normal', summary: 'x' });
  assert.equal(db.tickets.size, 1);
});
