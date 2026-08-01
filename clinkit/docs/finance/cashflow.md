# 12-Month Cash Plan — $5k Ceiling, Then Revenue/Capital Funded

Rule enforced throughout: **cumulative founder cash-out never exceeds $5,000.** After month
3, growth is funded by (a) platform contribution margin and (b) the seed raise the corridor
metrics are designed to unlock. Contribution/order from docs/06 §1: $0.51 at $35 AOV
(rising with basket size + surge mix; model holds it flat = conservative).

## Founder-cash months (0–3)

| Month | Spend | Cumulative | Orders/day (exit) | Platform rev/mo | Contribution/mo |
|---|---|---|---|---|---|
| 0 (Aug) | infra $150 · legal/licenses $200 · insurance $350 · domain $30 · flyers $180 · paid $320 | $1,230 | 5 | $325 | $77 |
| 1 | infra $150 · paid $900 · runner bonuses $300 · buyer credits $180 | $2,760 | 12 | $780 | $184 |
| 2 | infra $150 · paid $800 · bonuses $200 · credits $150 | $4,060 | 25 | $1,620 | $383 |
| 3 | infra $150 · paid $460 · credits $90 · contingency $150 | **$4,910** | 40 | $2,590 | $612 |

Month-3 exit state: ~40 orders/day, one corridor, CAC ≤ $8, retention ≥ 35% — the seed
packet. Remaining buffer: $90.

## Post-proof scaling (4–12) — requires the raise; shown so targets are mathematically traceable

Assumes $3M seed at month 4 (validated by corridor metrics), each new city follows the
Tracy curve but 1.5× faster (playbook + adapters are pre-built), $25k launch budget/city.

| Month | Cities live | Orders/day total | GMV/mo | Platform rev/mo |
|---|---|---|---|---|
| 4 | 3 | 120 | $156k | $7.8k |
| 6 | 6 | 550 | $715k | $36k |
| 8 | 10 | 2,200 | $2.9M | $143k |
| 10 | 15 | 6,500 | $8.4M | $422k |
| 12 | 20 | 15,000 | $19.5M | **$975k ≈ the $1M/mo mark** |

**Honest framing:** $1M/mo platform revenue lands ~month 12–14 (not month 6) and only with
~$3M deployed against a proven playbook; $10M/mo needs ~150k orders/day (top-3 US player
scale), i.e., a Series B and 2–3 more years. The $5k plan's job is to make row one of this
table undeniable. Anyone promising $1M/mo by month 6 on $5k is selling something.

## Fixed-cost floor (why $5k survives 3 months)
Infra $150/mo lean (single Fargate task + t4g.micro RDS off-peak scheduling) · Stripe/
Avalara/Kroger/Walmart/Maps $0 at this volume · SerpAPI deferred to month 1+ and capped by
cache+breaker (est. $40/mo at 25 orders/day) · insurance $350 covers ~2 months' premium —
renewal paid from month-2 contribution · all tooling free tier (GitHub, CloudWatch, Sentry
dev tier).

## Sensitivities
- AOV $50 instead of $35 → contribution $0.94/order → month-3 cumulative spend drops ~$400.
- CAC $12 instead of $8 → month-3 exit is 28 orders/day; raise gate slips one month. Kill
  rule in playbook exists precisely for this.
- CO retail-delivery-fee-style levies spreading → $0.29/order pass-through line item
  (pricing engine already itemizes fees; add config per state before CO launch).
