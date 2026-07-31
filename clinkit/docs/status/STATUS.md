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
