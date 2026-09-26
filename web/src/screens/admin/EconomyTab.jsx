import React from 'react';
import { Card, Button } from '../../components/UI.jsx';
import Icon from '../../components/Icon.jsx';
import { toast } from '../../components/Toast.jsx';
import { useConfig } from '../../lib/config.js';
import { haptic } from '../../lib/telegram.js';

const num = { width: 96, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)', fontSize: 14, textAlign: 'right' };

export default function EconomyTab() {
  const cfg = useConfig((s) => s.cfg);
  const update = useConfig((s) => s.update);
  const reset = useConfig((s) => s.reset);

  return (
    <div className="col" style={{ gap: 8 }}>
      <Card>
        <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>The Ember-Seal (pin)</b>
        <div className="row between" style={{ marginTop: 10 }}>
          <div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>Seal name</b><span className="tiny">Shown on pinned messages</span></div>
          <input defaultValue={cfg.seal.term} onChange={(e) => update((c) => { c.seal.term = e.target.value; })}
            style={{ ...num, width: 130, textAlign: 'left' }} />
        </div>
        <div className="row between" style={{ marginTop: 12 }}>
          <div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>Seal price</b><span className="tiny">Stars to pin a message</span></div>
          <input type="number" defaultValue={cfg.seal.price} onChange={(e) => update((c) => { c.seal.price = Number(e.target.value) || 0; })} style={num} />
        </div>
      </Card>

      <Card>
        <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Kiva buffs & relics</b>
        <div className="col" style={{ gap: 10, marginTop: 10 }}>
          {cfg.kivaBuffs.map((b) => (
            <div key={b.id} className="row between">
              <div className="col" style={{ gap: 1 }}><b className="row" style={{ gap: 5, fontSize: 14 }}>{b.name}{b.chiefFree && <Icon name="crown" size={12} style={{ color: 'var(--gold)' }} />}</b><span className="tiny">{b.desc}</span></div>
              <input type="number" defaultValue={b.price} onChange={(e) => update((c) => { const x = c.kivaBuffs.find((k) => k.id === b.id); if (x) x.price = Number(e.target.value) || 0; })} style={{ ...num, width: 80 }} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="row between">
          <div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>Accent color</b><span className="tiny">Home tiles & highlights</span></div>
          <input type="color" defaultValue={cfg.home.accent} onChange={(e) => update((c) => { c.home.accent = e.target.value; })}
            style={{ width: 44, height: 36, borderRadius: 10, background: 'none', border: '1px solid var(--glass-brd)' }} />
        </div>
      </Card>

      <Button variant="ghost" block onClick={() => { reset(); haptic('success'); toast('Config reset to defaults', 'info'); }}><Icon name="trash" size={15} /> Reset all config</Button>
    </div>
  );
}
