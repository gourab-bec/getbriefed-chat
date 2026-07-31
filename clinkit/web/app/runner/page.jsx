'use client';
// Runner dashboard: go online, live request feed, bid, drive the delivery status machine.
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, fmt, getToken, setToken } from '../../lib/api';

const NEXT_ACTION = {
  matched: ['shopping', 'Start shopping'],
  shopping: ['purchased', 'Purchased (receipt photo)'],
  purchased: ['enroute', 'On my way'],
  enroute: ['delivered', 'Delivered (door photo)'],
};

export default function RunnerPage() {
  const [me, setMe] = useState(null);
  const [online, setOnline] = useState(false);
  const [feed, setFeed] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  async function ensureRunner() {
    if (!getToken()) {
      const email = `runner+${Math.random().toString(36).slice(2, 8)}@clinkit.app`;
      const r = await api('/auth/register', { method: 'POST', body: { email, password: 'password123', fullName: 'Demo Runner', role: 'runner' } });
      setToken(r.token);
    }
    setMe(await api('/runners/me').catch(() => null));
  }
  useEffect(() => { ensureRunner().catch((e) => setError(e.message)); }, []);

  async function goOnline() {
    await api('/runners/online', { method: 'POST', body: { lat: 37.742, lng: -121.43 } });
    setOnline(true);
    setFeed((await api('/runners/feed')).orders);
    const s = io({ auth: { token: getToken() } });
    socketRef.current = s;
    s.on('order:new', (o) => setFeed((prev) => [o, ...prev]));
  }

  async function bid(orderId) {
    try {
      await api(`/orders/${orderId}/bids`, { method: 'POST', body: { markupPct: 10, etaMin: 25 } });
      const s = socketRef.current;
      s?.emit('order:join', { orderId });
      s?.on('order:matched', async ({ orderId: oid, runnerId }) => {
        const mine = (await api(`/orders/${oid}`).catch(() => null));
        if (mine?.runnerId && mine.runnerId === runnerId) setActive(mine);
      });
    } catch (e) { setError(e.message); }
  }

  async function advance() {
    const [next] = NEXT_ACTION[active.status];
    const body = { status: next };
    if (next === 'purchased') body.receiptPhotoUrl = 's3://demo/receipt.jpg'; // real app: presigned S3 upload from camera
    if (next === 'delivered') body.deliveryPhotoUrl = 's3://demo/door.jpg';
    try {
      const updated = await api(`/orders/${active.id}/status`, { method: 'POST', body });
      setActive(updated.status === 'completed' ? null : updated);
      socketRef.current?.emit('gps:ping', { orderId: active.id, lat: 37.74 + Math.random() * 0.01, lng: -121.43 });
    } catch (e) { setError(e.message); }
  }

  return (
    <main>
      <h1 style={{ fontSize: 22 }}>Runner dashboard</h1>
      {me && <p className="feenote">★ {me.rating} · {me.completedOrders} deliveries · payouts {me.payouts?.length ?? 0}</p>}
      {error && <p className="err">{error}</p>}

      {!online && <button className="btn block" onClick={goOnline}>Go online</button>}

      {active ? (
        <section className="card cheapest">
          <h3>Active: {active.storeName} → {active.dropoff.address}</h3>
          <p className="feenote">Status <b>{active.status}</b> · your earnings {fmt(active.totals.runnerEarningsCents)} + reimbursed {fmt(active.totals.itemsBaseCents)}</p>
          {NEXT_ACTION[active.status] && (
            <button className="btn block" onClick={advance}>{NEXT_ACTION[active.status][1]}</button>
          )}
        </section>
      ) : online && (
        <section>
          <h3>Nearby requests</h3>
          {feed.length === 0 && <p className="feenote">No open requests — you'll hear a ping.</p>}
          {feed.map((o) => (
            <div className="card" key={o.orderId}>
              <div className="bid">
                <span>
                  {o.storeName} · {o.itemCount} items · earn ~{fmt(o.estEarningsCents)}
                  {o.surge > 1 && <span className="badge surge"> ⚡ {o.surge}×</span>}
                </span>
                <button className="btn" onClick={() => bid(o.orderId)}>Bid 10%</button>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
