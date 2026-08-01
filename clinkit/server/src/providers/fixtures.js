// Deterministic mock offers (PROVIDERS_MOCK=1) mirroring real API shapes, centered on 95391 (Tracy, CA).
// Lets the entire compare→order→bid→deliver flow run with zero external keys.

import { nowIso } from './provider.js';

export const MOCK_STORES = {
  winco:   { storeChain: 'winco',   storeName: 'WinCo Foods Tracy',        location: { lat: 37.7513, lng: -121.4331 } },
  walmart: { storeChain: 'walmart', storeName: 'Walmart Supercenter Tracy', location: { lat: 37.7609, lng: -121.4520 } },
  kroger:  { storeChain: 'kroger',  storeName: 'Food 4 Less (Kroger)',      location: { lat: 37.7420, lng: -121.4270 } },
  safeway: { storeChain: 'safeway', storeName: 'Safeway Tracy',             location: { lat: 37.7391, lng: -121.4436 } },
  target:  { storeChain: 'target',  storeName: 'Target Tracy',              location: { lat: 37.7622, lng: -121.4468 } },
  local:   { storeChain: 'local',   storeName: 'Tracy Corner Market',       location: { lat: 37.7450, lng: -121.4380 } },
  costco:  { storeChain: 'costco',  storeName: 'Costco Tracy (membership)', location: { lat: 37.7280, lng: -121.4410 } },
};

// priceCents per canonical item per chain (winco intentionally cheapest on staples — matches reality).
const CATALOG = {
  // costco entries are bulk pack sizes — absolute shelf price, so ranking stays honest.
  'milk':  { name: 'Whole Milk 1 Gal',      unit: 'gal',  prices: { winco: 299, walmart: 324, kroger: 349, safeway: 389, target: 339, local: 419, costco: 549 } },
  'eggs':  { name: 'Large Eggs 12 ct',      unit: 'dozen', prices: { winco: 249, walmart: 262, kroger: 289, safeway: 329, target: 279, local: 350 } },
  'bread': { name: 'Wheat Sandwich Bread',  unit: 'loaf', prices: { winco: 179, walmart: 188, kroger: 219, safeway: 249, target: 199, local: 275 } },
  'butter': { name: 'Salted Butter 1 lb',   unit: 'lb',   prices: { winco: 379, walmart: 397, kroger: 429, safeway: 469, target: 419, local: 499 } },
  'bananas': { name: 'Bananas per lb',      unit: 'lb',   prices: { winco: 58,  walmart: 62,  kroger: 69,  safeway: 79,  target: 65, local: 89 } },
  'chicken breast': { name: 'Chicken Breast per lb', unit: 'lb', prices: { winco: 299, walmart: 318, kroger: 349, safeway: 399, target: 329, local: 450 } },
  'rice': { name: 'Long Grain Rice 5 lb',   unit: 'bag',  prices: { winco: 449, walmart: 472, kroger: 519, safeway: 579, target: 489, local: 625 } },
  'toilet paper': { name: 'Bath Tissue 12 Mega', unit: 'pack', prices: { winco: 1099, walmart: 1147, kroger: 1249, safeway: 1399, target: 1189, local: 1550, costco: 2199 } },
};

const OUT_OF_STOCK = new Set(['kroger:eggs']); // exercise low-stock UI path

/** Return mock offers for one chain the way its adapter would. */
export function mockOffersFor(chainKeys, provider, query, confidence) {
  const q = String(query).toLowerCase().trim();
  const hit = Object.entries(CATALOG).find(([k]) => q.includes(k) || k.includes(q));
  if (!hit) return [];
  const [key, item] = hit;
  return chainKeys
    .filter((c) => item.prices[c] != null)
    .map((c) => ({
      provider,
      ...MOCK_STORES[c],
      itemQuery: key,
      itemName: item.name,
      unit: item.unit,
      basePriceCents: item.prices[c],
      inStock: !OUT_OF_STOCK.has(`${c}:${key}`),
      confidence,
      fetchedAt: nowIso(),
    }));
}
