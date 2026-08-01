# Execution Status — 2026-07-31 (rev 2: Prop 22 workstream)

## New this revision
| Workstream | Deliverable | State |
|---|---|---|
| Prop 22 engine | `core/prop22.js`: engaged time (accept→proof-of-delivery), GPS-validated miles (≤50 m accuracy filter, teleport rejection, route-estimate fallback), 120%×min-wage + $0.37/mi floor, ≤14-day period settlement, healthcare stipend tiers. Rates verified against CA Treasurer 2026 adjustment. | ✅ 7 new tests, 34/34 total |
| State machine | `engagedStartAt` stamped at bid-accept; `engagedEndAt` + engagement record frozen at delivered-with-photo; schema: orders cols + `prop22_settlements` table | ✅ E2E verified |
| Mobile | `mobile/lib/engagedLocation.js` — Expo high-accuracy watcher (5 s/25 m) emitting accuracy-tagged pings; auto start/stop wired to RunnerScreen | ✅ syntax-checked |
| API | `GET /api/runners/prop22` — live period standing (floor breakdown, top-up, stipend tier); ws `gps:ping` accuracy validation | ✅ |
| Legal | `legal/07-prop22-policy.md` (ICA §4 incorporates by reference); licensing matrix updated to implemented + $0.37 | ✅ draft — attorney review |
| PDFs | All 8 legal docs exported to `docs/legal/pdf/` (Chromium print pipeline) | ✅ |

## Prior revision (unchanged)

| Phase | Deliverable | State |
|---|---|---|
| 1 Planner | docs/06-EXECUTION-PLAN.md — unit economics ($0.51/order contribution @ $35 AOV), $5k budget, 12-mo roadmap, honest volume math for $1M/$10M targets | ✅ |
| 2 Legal | legal/00 licensing matrix (fed/CA/city + 19-state notes, Prop 22, 🔶 flags) + 5 signature-ready drafts + insurance checklist | ✅ drafts — **attorney review before any signature** |
| 3 Sourcing | Per-provider auto-live switching, Costco/Target coverage in fixtures, key-acquisition guide (07), guided setup script | ✅ code + tests |
| 4 Engineering | Breakers, coalescing, JSON logs, admin status/metrics API, referral engine, k6 500-VU script, repo-root CI | ✅ 27/27 tests, boot verified |
| 5 Marketing | Corridor playbook (kill/scale rules, flywheel), creative kit (4 scripts, captions, prompts, landing copy, FTC rules) | ✅ |
| 6 Finance | 20-city ranked list w/ license notes, 12-mo cashflow ≤ $5k founder cash | ✅ |
| 7 Docs/Training | Runner onboarding + video scripts, buyer help, 6 runbooks, metrics dictionary | ✅ |
| Deploy | Public staging/prod URLs | ⏸ **blocked on founder-owned accounts** (AWS, domain, Stripe) — every step staged in DAY0-CHECKLIST.md, ~2–3h keyboard time |

Hard blockers requiring the human (by design, not by gap): entity/legal filings,
account signups + ToS acceptance, payment/banking, insurance binding, ad-account spend
authorization, and the final go-live call.

## Rev 3 — Brand, funding, standup (2026-07-31)
| Item | State |
|---|---|
| Brand: **ZipNab** — zipnab.com + .co probed available (DNS NS method; confirm at registrar), 30 candidates tested | ✅ docs/brand/BRAND.md + scripts/check-domains.mjs |
| Logo + icon SVG, taglines, message architecture | ✅ web/public/logo.svg, icon.svg |
| Deploy path on founder's existing Vercel/getbriefed.to + Fly.io API | ✅ web/vercel.json, infra/fly.toml, docs/08-DEPLOY-VERCEL.md |
| Credentials Q&A agent (item-by-item, resumable) | ✅ server/scripts/standup-qa.sh |
| Chase/SBA business plan ($50k ask, honest underwriting notes) | ✅ docs/finance/business-plan-chase.md + PDF |
| Ownership restructure 51% Sompriya Chanda (WOSB/WBE path, templates) | ✅ draft — attorney+CPA gate |
| Sequential launch dashboard (19 tasks, ETAs, step-locking) | ✅ launch-dashboard.html + published artifact |

