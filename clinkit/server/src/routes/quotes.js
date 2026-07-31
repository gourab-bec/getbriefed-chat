// POST /api/quotes — the compare endpoint: basket + ZIP in, ranked store options out.

import { Router } from 'express';
import { offersForBasket } from '../providers/index.js';
import { buildStoreOptions } from '../core/comparison.js';
import { zipToPoint } from '../core/geo.js';
import { surgeMultiplier } from '../core/surge.js';
import { calculateTax } from '../services/avalara.js';
import { db, newId } from '../db/memory.js';
import { runnersNear } from '../redis.js';

export const quotesRouter = Router();

quotesRouter.post('/', async (req, res, next) => {
  try {
    const { items, zip, lat, lng, radiusMi = 10, runnerMarkupPct = 10 } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0 || items.length > 25) {
      return res.status(400).json({ error: 'items must be a non-empty array (max 25)' });
    }
    if (items.some((i) => typeof i !== 'string' || !i.trim())) {
      return res.status(400).json({ error: 'items must be non-empty strings' });
    }
    const buyerPoint = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : zipToPoint(zip);
    if (!buyerPoint) return res.status(400).json({ error: 'zip or lat/lng required' });
    const r = Math.min(Math.max(Number(radiusMi) || 10, 1), 10);

    // Surge from live demand/supply in this area.
    const nearbyRunners = await runnersNear(buyerPoint.lat, buyerPoint.lng, r);
    const openRequests = [...db.orders.values()].filter(
      (o) => ['requested', 'bidding'].includes(o.status),
    ).length;
    const surge = surgeMultiplier({
      openRequests,
      onlineRunners: nearbyRunners.length || 1,
      hourLocal: new Date().getHours(),
    });

    const offers = await offersForBasket({ itemQueries: items, zip, ...buyerPoint, radiusMi: r });
    const options = buildStoreOptions(items, offers, buyerPoint, {
      radiusMi: r, surgeMultiplier: surge, runnerMarkupPct,
    });

    // Authoritative tax per option (grocery exemptions by state).
    for (const opt of options) {
      const tax = await calculateTax({
        zip,
        lines: opt.lines.map((l) => ({ itemName: l.itemName, priceCents: l.basePriceCents })),
      });
      opt.totals.taxCents = tax.taxCents;
      opt.totals.buyerTotalCents += tax.taxCents;
    }
    options.sort(
      (a, b) => Number(b.coversAllItems) - Number(a.coversAllItems) || a.totals.buyerTotalCents - b.totals.buyerTotalCents,
    );

    const quote = {
      id: newId(),
      buyerId: req.user?.sub ?? null,
      zip, items, surge,
      options: [...options],
      savingsCents: options.savingsCents ?? 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    db.quotes.set(quote.id, quote);
    res.json(quote);
  } catch (err) { next(err); }
});

quotesRouter.get('/:id', (req, res) => {
  const q = db.quotes.get(req.params.id);
  if (!q) return res.status(404).json({ error: 'quote not found' });
  res.json(q);
});
