// Domain availability checker (RDAP — the registry's own protocol; 404 = unregistered).
// Usage: node scripts/check-domains.mjs name1 name2 ...   (defaults to brand candidates)
// Availability ≠ trademark clearance: run candidates through USPTO TESS before committing.

const CANDIDATES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['clinkit', 'getnab', 'nabbit', 'grably', 'snagly', 'fetchit', 'runlee', 'quikcart',
     'cartnab', 'zipnab', 'pricenab', 'nabgo', 'getgoly', 'steely', 'nabley', 'grabgo',
     'pricely', 'runnerly'];
const TLDS = ['com', 'co', 'app'];

async function status(domain) {
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { accept: 'application/rdap+json' },
    });
    if (res.status === 404) return 'AVAILABLE';
    if (res.ok) return 'taken';
    return `unknown(${res.status})`;
  } catch {
    return 'unknown(err)';
  }
}

const rows = [];
for (const name of CANDIDATES) {
  const checks = await Promise.all(TLDS.map(async (tld) => [tld, await status(`${name}.${tld}`)]));
  rows.push({ name, ...Object.fromEntries(checks) });
  console.log(`${name.padEnd(10)} ${checks.map(([t, s]) => `${t}:${s}`).join('  ')}`);
}
const winners = rows.filter((r) => r.com === 'AVAILABLE');
console.log('\n.com AVAILABLE:', winners.map((r) => r.name).join(', ') || 'none');
