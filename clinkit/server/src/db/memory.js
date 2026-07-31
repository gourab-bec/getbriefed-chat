// MVP runtime store: in-memory maps mirroring schema.sql tables. Dev/demo runs stateless;
// production swaps these for parameterized SQL against Postgres (same function signatures),
// keeping routes storage-agnostic.

import crypto from 'node:crypto';

export const db = {
  users: new Map(),      // id -> user
  runners: new Map(),    // userId -> runner profile
  quotes: new Map(),
  orders: new Map(),
  bids: new Map(),
  messages: [],
  ratings: [],
  payments: new Map(),   // orderId -> payment
  deliveries: new Map(), // orderId -> delivery
};

export const newId = () => crypto.randomUUID();

export function findUserByEmail(email) {
  return [...db.users.values()].find((u) => u.email === email.toLowerCase()) ?? null;
}

export const ORDER_TRANSITIONS = {
  requested: ['bidding', 'cancelled'],
  bidding: ['matched', 'cancelled'],
  matched: ['shopping', 'cancelled'],
  shopping: ['purchased', 'cancelled'],
  purchased: ['enroute', 'disputed'],
  enroute: ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  completed: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
};

export function transitionOrder(order, next) {
  const allowed = ORDER_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(next)) {
    const err = new Error(`invalid transition ${order.status} -> ${next}`);
    err.status = 409;
    throw err;
  }
  order.status = next;
  order.updatedAt = new Date().toISOString();
  return order;
}
