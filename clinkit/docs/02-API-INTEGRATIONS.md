# Clinkit — Store Price/Inventory API Integrations

Every provider implements one interface (`server/src/providers/provider.js`):

```js
/** @typedef {Object} Offer
 *  @property {string} provider      // 'kroger' | 'walmart' | 'instacart' | 'briskly' | 'google_shopping' | 'google_places'
 *  @property {string} storeChain    // 'kroger' | 'walmart' | 'winco' | 'target' | 'local'
 *  @property {string} storeName
 *  @property {{lat:number,lng:number}} location
 *  @property {string} itemName
 *  @property {number} basePriceCents
 *  @property {string} [unit]        // 'each' | 'gal' | 'oz'...
 *  @property {boolean} inStock
 *  @property {number} confidence    // 0..1 (official API = 1.0, SERP = 0.8, crowd = 0.5)
 *  @property {string} fetchedAt     // ISO
 */
// searchOffers({ query, zip, lat, lng, radiusMi }) => Promise<Offer[]>
```

The aggregator (`providers/index.js`) fans out with `Promise.allSettled`, 2.5 s per-provider timeout,
Redis cache (`offer:{zip}:{normQuery}`, TTL 15 min), and merges into ranked options.

---

## 1. Kroger Products API (official) — Kroger, Ralphs, Food 4 Less, Fred Meyer…

- Docs: https://developer.kroger.com — free tier, OAuth2 client-credentials.
- `GET /v1/locations?filter.zipCode.near={zip}` → store IDs in radius.
- `GET /v1/products?filter.term={q}&filter.locationId={id}` → **store-level price** (`items[].price.regular/promo`) and `stockLevel`.
- Env: `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`. Rate: 10k/day free.

## 2. Walmart Developer / Affiliate API (official)

- https://developer.walmart.com (Affiliate API: product search w/ price; Store lookup for nearest).
- Signed requests (consumer ID + RSA key). Env: `WALMART_CONSUMER_ID`, `WALMART_KEY_VERSION`, `WALMART_PRIVATE_KEY`.
- Price is national/online; store-level via `storeId` param where supported — mark `confidence: 0.9`.

## 3. Instacart Developer Platform (partner)

- https://docs.instacart.com/developer_platform_api — retailer catalog + "Create shopping list page" APIs.
- Used two ways: (a) catalog price lookup across partnered retailers (incl. Target-type chains without public APIs), (b) optional fulfillment fallback when no Runner accepts in 10 min.
- Env: `INSTACART_API_KEY`. Requires partner approval → until then adapter runs in mock mode.

## 4. Briskly / POS feeds (opted-in local stores)

- Stores that onboard connect their POS (Briskly Retail API / Square Catalog webhook) → true live inventory pushed to `store_offers` table; `confidence: 1.0`, TTL none (event-driven).
- Env: `BRISKLY_API_KEY`.

## 5. Google Shopping via SerpAPI (licensed SERP) — WinCo & no-API chains

- WinCo has **no public price API** — we use SerpAPI's Google Shopping engine with `location={zip}` + `tbs=local_avail:1` to get local in-stock prices legally (SerpAPI handles SERP licensing/compliance; we do not scrape retailer sites directly, honoring ToS).
- `GET https://serpapi.com/search?engine=google_shopping&q={q}&location={zip}` → filter `source` matching WinCo/local stores → `confidence: 0.8`.
- Env: `SERPAPI_KEY`. Fallback: DataForSEO merchant API.

## 6. Google Places + Maps Platform

- Places Nearby Search discovers local/independent stores in the 5–10 mi radius (`type=grocery_or_supermarket`).
- Distance Matrix for ETA; Geocoding for ZIP→lat/lng. Runner-app navigation deep-links to Google Maps.
- Prices for Places-only stores start as **runner-verified**: first Runner in-store confirms shelf price (photo), cached 24 h, `confidence: 0.5→0.9`.
- Env: `GOOGLE_MAPS_API_KEY`.

## 7. Stripe Connect (payments) & Avalara (tax)

- **Stripe**: Express connected accounts for Runners (KYC + 1099-K handled by Stripe). Buyer pays via PaymentIntent with manual capture (auth at bid-accept, capture at delivery); `application_fee_amount` = platform 5%; destination charge to runner account. Webhooks: `payment_intent.succeeded`, `account.updated`, `transfer.failed`.
- **Avalara AvaTax**: `POST /api/v2/transactions/create` with line items + ship-to ZIP; grocery exemption codes (e.g. CA unprepared food exempt). Mock table fallback ships for dev (`AVALARA_MOCK=1`).

---

## Mock mode

Every adapter honors `PROVIDERS_MOCK=1` (default in dev/test): returns deterministic fixture offers
(e.g. milk in 95391 → WinCo $2.99, Walmart $3.24, Safeway $3.89, Kroger $3.49) so the full
compare→order→bid→deliver flow runs with zero external keys. Fixtures live in
`server/src/providers/fixtures.js` and mirror real response shapes.

## Failure & compliance rules

- Provider timeout 2.5 s; aggregator returns whatever settled — never block a quote on one provider.
- Stale-while-revalidate: serve cached offers up to 30 min while refreshing in background (SQS job).
- Respect robots/ToS: **no direct scraping of retailer sites**; only official APIs + licensed SERP providers.
- Every displayed price carries `provider`, `fetchedAt`, `confidence`; UI shows "verified 12 min ago".
