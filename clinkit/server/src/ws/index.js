// Socket.IO gateway: bid broadcasts, order rooms (buyer+runner), chat, GPS tracking.
// Prod adds the Redis adapter so any Fargate task serves any client.

import { verifyToken } from '../middleware/auth.js';
import { db } from '../db/memory.js';
import { runnerLocationSet } from '../redis.js';
import { distanceMi } from '../core/geo.js';

let io = null;

export function initWs(socketIo) {
  io = socketIo;

  io.use((socket, next) => {
    const payload = verifyToken(socket.handshake.auth?.token ?? '');
    if (!payload) return next(new Error('unauthorized'));
    socket.data.user = payload;
    next();
  });

  io.on('connection', (socket) => {
    const { sub: userId, role } = socket.data.user;
    if (role === 'runner') socket.join('runners');

    socket.on('order:join', ({ orderId }) => {
      const order = db.orders.get(orderId);
      if (order && [order.buyerId, order.runnerId].includes(userId)) socket.join(`order:${orderId}`);
    });

    socket.on('chat:send', ({ orderId, body }) => {
      const order = db.orders.get(orderId);
      if (!order || ![order.buyerId, order.runnerId].includes(userId)) return;
      if (typeof body !== 'string' || !body.trim() || body.length > 2000) return;
      const msg = { orderId, senderId: userId, body: body.trim(), at: new Date().toISOString() };
      db.messages.push(msg);
      io.to(`order:${orderId}`).emit('chat:message', msg);
    });

    // Runner GPS ping every ~5s while engaged; buyer sees live dot.
    // accuracyM (meters, from the device) is stored per ping — the Prop 22 mileage
    // calculator counts only pings ≤ MAX_GPS_ACCURACY_M; low-accuracy pings still
    // render on the map but never reduce (or inflate) engaged miles.
    socket.on('gps:ping', async ({ orderId, lat, lng, accuracyM }) => {
      if (role !== 'runner' || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      const acc = Number.isFinite(accuracyM) && accuracyM >= 0 ? Math.round(accuracyM) : null;
      await runnerLocationSet(userId, lat, lng);
      const order = orderId && db.orders.get(orderId);
      if (order && order.runnerId === userId) {
        const delivery = db.deliveries.get(orderId) ?? { orderId, gpsTrail: [] };
        delivery.gpsTrail.push({ lat, lng, at: Date.now(), accuracyM: acc });
        db.deliveries.set(orderId, delivery);
        io.to(`order:${orderId}`).emit('gps:update', { orderId, lat, lng });
      }
    });
  });
}

/** Broadcast to online runners whose last known point is within radius of the store. */
export function emitToRunnersNear(storePoint, radiusMi, event, payload) {
  if (!io) return;
  for (const [, s] of io.of('/').sockets) {
    if (s.data.user?.role !== 'runner') continue;
    const runner = db.runners.get(s.data.user.sub);
    if (!runner?.online || !runner.lastPoint) continue;
    if (distanceMi(storePoint, runner.lastPoint) <= radiusMi) s.emit(event, payload);
  }
}

export function emitToOrder(orderId, event, payload) {
  io?.to(`order:${orderId}`).emit(event, payload);
}
