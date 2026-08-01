// Order money math — integer cents throughout to avoid float drift.
// buyer_total  = items + runnerMarkup(=pct×surge) + delivery + tax
// platform_fee = 5% of (items + markup + delivery); runner keeps the rest + reimbursement.

// Fee levers are env-tunable so the founder can raise product cost without a code change.
// Defaults = launch plan. PRICING_PRESET=aggressive applies the month-1 profit-push preset
// (platform 10%, delivery $5.49 + $1.00/mi>2, runner default 12%, $1.49 small-order fee):
// on a $35 CA basket the buyer total moves ~$43 -> ~$50 — still below Instacart's typical
// marked-up total for the same basket, because the shelf price stays untouched.
const AGGRESSIVE = process.env.PRICING_PRESET === 'aggressive';
const envInt = (name, def) => {
  const v = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) ? v : def;
};

export const PLATFORM_FEE_PCT = envInt('PLATFORM_FEE_PCT', AGGRESSIVE ? 10 : 5);
export const DEFAULT_RUNNER_MARKUP_PCT = envInt('RUNNER_MARKUP_PCT', AGGRESSIVE ? 12 : 10);
export const DELIVERY_BASE_CENTS = envInt('DELIVERY_BASE_CENTS', AGGRESSIVE ? 549 : 399);
export const DELIVERY_PER_MI_CENTS = envInt('DELIVERY_PER_MI_CENTS', AGGRESSIVE ? 100 : 75);
export const FREE_MILES = envInt('FREE_MILES', AGGRESSIVE ? 2 : 3);
export const SMALL_ORDER_THRESHOLD_CENTS = envInt('SMALL_ORDER_THRESHOLD_CENTS', 2500);
export const SMALL_ORDER_FEE_CENTS = envInt('SMALL_ORDER_FEE_CENTS', AGGRESSIVE ? 149 : 0);
export const MIN_ORDER_CENTS = envInt('MIN_ORDER_CENTS', 2000);
// Bundle rebate: when a runner accepts a second order while one is active (two orders,
// one trip), the buyer gets this off the DELIVERY fee at accept — never off the platform
// $5, and the runner still nets more per trip (2× earnings for ~1.3× time).
export const BUNDLE_REBATE_CENTS = envInt('BUNDLE_REBATE_CENTS', 200);

// Platform-take FLOOR (founder rule): the platform's fee — its recovery of marketing, IT,
// and promotion costs — is max($5.00, percentage fee). Flat $5 minimum on every order,
// growing with order value once the percentage exceeds it (at 10% aggressive that's
// ~$42+ baskets; at 5% default ~$92+). Charged to the buyer as a visible "service fee"
// line — the runner's payout is never reduced to fund it.
// Override tiers: FEE_FLOOR_TIERS="maxBaseCents:floorCents,..." (last tier catches rest).
function parseTiers(raw) {
  const tiers = (raw ?? '999999999:500')
    .split(',')
    .map((t) => t.split(':').map(Number))
    .filter(([max, floor]) => Number.isFinite(max) && Number.isFinite(floor));
  return tiers.length ? tiers : [[999999999, 0]];
}
export const FEE_FLOOR_TIERS = parseTiers(process.env.FEE_FLOOR_TIERS);

export function feeFloorCents(itemsBaseCents) {
  for (const [maxBase, floor] of FEE_FLOOR_TIERS) {
    if (itemsBaseCents < maxBase) return floor;
  }
  return FEE_FLOOR_TIERS[FEE_FLOOR_TIERS.length - 1][1];
}

export function deliveryFeeCents(storeToBuyerMi) {
  const extra = Math.max(0, storeToBuyerMi - FREE_MILES);
  return DELIVERY_BASE_CENTS + Math.round(extra * DELIVERY_PER_MI_CENTS);
}

/**
 * @param {Object} p
 * @param {number} p.itemsBaseCents        Σ shelf prices at chosen store
 * @param {number} [p.runnerMarkupPct=10]  runner's bid (5–20)
 * @param {number} [p.surgeMultiplier=1]   1.0–2.5, applies to markup only
 * @param {number} p.storeToBuyerMi
 * @param {number} [p.taxRate=0]           effective rate from Avalara (0.0725 etc.)
 * @param {number} [p.taxableBaseCents]    taxable subset of items (grocery exemptions); default 0
 */
export function computeTotals(p) {
  const {
    itemsBaseCents,
    runnerMarkupPct = DEFAULT_RUNNER_MARKUP_PCT,
    surgeMultiplier = 1,
    storeToBuyerMi,
    taxRate = 0,
    taxableBaseCents = 0,
  } = p;
  if (!Number.isInteger(itemsBaseCents) || itemsBaseCents < 0) {
    throw new RangeError('itemsBaseCents must be a non-negative integer');
  }
  if (runnerMarkupPct < 0 || runnerMarkupPct > 30) throw new RangeError('runnerMarkupPct out of range');
  if (surgeMultiplier < 1 || surgeMultiplier > 2.5) throw new RangeError('surgeMultiplier out of range');

  const runnerMarkupCents = Math.round((itemsBaseCents * runnerMarkupPct * surgeMultiplier) / 100);
  const delivery = deliveryFeeCents(storeToBuyerMi);
  const smallOrderFeeCents =
    itemsBaseCents < SMALL_ORDER_THRESHOLD_CENTS ? SMALL_ORDER_FEE_CENTS : 0;
  // Tax applies to taxable goods + delivery service where applicable (simplified: goods only here;
  // Avalara adapter returns the authoritative figure and overrides taxCents when live).
  const taxCents = Math.round(taxableBaseCents * taxRate);

  // Platform take = max(percentage fee + small-order fee, tier floor). The top-up needed
  // to reach the floor is charged to the buyer as a service fee — never to the runner.
  const feeBase = itemsBaseCents + runnerMarkupCents + delivery;
  const pctFeeCents = Math.round((feeBase * PLATFORM_FEE_PCT) / 100);
  const minFeeTopUpCents = Math.max(0, feeFloorCents(itemsBaseCents) - (pctFeeCents + smallOrderFeeCents));
  const platformFeeCents = pctFeeCents + smallOrderFeeCents + minFeeTopUpCents;

  const buyerTotalCents =
    itemsBaseCents + runnerMarkupCents + delivery + smallOrderFeeCents + minFeeTopUpCents + taxCents;
  // Runner is reimbursed item cost (they paid at register) + earns markup + delivery − pct fee.
  const runnerPayoutCents = itemsBaseCents + runnerMarkupCents + delivery - pctFeeCents;
  const runnerEarningsCents = runnerMarkupCents + delivery - pctFeeCents;

  return {
    itemsBaseCents,
    runnerMarkupPct,
    surgeMultiplier,
    runnerMarkupCents,
    deliveryFeeCents: delivery,
    smallOrderFeeCents,
    minFeeTopUpCents,
    taxCents,
    buyerTotalCents,
    platformFeeCents,
    runnerPayoutCents,
    runnerEarningsCents,
  };
}

export const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;
