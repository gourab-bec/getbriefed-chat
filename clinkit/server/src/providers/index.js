// Aggregator: fan out one item query to all providers with hard timeouts, merge whatever
// settles, cache per (zip, query) in Redis. Never let one provider block a quote.

import { withTimeout } from './provider.js';
import { normalizeQuery } from '../core/comparison.js';
import * as kroger from './kroger.js';
import * as walmart from './walmart.js';
import * as instacart from './instacart.js';
import * as briskly from './briskly.js';
import * as googleShopping from './googleShopping.js';
import { cacheGet, cacheSet } from '../redis.js';
import { withBreaker, coalesce } from './breaker.js';

const PROVIDERS = [
  ['kroger', kroger],
  ['walmart', walmart],
  ['instacart', instacart],
  ['briskly', briskly],
  ['google_shopping', googleShopping],
];
const PROVIDER_TIMEOUT_MS = 2500;
const CACHE_TTL_S = 15 * 60;

/** Fetch offers for one item query across all providers (cached). */
export async function offersForQuery({ query, zip, lat, lng, radiusMi = 10 }) {
  const norm = normalizeQuery(query);
  const cacheKey = `offer:${zip}:${norm}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  // Coalesce concurrent identical lookups; breaker fails a sick provider fast so the
  // quote never waits on it and paid-API quota isn't burned on a dead key.
  return coalesce(cacheKey, () => fetchAndCache({ norm, cacheKey, zip, lat, lng, radiusMi }));
}

async function fetchAndCache({ norm, cacheKey, zip, lat, lng, radiusMi }) {
  const settled = await Promise.allSettled(
    PROVIDERS.map(([name, p]) =>
      withBreaker(name, () =>
        withTimeout(p.searchOffers({ query: norm, zip, lat, lng, radiusMi }), PROVIDER_TIMEOUT_MS, name),
      ),
    ),
  );
  const offers = [];
  for (const [i, r] of settled.entries()) {
    if (r.status === 'fulfilled') offers.push(...r.value);
    else console.warn(`[aggregator] ${PROVIDERS[i][0]} failed: ${r.reason?.message}`);
  }
  if (offers.length) await cacheSet(cacheKey, offers, CACHE_TTL_S);
  return offers;
}

/** Fetch offers for a whole basket (queries run concurrently). */
export async function offersForBasket({ itemQueries, zip, lat, lng, radiusMi = 10 }) {
  const perItem = await Promise.all(
    itemQueries.map((query) => offersForQuery({ query, zip, lat, lng, radiusMi })),
  );
  return perItem.flat();
}
