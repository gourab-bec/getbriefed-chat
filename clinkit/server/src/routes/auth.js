import { Router } from 'express';
import { db, newId, findUserByEmail } from '../db/memory.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../middleware/auth.js';
import { createRunnerAccount } from '../services/stripe.js';
import { incrWindow } from '../redis.js';

export const authRouter = Router();

// Rate limit auth endpoints: 10/min per IP.
authRouter.use(async (req, res, next) => {
  const n = await incrWindow(`rl:auth:${req.ip}`, 60);
  if (n > 10) return res.status(429).json({ error: 'too many attempts' });
  next();
});

authRouter.post('/register', async (req, res) => {
  const { email, password, fullName, role = 'buyer', zip } = req.body ?? {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'valid email required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'password min 8 chars' });
  if (!fullName) return res.status(400).json({ error: 'fullName required' });
  if (!['buyer', 'runner'].includes(role)) return res.status(400).json({ error: 'role must be buyer|runner' });
  if (findUserByEmail(email)) return res.status(409).json({ error: 'email already registered' });

  const user = {
    id: newId(),
    role,
    email: email.toLowerCase(),
    fullName,
    homeZip: zip ?? null,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  db.users.set(user.id, user);

  let onboardingUrl = null;
  if (role === 'runner') {
    const acct = await createRunnerAccount(user.email);
    db.runners.set(user.id, {
      userId: user.id, stripeAccountId: acct.accountId, rating: 5, completedOrders: 0,
      online: false, lastPoint: null, backgroundCheck: 'pending',
    });
    onboardingUrl = acct.onboardingUrl;
  }
  const token = signToken({ sub: user.id, role: user.role, email: user.email });
  res.status(201).json({ token, user: publicUser(user), onboardingUrl });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const user = email && findUserByEmail(email);
  if (!user || !verifyPassword(password ?? '', user.passwordHash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const token = signToken({ sub: user.id, role: user.role, email: user.email });
  res.json({ token, user: publicUser(user) });
});

// CCPA/GDPR-style rights
authRouter.get('/me/export', requireAuth(), (req, res) => {
  const user = db.users.get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'not found' });
  const orders = [...db.orders.values()].filter((o) => o.buyerId === user.id || o.runnerId === user.id);
  res.json({ user: publicUser(user), orders });
});

authRouter.delete('/me', requireAuth(), (req, res) => {
  const user = db.users.get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'not found' });
  user.deletedAt = new Date().toISOString(); // purge job hard-deletes after 30d
  res.json({ status: 'scheduled_for_deletion', purgeAfterDays: 30 });
});

const publicUser = (u) => ({ id: u.id, role: u.role, email: u.email, fullName: u.fullName, homeZip: u.homeZip });
