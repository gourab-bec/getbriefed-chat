# ⚡ Clinkit — hyperlocal marketplace at the lowest store price

Buyers request items; Clinkit compares **live prices across every store within 5–10 mi**
(Walmart, Target, WinCo, Kroger, local shops) and shows ranked options — *"Cheapest: $2.99 @
WinCo"* — with a full dynamic total (base + Runner 10% markup × surge + delivery + tax).
Runners bid, procure with photo proof, and deliver in 10–60 min. The platform takes 5% via
Stripe Connect splits.

## Repo map

| Path | What |
|---|---|
| `docs/01-PLAN.md` | Architecture, ERD, sequence diagrams, phases |
| `docs/02-API-INTEGRATIONS.md` | Kroger / Walmart / Instacart / Briskly / Google Shopping (SerpAPI) / Places sourcing strategy |
| `docs/03-COMPLIANCE.md` | PCI SAQ-A, CCPA/GDPR, gig 1099s, app security |
| `docs/04-DEPLOYMENT.md` | AWS (ECS Fargate + RDS/PostGIS + ElastiCache) |
| `docs/05-DESIGN.md` | UI spec — store-comparison screen wireframes |
| `server/` | Node 22 / Express + Socket.IO API; dependency-free core engines |
| `web/` | Next.js 14 responsive web + PWA |
| `mobile/` | Expo React Native (iOS/Android) |
| `infra/` | docker-compose (Postgres+PostGIS, Redis), CI workflow |

## Quickstart (zero keys needed — mock providers on by default)

```bash
cd clinkit/server
node --test test/*.test.js        # 22 tests, no install required
npm install && npm run dev        # API on :4000

cd ../web && npm install && npm run dev    # web on :3000
cd ../mobile && npm install && npx expo start
```

Try it: `POST /api/quotes {"items":["milk","eggs","bread"],"zip":"95376"}` → WinCo wins at
$2.99 milk; from ZIP 95391 (Mountain House) per-mile delivery fees can flip the ranking —
totals decide, not shelf price.

## Core engines (`server/src/core/`, pure + fully tested)

- **comparison.js** — normalize queries, dedupe stores, per-item best offer, radius filter, rank by full buyer total, cheapest/fastest badges, savings math
- **pricing.js** — cents-safe totals: items + markup×surge + delivery ($3.99 + $0.75/mi > 3 mi) + tax; 5% platform fee; runner payout identity `buyer = payout + fee + tax`
- **surge.js** — demand/supply multiplier (1–2.5×), markup-only
- **geo.js** — haversine, radius matching, ETA windows

Real integrations activate by setting keys in `.env` and `PROVIDERS_MOCK=0` — see
`docs/02-API-INTEGRATIONS.md`.
