# Clinkit — Design Spec (Phase 2)

## Design language
- **Brand**: "Clinkit" — bolt icon ⚡; primary `#16A34A` (green = savings), accent `#0F172A`, surge amber `#F59E0B`, error `#DC2626`.
- Type: Inter (web), SF/Roboto (native). 8-pt spacing grid, 12 px card radius.
- Mobile-first; web is the same layout ≥768 px with a two-column compare view.
- Implemented in `web/` (Tailwind) and mirrored in `mobile/` styles.

## Screen map
Buyer: Home/Search → **Store Comparison** → Cart/Checkout → Bidding → Live Tracking → Rating
Runner: Online toggle → Request Feed → Bid sheet → Shop Checklist (photo proof) → Navigate → Deliver
Shared: Auth (phone OTP), Chat, Profile, Order history

## Centerpiece: Store Comparison (buyer)

The money screen — answers "where is my basket cheapest, and what's the tradeoff?"

```
┌──────────────────────────────────────────────────────────┐
│ ⚡ Clinkit          95391 · Tracy, CA ▾        🛒 3      │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 🔍 milk, eggs, bread                                 │ │
│ └──────────────────────────────────────────────────────┘ │
│  Sort:  [$ Cheapest]  [⚡ Fastest]  [★ Preferred]        │
│                                                          │
│ ╔══════════════════════════════════════════════════════╗ │
│ ║ 🏆 CHEAPEST                                          ║ │
│ ║ WinCo Foods · 2.1 mi                  price ✓ 12m ago║ │
│ ║ Whole Milk 1gal            $2.99                     ║ │
│ ║ Eggs Large 12ct            $2.49                     ║ │
│ ║ Wheat Bread                $1.79                     ║ │
│ ║ ─────────────────────────────                        ║ │
│ ║ Items $7.27 · Runner +10% $0.73 · Delivery $3.99     ║ │
│ ║ Est. total  $12.36        ⏱ 25–35 min               ║ │
│ ║              [ Choose WinCo ]                        ║ │
│ ╚══════════════════════════════════════════════════════╝ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Walmart Supercenter · 3.4 mi        Save $0 vs base  │ │
│ │ Basket $8.12 · Est. total $13.29    ⏱ 20–30 min ⚡  │ │
│ │                              [ Choose Walmart ]      │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Kroger (Food 4 Less) · 4.8 mi                        │ │
│ │ Basket $8.90 · Est. total $14.15    ⏱ 30–45 min     │ │
│ │  ⓘ Eggs low stock                    [ Choose ]      │ │
│ └──────────────────────────────────────────────────────┘ │
│  You save $1.79 (13%) choosing WinCo over Kroger         │
└──────────────────────────────────────────────────────────┘
```

Rules:
- Cheapest option pinned first with 🏆 badge + green border; per-item line prices expandable.
- Every card shows **full estimated total** (base + runner 10% + surge + delivery + tax) — never bare shelf price; surge shows amber "⚡ 1.3× busy" chip when >1.
- Provenance chip: "price ✓ 12m ago · Kroger API" / "Google Shopping" / "runner-verified".
- Missing/low-stock items flagged per store with substitution suggestion.
- Sticky footer: savings vs most-expensive option ("You save $1.79 (13%)").

## Bidding sheet (buyer)
Bottom sheet, live via WebSocket: runner avatar + rating, ETA, their markup ("+10% · $0.73" or "+8% · $0.58 🔥"), countdown ring (bids expire 60 s). Accept → Stripe auth hold.

## Runner request card
Push/WS alert: basket summary, store + distance to store + distance to buyer, guaranteed earnings breakdown (`markup + delivery − 5% fee`), Accept (default 10%) / Counter slider (5–20%) / Skip. Shop checklist per item with [Found] [Substitute] [Out]; receipt photo required to advance to `enroute`; delivery photo to complete.

## Live tracking (buyer)
Map with runner dot (5 s GPS pings over WS), status stepper (Matched → Shopping → On the way → Delivered), chat button, itemized receipt after purchase (actuals replace estimates; delta > $2 requires buyer tap-approve).

## Accessibility & perf
- WCAG AA contrast, 44 px touch targets, price differences conveyed by text + badge (not color alone).
- Skeleton loaders on compare (aggregator streams results as providers settle — cards pop in ranked).
- PWA: installable, offline order-history cache, push notifications.
