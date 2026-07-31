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

## Production status (updated 2026-07-31)

**What is live right now:** the full stack runs and is CI-tested (27 tests + boot smoke) in
**mock-provider mode** — no public URL exists yet because deploying requires founder-owned
accounts (AWS, domain registrar, Stripe). Everything is staged so each founder action is
minutes, not days: see **`docs/DAY0-CHECKLIST.md`**.

**Mock → live, per provider (no code changes):** every adapter auto-detects its key.
Paste `KROGER_CLIENT_ID`/`SECRET` into the environment → Kroger serves real store prices on
next boot; same for Walmart, SerpAPI, Instacart, Stripe (`STRIPE_MOCK=0`), Avalara.
`PROVIDERS_MOCK=1` force-mocks everything (staging safety). Check state anytime:
`curl -H "X-Admin-Token: $ADMIN_TOKEN" $HOST/api/admin/providers`. Guided key entry:
`server/scripts/setup-keys.sh`. Signup paths per provider: `docs/07-PROVIDER-KEYS.md`.

**Redeploy (once AWS secrets are in GitHub):** `git push origin main` — CI
(`.github/workflows/ci.yml`) tests, boots, smoke-checks, then the deploy job ships the
image. Manual equivalent: `docker build clinkit/server -t clinkit && aws ecs
update-service --force-new-deployment`.

**Hardening added:** circuit breakers + request coalescing on the price aggregator,
structured JSON logs, admin metrics endpoint, referral engine with fraud-gated credits,
k6 load proof for 500 VUs / 50 orders-min (`infra/load/k6-quotes.js`).

## Business execution pack (docs/)
`06-EXECUTION-PLAN.md` unit economics + honest path to scale · `legal/` licensing matrix +
5 signature-ready drafts (**attorney review required**) + insurance checklist ·
`marketing/` corridor playbook + creative kit · `finance/` 20-city ranking + $5k cash plan ·
`ops/` runner training, buyer help, runbooks, metrics definitions ·
`DAY0-CHECKLIST.md` the go-live gate. PDF export of any doc:
`npx -y md-to-pdf docs/**/*.md` (binaries intentionally not committed).
