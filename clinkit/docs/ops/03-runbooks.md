# Internal Ops Runbooks

## 1. Dispute resolution (SLA 24h)
Trigger: buyer report or chargeback webhook. Steps: (1) pull order bundle — receipt photo,
delivery photo, GPS trail, chat log (all linked from order id); (2) decision matrix:
photo+GPS prove delivery → deny non-delivery claim with evidence; receipt total ≠ captured
total → auto partial refund of difference; spoilage w/ photo → instant credit ≤ $15, refund
above; (3) execute via Stripe (`refund()` in services/stripe.js — reverse_transfer keeps
the 5% fee fair on partials); (4) log to `disputes` with resolution JSON; (5) two upheld
fraud flags on either side → deactivate + appeal path. Chargebacks: submit photo/GPS
evidence packet via Stripe within 7 days, always.

## 2. Refund flow (money paths)
Pre-capture (order ≤ delivered): cancel PaymentIntent → full void, runner reimbursed for
purchased goods via manual transfer if items already bought (goods to buyer anyway or
donated — never returned to shelf). Post-capture: `refund({amountCents})` partial or full;
platform fee refunded proportionally; payout clawback only on runner fraud, never on store
price drift.

## 3. Surge activation (mostly automatic — this is the manual override)
Auto: `core/surge.js` from open-requests/online-runners per area. Manual override cases:
weather event or store closure → set cap 1.5× (config) + push "high demand" banner; runner
supply collapse (< 3 online in live ZIP) → runner SMS blast offering a per-order boost
("+$3 per completed delivery for the next 2 hours" from bonus budget) BEFORE letting surge
exceed 2×. **Founder rule: never pay for availability or idle time — every incentive
dollar, signup bonuses included, releases only against a completed order** (matches the
pay-per-order model and Prop 22's engaged-time-only floor). Never market during surge caps.

## 4. City expansion checklist (clone-a-city, target: 2 weeks)
1. Legal: state marketplace-facilitator registration + city license (legal/00 matrix row)
2. Config: add ZIP centroids (`core/geo.js`), store fixtures for demo, radius defaults
3. Providers: verify Kroger-banner coverage via locations API; enable SerpAPI for the ZIPs
4. Supply: run Week −1 runner recruitment (marketing/01) — gate ≥10 activated
5. Demand: clone creative kit with {CITY} vars; $500 initial media
6. Ops: on-call rota covers new timezone hours; metrics dashboard filter added
7. Go/no-go: quote accuracy spot-check 20 items in-store vs app before first real order

## 5. Incident response (from DPA §5)
Sev1 (payments down/breach): page founder; freeze new orders (health endpoint flips);
Stripe status first. Breach: contain → scope within 72h → notify per state law → postmortem
here. Sev2 (provider breaker open > 30 min): quotes silently degrade to cached/mock — check
`/api/admin/providers`, rotate key if 401s, else wait out upstream.

## 5b. Prop 22 settlement (automated, verify weekly)
Daily cron (or manual): `POST /api/admin/prop22/settle` (X-Admin-Token). Fixed 14-day
windows anchored to launch day (2026-08-01); idempotent per runner+period; top-ups paid by
Stripe transfer with idempotency keys; results in `prop22_settlements`. Weekly check: every
settled period with `topUpCents > 0` has a `transferId`; spot-audit one runner's floor math
against their order list. Tips recorded via `POST /api/orders/:id/tip` — a missing tip
inflates the top-up (costs us money, never the runner), so reconcile tips vs Stripe monthly.

## 6. Weekly ops cadence
Mon: metrics review vs targets (04) · Wed: runner insurance-expiry query + payout audit
(sample 5 orders: receipt vs charged) · Fri: dispute backlog zero + next-week media
kill/scale decisions · Monthly: CDTFA/DOR filings, purge-job verification (GPS>30d, deleted
accounts>30d), key rotation calendar.
