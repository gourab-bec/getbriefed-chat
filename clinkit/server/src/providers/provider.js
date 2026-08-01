// Shared provider contract. Each adapter exports:
//   searchOffers({ query, zip, lat, lng, radiusMi }) => Promise<Offer[]>
// and must throw (or reject) rather than hang — the aggregator enforces a hard timeout.

/**
 * @typedef {Object} Offer
 * @property {string} provider        'kroger'|'walmart'|'instacart'|'briskly'|'google_shopping'|'google_places'
 * @property {string} storeChain      'kroger'|'walmart'|'winco'|'target'|'safeway'|'local'
 * @property {string} storeName
 * @property {{lat:number,lng:number}} location
 * @property {string} itemQuery       the normalized query this offer answers
 * @property {string} itemName
 * @property {number} basePriceCents
 * @property {string} [unit]
 * @property {boolean} inStock
 * @property {number} confidence      0..1
 * @property {string} fetchedAt       ISO timestamp
 */

/** Wrap a promise with a timeout so one slow provider can't stall a quote. */
export function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

export const nowIso = () => new Date().toISOString();
