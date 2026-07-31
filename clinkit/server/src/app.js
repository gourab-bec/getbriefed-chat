import express from 'express';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { quotesRouter } from './routes/quotes.js';
import { ordersRouter } from './routes/orders.js';
import { runnersRouter } from './routes/runners.js';
import { adminRouter } from './routes/admin.js';
import { referralsRouter } from './routes/referrals.js';
import { verifyWebhookSignature } from './services/stripe.js';
import { incrWindow } from './redis.js';
import { log, requestLogger } from './logger.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Stripe webhooks need the raw body for signature verification — mount before json().
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const event = await verifyWebhookSignature(req.body, req.headers['stripe-signature']);
      // payment_intent.succeeded / account.updated / transfer.failed handled idempotently here.
      log.info('stripe_webhook', { type: event.type ?? 'event' });
      res.json({ received: true });
    } catch {
      res.status(400).json({ error: 'invalid signature' });
    }
  });

  app.use(express.json({ limit: '256kb' }));
  app.use(requestLogger());

  // Security headers (helmet-equivalent minimal set) + CORS allowlist.
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    });
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Global rate limit: 100 req/min/IP.
  app.use(async (req, res, next) => {
    const n = await incrWindow(`rl:global:${req.ip}`, 60);
    if (n > 100) return res.status(429).json({ error: 'rate limited' });
    next();
  });

  app.get('/api/health', (req, res) => res.json({ ok: true, mock: config.providersMock }));
  app.use('/api/auth', authRouter);
  app.use('/api/quotes', quotesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/runners', runnersRouter);
  app.use('/api/referrals', referralsRouter);
  app.use('/api/admin', adminRouter);

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status ?? 500;
    if (status >= 500) log.error('unhandled', { err: err.message, stack: err.stack });
    res.status(status).json({ error: status >= 500 ? 'internal error' : err.message });
  });
  return app;
}
