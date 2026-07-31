'use client';
// Order screen: live bids → accept → status stepper → chat + GPS updates over Socket.IO.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { io } from 'socket.io-client';
import { api, fmt, getToken } from '../../../lib/api';

const STEPS = ['matched', 'shopping', 'purchased', 'enroute', 'delivered', 'completed'];

export default function OrderPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [bids, setBids] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState('');
  const [runnerPos, setRunnerPos] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
    const s = io({ auth: { token: getToken() } });
    socketRef.current = s;
    s.emit('order:join', { orderId: id });
    s.on('bid:new', (b) => setBids((prev) => [...prev, b]));
    s.on('order:matched', () => api(`/orders/${id}`).then(setOrder));
    s.on('order:status', () => api(`/orders/${id}`).then(setOrder));
    s.on('chat:message', (m) => setMsgs((prev) => [...prev, m]));
    s.on('gps:update', (p) => setRunnerPos(p));
    return () => s.disconnect();
  }, [id]);

  async function accept(bid) {
    try { await api(`/orders/bids/${bid.id}/accept`, { method: 'POST', body: {} }); }
    catch (e) { setError(e.message); }
  }
  function send() {
    if (!draft.trim()) return;
    socketRef.current?.emit('chat:send', { orderId: id, body: draft });
    setDraft('');
  }

  if (!order) return <p>{error ?? 'Loading…'}</p>;
  const stepIdx = STEPS.indexOf(order.status);

  return (
    <main>
      <h1 style={{ fontSize: 22 }}>{order.storeName} → {order.dropoff.address}</h1>
      <div className="stepper" role="progressbar" aria-valuenow={stepIdx + 1} aria-valuemax={STEPS.length}>
        {STEPS.map((s, i) => <div key={s} className={`step${i <= stepIdx ? ' done' : ''}`} title={s} />)}
      </div>
      <p className="feenote">Status: <b>{order.status}</b> · Total {fmt(order.totals.buyerTotalCents)}
        {order.surgeMultiplier > 1 && <span className="badge surge"> ⚡ {order.surgeMultiplier}×</span>}</p>
      {error && <p className="err">{error}</p>}

      {order.status === 'bidding' && (
        <section className="card">
          <h3>Runner bids <span className="feenote">(expire in 60s)</span></h3>
          {bids.length === 0 && <p className="feenote">Waiting for nearby Runners…</p>}
          {bids.map((b) => (
            <div className="bid" key={b.id}>
              <span>★ {b.runnerRating} · +{b.markupPct}% · ⏱ {b.etaMin} min</span>
              <button className="btn" onClick={() => accept(b)}>Accept</button>
            </div>
          ))}
        </section>
      )}

      {runnerPos && (
        <p className="feenote">📍 Runner at {runnerPos.lat.toFixed(4)}, {runnerPos.lng.toFixed(4)} (live)</p>
      )}

      <section className="card">
        <h3>Items</h3>
        <ul className="lines">
          {order.items.map((it) => (
            <li key={it.id}>
              <span>{it.itemName} {it.fulfillment !== 'pending' && <em className="feenote">({it.fulfillment})</em>}</span>
              <span>{fmt(it.actualPriceCents ?? it.estPriceCents)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Chat</h3>
        <div className="msgs">{msgs.map((m, i) => <p key={i}><b>{m.senderId === order.buyerId ? 'You' : 'Runner'}:</b> {m.body}</p>)}</div>
        <div className="chat">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
                 placeholder="Message your Runner…" />
          <button className="btn ghost" onClick={send}>Send</button>
        </div>
      </section>
    </main>
  );
}
