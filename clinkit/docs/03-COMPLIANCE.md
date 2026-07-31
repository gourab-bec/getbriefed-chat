# Clinkit — Security & US Compliance

## Payments / PCI
- **PCI DSS SAQ-A posture**: card data never touches Clinkit servers. Stripe Elements (web) / Stripe RN SDK (mobile) tokenize client-side; server sees only PaymentIntent IDs.
- Manual-capture PaymentIntents: authorize at bid-accept, capture at delivery, auto-void on cancel — no stored balances.
- Webhook signatures verified (`STRIPE_WEBHOOK_SECRET`), idempotency keys on all mutating Stripe calls.

## Gig-economy / 1099
- Runners are independent contractors on **Stripe Connect Express**: Stripe collects W-9, runs KYC, and files **1099-K/1099-NEC** where thresholds met; Clinkit exports `payouts` by `tax_year` for backup.
- Contractor agreement + per-state gig rules flag (CA AB5 checklist: runner sets own price via bid markup, chooses jobs, multi-apping allowed — Prop 22-style disclosures in app).
- Background checks (Checkr API) gate runner activation; insurance disclosure at onboarding.

## Privacy (GDPR-grade, applied to CCPA/CPRA)
- Data map: PII limited to `users`, `runner_profiles`, `payments`; GPS trails auto-purged 30 days post-delivery.
- Rights endpoints: `GET /api/me/export` (JSON takeout), `DELETE /api/me` (soft-delete + 30-day purge job); consent log table.
- No sale of personal data; analytics anonymized (IP truncation). Cookie banner on web; ATT prompt on iOS only if ads ever added.

## Application security
- JWT (15 min access + rotating refresh), bcrypt(12) passwords, optional SMS OTP (Twilio Verify).
- `helmet`, strict CORS allowlist, Zod validation on every route, parameterized SQL only, rate limiting (Redis sliding window: 100 req/min/IP, 10/min on auth).
- S3 photo-proof uploads via pre-signed PUT (5 MB cap, content-type pinned); EXIF GPS kept for fraud checks, stripped before display.
- Secrets in AWS Secrets Manager; least-privilege IAM per service; TLS 1.2+ everywhere; audit log table for admin actions.
- Fraud: device fingerprint on bids, receipt-photo total OCR vs charged total mismatch flag, geofence check that "purchased" event occurs at store location.

## Marketplace trust
- Two-sided ratings; disputes open a `disputes` row, freeze capture if pre-capture, partial refunds via Stripe.
- Photo proof required at purchase (receipt) and delivery (door photo) before payout release.
