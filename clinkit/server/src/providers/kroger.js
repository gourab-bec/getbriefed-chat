// Kroger Products API (official, OAuth2 client-credentials) — store-level prices & stock.
// https://developer.kroger.com

import { config, providerLive } from '../config.js';
import { nowIso } from './provider.js';
import { mockOffersFor } from './fixtures.js';

let token = null; // { value, expiresAt }

async function getToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${config.kroger.clientId}:${config.kroger.clientSecret}`).toString('base64');
  const res = await fetch('https://api.kroger.com/v1/connect/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=product.compact',
  });
  if (!res.ok) throw new Error(`kroger oauth ${res.status}`);
  const j = await res.json();
  token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return token.value;
}

export async function searchOffers({ query, zip }) {
  if (!providerLive('kroger')) return mockOffersFor(['kroger'], 'kroger', query, 1.0);

  const t = await getToken();
  const locRes = await fetch(
    `https://api.kroger.com/v1/locations?filter.zipCode.near=${zip}&filter.limit=3`,
    { headers: { Authorization: `Bearer ${t}` } },
  );
  if (!locRes.ok) throw new Error(`kroger locations ${locRes.status}`);
  const locations = (await locRes.json()).data ?? [];

  const offers = [];
  for (const loc of locations) {
    const prodRes = await fetch(
      `https://api.kroger.com/v1/products?filter.term=${encodeURIComponent(query)}&filter.locationId=${loc.locationId}&filter.limit=5`,
      { headers: { Authorization: `Bearer ${t}` } },
    );
    if (!prodRes.ok) continue;
    for (const p of (await prodRes.json()).data ?? []) {
      const item = p.items?.[0];
      const price = item?.price?.promo || item?.price?.regular;
      if (!price) continue;
      offers.push({
        provider: 'kroger',
        storeChain: 'kroger',
        storeName: loc.name,
        location: { lat: Number(loc.geolocation?.latitude), lng: Number(loc.geolocation?.longitude) },
        itemQuery: query,
        itemName: p.description,
        basePriceCents: Math.round(price * 100),
        unit: item?.size,
        inStock: item?.inventory?.stockLevel !== 'TEMPORARILY_OUT_OF_STOCK',
        confidence: 1.0,
        fetchedAt: nowIso(),
      });
    }
  }
  return offers;
}
