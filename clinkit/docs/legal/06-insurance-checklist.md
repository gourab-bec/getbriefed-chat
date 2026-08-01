# Insurance Requirements Checklist

> Budget reality: a $1M/$2M general-liability + cyber + E&O bundle for a pre-revenue tech
> marketplace typically quotes **$120–350/month** from digital brokers (Vouch, Embroker,
> Hiscox, Next). The $5k budget carries the first ~2 months ($350 line); renewals come from
> revenue. Occupational-accident (Prop 22) is volume-priced per engaged hour — quote it the
> week live orders begin, not before.

## Platform (GetBriefed Inc/LLC) — buy
- [ ] **Cyber liability** ($1M) — data breach, ransomware. Required before storing real buyer PII at scale.
- [ ] **Tech E&O / professional liability** ($1M) — wrong-price claims, platform errors.
- [ ] **General liability** ($1M/$2M) — usually bundled ~free with the above.
- [ ] **CA Prop 22 occupational-accident coverage** ($1M per occurrence) for engaged Runners — REQUIRED in CA once live; quote via gig-specialty brokers (e.g., Buckle, OneBeacon programs). This is the one policy that scales with orders; per-delivery cost est. $0.05–0.15 (feeds unit economics — tracked in finance model).
- [ ] Directors & officers — DEFER until fundraise (investors will require; ~$3–5k/yr).
- [ ] Workers' comp — not required with zero W-2 employees; revisit at first hire.

## Runner (attested in ICA §6 — verified at onboarding)
- [ ] Valid driver's license + vehicle registration (photo upload).
- [ ] **Auto liability at or above state minimum** (declarations-page upload; OCR check for expiry). The ICA squarely places commercial-use gap risk on the Runner; the onboarding flow must display the personal-auto-exclusion warning verbatim.
- [ ] The "1M auto + GL per Runner" aspiration is **not enforceable at launch** — typical gig workers don't carry commercial auto; requiring it would zero the Runner supply. Mitigation stack instead: platform occupational-accident policy + contingent-liability rider (quote with the cyber/E&O bundle) + strict photo/GPS proof reducing claim surface.

## Operational gates
- [ ] No Runner activates without: license, registration, insurance declarations, background check clear, signed ICA + FCRA consent.
- [ ] Policy expiry watcher: onboarding stores expiry dates; ops runbook has a weekly re-verification query.
- [ ] Certificates of insurance saved to S3 `compliance/` with 7-year retention.