## Rev 4 — Workstream audit + payout-flow completion (2026-07-31)
Re-audit of the five mandated workstreams found all delivered; two gaps in "integrate
top-up into payout flow" closed this rev:
| Gap | Fix |
|---|---|
| Top-up calculator had no executor | `services/prop22Settle.js`: fixed 14-day windows anchored to launch, idempotent per runner+period, pays via Stripe `transferFunds` with idempotency keys; trigger `POST /api/admin/prop22/settle`; resolves the rolling-window counsel flag from rev 2 |
| Tips uncounted (would over-pay top-ups) | `POST /api/orders/:id/tip` — buyer post-delivery, 100% to runner, zero platform fee, feeds settlement |
38/38 tests. Remaining human gates unchanged: attorney sign-off, payments/accounts, DNS go-live (dashboard Tasks 1–19).

## Rev 5 — Brand APPROVED: ZipNab (2026-07-31, founder decision)
Swept through: web UI (title, header, hero tagline, manifest, token key), mobile (app name,
slug, scheme, bundle ids app.zipnab.mobile, header), referral share URL → zipnab.com/r/,
Avalara company code, marketing kit, runner/buyer ops docs, and all legal drafts (d/b/a
ZipNab) with PDFs regenerated. Repo folder `clinkit/` remains the internal code name.
Founder's next dashboard tasks: 2 (USPTO TESS) → 3 (buy zipnab.com/.co).

## Rev 6 — Marketing agents (2026-07-31)
Planning agent → docs/marketing/03 (honest curve: month-2 ≈ break-even-minus, $100k/mo net
lands months 18–24 with funding; tiered channel plan A $2.8k / B +$30k / C +$250k).
Content agent → docs/marketing/04 (3 hero videos w/ Sora/Veo/Runway prompt sets, daily
organic engine, paid structures with kill/scale rules, FTC rails — no AI testimonials).
Review agent → REAL CODE: scripts/growth-review.mjs + growth-targets.json, daily GitHub
Action (.github/workflows/growth-review.yml) → Actions summary + auto-issue when off-plan;
verified against a live seeded order (correctly flagged orders/day + CAC, passed take-rate
4.99%). Reusable prompts P1–P3 in docs/marketing/05-agents.md. Spend execution remains
founder-authorized.

## Rev 7 — AI support org, fee levers, promo previz (2026-07-31)
| Item | State |
|---|---|
| AI support agent (buyers + runners, equal competence): Claude-powered when ANTHROPIC_API_KEY set (claude-opus-5, prompt-cached policy system, refusal-handled), deterministic policy router otherwise; grounded in the user's REAL orders + Prop 22 standing | ✅ services/supportAgent.js + POST /api/support/chat |
| Escalation handling: safety/legal/fraud topics ticket FIRST (never AI-adjudicated), refund reviews, human-requested; admin console GET/resolve /api/admin/tickets | ✅ 7 tests |
| Fee levers ("increase product cost"): env-tunable platform fee/delivery/markup + small-order fee; PRICING_PRESET=aggressive → ~$2.60 contribution at $35 AOV, money identity verified | ✅ |
| Aggressive targets encoded (PLAN=aggressive in daily review): M1 $10k / M3 $30k / M6 $100k net → 175/430/1,380 orders/day, tracked honestly | ✅ |
| Promo previz: two watchable animated hero spots + Veo/Sora/Runway render prompts, FTC rails (no AI testimonials — declined as illegal; real-runner + AI-b-roll formula instead) | ✅ artifact published |
45/45 tests. $100/day budget note: covers Veo/Runway subs + SerpAPI + Claude support-agent tokens at launch volume.
