// k6 load proof: 500 concurrent VUs browsing quotes + ~50 orders/min placed.
// Run:  k6 run infra/load/k6-quotes.js  (BASE=https://staging.clinkit.co k6 run ...)
// Pass criteria (thresholds below): p95 quote < 800ms, error rate < 1%.
// Mock mode exercises the full compare pipeline (cache, comparison, pricing) without
// burning provider quota — identical code path to live except the outbound fetch.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:4000';

export const options = {
  scenarios: {
    browsers: { // 500 concurrent users comparing prices
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 500 },
        { duration: '3m', target: 500 },
        { duration: '30s', target: 0 },
      ],
      exec: 'browse',
    },
    buyers: { // ~50 orders/min end-to-end pressure on the write path
      executor: 'constant-arrival-rate',
      rate: 50, timeUnit: '1m', duration: '4m30s',
      preAllocatedVUs: 30, maxVUs: 60,
      exec: 'order',
    },
  },
  thresholds: {
    'http_req_duration{scenario:browsers}': ['p(95)<800'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.98'],
  },
};

const BASKETS = [['milk'], ['milk', 'eggs'], ['milk', 'eggs', 'bread'], ['rice', 'butter'], ['toilet paper']];
const json = { headers: { 'Content-Type': 'application/json' } };

export function browse() {
  const items = BASKETS[Math.floor(Math.random() * BASKETS.length)];
  const res = http.post(`${BASE}/api/quotes`, JSON.stringify({ items, zip: '95376' }), json);
  check(res, {
    'quote 200': (r) => r.status === 200,
    'has options': (r) => (r.json('options') ?? []).length > 0,
  });
  sleep(Math.random() * 3 + 1);
}

export function order() {
  const reg = http.post(`${BASE}/api/auth/register`, JSON.stringify({
    email: `k6+${__VU}-${__ITER}-${Date.now()}@load.test`, password: 'password123', fullName: 'Load Buyer', zip: '95376',
  }), json);
  if (!check(reg, { 'register 201': (r) => r.status === 201 })) return;
  const token = reg.json('token');
  const auth = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };

  const quote = http.post(`${BASE}/api/quotes`, JSON.stringify({ items: ['milk', 'eggs'], zip: '95376' }), auth);
  if (!check(quote, { 'quote ok': (r) => r.status === 200 })) return;

  const order = http.post(`${BASE}/api/orders`, JSON.stringify({
    quoteId: quote.json('id'),
    storeName: quote.json('options.0.storeName'),
    dropoff: { lat: 37.7397, lng: -121.4252, address: '123 Load St, Tracy CA' },
  }), auth);
  check(order, { 'order 201': (r) => r.status === 201 });
}
