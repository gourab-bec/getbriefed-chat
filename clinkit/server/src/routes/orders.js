// Orders + bids: place from a quote, runners bid over WS, buyer accepts (Stripe auth hold),
// runner drives the status machine to delivered (photo proof), capture + split on completion.

import { Router } from 'express';
import { db, newId, transitionOrder } from '../db/memory.js';
import { requireAuth } from '../middleware/auth.js';
import { computeTotals } from '../core/pricing.js';
import { distanceMi } from '../core/geo.js';
import { authorizePayment, capturePayment, cancelPayment } from '../services/stripe.js';
import { emitToRunnersNear, emitToOrder } from '../ws/index.js';

export const ordersRouter = Router();

ordersRouter.post('/', requireAuth('buyer'), async (req, res, next) => {
  try {
    const { quoteId, storeName, dropoff } = req.body ?? {};
    const quote = db.quotes.get(quoteId);
    if (!quote) return res.status(404).json({ error: 'quote not found' });
    if (new Date(quote.expiresAt) < new Date()) return res.status(410).json({ error: 'quote expired — re-compare' });
    const option = quote.options.find((o) => o.storeName === storeName) ?? quote.options[0];
    if (!option) return res.status(400).json({ error: 'no store option available' });
    if (!dropoff?.lat || !dropoff?.lng || !dropoff?.address) {
      return res.status(400).json({ error: 'dropoff {lat,lng,address} required' });
    }

    const order = {
      id: newId(),
      buyerId: req.user.sub,
      quoteId,
      storeChain: option.storeChain,
      storeName: option.storeName,
      storePoint: option.location,
      dropoff,
      status: 'requested',
      runnerId: null,
      surgeMultiplier: quote.surge,
      items: option.lines.map((l) => ({
        id: newId(), itemQuery: l.query, itemName: l.itemName,
        estPriceCents: l.basePriceCents, actualPriceCents: null, fulfillment: 'pending',
      })),
      totals: option.totals,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.orders.set(order.id, order);
    transitionOrder(order, 'bidding');

    // Alert online runners within radius of the store.
    emitToRunnersNear(option.location, 10, 'order:new', {
      orderId: order.id,
      storeName: order.storeName,
      itemCount: order.items.length,
      estEarningsCents: order.totals.runnerEarningsCents,
      surge: order.surgeMultiplier,
    });
    res.status(201).json(order);
  } catch (err) { next(err); }
});

ordersRouter.get('/:id', requireAuth(), (req, res) => {
  const order = db.orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'order not found' });
  if (![order.buyerId, order.runnerId].includes(req.user.sub) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  res.json(order);
});

// --- Bids ---

ordersRouter.post('/:id/bids', requireAuth('runner'), (req, res) => {
  const order = db.orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'order not found' });
  if (order.status !== 'bidding') return res.status(409).json({ error: `order is ${order.status}` });
  const { markupPct = 10, etaMin } = req.body ?? {};
  if (markupPct < 5 || markupPct > 20) return res.status(400).json({ error: 'markupPct must be 5–20' });
  if (!Number.isInteger(etaMin) || etaMin < 10 || etaMin > 60) return res.status(400).json({ error: 'etaMin must be 10–60' });
  if ([...db.bids.values()].some((b) => b.orderId === order.id && b.runnerId === req.user.sub && b.status === 'open')) {
    return res.status(409).json({ error: 'already bid' });
  }

  const runner = db.runners.get(req.user.sub);
  const bid = {
    id: newId(), orderId: order.id, runnerId: req.user.sub,
    runnerRating: runner?.rating ?? 5, markupPct, etaMin, status: 'open',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
  };
  db.bids.set(bid.id, bid);
  emitToOrder(order.id, 'bid:new', bid);
  res.status(201).json(bid);
});

ordersRouter.post('/bids/:bidId/accept', requireAuth('buyer'), async (req, res, next) => {
  try {
    const bid = db.bids.get(req.params.bidId);
    if (!bid || bid.status !== 'open') return res.status(404).json({ error: 'bid not open' });
    if (new Date(bid.expiresAt) < new Date()) { bid.status = 'expired'; return res.status(410).json({ error: 'bid expired' }); }
    const order = db.orders.get(bid.orderId);
    if (order.buyerId !== req.user.sub) return res.status(403).json({ error: 'forbidden' });
    if (order.status !== 'bidding') return res.status(409).json({ error: `order is ${order.status}` });

    // Recompute totals with the accepted markup, keep quoted tax.
    const storeToBuyerMi = distanceMi(order.storePoint, order.dropoff);
    const totals = computeTotals({
      itemsBaseCents: order.totals.itemsBaseCents,
      runnerMarkupPct: bid.markupPct,
      surgeMultiplier: order.surgeMultiplier,
      storeToBuyerMi,
    });
    totals.taxCents = order.totals.taxCents;
    totals.buyerTotalCents += order.totals.taxCents;
    order.totals = totals;

    const runner = db.runners.get(bid.runnerId);
    const payment = await authorizePayment({
      orderId: order.id,
      buyerTotalCents: totals.buyerTotalCents,
      platformFeeCents: totals.platformFeeCents,
      runnerAccountId: runner?.stripeAccountId,
    });
    db.payments.set(order.id, { orderId: order.id, ...payment, amountCents: totals.buyerTotalCents, statusLocal: 'authorized' });

    bid.status = 'accepted';
    for (const other of db.bids.values()) {
      if (other.orderId === order.id && other.id !== bid.id && other.status === 'open') other.status = 'rejected';
    }
    order.runnerId = bid.runnerId;
    transitionOrder(order, 'matched');
    emitToOrder(order.id, 'order:matched', { orderId: order.id, runnerId: bid.runnerId, etaMin: bid.etaMin });
    res.json({ order, payment: { clientSecret: payment.clientSecret } });
  } catch (err) { next(err); }
});

