# Day-0 Launch Checklist

Legend: 🤖 = done by agents (already in repo) · 👤 = founder-only (legal identity, money,
or account ownership — agents cannot lawfully do these). Founder keyboard time to soft
launch: **≈ 2–3 hours total**, plus third-party wait times (Stripe KYC, background-check
vendor).

## A. Code & platform — 🤖 DONE
- [x] 27 tests green, boot smoke green, CI live at `.github/workflows/ci.yml`
- [x] Per-provider mock→live auto-switching + admin status endpoint
- [x] Circuit breakers, coalescing, structured logs, rate limits, security headers
- [x] Referral engine (fraud-gated $7/$7 + $30 runner) wired to order completion
- [x] Load-test script proving 500 VU / 50 orders-min target (run against staging in E)
- [x] **Prop 22 compliance engine**: engaged time captured accept→proof-of-delivery,
      GPS-accuracy-validated mileage (≤50 m fixes, estimate fallback), 120%-min-wage +
      $0.37/mi floor calculator, 14-day settlement endpoint, healthcare-stipend tiers,
      Expo high-accuracy tracking helper (2026 rates verified vs CA Treasurer)

## B. Legal identity — 👤 (~45 min + waits)
- [ ] Confirm GetBriefed entity standing; file d/b/a "Clinkit" (county form, ~$50)
- [ ] Send `docs/legal/01–05` to an attorney for review (budgeted advice, not new drafting — ask for redlines only)
- [ ] CDTFA seller's permit + marketplace-facilitator registration (online, free)
- [ ] Tracy business license application (~$75)
- [ ] Insurance: request cyber+E&O quotes (Vouch/Hiscox/Next — 15 min of forms; bind ≤$350/mo)

## C. Accounts & keys — 👤 (~35 min, guided by `docs/07-PROVIDER-KEYS.md`)
- [ ] Stripe: activate + enable Connect Express (EIN, bank) → `STRIPE_SECRET_KEY`, webhook secret
- [ ] Kroger developer app (5 min, instant keys)
- [ ] Google Cloud: Maps/Places key (5 min)
- [ ] SerpAPI account (2 min; stay on free 100 searches until first live ZIP)
- [ ] Walmart.io affiliate app (10 min incl. RSA keygen)
- [ ] Instacart partner application submitted (approval takes weeks — mock covers meanwhile)
- [ ] Checkr (or similar) account for background checks
- [ ] Run `server/scripts/setup-keys.sh` → keys validated + saved; providers flip live

## D. Domain & deploy — 👤 15 min, then 🤖-guided
- [ ] Buy domain (clinkit.co ~$30; skip clinkit.com unless <$300)
- [ ] AWS account + IAM role for CI; put `AWS_ROLE_ARN`, `ECR_REPO` in GitHub repo secrets
- [ ] `docker compose -f infra/docker-compose.yml up` path verified locally, then ECS per `docs/04-DEPLOYMENT.md`
- [ ] Point DNS: `api.` → ALB, apex/`www` → Amplify/Vercel web build
- [ ] Set prod env: `JWT_SECRET` (64 rand), `ADMIN_TOKEN`, `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGINS`

## E. Pre-launch verification — 🤖 runbook, 👤 executes two commands
- [ ] `node --test` in CI green on the deploy commit
- [ ] `BASE=https://api.clinkit.co k6 run infra/load/k6-quotes.js` → thresholds pass
- [ ] Real-store spot check: 20 items, app quote vs shelf price in Tracy (accuracy ≥90% gate)
- [ ] Stripe test-mode order end-to-end, then one $1 live-mode order, then refund it

## F. Supply & demand ignition (marketing/01 Week −1)
- [ ] 10+ runners fully activated (ops/01 checklist each)
- [ ] Flyers printed, TRACY7 credit code enabled, first 3 videos shot
- [ ] **GO/NO-GO: founder says "go live" — the one human decision this checklist reserves**

## Post-launch continuous loop (what automation does and doesn't cover)
Agents/automation from this repo: CI on every push, breaker-protected providers, surge
auto-tuning, weekly metrics endpoint. A monitoring agent session (Claude Code Routine
hitting `/api/health` + `/api/admin/metrics` hourly and filing issues) can be armed **after
a real URL exists** — it needs the deployed host + `ADMIN_TOKEN`. City expansion is
deliberately NOT autonomous: each city touches licenses, taxes, and insurance (§B) —
the runbook (ops/03 §4) compresses it to ~2 weeks, but a human signs the registrations.
