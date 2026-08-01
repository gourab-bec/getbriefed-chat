import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { handleSupportMessage, supportLive } from '../services/supportAgent.js';
import { db } from '../db/memory.js';
import { incrWindow } from '../redis.js';

export const supportRouter = Router();

// 20 msgs/min per user — generous for humans, blocks abuse of the LLM path.
supportRouter.post('/chat', requireAuth(), async (req, res, next) => {
  try {
    const n = await incrWindow(`rl:support:${req.user.sub}`, 60);
    if (n > 20) return res.status(429).json({ error: 'slow down a moment' });
    const { message, history } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
      return res.status(400).json({ error: 'message required (max 4000 chars)' });
    }
    const safeHistory = Array.isArray(history)
      ? history.slice(-10).filter(
          (h) => ['user', 'assistant'].includes(h?.role) && typeof h?.content === 'string' && h.content.length <= 4000,
        )
      : [];
    const result = await handleSupportMessage({
      userId: req.user.sub, role: req.user.role, message: message.trim(), history: safeHistory,
    });
    res.json({ ...result, ai: supportLive() ? 'claude' : 'policy-router' });
  } catch (err) { next(err); }
});

supportRouter.get('/tickets/mine', requireAuth(), (req, res) => {
  res.json({
    tickets: [...(db.tickets?.values() ?? [])]
      .filter((t) => t.userId === req.user.sub)
      .map(({ id, kind, severity, status, createdAt, resolution }) => ({ id, kind, severity, status, createdAt, resolution })),
  });
});
