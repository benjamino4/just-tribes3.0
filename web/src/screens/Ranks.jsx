import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../components/Icon.jsx';
import { Card } from '../components/UI.jsx';
import { fmt } from '../lib/format.js';

const WORLD = [
  { name: 'Stormfang', loyalty: 512000, members: 40 },
  { name: 'Ironroot', loyalty: 448500, members: 38 },
  { name: 'Ashborn', loyalty: 240900, members: 28, you: true },
  { name: 'Nightmaw', loyalty: 198200, members: 25 },
  { name: 'Sunkin', loyalty: 154000, members: 22 },
  { name: 'Dawnhollow', loyalty: 121000, members: 19 },
];
const KIN = [
  { name: 'Kael', v: 42000 }, { name: 'Mira', v: 31500 }, { name: 'You', v: 28600, you: true }, { name: 'Vex', v: 19800 },
];

function Seg({ tabs, value, onChange }) {
  return (
    <div className="glass" style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '1fr', padding: 5, borderRadius: 'var(--r-pill)', position: 'relative' }}>
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} style={{ position: 'relative', zIndex: 2, padding: '9px 0', borderRadius: 999, fontWeight: 700, fontSize: 14, color: value === t ? 'var(--ink)' : 'var(--ink-dim)' }}>
          {value === t && <motion.span layoutId="seg" className="tab-pill" style={{ inset: 0 }} transition={{ type: 'spring', stiffness: 480, damping: 34 }} />}
          <span style={{ position: 'relative', zIndex: 2 }}>{t}</span>
        </button>
      ))}
    </div>
  );
}

export default function Ranks() {
  const [tab, setTab] = useState('World');
  const list = tab === 'World' ? WORLD : KIN;
  return (
    <div className="col" style={{ gap: 12 }}>
      <Seg tabs={['World', 'Kin']} value={tab} onChange={setTab} />
      {list.map((r, i) => (
        <motion.div key={r.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
          <Card className={r.you ? 'you-row' : ''} style={r.you ? { borderColor: 'rgba(255,180,100,.5)', boxShadow: 'var(--sh-ember)' } : undefined}>
            <div className="row between">
              <div className="row">
                <b style={{ width: 28, fontSize: 18, color: i < 3 ? 'var(--gold)' : 'var(--ink-dim)' }}>{i + 1}</b>
                <span className="crest-art">{i === 0 ? <Icon name="crown" size={16} style={{ color: '#2a1200' }} /> : <Icon name="tribe" size={16} style={{ color: '#2a1200' }} />}</span>
                <div className="col" style={{ gap: 1 }}>
                  <b style={{ fontSize: 14 }}>{r.name}</b>
                  {tab === 'World' && <span className="tiny">{r.members} members</span>}
                </div>
              </div>
              <b className="tabular">{fmt(r.loyalty || r.v)}</b>
            </div>
          </Card>
        </motion.div>
      ))}
      <Card style={{ textAlign: 'center' }}>
        <span className="tiny">Loyalty per member decides your <b style={{ color: 'var(--ember-200)' }}>airdrop share</b> at season end.</span>
      </Card>
    </div>
  );
}
