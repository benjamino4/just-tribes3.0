import React from 'react';
import { Card } from '../../components/UI.jsx';
import { toast } from '../../components/Toast.jsx';
import { useConfig } from '../../lib/config.js';

const RARITY_TONE = { Common: '#9fb0c4', Rare: '#7cc4ff', Epic: '#c39bff', Legendary: '#ffd27a', Cursed: '#8b5cf6' };
const num = { width: 64, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)', fontSize: 13, textAlign: 'right' };

export default function PacksTab() {
  const cfg = useConfig((s) => s.cfg);
  const update = useConfig((s) => s.update);

  return (
    <div className="col" style={{ gap: 8 }}>
      {cfg.packs.map((p) => {
        const sum = Object.values(p.rates).reduce((a, b) => a + Number(b), 0);
        return (
          <Card key={p.id} style={{ borderColor: p.glow + '44' }}>
            <div className="row between">
              <b className="row" style={{ gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: p.glow }} /> {p.name}</b>
              <div className="row" style={{ gap: 6 }}><span className="tiny">Price ⭐</span>
                <input type="number" defaultValue={p.price} onChange={(e) => update((c) => { const x = c.packs.find((k) => k.id === p.id); if (x) x.price = Number(e.target.value) || 0; })} style={num} /></div>
            </div>
            <div className="col" style={{ gap: 7, marginTop: 12 }}>
              {Object.entries(p.rates).map(([r, v]) => (
                <div key={r} className="row between">
                  <span className="row" style={{ gap: 8, fontSize: 13 }}><span style={{ width: 9, height: 9, borderRadius: 99, background: RARITY_TONE[r] }} />{r}</span>
                  <input type="number" step="0.5" defaultValue={v} onChange={(e) => update((c) => { const x = c.packs.find((k) => k.id === p.id); if (x) x.rates[r] = Number(e.target.value) || 0; })} style={num} />
                </div>
              ))}
            </div>
            <div className="row between" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--glass-brd)' }}>
              <span className="tiny">Total</span>
              <b className="tabular" style={{ color: Math.abs(sum - 100) < 0.01 ? 'var(--good)' : '#ff8a8a', fontSize: 13 }}>{sum.toFixed(1)}%</b>
            </div>
          </Card>
        );
      })}
      <p className="tiny" style={{ color: 'var(--ink-faint)', padding: '2px 2px' }}>Drop rates should total 100%. The pack-open roll uses these weights live.</p>
    </div>
  );
}
