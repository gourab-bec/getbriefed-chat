// Avalara AvaTax adapter. Mock mode ships a per-state effective-rate table with
// grocery exemptions (unprepared food exempt in CA/most states) so dev totals are realistic.

import { config } from '../config.js';

// Effective combined rates for taxable goods (state+avg local), simplified.
const MOCK_RATES = { CA: 0.0825, TX: 0.0725, NY: 0.08375, WA: 0.092, OR: 0, DEFAULT: 0.07 };
const GROCERY_EXEMPT_STATES = new Set(['CA', 'TX', 'NY', 'WA', 'OR', 'AZ', 'NV', 'FL', 'CO']);

const ZIP_STATE = [[/^9[0-6]/, 'CA'], [/^97/, 'OR'], [/^98|^99[0-4]/, 'WA'], [/^7[5-9]/, 'TX'], [/^1[0-4]/, 'NY']];
export function zipToState(zip) {
  return ZIP_STATE.find(([re]) => re.test(String(zip)))?.[1] ?? 'DEFAULT';
}

/**
 * @param {Object} p
 * @param {string} p.zip
 * @param {Array<{itemName:string, priceCents:number, taxCode?:string}>} p.lines
 *        taxCode 'PF050502' = unprepared food (exempt in exempt states)
 * @returns {Promise<{taxCents:number, effectiveRate:number, byLine:number[]}>}
 */
export async function calculateTax({ zip, lines }) {
  if (config.avalara.mock) {
    const state = zipToState(zip);
    const rate = MOCK_RATES[state] ?? MOCK_RATES.DEFAULT;
    const byLine = lines.map((l) => {
      const grocery = (l.taxCode ?? 'PF050502') === 'PF050502';
      const exempt = grocery && GROCERY_EXEMPT_STATES.has(state);
      return exempt ? 0 : Math.round(l.priceCents * rate);
    });
    const taxCents = byLine.reduce((a, b) => a + b, 0);
    const base = lines.reduce((a, l) => a + l.priceCents, 0) || 1;
    return { taxCents, effectiveRate: taxCents / base, byLine };
  }

  const auth = Buffer.from(`${config.avalara.accountId}:${config.avalara.licenseKey}`).toString('base64');
  const res = await fetch('https://rest.avatax.com/api/v2/transactions/create', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'SalesOrder',
      companyCode: config.avalara.companyCode,
      date: new Date().toISOString().slice(0, 10),
      customerCode: 'clinkit-buyer',
      addresses: { ShipTo: { postalCode: zip, country: 'US' } },
      lines: lines.map((l, i) => ({
        number: String(i + 1),
        amount: l.priceCents / 100,
        taxCode: l.taxCode ?? 'PF050502',
        description: l.itemName,
      })),
    }),
  });
  if (!res.ok) throw new Error(`avalara ${res.status}`);
  const j = await res.json();
  return {
    taxCents: Math.round(j.totalTax * 100),
    effectiveRate: j.totalAmount ? j.totalTax / j.totalAmount : 0,
    byLine: (j.lines ?? []).map((l) => Math.round(l.tax * 100)),
  };
}
