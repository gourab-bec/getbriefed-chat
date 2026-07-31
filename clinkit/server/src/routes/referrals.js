// Referral engine (Phase 5 flywheel): every user gets a share code; a referred signup
// creates a pending credit that pays out only when the referred user COMPLETES a first
// order (fraud gate). Buyer credit applies to the next order; runner bonus rides payout.

import { Router } from 'express';
import crypto from 'node:crypto';
import { db, newId } from '../db/memory.js';
import { requireAuth } from '../middleware/auth.js';

export const REFERRAL_BUYER_CREDIT_CENTS = 700;   // $7 to each side, buyer→buyer
export const REFERRAL_RUNNER_BONUS_CENTS = 3000;  // $30 runner signup, on 1st completed order

db.referrals = db.referrals ?? new Map(); // code -> { ownerId, uses: [] }
db.credits = db.credits ?? new Map();     // userId -> [{cents, reason, status: pending|granted|consumed}]

export function codeFor(userId) {
  for (const [code, r] of db.referrals) if (r.ownerId === userId) return code;
  const code = `CLK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  db.referrals.set(code, { ownerId: userId, uses: [] });
  return code;
}

function addCredit(userId, cents, reason, status) {
  const list = db.credits.get(userId) ?? [];
  list.push({ id: newId(), cents, reason, status, at: new Date().toISOString() });
  db.credits.set(userId, list);
}

/** Called by order completion: flips pending referral credits to granted. */
export function onFirstCompletedOrder(userId, role) {
  for (const [, r] of db.referrals) {
    const use = r.uses.find((u) => u.userId === userId && u.status === 'pending');
    if (!use) continue;
    use.status = 'completed';
    const bonus = role === 'runner' ? REFERRAL_RUNNER_BONUS_CENTS : REFERRAL_BUYER_CREDIT_CENTS;
    addCredit(userId, role === 'runner' ? 0 : REFERRAL_BUYER_CREDIT_CENTS, 'referred_signup', 'granted');
    addCredit(r.ownerId, bonus, `referral_reward_${role}`, 'granted');
  }
}

export const referralsRouter = Router();

referralsRouter.get('/me', requireAuth(), (req, res) => {
  const code = codeFor(req.user.sub);
  const r = db.referrals.get(code);
  const credits = db.credits.get(req.user.sub) ?? [];
  res.json({
    code,
    shareUrl: `https://clinkit.co/r/${code}`,
    pending: r.uses.filter((u) => u.status === 'pending').length,
    completed: r.uses.filter((u) => u.status === 'completed').length,
    creditBalanceCents: credits.filter((c) => c.status === 'granted').reduce((s, c) => s + c.cents, 0),
    credits,
  });
});

referralsRouter.post('/redeem', requireAuth(), (req, res) => {
  const { code } = req.body ?? {};
  const r = db.referrals.get(String(code ?? '').toUpperCase());
  if (!r) return res.status(404).json({ error: 'invalid code' });
  if (r.ownerId === req.user.sub) return res.status(400).json({ error: 'cannot refer yourself' });
  if ([...db.referrals.values()].some((x) => x.uses.some((u) => u.userId === req.user.sub))) {
    return res.status(409).json({ error: 'already referred' });
  }
  r.uses.push({ userId: req.user.sub, role: req.user.role, status: 'pending', at: new Date().toISOString() });
  res.json({ status: 'pending', note: 'credit unlocks when your first order completes' });
});
