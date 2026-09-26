import React from 'react';
import { Card } from '../../components/UI.jsx';
import { useConfig } from '../../lib/config.js';

const num = { width: 80, padding: '7px 9px', borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)', fontSize: 14, textAlign: 'right' };

export default function KivaTab() {
  const cfg = useConfig((s) => s.cfg);
  const update = useConfig((s) => s.update);

  return (
    <div className="col" style={{ gap: 8 }}>
      <Card>
        <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Free emojis</b>
        <div className="emoji-grid" style={{ marginTop: 10 }}>
          {cfg.freeEmojis.map((e) => <span key={e} className="emoji-cell" style={{ pointerEvents: 'none' }}>{e}</span>)}
        </div>
        <span className="tiny" style={{ display: 'block', marginTop: 6 }}>These 5 are free for everyone.</span>
      </Card>

      {cfg.emojiSets.map((set) => (
        <Card key={set.id}>
          <div className="row between">
            <div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>{set.name}</b><span className="tiny">{set.emojis.length} emojis</span></div>
            <div className="row" style={{ gap: 6 }}><span className="tiny">Price ⭐</span>
              <input type="number" defaultValue={set.price} onChange={(e) => update((c) => { const x = c.emojiSets.find((k) => k.id === set.id); if (x) x.price = Number(e.target.value) || 0; })} style={num} /></div>
          </div>
          <div className="emoji-grid" style={{ marginTop: 10 }}>
            {set.emojis.map((e) => <span key={e} className="emoji-cell" style={{ pointerEvents: 'none' }}>{e}</span>)}
          </div>
        </Card>
      ))}
    </div>
  );
}
