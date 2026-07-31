// Instacart Developer Platform — partner catalog lookup + optional fulfillment fallback.
// Runs in mock mode until partner approval (see docs/02-API-INTEGRATIONS.md §3).

import { config } from '../config.js';
import { nowIso } from './provider.js';
import { mockOffersFor } from './fixtures.js';

export async function searchOffers({ query, zip }) {
  if (config.providersMock) return mockOffersFor(['safeway', 'target'], 'instacart', query, 0.85);

  const res = await fetch('https://connect.instacart.com/idp/v1/products/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.instacartApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, postal_code: zip, limit: 10 }),
  });
  if (!res.ok) throw new Error(`instacart ${res.status}`);
  const j = await res.json();
  return (j.products ?? []).map((p) => ({
    provider: 'instacart',
    storeChain: p.retailer_key ?? 'local',
    storeName: p.retailer_name,
    location: p.store_location ?? null,
    itemQuery: query,
    itemName: p.name,
    basePriceCents: Math.round(Number(p.price) * 100),
    unit: p.size,
    inStock: p.availability !== 'out_of_stock',
    confidence: 0.85,
    fetchedAt: nowIso(),
  }));
}
