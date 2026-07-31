# Clinkit Prop 22 Compliance Policy (published; incorporated into Runner ICA §4)

> **DRAFT — ATTORNEY REVIEW REQUIRED.** Implements Cal. Bus. & Prof. Code §7449 et seq.
> for Runners in California. Rates verified 2026-07-31 against the CA Treasurer's annual
> adjustment; re-verify every January (ops runbook §6).

## 1. Engaged time
Engaged time begins the moment your bid is **accepted** and ends when you complete
delivery with **photo proof**. The app records both timestamps automatically
(`engaged_start_at`, `engaged_end_at` on every order) — you never log hours manually.
Time between deliveries (online, waiting) is not engaged time under Prop 22.

## 2. Engaged miles
While engaged, the app records your GPS position (~every 5 seconds / 25 meters) including
the device-reported accuracy. Miles are computed from fixes accurate to **≤ 50 m**;
implausible jumps are discarded. **If your GPS is poor, we do not zero your miles** — we
substitute a route-based estimate (straight-line store→drop-off × 1.3) whenever the
recorded trail covers less than half the expected route. Every order shows which method
was used (`milesSource: gps | estimated`).

## 3. Earnings guarantee (the floor)
For each earning period (**14 days**), we compare your net earnings — your bid markup +
delivery fees − the 5% platform fee **+ 100% of tips** (item reimbursements are excluded;
they are expense pass-throughs) — against:

> **120% × applicable minimum wage × engaged hours + $0.37 × engaged miles** *(2026 rate)*

Statewide 2026 minimum wage is $16.90/hr → an engaged-hour floor of **$20.28**; where a
city ordinance sets a higher minimum wage, the higher wage applies. If your net earnings
are below the floor, Clinkit pays the difference **no later than the next earning period**
via your Stripe account. Your live standing is always visible: app → Earnings → "Prop 22
guarantee" (`GET /api/runners/prop22`).

## 4. Healthcare stipend
Averaged over a calendar quarter: **≥ 25 engaged hours/week** → stipend equal to 100% of
the average Covered California bronze-plan employer contribution; **15–24.9 h/wk** → 50%;
under 15 → none. Proof of current health coverage is required per statute; paid quarterly.

## 5. Other Prop 22 protections we implement
Occupational-accident insurance ($1M) while engaged · anti-discrimination and sexual-
harassment policy applies to the platform relationship · no retaliation for rejecting
requests · rest policy: the app warns at 10 cumulative engaged+online hours and enforces a
6-hour break at 12, per §7467 · written deactivation appeal path (ops runbook §1).

## 6. What this does not change
You remain an independent contractor: you choose when to work, which requests to accept,
what markup to bid, and you may work for competitors — including simultaneously.

**Sources:** [CA Treasurer — Prop 22 per-mile annual adjustment ($0.37 for 2026)](https://www.treasurer.ca.gov/prop-22),
[adjustment notice (PDF)](https://www.treasurer.ca.gov/sites/default/files/executive-office/25-54.pdf),
[Bloomberg Law overview of the Prop 22 earnings floor](https://www.bloomberglaw.com/external/document/X378I1A8000000/wages-hours-leave-professional-perspective-california-s-proposit).
