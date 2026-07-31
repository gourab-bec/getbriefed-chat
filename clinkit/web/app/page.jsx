'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fmt, setToken, getToken } from '../lib/api';
import StoreOptionCard from '../components/StoreOptionCard';

const SUGGESTIONS = ['milk', 'eggs', 'bread', 'butter', 'bananas', 'rice', 'toilet paper'];

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState('milk, eggs, bread');
  const [zip, setZip] = useState('95376');
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function compare() {
    setBusy(true); setError(null);
    try {
      const items = query.split(',').map((s) => s.trim()).filter(Boolean);
      setQuote(await api('/quotes', { method: 'POST', body: { items, zip } }));
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function choose(option) {
    try {
      if (!getToken()) {
        // Demo auto-login (real app: auth screen with phone OTP)
        const email = `demo+${Math.random().toString(36).slice(2, 8)}@clinkit.app`;
        const r = await api('/auth/register', { method: 'POST', body: { email, password: 'password123', fullName: 'Demo Buyer', zip } });
        setToken(r.token);
      }
      const order = await api('/orders', {
        method: 'POST',
        body: {
          quoteId: quote.id,
          storeName: option.storeName,
          dropoff: { lat: 37.7397, lng: -121.4252, address: '123 Main St, Tracy CA' },
        },
      });
      router.push(`/order/${order.id}`);
    } catch (e) { setError(e.message); }
  }

  return (
    <main>
      <h1 style={{ fontSize: 26 }}>What do you need? We find it cheapest nearby.</h1>
      <div className="searchbox">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="milk, eggs, bread…"
               onKeyDown={(e) => e.key === 'Enter' && compare()} aria-label="Items to compare" />
        <input value={zip} onChange={(e) => setZip(e.target.value)} style={{ maxWidth: 90 }} aria-label="ZIP code" />
        <button className="btn" onClick={compare} disabled={busy}>{busy ? '…' : 'Compare'}</button>
      </div>
      <p className="feenote">Try: {SUGGESTIONS.map((s) => (
        <button key={s} className="btn ghost" style={{ padding: '2px 10px', fontSize: 13, marginRight: 6 }}
                onClick={() => setQuery(s)}>{s}</button>
      ))}</p>
      {error && <p className="err">{error}</p>}

      {quote && (
        <section aria-live="polite">
          <h2 style={{ fontSize: 18 }}>Store options near {quote.zip}</h2>
          {quote.options.map((o) => (
            <StoreOptionCard key={o.storeName} option={o} surge={quote.surge} onChoose={choose} />
          ))}
          {quote.savingsCents > 0 && (
            <div className="savings">
              You save {fmt(quote.savingsCents)} choosing {quote.options[0].storeName} ✨
            </div>
          )}
        </section>
      )}
    </main>
  );
}