// --- Runner status progression with proof ---

ordersRouter.post('/:id/status', requireAuth('runner'), async (req, res, next) => {
  try {
    const order = db.orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'order not found' });
    if (order.runnerId !== req.user.sub) return res.status(403).json({ error: 'not your order' });
    const { status, receiptPhotoUrl, deliveryPhotoUrl, actuals } = req.body ?? {};

    if (status === 'purchased') {
      if (!receiptPhotoUrl) return res.status(400).json({ error: 'receiptPhotoUrl required' });
      const delivery = db.deliveries.get(order.id) ?? { orderId: order.id, gpsTrail: [] };
      delivery.receiptPhotoS3 = receiptPhotoUrl;
      delivery.purchasedAt = new Date().toISOString();
      db.deliveries.set(order.id, delivery);
      // Receipt actuals replace estimates; >$2 total drift requires buyer approval (P1: tap-approve flow).
      if (Array.isArray(actuals)) {
        for (const a of actuals) {
          const item = order.items.find((i) => i.id === a.itemId);
          if (item) { item.actualPriceCents = a.priceCents; item.fulfillment = a.fulfillment ?? 'found'; }
        }
      }
    }
    if (status === 'delivered') {
      if (!deliveryPhotoUrl) return res.status(400).json({ error: 'deliveryPhotoUrl required' });
      const delivery = db.deliveries.get(order.id) ?? { orderId: order.id, gpsTrail: [] };
      delivery.deliveryPhotoS3 = deliveryPhotoUrl;
      delivery.deliveredAt = new Date().toISOString();
      db.deliveries.set(order.id, delivery);
    }

    transitionOrder(order, status);
    emitToOrder(order.id, 'order:status', { orderId: order.id, status });

    if (status === 'delivered') {
      const payment = db.payments.get(order.id);
      const captured = await capturePayment({
        orderId: order.id,
        paymentIntentId: payment.paymentIntentId,
        finalAmountCents: order.totals.buyerTotalCents,
      });
      payment.statusLocal = 'captured';
      payment.transferId = captured.transferId;
      transitionOrder(order, 'completed');
      const runner = db.runners.get(order.runnerId);
      if (runner) runner.completedOrders += 1;
      emitToOrder(order.id, 'order:status', { orderId: order.id, status: 'completed' });
    }
    res.json(order);
  } catch (err) { next(err); }
});

ordersRouter.post('/:id/cancel', requireAuth(), async (req, res, next) => {
  try {
    const order = db.orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'order not found' });
    if (![order.buyerId, order.runnerId].includes(req.user.sub) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    transitionOrder(order, 'cancelled');
    const payment = db.payments.get(order.id);
    if (payment?.statusLocal === 'authorized') {
      await cancelPayment({ orderId: order.id, paymentIntentId: payment.paymentIntentId });
      payment.statusLocal = 'voided';
    }
    emitToOrder(order.id, 'order:status', { orderId: order.id, status: 'cancelled' });
    res.json(order);
  } catch (err) { next(err); }
});

// --- Ratings ---

ordersRouter.post('/:id/rating', requireAuth(), (req, res) => {
  const order = db.orders.get(req.params.id);
  if (!order || order.status !== 'completed') return res.status(409).json({ error: 'order not completed' });
  const { stars, comment } = req.body ?? {};
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: 'stars 1–5' });
  const raterId = req.user.sub;
  if (![order.buyerId, order.runnerId].includes(raterId)) return res.status(403).json({ error: 'forbidden' });
  if (db.ratings.some((r) => r.orderId === order.id && r.raterId === raterId)) {
    return res.status(409).json({ error: 'already rated' });
  }
  const rateeId = raterId === order.buyerId ? order.runnerId : order.buyerId;
  db.ratings.push({ id: newId(), orderId: order.id, raterId, rateeId, stars, comment: comment ?? null });
  const runner = db.runners.get(rateeId);
  if (runner) {
    const runnerRatings = db.ratings.filter((r) => r.rateeId === rateeId);
    runner.rating = Math.round((runnerRatings.reduce((s, r) => s + r.stars, 0) / runnerRatings.length) * 100) / 100;
  }
  res.status(201).json({ ok: true });
});
