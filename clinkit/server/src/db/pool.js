// Postgres pool — lazily loads `pg` only when DATABASE_URL is configured, so mock-mode
// dev/tests run without the dependency or a database. In-memory stores back dev mode.

import { config } from '../config.js';

let pool = null;

export async function getPool() {
  if (!config.databaseUrl) return null;
  if (!pool) {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
  }
  return pool;
}

export async function query(text, params) {
  const p = await getPool();
  if (!p) throw new Error('DATABASE_URL not configured');
  return p.query(text, params);
}
