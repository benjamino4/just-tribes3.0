import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button, ProgressBar } from '../../components/UI.jsx';
import AnimatedIcon from '../../components/AnimatedIcon.jsx';
import Icon from '../../components/Icon.jsx';
import { toast } from '../../components/Toast.jsx';
import { useGame } from '../../store.js';
import { fmt } from '../../lib/format.js';
import { haptic } from '../../lib/telegram.js';

const AMOUNTS = [100, 500, 2000, 10000];
const LOG = [
  { who: 'Kael', amt: 5000, ts: '2m' }, { who: 'Mira', amt: 1200, ts: '9m' },
  { who: 'You', amt: 500, ts: '14m' }, { who: 'Vex', amt: 800, ts: '31m' },
];

export default function Pyre() {
  const { data, patch } = useGame();
  const tribe = data?.tribe || {};
  const user = data?.user || {};
  const [amt, setAmt] = useState(500);

  function stoke() {
    if ((user.ember || 0) < amt) { toast('Not enough Ember', 'error'); return; }
    haptic('heavy');
    patch({ user: { ...user, ember: user.ember - amt }, tribe: { ...tribe, treasury: (tribe.treasury || 0) + amt, loyalty_total: (tribe.loyalty_total || 0) + amt } });
    toast(`+${fmt(amt)} stoked into the Pyre`, 'good');
  }

  const lvlBase = 200000;
  const into = (tribe.treasury || 0) % lvlBase;

  return (
    <SubPage title="The Great Pyre" hint="The tribe's shared treasury. Every Ember you stoke raises the tribe level, unlocking buffs for all members. Chiefs decide how the buffs are spent.">
      <Card strong style={{ textAlign: 'center', overflow: 'hidden' }}>
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 3, repeat: Infinity }} style={{ margin: '4px auto 0' }}>
          <AnimatedIcon name="flame" size={72} />
        </motion.div>
        <div className="display" style={{ fontSize: 34, lineHeight: 1.1 }}>{fmt(tribe.treasury || 0)}</div>
        <span className="tiny">total Ember in the Pyre</span>
        <div style={{ margin: '16px 0 6px' }}><ProgressBar value={into} max={lvlBase} /></div>
        <span className="tiny">Level {tribe.level} → {(tribe.level || 1) + 1} · {fmt(lvlBase - into)} to go</span>
      </Card>

      <Card>
        <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Choose an offering</b>
        <div className="row" style={{ gap: 8, margin: '12px 0' }}>
          {AMOUNTS.map((a) => (
            <motion.button key={a} whileTap={{ scale: 0.94 }} onClick={() => { haptic('select'); setAmt(a); }} className="glass"
              style={{ flex: 1, padding: '10px 4px', borderRadius: 12, fontWeight: 700, fontSize: 13, borderColor: amt === a ? 'var(--ember-400)' : 'var(--glass-brd)', background: amt === a ? 'rgba(255,122,24,.16)' : 'rgba(255,255,255,.04)' }}>
              {fmt(a)}
            </motion.button>
          ))}
        </div>
        <Button variant="primary" size="lg" block onClick={stoke} haptic="heavy"><Icon name="fire" size={18} /> Stoke {fmt(amt)}</Button>
      </Card>

      <Card>
        <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Recent offerings</b>
        <div className="col" style={{ gap: 8, marginTop: 10 }}>
          {LOG.map((l, i) => (
            <div key={i} className="row between">
              <div className="row"><span className="crest-art" style={{ width: 30, height: 30 }}><b style={{ fontSize: 12 }}>{l.who[0]}</b></span><span style={{ fontSize: 14 }}>{l.who}</span></div>
              <span className="tiny"><b style={{ color: 'var(--ember-200)' }}>+{fmt(l.amt)}</b> · {l.ts} ago</span>
            </div>
          ))}
        </div>
      </Card>
    </SubPage>
  );
}
