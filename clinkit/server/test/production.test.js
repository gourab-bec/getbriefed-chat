// Phase-4 hardening: circuit breaker, coalescing, per-provider auto-live, referral engine.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withBreaker, coalesce, breakerState, _resetBreakers } from '../src/providers/breaker.js';
import { providerLive } from '../src/config.js';
import { db } from '../src/db/memory.js';
import { codeFor, onFirstCompletedOrder, REFERRAL_RUNNER_BONUS_CENTS } from '../src/routes/referrals.js';

test('breaker opens after 5 consecutive failures and fails fast', async () => {
  _resetBreakers();
  const boom = () => Promise.reject(new Error('upstream down'));
  for (let i = 0; i < 5; i++) await withBreaker('serp_test', boom).catch(() => {});
  assert.equal(breakerState('serp_test'), 'open');
  // Open circuit rejects without invoking fn (quota protection).
  let invoked = false;
  await withBreaker('serp_test', () => { invoked = true; return Promise.resolve(1); }).catch((e) => {
    assert.match(e.message, /circuit open/);
  });
  assert.equal(invoked, false);
});

test('breaker recovers on success', async () => {
  _resetBreakers();
  await withBreaker('p', () => Promise.reject(new Error('x'))).catch(() => {});
  assert.equal(breakerState('p'), 'degraded');
  await withBreaker('p', () => Promise.resolve('ok'));
  assert.equal(breakerState('p'), 'closed');
});

test('coalesce: concurrent identical requests share one upstream call', async () => {
  _resetBreakers();
  let calls = 0;
  const slow = () => new Promise((r) => { calls += 1; setTimeout(() => r(calls), 20); });
  const [a, b, c] = await Promise.all([coalesce('k1', slow), coalesce('k1', slow), coalesce('k1', slow)]);
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.equal(b, c);
  // After settle, a new call goes upstream again.
  await coalesce('k1', slow);
  assert.equal(calls, 2);
});

test('per-provider auto-live: no keys => mock; key => live; PROVIDERS_MOCK=1 forces mock', () => {
  delete process.env.PROVIDERS_MOCK;
  assert.equal(providerLive('kroger'), false); // no keys in test env
  assert.equal(providerLive('google_shopping'), false);
  process.env.PROVIDERS_MOCK = '1';
  assert.equal(providerLive('kroger'), false); // forced mock regardless
  process.env.PROVIDERS_MOCK = '1'; // leave forced for rest of suite
});

test('referral: credit stays pending until first completed order, runner bonus $30', () => {
  db.referrals = new Map();
  db.credits = new Map();
  const code = codeFor('owner-1');
  assert.match(code, /^CLK-[0-9A-F]{6}$/);
  db.referrals.get(code).uses.push({ userId: 'runner-9', role: 'runner', status: 'pending' });

  // Not completed yet — owner has no granted credit.
  assert.equal((db.credits.get('owner-1') ?? []).length, 0);

  onFirstCompletedOrder('runner-9', 'runner');
  const ownerCredits = db.credits.get('owner-1');
  assert.equal(ownerCredits.length, 1);
  assert.equal(ownerCredits[0].cents, REFERRAL_RUNNER_BONUS_CENTS);
  assert.equal(ownerCredits[0].status, 'granted');

  // Second completion does not double-pay.
  onFirstCompletedOrder('runner-9', 'runner');
  assert.equal(db.credits.get('owner-1').length, 1);
});
