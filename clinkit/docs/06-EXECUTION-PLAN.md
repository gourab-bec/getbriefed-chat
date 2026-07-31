# Phase 1 — Execution Plan: $5k Soft-Launch → Scaled Rollout

**Entity:** GetBriefed Inc/LLC (woman-owned). **Launch corridor:** Tracy / Mountain House /
Stockton (ZIP 95391 anchor). **Model:** pure marketplace, zero inventory, 1099 Runners,
5% platform take on (items + markup + delivery).

---

## 1. Unit economics (per order, from `core/pricing.js` — these are the shipped formulas)

Assumptions: AOV items **$35.00**, runner markup 10%, avg store→buyer **4 mi**, no surge.

| Line | Amount |
|---|---|
| Items base | $35.00 |
| Runner markup (10%) | $3.50 |
| Delivery fee ($3.99 + $0.75×1 mi) | $4.74 |
| Tax (CA groceries exempt) | $0.00 |
| **Buyer pays** | **$43.24** |
| Platform fee (5% of $43.24) | **$2.16 gross revenue** |
| − Stripe (2.9% + $0.30 on $43.24) | −$1.55 |
| − Avalara/API/infra allocation (~$0.10 at volume) | −$0.10 |
| **Contribution margin per order** | **≈ $0.51 (23.6% of platform revenue)** |

Two levers already in code that improve this: (a) surge multiplies markup (fee base grows,
Stripe fixed fee amortizes), (b) basket size — at $60 AOV contribution is ≈ $1.17/order.
**Action:** minimum basket $15 and a $0.99 small-order fee (config change, no code).

### Volume required for the revenue targets (honest math)

Platform revenue/order ≈ $2.16 ⇒

| Target | Orders/month | Orders/day | Reality check |
|---|---|---|---|
| $1M/mo platform revenue | ~463,000 | ~15,400 | ≈ DoorDash-scale in 25–30 dense cities. **Not reachable on $5k**; requires ~$3–8M seed after corridor proof. |
| $10M/mo | ~4.6M | ~154,000 | Top-3 US player territory; Series B+ capital. |

**What $5k actually buys (and what it must prove):** 90 days in one corridor reaching
**25–40 orders/day, CAC < $8, ≥35% 4-week buyer retention, runner utilization ≥1.5
orders/hour**. Those four numbers are the fundable proof that makes the $1M/$10M curve
possible with outside capital. The plan below is built so every artifact (city playbook,
licensing matrix, provider adapters) is clone-ready the day capital arrives.

## 2. $5,000 budget (marketing is the largest line — hard cap enforcement in docs/finance/cashflow.md)

| Line | Amount |
|---|---|
| **Marketing (Phase 5 playbook)** | **$2,800** |
| Runner signup bonuses (20 × $30, paid on 1st completed order) | $600 |
| Buyer first-order credits (60 × $7 avg redeemed) | $420 |
| Infra (3 mo Fargate/RDS/ElastiCache lean tier) | $450 |
| Domain (clinkit.co ~$30/yr; clinkit.com only if <$300 aftermarket) | $30 |
| Insurance down-payment (cyber+E&O starter, monthly) | $350 |
| CA registrations (CDTFA seller's permit $0, city licenses ~$150, misc filings) | $200 |
| Contingency | $150 |
| **Total** | **$5,000** |

$0 lines: Stripe (per-txn only), Avalara (free tier <200 txn/mo), Kroger API (free tier),
Walmart API (free), SerpAPI ($75/mo deferred — mock until order 1 in a ZIP, then per-ZIP
cache makes ~$0.02/quote), Google Maps ($200/mo free credit), CI (GitHub free).

## 3. 12-month roadmap

| Month | Milestone | Gate to proceed |
|---|---|---|
| 0 (Aug 1) | Soft-launch 95391/95376 mock→live hybrid; 10 runners onboarded | Day-0 checklist green |
| 1 | 10 orders/day; Kroger+Walmart live keys; SerpAPI on | CAC < $12 |
| 2 | 25 orders/day; Stockton ZIPs on; surge tuned | retention ≥ 30% |
| 3 | 40 orders/day; corridor contribution-positive | **fundraise packet auto-generated from metrics** |
| 4–6 | +4 CA cities (finance/20-cities.md order); seed close | $1M/mo path needs ~$3M raised |
| 7–12 | +15 cities, 2-per-month cadence via city-expansion runbook | density model per city (Phase 5 §4) |

## 4. Architecture deltas for production (implemented in Phase 4)

Per-provider auto-live (key present ⇒ live, else mock) · circuit breakers + request
coalescing on the aggregator · structured JSON logs · k6 load proof at 500 VU / 50
orders-min · CI at repo root · admin status endpoint `/api/admin/providers`.
