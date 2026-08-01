// Comparison engine + full quote pipeline in mock mode: the core promise —
// "milk is cheapest at WinCo in 95391" — must hold end to end.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStoreOptions, normalizeQuery, offerMatches } from '../src/core/comparison.js';
import { offersForBasket } from '../src/providers/index.js';
import { zipToPoint } from '../src/core/geo.js';
import { calculateTax, zipToState } from '../src/services/avalara.js';
import { surgeMultiplier } from '../src/core/surge.js';

// Tracy proper (95376): all mock stores sit inside the 3-mi free-delivery zone, so basket
// price dominates the ranking. 95391 (Mountain House) is ~9 mi out — used below to prove
// distance fees can legitimately flip the winner.
const BUYER = zipToPoint('95376');

test('normalizeQuery collapses case/punctuation/whitespace', () => {
  assert.equal(normalizeQuery('  Whole   MILK, 1-gal!! '), 'whole milk 1 gal');
  assert.ok(offerMatches('milk', { itemQuery: 'milk', itemName: 'Whole Milk 1 Gal' }));
  assert.ok(!offerMatches('almond milk', { itemQuery: 'milk', itemName: 'Whole Milk 1 Gal' }));
});

test('mock aggregator: milk in Tracy → WinCo $2.99 is the cheapest option', async () => {
  const offers = await offersForBasket({ itemQueries: ['milk'], zip: '95376', ...BUYER, radiusMi: 10 });
  assert.ok(offers.length >= 4, 'expect offers from multiple chains');
  const options = buildStoreOptions(['milk'], offers, BUYER);
  assert.equal(options[0].storeChain, 'winco');
  assert.equal(options[0].lines[0].basePriceCents, 299);
  assert.ok(options[0].isCheapest);
  const walmart = options.find((o) => o.storeChain === 'walmart');
  assert.ok(walmart.totals.buyerTotalCents > options[0].totals.buyerTotalCents);
});

test('from 95391 (Mountain House, ~9 mi out) mileage fees can flip the winner — totals, not shelf price, decide', async () => {
  const mh = zipToPoint('95391');
  const offers = await offersForBasket({ itemQueries: ['milk'], zip: '95391', ...mh, radiusMi: 10 });
  const options = buildStoreOptions(['milk'], offers, mh);
  assert.ok(options.length >= 2);
  // Every option pays the per-mile fee beyond 3 mi, and ranking is strictly by buyer total.
  for (const o of options) assert.ok(o.totals.deliveryFeeCents > 399);
  for (let i = 1; i < options.length; i++) {
    assert.ok(options[i].totals.buyerTotalCents >= options[i - 1].totals.buyerTotalCents);
  }
});

test('basket milk+eggs+bread: full totals ranked, savings computed, provenance kept', async () => {
  const items = ['milk', 'eggs', 'bread'];
  const offers = await offersForBasket({ itemQueries: items, zip: '95376', ...BUYER, radiusMi: 10 });
  const options = buildStoreOptions(items, offers, BUYER);

  const winco = options[0];
  assert.equal(winco.storeChain, 'winco');
  assert.equal(winco.totals.itemsBaseCents, 299 + 249 + 179); // $7.27
  assert.ok(winco.coversAllItems);
  assert.ok(winco.totals.buyerTotalCents > winco.totals.itemsBaseCents, 'total includes markup+delivery');
  assert.ok(options.savingsCents > 0, 'savings vs priciest full-coverage store');
  for (const line of winco.lines) {
    assert.ok(line.provider && line.fetchedAt && line.confidence > 0);
  }
  // Kroger eggs are mocked out-of-stock — surfaced, not hidden.
  const kroger = options.find((o) => o.storeChain === 'kroger');
  assert.ok(kroger.lines.find((l) => l.query === 'eggs').inStock === false);
});

test('stores outside radius are excluded; partial-coverage stores rank below full', async () => {
  const nearOnly = buildStoreOptions(
    ['milk'],
    [{ provider: 'x', storeChain: 'local', storeName: 'Far Store', location: { lat: 38.9, lng: -120.0 },
       itemQuery: 'milk', itemName: 'Milk', basePriceCents: 100, inStock: true, confidence: 1, fetchedAt: '' }],
    BUYER,
  );
  assert.equal(nearOnly.length, 0);

  const offers = await offersForBasket({ itemQueries: ['milk', 'toilet paper'], zip: '95376', ...BUYER });
  const options = buildStoreOptions(['milk', 'toilet paper'], offers, BUYER);
  const covered = options.filter((o) => o.coversAllItems);
  const partial = options.filter((o) => !o.coversAllItems);
  if (partial.length) {
    assert.ok(options.indexOf(partial[0]) > options.indexOf(covered[covered.length - 1]));
  }
});

test('surge raises totals but never shelf prices; tax mock exempts CA groceries', async () => {
  const offers = await offersForBasket({ itemQueries: ['milk'], zip: '95376', ...BUYER });
  const calm = buildStoreOptions(['milk'], offers, BUYER, { surgeMultiplier: 1 });
  const busy = buildStoreOptions(['milk'], offers, BUYER, { surgeMultiplier: 2 });
  assert.equal(calm[0].lines[0].basePriceCents, busy[0].lines[0].basePriceCents);
  assert.ok(busy[0].totals.buyerTotalCents > calm[0].totals.buyerTotalCents);

  assert.equal(zipToState('95391'), 'CA');
  const tax = await calculateTax({ zip: '95391', lines: [{ itemName: 'Milk', priceCents: 299 }] });
  assert.equal(tax.taxCents, 0); // unprepared food exempt in CA
  const taxable = await calculateTax({ zip: '95391', lines: [{ itemName: 'Batteries', priceCents: 1000, taxCode: 'P0000000' }] });
  assert.equal(taxable.taxCents, 83); // 8.25%
});

test('surge multiplier bounds and behavior', () => {
  assert.equal(surgeMultiplier({ openRequests: 0, onlineRunners: 5 }), 1);
  assert.equal(surgeMultiplier({ openRequests: 5, onlineRunners: 5, hourLocal: 15 }), 1);
  assert.ok(surgeMultiplier({ openRequests: 10, onlineRunners: 2, hourLocal: 18 }) > 1.5);
  assert.equal(surgeMultiplier({ openRequests: 100, onlineRunners: 1 }), 2.5); // capped
  assert.ok(surgeMultiplier({ openRequests: 3, onlineRunners: 0 }) >= 1.5);
});
