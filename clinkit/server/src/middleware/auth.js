// Auth: scrypt password hashing + HS256 JWTs via node:crypto (no extra deps, PCI-friendly:
// no card data here, ever). Access tokens 15 min; refresh handled by re-login in MVP.

import crypto from 'node:crypto';
import { config } from '../config.js';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [, salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export function signToken(payload, ttlSeconds = 15 * 60) {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  const [header, body, sig] = String(token).split('.');
  if (!header || !body || !sig) return null;
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** Express middleware: require a valid bearer token (optionally a specific role). */
export function requireAuth(role) {
  return (req, res, next) => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'unauthorized' });
    if (role && payload.role !== role && payload.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    req.user = payload;
    next();
  };
}
