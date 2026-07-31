'use client';
import { useState } from 'react';
import { fmt } from '../lib/api';

/** The store-comparison card — docs/05-DESIGN.md centerpiece. */
export default function StoreOptionCard({ option, surge, onChoose }) {
  const [expanded, setExpanded] = useState(option.isCheapest);
  const t = option.totals;
  const minsAgo = option.lines[0]?.fetchedAt
    ? Math.max(0, Math.round((Date.now() - new Date(option.lines[0].fetchedAt)) / 60000))
    : null;
  const outOfStock = option.lines.filter((l) => !l.inStock);

  return (
    <div className={`card${option.isCheapest ? ' cheapest' : ''}`}>
      <div className="storehead">
        <h3>
          {option.isCheapest && <span className="badge win">🏆 CHEAPEST </span>}{' '}
          {option.storeName} <span className="dist">· {option.distanceMi} mi</span>
          {option.isFastest && <span className="badge fast"> ⚡ fastest</span>}
        </h3>
        {minsAgo != null && <span className="provenance">price ✓ {minsAgo}m ago</span>}
      </div>

      <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Hide items' : `${option.lines.length} items`}
      </button>
      {expanded && (
        <ul className="lines">
          {option.lines.map((l) => (
            <li key={l.query}>
              <span>
                {l.itemName}
                {!l.inStock && <span className="badge stock"> low stock</span>}
              </span>
              <span>{fmt(l.basePriceCents)}</span>
            </li>
          ))}
          {option.missingItems.map((m) => (
            <li key={m} style={{ color: 'var(--muted)' }}>
              <span>{m}</span><span>not carried</span>
            </li>
          ))}
        </ul>
      )}

      <div className="feenote">
        Items {fmt(t.itemsBaseCents)} · Runner +{t.runnerMarkupPct}% {fmt(t.runnerMarkupCents)}
        {surge > 1 && <span className="badge surge"> ⚡ {surge}× busy</span>} · Delivery {fmt(t.deliveryFeeCents)}
        {t.taxCents > 0 && <> · Tax {fmt(t.taxCents)}</>}
      </div>
      <div className="totalrow">
        <div>
          <div className="total">{fmt(t.buyerTotalCents)}</div>
          <div className="feenote">⏱ {option.eta.lowMin}–{option.eta.highMin} min</div>
        </div>
        <button className="btn" onClick={() => onChoose(option)} disabled={outOfStock.length === option.lines.length}>
          Choose {option.storeName.split(' ')[0]}
        </button>
      </div>
    </div>
  );
}
