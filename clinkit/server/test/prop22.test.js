// Prop 22 engaged-time compliance: floor math, GPS filtering, fallbacks, settlement.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  engagedHourFloorCents, engagedMilesFromTrail, estimatedEngagedMiles,
  orderEngagement, floorCents, periodSettlement, healthcareStipendTier,
  MAX_GPS_ACCURACY_M, P22_RATES_2026,
} from '../src/core/prop22.js';

const STORE = { lat: 37.7513, lng: -121.4331 };  // WinCo Tracy
const DROP = { lat: 37.7397, lng: -121.4252 };   // ~1 mi away

test('2026 engaged-hour floor: 120% × $16.90 = $20.28; city ordinance overrides upward', () => {
  assert.equal(engagedHourFloorCents(undefined), 2028);
  assert.equal(engagedHourFloorCents('tracy'), 2028);            // state wage applies
  assert.equal(engagedHourFloorCents('san francisco'), Math.round(1907 * 1.2));
  assert.equal(P22_RATES_2026.perMileCents, 37);                 // CA Treasurer 2026 adjustment
});

test('GPS mileage counts only accurate pings and drops teleport artifacts', () => {
  const trail = [
    { lat: 37.7513, lng: -121.4331, at: 0, accuracyM: 10 },
    { lat: 37.7480, lng: -121.4300, at: 5000, accuracyM: 20 },
    { lat: 38.9000, lng: -120.0000, at: 10000, accuracyM: 15 },  // 80-mi teleport — skip leg
    { lat: 37.7450, lng: -121.4280, at: 15000, accuracyM: 30 },
    { lat: 37.7397, lng: -121.4252, at: 20000, accuracyM: 500 }, // low accuracy — excluded
  ];
  const r = engagedMilesFromTrail(trail);
  assert.equal(r.goodPings, 4);
  assert.equal(r.totalPings, 5);
  assert.equal(r.source, 'gps');
  assert.ok(r.miles > 0.2 && r.miles < 1.5, `sane local miles, got ${r.miles}`);
});

test('unusable trail falls back to route estimate — runner never zeroed for bad GPS', () => {
  const badTrail = [{ lat: 37.75, lng: -121.43, at: 0, accuracyM: MAX_GPS_ACCURACY_M + 1 }];
  const eng = orderEngagement({
    engagedStartAt: '2026-07-31T10:00:00Z',
    engagedEndAt: '2026-07-31T10:30:00Z',
    gpsTrail: badTrail,
    storePoint: STORE,
    dropoffPoint: DROP,
  });
  assert.equal(eng.milesSource, 'estimated');
  assert.equal(eng.engagedMiles, estimatedEngagedMiles(STORE, DROP));
  assert.ok(eng.engagedMiles > 0.5);
  assert.equal(eng.engagedMs, 30 * 60 * 1000);
});

test('floor math: 30 engaged minutes + 2 miles', () => {
  const f = floorCents({ engagedMs: 30 * 60 * 1000, engagedMiles: 2 });
  assert.equal(f.timeCents, Math.round(2028 * 0.5)); // 1014
  assert.equal(f.mileCents, 74);
  assert.equal(f.totalCents, 1088);
});

test('period settlement: top-up owed when net earnings under floor, zero when above', () => {
  // Slow week: 3 orders, 45 engaged min each, 3 mi each, $4.70 net each.
  const slow = periodSettlement({
    orders: Array.from({ length: 3 }, () => ({
      engagedMs: 45 * 60 * 1000, engagedMiles: 3, netEarningsCents: 470,
    })),
  });
  const expectedFloor = Math.round(2028 * 2.25) + Math.round(37 * 9);
  assert.equal(slow.floorCents, expectedFloor);
  assert.equal(slow.topUpCents, expectedFloor - 1410);
  assert.ok(slow.topUpCents > 0);

  // Busy week with tips: earnings clear the floor — no top-up, never negative.
  const busy = periodSettlement({
    orders: Array.from({ length: 3 }, () => ({
      engagedMs: 45 * 60 * 1000, engagedMiles: 3, netEarningsCents: 1600, tipsCents: 500,
    })),
  });
  assert.equal(busy.topUpCents, 0);
  assert.equal(busy.netEarningsCents, 3 * 2100);
});

test('healthcare stipend tiers at 15/25 engaged hours per week', () => {
  assert.equal(healthcareStipendTier(10), 'none');
  assert.equal(healthcareStipendTier(15), 'half');
  assert.equal(healthcareStipendTier(24.9), 'half');
  assert.equal(healthcareStipendTier(25), 'full');
});

test('engagement record survives missing timestamps without NaN poisoning', () => {
  const eng = orderEngagement({ engagedStartAt: null, engagedEndAt: undefined, gpsTrail: [], storePoint: STORE, dropoffPoint: DROP });
  assert.equal(eng.engagedMs, 0);
  assert.ok(Number.isFinite(eng.engagedMiles));
  const settle = periodSettlement({ orders: [{ engagedMs: eng.engagedMs, engagedMiles: eng.engagedMiles, netEarningsCents: 0 }] });
  assert.ok(Number.isFinite(settle.topUpCents));
});
