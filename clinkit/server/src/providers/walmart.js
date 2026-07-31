// Walmart Affiliate/Developer API — signed requests (consumer ID + RSA-SHA256 signature).
// https://developer.walmart.com

import crypto from 'node:crypto';
import { config } from '../config.js';
import { nowIso } from './provider.js';
import { mockOffersFor } from './fixtures.js';

function signedHeaders() {
  const ts = Date.now().toString();
  const { consumerId, keyVersion, privateKeyPem } = config.walmart;
  const canonical = `${consumerId}\n${ts}\n${keyVersion}\n`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(canonical), privateKeyPem).toString('base64');
  return {
    'WM_CONSUMER.ID': consumerId,
    'WM_CONSUMER.INTIMESTAMP': ts,
    'WM_SEC.KEY_VERSION': keyVersion,
    'WM_SEC.AUTH_SIGNATURE': signature,
  };
}

export async function searchOffers({ query, zip }) {
  if (config.providersMock) return mockOffersFor(['walmart', 'target'], 'walmart', query, 0.9);
  // Target-chain rows come from partner catalogs in prod; affiliate search is Walmart-only.

  const res = await fetch(
    `https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search?query=${encodeURIComponent(query)}&numItems=5&zipCode=${zip}`,
    { headers: signedHeaders() },
  );
  if (!res.ok) throw new Error(`walmart search ${res.status}`);
  const j = await res.json();
  return (j.items ?? [])
    .filter((it) => it.salePrice != null)
    .map((it) => ({
      provider: 'walmart',
      storeChain: 'walmart',
      storeName: `Walmart (${zip})`,
      location: it.storeLocation ?? { lat: NaN, lng: NaN }, // enriched via Places store lookup in aggregator
      itemQuery: query,
      itemName: it.name,
      basePriceCents: Math.round(it.salePrice * 100),
      unit: it.size,
      inStock: it.stock === 'Available',
      confidence: 0.9,
      fetchedAt: nowIso(),
    }));
}
