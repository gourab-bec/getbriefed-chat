# Provider Keys — Self-Serve Acquisition & Auto-Live Switching

**How going live works now:** every adapter checks `providerLive(name)` at request time.
The moment a provider's key exists in the environment, that provider serves real data;
providers without keys keep serving high-confidence mock data. **No code change, no
coordinated cutover — paste one key, redeploy, that provider is live.** Set
`PROVIDERS_MOCK=1` to force everything back to mock (staging safety valve).
Live/mock state per provider is visible at `GET /api/admin/providers`.

> **Why an agent can't fetch these keys for you:** every signup below requires accepting a
> developer ToS on behalf of GetBriefed Inc/LLC and, for payments, identity/banking
> verification. Those are legal acts the account owner must perform. Each is a ≤5-minute
> task; total founder keyboard time to full-live: **~35 minutes**.

| Provider | Signup path (self-serve) | Time | Cost | Env vars |
|---|---|---|---|---|
| **Kroger** | developer.kroger.com → Create account → Register app → check "Products" + "Locations" scopes → keys issued instantly | 5 min | $0 (10k calls/day) | `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET` |
| **Walmart** | developer.walmart.com → Walmart.io account → Affiliate/Content API → upload RSA public key (generate: `openssl genrsa 2048`) | 10 min | $0 | `WALMART_CONSUMER_ID`, `WALMART_KEY_VERSION`, `WALMART_PRIVATE_KEY` |
| **SerpAPI** (WinCo/local via Google Shopping) | serpapi.com → register → key on dashboard immediately | 2 min | $75/mo (defer until first live ZIP; 100 free searches to validate) | `SERPAPI_KEY` |
| **Google Maps/Places** | console.cloud.google.com → enable Places+Geocoding+Distance Matrix → API key with referrer restriction | 5 min | $0 ($200/mo credit) | `GOOGLE_MAPS_API_KEY` |
| **Stripe** | dashboard.stripe.com → activate account (EIN, bank, identity — founder only) → enable Connect Express | 10 min + KYC wait | $0 fixed | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MOCK=0` |
| **Avalara** | avalara.com AvaTax free tier (or Stripe Tax as simpler alternative — adapter swap noted in code) | 10 min | $0 <200 txn/mo | `AVALARA_ACCOUNT_ID`, `AVALARA_LICENSE_KEY`, `AVALARA_MOCK=0` |
| **Instacart Dev Platform** | docs.instacart.com → partner application (NOT self-serve; approval takes weeks) | apply now | $0 | `INSTACART_API_KEY` |
| **Briskly / Square POS** | per-store opt-in during store-partner outreach (Phase 5) | n/a | $0 | `BRISKLY_API_KEY` |
| **Target / Albertsons / Costco** | No public price APIs. Coverage path: Instacart catalog (Target, Albertsons banners) once approved; SerpAPI local-availability meanwhile; Costco flagged "membership required" on the card. **Do not scrape their sites** — ToS prohibits. | — | — | — |

## Key handling rules
- Keys live in AWS Secrets Manager (prod) or `.env` (local) — never in git, never in chat.
- `scripts/setup-keys.sh` walks the founder through pasting each key locally and validates
  it with a single test call before writing `.env`.
- Rotation: Kroger/SerpAPI/Google keys rotate quarterly (calendar note in ops runbook).
- Budget guard: SerpAPI calls only fire on cache miss (15-min TTL per ZIP+item); the
  circuit breaker opens after repeated failures so a bad key can't burn quota.
