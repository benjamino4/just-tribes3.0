import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button } from '../../components/UI.jsx';
import Icon from '../../components/Icon.jsx';
import Sheet from '../../components/Sheet.jsx';
import { toast } from '../../components/Toast.jsx';
import { fmt } from '../../lib/format.js';
import { haptic } from '../../lib/telegram.js';

const ROSTER = [
  { name: 'Kael', role: 'Chief',  online: true,  loyalty: 42000 },
  { name: 'Mira', role: 'Head',   online: true,  loyalty: 31500 },
  { name: 'Doon', role: 'Elder',  online: false, loyalty: 22100 },
  { name: 'Vex',  role: 'Hunter', online: true,  loyalty: 19800 },
  { name: 'You',  role: 'Hunter', online: true,  loyalty: 12480, mine: true },
  { name: 'Ora',  role: 'Kin',    online: false, loyalty: 9400 },
  { name: 'Pip',  role: 'Toddler',online: false, loyalty: 1200 },
];
const ORDER = ['Chief', 'Head', 'Elder', 'Hunter', 'Kin', 'Toddler'];

export default function Members() {
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState('all');
  const list = ROSTER.filter((m) => filter === 'all' || (filter === 'online' && m.online))
    .sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));
  const onlineN = ROSTER.filter((m) => m.online).length;

  return (
    <SubPage title="Roster" hint="Everyone in your tribe, ranked by role. Green dot means online now. Tap a member to view their standing — Chiefs and Heads can promote or remove Kin.">
      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
        {[['all', `All · ${ROSTER.length}`], ['online', `Online · ${onlineN}`]].map(([k, label]) => (
          <motion.button key={k} whileTap={{ scale: 0.95 }} onClick={() => { haptic('select'); setFilter(k); }} className="chip"
            style={{ borderColor: filter === k ? 'var(--ember-400)' : 'var(--glass-brd)', color: filter === k ? 'var(--ember-200)' : 'var(--ink-dim)' }}>{label}</motion.button>
        ))}
      </div>
      {list.map((m, i) => (
        <motion.div key={m.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
          <Card onClick={() => { haptic('light'); setSel(m); }} style={{ cursor: 'pointer', borderColor: m.mine ? 'var(--ember-400)' : 'var(--glass-brd)' }}>
            <div className="row between">
              <div className="row">
                <span className="crest-art" style={{ background: 'linear-gradient(180deg,#4a4038,#241f1a)', position: 'relative' }}>
                  <b style={{ fontSize: 15 }}>{m.name[0]}</b>
                  <span style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: 99, border: '2px solid var(--bg-2)', background: m.online ? 'var(--good)' : 'var(--ink-faint)' }} />
                </span>
                <div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>{m.name}{m.mine && ' (you)'}</b><span className="tiny">{m.role}</span></div>
              </div>
              <span className="tiny tabular">{fmt(m.loyalty)}</span>
            </div>
          </Card>
        </motion.div>
      ))}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name}>
        {sel && (
          <div className="col" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 14 }}>
              <span className="crest-art" style={{ width: 56, height: 56 }}><b style={{ fontSize: 22 }}>{sel.name[0]}</b></span>
              <div className="col" style={{ gap: 2 }}><b style={{ fontSize: 18 }}>{sel.name}</b><span className="tiny">{sel.role} · {sel.online ? 'online now' : 'offline'}</span><span className="tiny">{fmt(sel.loyalty)} loyalty</span></div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Button variant="primary" block onClick={() => { toast(`${sel.name} promoted`, 'good'); setSel(null); }}><Icon name="crown" size={15} /> Promote</Button>
              <Button variant="ghost" block onClick={() => { toast(`${sel.name} removed`, 'info'); setSel(null); }}><Icon name="ban" size={15} /> Remove</Button>
            </div>
          </div>
        )}
      </Sheet>
    </SubPage>
  );
}
