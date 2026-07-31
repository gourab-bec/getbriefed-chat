// Circuit breaker + in-flight request coalescing for provider calls.
// Breaker: 5 consecutive failures opens the circuit for 60 s (calls fail fast → aggregator
// falls back to other providers/cache; no quota burn on a dead or mis-keyed provider).
// Coalescing: concurrent identical requests share one upstream call (thundering-herd guard
// for hot queries like "milk" in a busy ZIP).

const FAILURE_THRESHOLD = 5;
const OPEN_MS = 60_000;

const breakers = new Map(); // name -> { failures, openedAt }
const inflight = new Map(); // key -> Promise

export function breakerState(name) {
  const b = breakers.get(name);
  if (!b) return 'closed';
  if (b.openedAt && Date.now() - b.openedAt < OPEN_MS) return 'open';
  if (b.openedAt) return 'half-open'; // window elapsed; next call probes
  return b.failures > 0 ? 'degraded' : 'closed';
}

export async function withBreaker(name, fn) {
  const state = breakerState(name);
  if (state === 'open') throw new Error(`${name} circuit open`);
  try {
    const result = await fn();
    breakers.set(name, { failures: 0, openedAt: null });
    return result;
  } catch (err) {
    const b = breakers.get(name) ?? { failures: 0, openedAt: null };
    b.failures += 1;
    if (b.failures >= FAILURE_THRESHOLD) b.openedAt = Date.now();
    breakers.set(name, b);
    throw err;
  }
}

export function coalesce(key, fn) {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = Promise.resolve()
    .then(fn)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function _resetBreakers() { breakers.clear(); inflight.clear(); }
