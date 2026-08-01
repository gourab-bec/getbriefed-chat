// Briskly / POS feeds for opted-in local stores — event-driven inventory pushed into
// store_offers; this adapter reads the DB cache rather than calling out per-query.

import { config, providerLive } from '../config.js';
import { nowIso } from './provider.js';
import { mockOffersFor } from './fixtures.js';
import { query as dbQuery } from '../db/pool.js';

export async function searchOffers({ query, zip }) {
  if (!providerLive('briskly')) return mockOffersFor(['local'], 'briskly', query, 1.0);

  const { rows } = await dbQuery(
    `SELECT s.chain, s.name, ST_Y(s.point::geometry) AS lat, ST_X(s.point::geometry) AS lng,
            o.item_name, o.base_price_cents, o.in_stock, o.fetched_at
       FROM store_offers o JOIN stores s ON s.id = o.store_id
      WHERE s.source = 'briskly' AND o.item_query ILIKE '%' || $1 || '%' AND s.zip = $2
        AND o.fetched_at > now() - interval '24 hours'`,
    [query, zip],
  );
  return rows.map((r) => ({
    provider: 'briskly',
    storeChain: r.chain,
    storeName: r.name,
    location: { lat: r.lat, lng: r.lng },
    itemQuery: query,
    itemName: r.item_name,
    basePriceCents: r.base_price_cents,
    inStock: r.in_stock,
    confidence: 1.0,
    fetchedAt: r.fetched_at?.toISOString?.() ?? nowIso(),
  }));
}
