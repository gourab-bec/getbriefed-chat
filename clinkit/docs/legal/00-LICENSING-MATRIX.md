# Licensing & Registration Matrix — Goods-Delivery Marketplace (GetBriefed Inc/LLC d/b/a ZipNab)

> ⚠️ Research summary prepared by an AI agent from general knowledge (cutoff Jan 2026).
> **Verify each item with licensed counsel and the cited agency before launch.** Items marked
> 🔶 are genuinely unsettled for gig goods-delivery and need a counsel opinion.

## Federal
| Item | Status / action |
|---|---|
| EIN | Assumed held by GetBriefed. Add d/b/a "ZipNab" via county/state fictitious-name filing. |
| 1099-K (buyers' payments to runners via platform) | Stripe Connect Express files 1099-K/1099-NEC where thresholds met; platform exports `payouts` by tax_year as backup (already in schema). |
| FTC | Truthful pricing claims: every price card already shows provenance + freshness; keep "prices verified Xm ago" language. Referral/testimonial disclosures per 16 CFR 255. |
| USDOT / FMCSA | Not applicable: intrastate, non-CDL passenger vehicles, no interstate for-hire freight at launch. Re-check if any city pair crosses state lines (e.g., KC metro). |

## California (launch state)
| Item | Agency | Action / cost |
|---|---|---|
| Seller's permit + **marketplace facilitator** registration (AB 147) | CDTFA | Register before first taxable sale; platform collects/remits tax on taxable goods it facilitates. $0. Avalara handles calc; CDTFA filing monthly/quarterly. |
| Foreign qualification (if GetBriefed formed outside CA) | CA SOS | ~$70 + $800/yr franchise tax if LLC doing business in CA. **Material cost — confirm entity state first.** |
| Fictitious Business Name ("ZipNab") | County (San Joaquin) | ~$50 + newspaper publication. |
| **Prop 22 (app-based driver law)** | — | ZipNab is likely a "delivery network company" under Prop 22. Compliance duties: 120% of applicable min-wage earnings floor on engaged time + **$0.37/mi (2026, CA Treasurer-indexed)**, healthcare stipend at 15+/25+ engaged hrs/wk, occupational-accident insurance ($1M), anti-discrimination policy, no mandatory schedules/exclusivity. **✅ IMPLEMENTED**: engaged-time capture, GPS-validated mileage, floor calculator, and 14-day settlement live in `server/src/core/prop22.js` + `/api/runners/prop22`; published policy at `07-prop22-policy.md`. |
| 🔶 Motor Carrier Permit (DMV MCP) for property transport for hire | CA DMV | Ambiguous for gig couriers in private cars; major platforms have faced this question. Options counsel must weigh: platform-level MCP, runner attestation model, or exemption analysis. **Do not scale past soft-launch without written counsel guidance.** |
| Workers' comp | — | Not required for true 1099 ICs, but Prop 22 occupational-accident policy is (see above + insurance checklist). |
| CCPA/CPRA | — | Rights endpoints already shipped (`/api/auth/me/export`, `DELETE /me`); privacy policy draft in this folder; no sale of PI. |

## City-level (corridor)
| City | Requirement | Est. cost |
|---|---|---|
| Tracy | Business license (tax certificate), renew annually | ~$50–100 |
| Mountain House (CSD) / unincorporated San Joaquin | County business license | ~$50 |
| Stockton | Business license + possible home-occupation permit if founder-address registered | ~$100 |
| All | No food-facility permit needed (no restaurant food, no repacking; runners buy retail sealed goods). If we later add restaurant food, county EHD permits apply — out of scope. |

## Other states in the 20-city list (summary — full per-city notes in docs/finance/20-cities.md)
- **TX, AZ, NV, FL, TN, NC, GA, CO, WA, UT**: all have marketplace-facilitator statutes — register with each DOR before first sale in-state; grocery taxability varies (TX/UT tax some groceries at reduced rates — Avalara tax codes handle). No TNC-style registration for goods-only couriers in these states as of knowledge cutoff. 🔶 WA: check Seattle's app-based worker minimum-pay ordinance (PayUp) — **applies to goods delivery**; deprioritizes Seattle (flagged in city list).
- **NY/NJ/MA/IL**: higher IC-classification risk (ABC-test states); keep in months 7–12 with counsel review. NYC: app-based delivery minimum pay rule currently targets restaurant food platforms — verify scope before NYC.

## Independent-contractor posture (all states)
The Runner ICA (01-runner-ica.md) is drafted around the strongest available factors, in the
spirit of DOL Opinion Letter FLSA2019-6 (since withdrawn — 🔶 current DOL economic-realities
rule is less favorable; CA relies on Prop 22 instead of Borello/ABC): runner sets price via
bid markup, accepts/rejects freely, multi-apps, supplies own vehicle/phone, no schedules, no
supervision, per-job payment. Anti-patterns to never introduce: mandatory shifts, exclusivity,
uniform requirements, platform-set hourly pay.

## Deprioritized / flagged cities
Seattle (PayUp pay floor), NYC (pay-rule scope + congestion), SF (HQ-tax + density of
competitors), Chicago (lease-tax nexus complexity), Boston (ABC test). All still listed in
the 20-city file with barrier notes.
