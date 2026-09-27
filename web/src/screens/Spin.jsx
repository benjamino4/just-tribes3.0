// TRIBES-FILE: web/src/screens/Spin.jsx
// PHASE: 3 — Economy
// Wheel of Ash. Free + paid spins. Landing animation on result.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V, SECTION_MOTION } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

const FALLBACK = [
  { slot_index: 0,  label: '100',     kind: 'ember' },
  { slot_index: 1,  label: '250',     kind: 'ember' },
  { slot_index: 2,  label: '+5',      kind: 'renown' },
  { slot_index: 3,  label: '500',     kind: 'ember' },
  { slot_index: 4,  label: '—',       kind: 'empty' },
  { slot_index: 5,  label: '1k',      kind: 'ember' },
  { slot_index: 6,  label: '+10',     kind: 'renown' },
  { slot_index: 7,  label: '2.5k',    kind: 'ember' },
  { slot_index: 8,  label: '+10 ⭐',  kind: 'stars' },
  { slot_index: 9,  label: 'Relic',   kind: 'relic' },
  { slot_index: 10, label: '5k',      kind: 'ember' },
  { slot_index: 11, label: '+50 ⭐',  kind: 'stars' },
];

const TONE = {
  ember:  '#ff9f45',
  renown: '#c39bff',
  stars:  '#7cc4ff',
  relic:  '#5ce39a',
  empty:  '#7d7466',
};

const SLICE = 360 / FALLBACK.length;

export default function Spin() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const spin = data?.spin || {};
  const rewards = spin.rewards?.length ? spin.rewards : FALLBACK;

  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState(null);

  async function doSpin() {
    if (spinning) return;
    setSpinning(true);
    haptic('heavy');

    try {
      const r = await apiPost('/api/spin');
      const idx = r.slotIndex ?? 0;
      const target = 360 * 5 + (360 - idx * SLICE - SLICE / 2);
      setAngle((a) => a - (a % 360) + target);
      setTimeout(() => {
        setSpinning(false);
        setLast(r);
        toast(`+${fmt(r.reward.amount)} ${r.reward.kind}`, 'good');
        reload();
      }, 4200);
    } catch (e) {
      setSpinning(false);
      toast(e.message || 'Spin failed', 'bad');
    }
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>Wheel of Ash</h2>
          <Hint text="One free spin daily. Land on a segment to win Ember — or hit the Jackpot. Extra spins can be bought with Stars." />
        </div>
      </div>

      <div className="glass hero card" style={{ textAlign: 'center', paddingBottom: 24 }}>
        <div style={{ position: 'relative', width: 250, height: 250, margin: '10px auto 0' }}>
          <div style={{
            position: 'absolute', top: -6, left: '50%',
            transform: 'translateX(-50%)', zIndex: 3,
            width: 0, height: 0,
            borderLeft: '11px solid transparent',
            borderRight: '11px solid transparent',
            borderTop: '20px solid var(--gold)',
          }} />

          <motion.div
            animate={{ rotate: angle }}
            transition={{ duration: 4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: 250, height: 250, borderRadius: '50%',
              position: 'relative',
              boxShadow: 'var(--sh-3), inset 0 0 0 6px rgba(255,255,255,.08)',
              background: `conic-gradient(${rewards
                .map((r, i) => `${TONE[r.kind] || TONE.ember} ${i * SLICE}deg ${(i + 1) * SLICE}deg`)
                .join(',')})`,
            }}
          >
            {rewards.map((r, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%', top: '50%',
                  transformOrigin: '0 0',
                  transform: `rotate(${i * SLICE + SLICE / 2}deg) translateY(-96px)`,
                  color: '#2a1200',
                  fontWeight: 800,
                  fontSize: r.label?.length > 4 ? 9 : 13,
                }}
              >
                {r.label}
              </span>
            ))}
            <span style={{
              position: 'absolute', inset: '42%', borderRadius: '50%',
              background: 'var(--bg-1)',
              border: '3px solid rgba(255,255,255,.15)',
            }} />
          </motion.div>
        </div>

        <Button
          variant="primary" size="lg" block
          style={{ marginTop: 20 }}
          onClick={doSpin}
          disabled={spinning || (!spin.freeAvailable && spin.paidLeft <= 0)}
        >
          {spinning ? 'Spinning…' : spin.freeAvailable ? 'Free Spin' : `Spin · ${spin.starsPerSpin || 25} ⭐`}
        </Button>
      </div>

      {last && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass card">
          <div className="row between">
            <b>Last spin</b>
            <span className="chip" style={{ color: TONE[last.reward.kind] }}>
              +{fmt(last.reward.amount)} {last.reward.kind}
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}