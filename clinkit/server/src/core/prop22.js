// Prop 22 engaged-time compliance engine (CA Bus. & Prof. Code §7451 et seq.).
// Pure functions, integer cents.
//
// Engaged time: Runner bid ACCEPTED (order → matched) until DELIVERED with photo proof.
// Net earnings floor per earning period (≤14 days):
//   120% × applicable min wage × engaged hours  +  per-mile rate × engaged miles
// Net earnings counted toward the floor: markup + delivery fee − platform fee + tips
// (item reimbursement is expense pass-through, never earnings). If net < floor, the
// platform owes the difference ("top-up") no later than the next earning period.
// 2026 rates (verify annually — CA Treasurer publishes the per-mile adjustment):
//   min wage $16.90/hr statewide → engaged-hour floor $20.28 · per-mile $0.37.

import { distanceMi } from './geo.js';

export const P22_RATES_2026 = {
  minWageCentsDefault: 1690,
  // City/county minimum-wage ordinances override the state wage where higher.
  cityMinWageCents: {
    // corridor launch cities use state wage; entries added per city-expansion runbook
    'los angeles': 1778, 'san francisco': 1907, 'san jose': 1795, // examples — re-verify at expansion
  },
  perMileCents: 37,
  floorMultiplier: 1.2,
  periodMaxDays: 14,
};

export const MAX_GPS_ACCURACY_M = 50;   // pings worse than this don't count toward mileage
export const MIN_TRAIL_COVERAGE = 0.5;  // <50% of expected route covered by good pings → fallback
export const ROUTE_FACTOR = 1.3;        // straight-line → road distance estimate

/** Hourly engaged floor in cents for a city (120% of applicable min wage). */
export function engagedHourFloorCents(city, rates = P22_RATES_2026) {
  const wage = rates.cityMinWageCents[String(city ?? '').toLowerCase()] ?? rates.minWageCentsDefault;
  return Math.round(wage * rates.floorMultiplier);
}

/**
 * Engaged miles from a GPS trail, filtering out low-accuracy pings.
 * @param {Array<{lat:number,lng:number,at:number,accuracyM?:number}>} trail
 * @returns {{miles:number, goodPings:number, totalPings:number, source:'gps'|'insufficient'}}
 */
export function engagedMilesFromTrail(trail, maxAccuracyM = MAX_GPS_ACCURACY_M) {
  const good = (trail ?? []).filter(
    (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) &&
           (p.accuracyM == null || p.accuracyM <= maxAccuracyM),
  );
  let miles = 0;
  for (let i = 1; i < good.length; i++) {
    const leg = distanceMi(good[i - 1], good[i]);
    if (leg < 2) miles += leg; // drop teleport artifacts (>2mi between 5s pings)
  }
  return {
    miles: Math.round(miles * 100) / 100,
    goodPings: good.length,
    totalPings: (trail ?? []).length,
    source: good.length >= 2 ? 'gps' : 'insufficient',
  };
}

/** Fallback estimate when the trail is unusable: store→dropoff straight-line × road factor. */
export function estimatedEngagedMiles(storePoint, dropoffPoint) {
  if (!storePoint || !dropoffPoint) return 0;
  return Math.round(distanceMi(storePoint, dropoffPoint) * ROUTE_FACTOR * 100) / 100;
}

/**
 * Per-order engagement record (attached to the order at delivery; the authoritative
 * settlement aggregates these per earning period).
 */
export function orderEngagement({ engagedStartAt, engagedEndAt, gpsTrail, storePoint, dropoffPoint }) {
  const startMs = Date.parse(engagedStartAt);
  const endMs = Date.parse(engagedEndAt);
  const engagedMs = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : 0;

  const fromTrail = engagedMilesFromTrail(gpsTrail);
  const expected = estimatedEngagedMiles(storePoint, dropoffPoint);
  // Use GPS miles when the trail is usable AND covers a plausible share of the route;
  // otherwise fall back to the route estimate (never zero a runner's miles for bad GPS).
  const useGps = fromTrail.source === 'gps' && (expected === 0 || fromTrail.miles >= expected * MIN_TRAIL_COVERAGE);
  return {
    engagedMs,
    engagedMiles: useGps ? fromTrail.miles : expected,
    milesSource: useGps ? 'gps' : 'estimated',
    gpsQuality: { goodPings: fromTrail.goodPings, totalPings: fromTrail.totalPings },
  };
}

/** Floor for a span of engaged time + miles. */
export function floorCents({ engagedMs, engagedMiles, city, rates = P22_RATES_2026 }) {
  const hours = engagedMs / 3_600_000;
  const timeCents = Math.round(engagedHourFloorCents(city, rates) * hours);
  const mileCents = Math.round(rates.perMileCents * engagedMiles);
  return { timeCents, mileCents, totalCents: timeCents + mileCents };
}

/**
 * Earning-period settlement (period ≤ 14 days).
 * @param {Array<{engagedMs:number, engagedMiles:number, netEarningsCents:number, tipsCents?:number}>} orders
 *        completed orders in the period (netEarningsCents = markup + delivery − platform fee)
 * @returns settlement with topUpCents owed (0 if net ≥ floor)
 */
export function periodSettlement({ orders, city, rates = P22_RATES_2026 }) {
  const engagedMs = orders.reduce((s, o) => s + (o.engagedMs ?? 0), 0);
  const engagedMiles = Math.round(orders.reduce((s, o) => s + (o.engagedMiles ?? 0), 0) * 100) / 100;
  const netEarningsCents = orders.reduce((s, o) => s + (o.netEarningsCents ?? 0) + (o.tipsCents ?? 0), 0);
  const floor = floorCents({ engagedMs, engagedMiles, city, rates });
  return {
    orders: orders.length,
    engagedMs,
    engagedHours: Math.round((engagedMs / 3_600_000) * 100) / 100,
    engagedMiles,
    netEarningsCents,
    floorCents: floor.totalCents,
    floorBreakdown: floor,
    topUpCents: Math.max(0, floor.totalCents - netEarningsCents),
  };
}

/**
 * Healthcare stipend tier from average engaged hours/week over the quarter:
 * ≥25 h/wk → 100% of the average CCSB bronze premium contribution; 15–25 → 50%; else none.
 */
export function healthcareStipendTier(avgEngagedHoursPerWeek) {
  if (avgEngagedHoursPerWeek >= 25) return 'full';
  if (avgEngagedHoursPerWeek >= 15) return 'half';
  return 'none';
}
