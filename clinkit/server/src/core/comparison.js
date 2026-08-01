// Cross-store basket comparison: takes raw offers from all providers and produces
// ranked per-store options with full estimated buyer totals.

import { withinRadius, etaWindowMin } from './geo.js';
import { computeTotals, DEFAULT_RUNNER_MARKUP_PCT } from './pricing.js';

/** Normalize an item query for matching/caching: lowercase, trim, collapse spaces, strip punctuation. */
export function normalizeQuery(q) {
  return String(q).toLowerCase().replace(/[^\w\s%]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Group offers by store and pick the best (cheapest in-stock) offer per requested item.
 * @param {string[]} itemQueries        buyer's requested items
 * @param {import('../providers/provider.js').Offer[]} offers  flat list from aggregator
 * @param {{lat:number,lng:number}} buyerPoint
 * @param {Object} [opts]
 * @param {number} [opts.radiusMi=10]
 * @param {number} [opts.surgeMultiplier=1]
 * @param {number} [opts.taxRate=0]
 * @param {number} [opts.runnerMarkupPct=10]
 * @returns {Array<StoreOption>} sorted cheapest-first; [0] gets isCheapest when it covers all items
 */
export function buildStoreOptions(itemQueries, offers, buyerPoint, opts = {}) {
  const {
    radiusMi = 10,
    surgeMultiplier = 1,
    taxRate = 0,
    runnerMarkupPct = DEFAULT_RUNNER_MARKUP_PCT,
  } = opts;
  const queries = itemQueries.map(normalizeQuery);

  // Bucket offers by store identity (chain+name+rounded location).
  const stores = new Map();
  for (const o of offers) {
    if (!o?.location || !Number.isFinite(o.basePriceCents)) continue;
    const key = `${o.storeChain}|${o.storeName}|${o.location.lat.toFixed(3)},${o.location.lng.toFixed(3)}`;
    if (!stores.has(key)) {
      stores.set(key, { storeChain: o.storeChain, storeName: o.storeName, location: o.location, offers: [] });
    }
    stores.get(key).offers.push(o);
  }

  // Radius filter + per-item best offer selection.
  const inRange = withinRadius(buyerPoint, [...stores.values()], radiusMi);
  const options = [];
  for (const store of inRange) {
    const lines = [];
    const missing = [];
    for (const q of queries) {
      const matches = store.offers.filter((o) => offerMatches(q, o));
      const inStock = matches.filter((o) => o.inStock !== false);
      const best = (inStock.length ? inStock : matches).sort((a, b) => a.basePriceCents - b.basePriceCents)[0];
      if (!best) { missing.push(q); continue; }
      lines.push({
        query: q,
        itemName: best.itemName,
        basePriceCents: best.basePriceCents,
        inStock: best.inStock !== false,
        provider: best.provider,
        confidence: best.confidence ?? 0.8,
        fetchedAt: best.fetchedAt,
      });
    }
    if (!lines.length) continue;

    const itemsBaseCents = lines.reduce((s, l) => s + l.basePriceCents, 0);
    const totals = computeTotals({
      itemsBaseCents,
      runnerMarkupPct,
      surgeMultiplier,
      storeToBuyerMi: store.distanceMi,
      taxRate,
      taxableBaseCents: 0, // groceries default-exempt; Avalara adapter overrides per line
    });
    options.push({
      storeChain: store.storeChain,
      storeName: store.storeName,
      location: store.location,
      distanceMi: store.distanceMi,
      lines,
      missingItems: missing,
      coversAllItems: missing.length === 0,
      minConfidence: Math.min(...lines.map((l) => l.confidence)),
      eta: etaWindowMin(store.distanceMi, lines.length),
      totals,
      isCheapest: false,
      isFastest: false,
    });
  }

  // Rank: full-coverage options first, then by buyer total, then distance.
  options.sort(
    (a, b) =>
      Number(b.coversAllItems) - Number(a.coversAllItems) ||
      a.totals.buyerTotalCents - b.totals.buyerTotalCents ||
      a.distanceMi - b.distanceMi,
  );
  if (options[0]?.coversAllItems) options[0].isCheapest = true;
  const fastest = [...options].sort((a, b) => a.eta.lowMin - b.eta.lowMin)[0];
  if (fastest) fastest.isFastest = true;

  // Savings banner data: cheapest full-coverage vs priciest full-coverage.
  const full = options.filter((o) => o.coversAllItems);
  const savingsCents = full.length >= 2
    ? full[full.length - 1].totals.buyerTotalCents - full[0].totals.buyerTotalCents
    : 0;
  return Object.assign(options, { savingsCents });
}

/** Loose token match: every token of the query appears in the offer's name or original query tag. */
export function offerMatches(normQuery, offer) {
  const hay = normalizeQuery(`${offer.itemQuery ?? ''} ${offer.itemName ?? ''}`);
  return normQuery.split(' ').every((tok) => hay.includes(tok));
}
