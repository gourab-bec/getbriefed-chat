// Redis wrapper with an in-memory fallback so dev/test run with no services.
// Prod (REDIS_URL set) lazily loads ioredis; also backs Socket.IO adapter, surge
// counters, and runner GEOSEARCH.

import { config } from './config.js';

let client = null;
const mem = new Map(); // key -> { value, expiresAt }

async function getClient() {
  if (!config.redisUrl) return null;
  if (!client) {
    const { default: Redis } = await import('ioredis');
    client = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });
  }
  return client;
}

export async function cacheGet(key) {
  const c = await getClient();
  if (c) {
    const v = await c.get(key);
    return v ? JSON.parse(v) : null;
  }
  const e = mem.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) { mem.delete(key); return null; }
  return e.value;
}

export async function cacheSet(key, value, ttlSeconds) {
  const c = await getClient();
  if (c) { await c.set(key, JSON.stringify(value), 'EX', ttlSeconds); return; }
  mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function incrWindow(key, windowSeconds) {
  const c = await getClient();
  if (c) {
    const n = await c.incr(key);
    if (n === 1) await c.expire(key, windowSeconds);
    return n;
  }
  const e = mem.get(key);
  const now = Date.now();
  if (!e || e.expiresAt < now) { mem.set(key, { value: 1, expiresAt: now + windowSeconds * 1000 }); return 1; }
  e.value += 1;
  return e.value;
}

// Runner geo presence: GEOADD in prod, simple map in dev.
const geoMem = new Map(); // runnerId -> {lat,lng}
export async function runnerLocationSet(runnerId, lat, lng) {
  const c = await getClient();
  if (c) { await c.geoadd('runners:online', lng, lat, runnerId); return; }
  geoMem.set(runnerId, { lat, lng });
}
export async function runnerLocationRemove(runnerId) {
  const c = await getClient();
  if (c) { await c.zrem('runners:online', runnerId); return; }
  geoMem.delete(runnerId);
}
export async function runnersNear(lat, lng, radiusMi) {
  const c = await getClient();
  if (c) return c.geosearch('runners:online', 'FROMLONLAT', lng, lat, 'BYRADIUS', radiusMi, 'mi', 'ASC');
  const { distanceMi } = await import('./core/geo.js');
  return [...geoMem.entries()]
    .filter(([, p]) => distanceMi({ lat, lng }, p) <= radiusMi)
    .map(([id]) => id);
}
export function _memStats() { return { keys: mem.size, runners: geoMem.size }; }
