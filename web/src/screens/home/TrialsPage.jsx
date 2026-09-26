import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button } from '../../components/UI.jsx';
import AnimatedIcon from '../../components/AnimatedIcon.jsx';
import { toast } from '../../components/Toast.jsx';
import { haptic } from '../../lib/telegram.js';

const TRIALS = [
  { slug: 'hold', name: 'Hold the Flame', hint: 'Press and hold to feed the fire', reward: 400 },
  { slug: 'aim', name: 'Spark Strike', hint: 'Tap when the ember aligns', reward: 650 },
  { slug: 'gather', name: 'Ash Rush', hint: 'Collect falling ash in time', reward: 500 },
];

export default function TrialsPage() {
  const [active, setActive] = useState(null);
  const [charge, setCharge] = useState(0);

  function hold() {
    haptic('heavy');
    let c = 0; const t = setInterval(() => { c += 6; setCharge(c); if (c >= 100) { clearInterval(t); setTimeout(() => { setActive(null); setCharge(0); toast('Trial complete! +400 Ember', 'good'); }, 300); } }, 60);
    active && (active._t = t);
  }

  return (
    <SubPage title="Trials of Fire" hint="Quick skill mini-games with a cooldown. Beat them for a burst of Ember and loyalty. Come back when the cooldown clears.">
      {TRIALS.map((tr, i) => (
        <motion.div key={tr.slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card>
            <div className="row between">
              <div className="row"><AnimatedIcon name="bolt" size={34} tone="var(--ember-400)" /><div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>{tr.name}</b><span className="tiny">{tr.hint} · +{tr.reward}</span></div></div>
              <Button variant="primary" onClick={() => setActive(tr)}>Play</Button>
            </div>
          </Card>
        </motion.div>
      ))}

      <AnimatePresence>
        {active && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setActive(null); setCharge(0); }}
            style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center' }}>
            <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="glass strong" style={{ padding: 26, borderRadius: 'var(--r-xl)', width: 280, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
              <h3 className="display" style={{ fontSize: 20, marginBottom: 6 }}>{active.name}</h3>
              <p className="tiny" style={{ marginBottom: 18 }}>{active.hint}</p>
              <motion.button onPointerDown={hold} whileTap={{ scale: 0.9 }}
                style={{ width: 130, height: 130, borderRadius: '50%', margin: '0 auto', display: 'grid', placeItems: 'center', background: `conic-gradient(var(--ember-500) ${charge}%, rgba(255,255,255,.1) 0)`, boxShadow: 'var(--sh-ember)' }}>
                <span style={{ width: 108, height: 108, borderRadius: '50%', background: 'var(--bg-2)', display: 'grid', placeItems: 'center' }}>
                  <AnimatedIcon name="flame" size={54} />
                </span>
              </motion.button>
              <p className="tiny" style={{ marginTop: 16 }}>Hold to charge — {charge}%</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SubPage>
  );
}
