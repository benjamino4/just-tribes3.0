// TRIBES-FILE: web/src/screens/Pyre.jsx
// PHASE: 5 — Council & Kiva
// The Great Pyre — deeper view of the tribe treasury, with the Idol altar.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V, SECTION_MOTION } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

const PRESETS = [100, 500, 2000, 10000];

export default function Pyre() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const tribe = data?.tribe;
  const user = data?.user || {};
  const [amount, setAmount] = useState(500);
  const [council, setCouncil] = useState(null);

  useEffect(() => {
    if (!tribe) return;
    (async () => {
      try { setCouncil(await apiGet('/api/council/state')); } catch {}
    })();
  }, [tribe?.id]);

  if (!tribe) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}>
        <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>
          <h2 className="display" style={{ fontSize: 22 }}>The Pyre is cold</h2>
          <Button variant="primary" block style={{ marginTop: 14 }} onClick={() => nav('/longhouse')}>Find a Tribe</Button>
        </div>
      </motion.div>
    );
  }

  async function stoke() {
    if (Number(user.ember) < amount) { toast('Not enough Ember', 'bad'); return; }
    try {
      const r = await apiPost('/api/tribe/donate', { amount });
      toast(`+${fmt(r.donated)} stoked into the Pyre`, 'good');
      reload();
    } catch (e) { toast(e.message || 'Could not stoke', 'bad'); }
  }

  async function forgeIdol(amt) {
    try {
      const r = await apiPost('/api/council/idol/forge', { amount: amt });
      toast(`Idol Tier ${r.tier} · +${(r.buff_value * 100).toFixed(0)}%`, 'good');
      const c = await apiGet('/api/council/state');
      setCouncil(c);
      reload();
    } catch (e) { toast(e.message || 'Could not forge', 'bad'); }
  }

  const cap = 200000;
  const progress = (Number(tribe.treasury) % cap) / cap * 100;

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }}
                  onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>The Great Pyre</h2>
          <Hint text="The tribe's shared treasury. Every Ember you stoke raises the tribe level, unlocking buffs for all members. The Idol is forged from Ember offered by any kin." />
        </div>
      </div>

      <div className="glass hero card" style={{ textAlign: 'center', overflow: 'hidden' }}>
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 3, repeat: M.drift.repeat || 0 }}
          style={{ margin: '4px auto 0' }}
        >
          <Icon name="fire" size={72} style={{ color: 'var(--ember-400)' }} />
        </motion.div>
        <div className="display" style={{ fontSize: 34, lineHeight: 1.1 }}>
          {fmt(tribe.treasury)}
        </div>
        <span className="tiny">total Ember in the Pyre</span>
        <div style={{ margin: '16px 0 6px' }}>
          <div className="bar"><i style={{ width: progress + '%' }} /></div>
        </div>
        <span className="tiny">
          Level {tribe.level} · {fmt(cap - (tribe.treasury % cap))} to next
        </span>
      </div>

      <div className="glass card">
        <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>Choose an offering</b>
        <div className="row" style={{ gap: 8, margin: '12px 0' }}>
          {PRESETS.map((p) => (
            <motion.button
              key={p}
              whileTap={{ scale: 0.94 }}
              onClick={() => { haptic('select'); setAmount(p); }}
              className="glass"
              style={{
                flex: 1, padding: '10px 4px', borderRadius: 12,
                fontWeight: 700, fontSize: 13,
                borderColor: amount === p ? 'var(--ember-400)' : 'var(--glass-brd)',
                background: amount === p ? 'rgba(255,122,24,.16)' : 'rgba(255,255,255,.04)',
              }}
            >
              {fmt(p)}
            </motion.button>
          ))}
        </div>
        <Button variant="primary" size="lg" block haptic="heavy" onClick={stoke}>
          <Icon name="fire" size={18} /> Stoke {fmt(amount)}
        </Button>
      </div>

      {council?.idol && (
        <div className="glass card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <b className="row" style={{ gap: 6 }}>
              <Icon name="crown" size={16} style={{ color: 'var(--gold)' }} />
              The Idol
            </b>
            <span className="chip" style={{
              color: council.idol.state === 'blazing' ? 'var(--good)' : 'var(--gold)',
            }}>
              {council.idol.state}
            </span>
          </div>
          <div className="row between tiny" style={{ marginBottom: 6 }}>
            <span>Tier {council.idol.tier} · +{(council.idol.buff_value * 100).toFixed(0)}% tribe buff</span>
            <span>{fmt(council.idol.forge_progress)}/{fmt(council.idol.forge_goal)}</span>
          </div>
          <div className="bar"><i style={{ width: (council.idol.forge_progress / council.idol.forge_goal * 100) + '%' }} /></div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            {[500, 2000, 5000].map((a) => (
              <Button key={a} variant="ghost" block onClick={() => forgeIdol(a)}>
                Forge {fmt(a)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}