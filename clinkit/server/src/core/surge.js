// Surge pricing — multiplier on the runner markup only (never on shelf prices).
// Inputs come from Redis counters per geohash cell: open requests vs online runners.

import { clamp } from './geo.js';

/**
 * @param {Object} p
 * @param {number} p.openRequests   unmatched orders in the cell (last 15 min)
 * @param {number} p.onlineRunners  runners online in the cell
 * @param {number} [p.hourLocal]    0–23, buyer-local; peak meal hours nudge surge up
 * @returns {number} multiplier in [1, 2.5], one decimal
 */
export function surgeMultiplier({ openRequests, onlineRunners, hourLocal = 12 }) {
  if (openRequests <= 0) return 1;
  const supply = Math.max(onlineRunners, 1);
  const ratio = openRequests / supply;
  // ratio 1 → 1.0x, 2 → ~1.4x, 4+ → cap
  let m = 1 + Math.max(0, ratio - 1) * 0.4;
  const peak = (hourLocal >= 11 && hourLocal <= 13) || (hourLocal >= 17 && hourLocal <= 20);
  if (peak) m += 0.1;
  if (onlineRunners === 0) m = Math.max(m, 1.5);
  return clamp(Math.round(m * 10) / 10, 1, 2.5);
}
