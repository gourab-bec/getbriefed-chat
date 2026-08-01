# Weekly Metrics Dashboard — definitions

Source: `GET /api/admin/metrics` (live now) + Stripe dashboard + ad-platform exports.
Review every Monday; every number has an owner and a target from marketing/01.

| Metric | Definition | Target (mo 3) |
|---|---|---|
| Orders | orders created/wk | 280/wk (40/day) |
| Completion rate | completed ÷ created (cancels + no-runner-found are the gap) | ≥ 92% |
| GMV | Σ buyer_total on completed | $12k/wk |
| Platform revenue | Σ platform_fee (the 5%) | $620/wk |
| Take rate (check) | platform revenue ÷ GMV — should hover ~5% of fee base | 4.7–5.0% |
| Contribution margin | platform revenue − Stripe fees − API spend − per-order insurance | ≥ $0.45/order |
| AOV | GMV ÷ completed orders | ≥ $40 (push basket size) |
| Match time | request → accepted bid, p50/p95 | ≤ 90 s / ≤ 5 min |
| Delivery time | accept → delivered, p50 | ≤ 40 min |
| Runner utilization | completed deliveries ÷ runner online-hours | ≥ 1.5 |
| Runner active base | runners with ≥1 delivery/wk | ≥ 25 |
| CAC (blended) | (media + credits redeemed) ÷ new buyers w/ 1st order | ≤ $8 |
| Referral share | new buyers via referral code ÷ all new buyers | ≥ 25% |
| Retention W4 | buyers with ≥1 order in wk N+4 cohort | ≥ 35% |
| LTV (6-mo proxy) | avg orders/buyer/mo × contribution × 6 | ≥ 3× CAC |
| Price accuracy | quoted vs receipt total within $2 | ≥ 90% of orders |
| Disputes | disputes ÷ completed | ≤ 2% |
| NPS | 1-tap post-delivery survey | ≥ 60 |

Fundraise packet = this table, 12 weeks of history, screenshotted from the dashboard —
generated, not narrated.
