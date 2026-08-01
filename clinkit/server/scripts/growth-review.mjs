// Growth review agent: pulls live metrics, compares against plan targets, and emits a
// markdown report with the specific playbook adjustment for every off-target metric.
// Run daily (GitHub Action .github/workflows/growth-review.yml, or locally):
//   METRICS_URL=https://zipnab-api.fly.dev ADMIN_TOKEN=xxx LAUNCH_MONTH=1 node scripts/growth-review.mjs
// Exit code 1 when anything is off-target (lets CI mark the run and open an issue).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const targets = JSON.parse(readFileSync(join(here, 'growth-targets.json'), 'utf8'));
const { playbook, planVersion } = targets;
// PLAN=aggressive tracks the founder's $10k/$30k/$100k net curve; default = base plan.
const months = process.env.PLAN === 'aggressive' ? targets.aggressiveMonths : targets.months;

const BASE = process.env.METRICS_URL ?? 'http://localhost:4000';
const month = String(process.env.LAUNCH_MONTH ?? '1');
const t = months[month] ?? months[Object.keys(months).sort((a, b) => b - a).find((m) => Number(m) <= Number(month))] ?? months['1'];

const headers = process.env.ADMIN_TOKEN ? { 'X-Admin-Token': process.env.ADMIN_TOKEN } : {};
let m;
try {
  m = await (await fetch(`${BASE}/api/admin/metrics`, { headers, signal: AbortSignal.timeout(10000) })).json();
} catch (e) {
  console.log(`# Growth review — FAILED to reach ${BASE}: ${e.message}\nIs the API deployed? See docs/08-DEPLOY-VERCEL.md.`);
  process.exit(1);
}

// Derived (windowDays lets the same report run on partial data early on).
const windowDays = Number(process.env.WINDOW_DAYS ?? 7);
const ordersPerDay = m.completed / windowDays;
const spendCents = Number(process.env.MARKETING_SPEND_CENTS ?? 0); // founder inputs actual ad spend
const newBuyers = Number(process.env.NEW_BUYERS ?? 0);
const cacCents = newBuyers > 0 ? Math.round(spendCents / newBuyers) : null;
const referralShare = m.referrals > 0 && newBuyers > 0 ? Math.min(1, m.referrals / newBuyers) : null;

const rows = [];
const flag = (name, actual, target, ok, advice) => rows.push({ name, actual, target, ok, advice });

flag('Orders/day', ordersPerDay.toFixed(1), `≥ ${t.ordersPerDay}`, ordersPerDay >= t.ordersPerDay,
  ordersPerDay >= t.ordersPerDay ? playbook.ordersPerDay.above : playbook.ordersPerDay.below);
flag('Completion rate', m.completionRate == null ? 'n/a' : (m.completionRate * 100).toFixed(0) + '%', `≥ ${t.completionRate * 100}%`,
  m.completionRate == null || m.completionRate >= t.completionRate, playbook.completionRate.below);
flag('CAC', cacCents == null ? 'n/a (set MARKETING_SPEND_CENTS + NEW_BUYERS)' : `$${(cacCents / 100).toFixed(2)}`,
  `≤ $${(t.cacMaxCents / 100).toFixed(2)}`, cacCents == null || cacCents <= t.cacMaxCents,
  cacCents != null && cacCents <= t.cacMaxCents ? playbook.cac.below : playbook.cac.above);
flag('Referral share', referralShare == null ? 'n/a' : (referralShare * 100).toFixed(0) + '%',
  `≥ ${t.referralShareMin * 100}%`, referralShare == null || referralShare >= t.referralShareMin, playbook.referralShare.below);
const tr = m.takeRate;
flag('Take rate', tr == null ? 'n/a' : (tr * 100).toFixed(2) + '%', `${t.takeRateBand[0] * 100}–${t.takeRateBand[1] * 100}%`,
  tr == null || (tr >= t.takeRateBand[0] && tr <= t.takeRateBand[1]), playbook.takeRate.outside);

const off = rows.filter((r) => !r.ok);
console.log(`# ZipNab growth review — month ${month} targets (${planVersion})`);
console.log(`_${new Date().toISOString().slice(0, 10)} · window ${windowDays}d · GMV $${(m.gmvCents / 100).toFixed(0)} · platform rev $${(m.platformRevenueCents / 100).toFixed(0)} · runners online ${m.runnersOnline}_\n`);
console.log('| Metric | Actual | Target | Status |');
console.log('|---|---|---|---|');
for (const r of rows) console.log(`| ${r.name} | ${r.actual} | ${r.target} | ${r.ok ? '✅' : '🔴'} |`);
if (off.length) {
  console.log('\n## Adjustments to make today');
  off.forEach((r, i) => console.log(`${i + 1}. **${r.name}** — ${r.advice}`));
} else {
  console.log('\nAll green. Per plan: scale the winning creative and consider unlocking the next ZIP.');
}
process.exit(off.length ? 1 : 0);
