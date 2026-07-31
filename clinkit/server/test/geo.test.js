import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceMi, withinRadius, etaWindowMin, zipToPoint } from '../src/core/geo.js';

const TRACY = { lat: 37.7397, lng: -121.4252 };
const SF = { lat: 37.7749, lng: -122.4194 };

test('haversine: Tracy → SF ≈ 54–56 mi', () => {
  const d = distanceMi(TRACY, SF);
  assert.ok(d > 53 && d < 57, `got ${d}`);
});

test('withinRadius filters and sorts by distance', () => {
  const stores = [
    { name: 'far', location: SF },
    { name: 'near', location: { lat: 37.7513, lng: -121.4331 } },   // ~1 mi
    { name: 'mid', location: { lat: 37.80, lng: -121.50 } },        // ~6 mi
  ];
  const r = withinRadius(TRACY, stores, 10);
  assert.deepEqual(r.map((s) => s.name), ['near', 'mid']);
  assert.ok(r[0].distanceMi < r[1].distanceMi);
  assert.ok(r.every((s) => s.distanceMi <= 10));
});

test('ETA window clamps to 10–60 min and grows with distance/items', () => {
  const close = etaWindowMin(1, 3);
  const far = etaWindowMin(9, 10);
  assert.ok(close.lowMin >= 10 && close.highMin <= 60);
  assert.ok(far.lowMin > close.lowMin);
  assert.ok(far.highMin <= 60);
  assert.ok(close.lowMin < close.highMin);
});

test('zip centroids: 95391 resolves, unknown returns null', () => {
  assert.ok(zipToPoint('95391'));
  assert.equal(zipToPoint('00000'), null);
});
