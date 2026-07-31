// Google Shopping via SerpAPI (licensed SERP access) — the legal path to prices for chains
// with no public API: WinCo, Safeway, independents. No direct retailer scraping.

import { config } from '../config.js';
import { nowIso } from './provider.js';
import { mockOffersFor } from './fixtures.js';

const CHAIN_PATTERNS = [
  [/winco/i, 'winco'],
  [/safeway/i, 'safeway'],
  [/target/i, 'target'],
  [/walmart/i, 'walmart'],
  [/kroger|food 4 less|ralphs|fred meyer/i, 'kroger'],
];

export async function searchOffers({ query, zip }) {
  if (config.providersMock) return mockOffersFor(['winco', 'safeway', 'local'], 'google_shopping', query, 0.8);

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', query);
  url.searchParams.set('location', `${zip}, United States`);
  url.searchParams.set('tbs', 'local_avail:1'); // in-stock nearby only
  url.searchParams.set('api_key', config.serpapiKey);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`serpapi ${res.status}`);
  const j = await res.json();

  return (j.shopping_results ?? [])
    .filter((r) => r.extracted_price != null && r.source)
    .map((r) => {
      const chain = CHAIN_PATTERNS.find(([re]) => re.test(r.source))?.[1] ?? 'local';
      return {
        provider: 'google_shopping',
        storeChain: chain,
        storeName: r.source,
        location: r.store_location ?? null, // resolved to Places store point in aggregator enrichment
        itemQuery: query,
        itemName: r.title,
        basePriceCents: Math.round(r.extracted_price * 100),
        inStock: true,
        confidence: 0.8,
        fetchedAt: nowIso(),
      };
    });
}
