// TRIBES-FILE: web/src/screens/Trials.jsx
// PHASE: 3 — Economy
// Full trials page + minigame sheet (hold / stoke / feed / cry / sift).

import { useState, useRef, useEffect } from 'react';
import Emoji from '../components/Emoji.jsx';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt, shortTime } from '../lib/format.js';
import { apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

export default function Trials() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const trials = data?.trials || [];
  const [active, setActive] = useState(null);

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>Trials of Fire</h2>
          <Hint text="Quick skill challenges with a cooldown. Beat them for a burst of Ember and renown. Come back when the cooldown clears." />
        </div>
      </div>

      {trials.map((t, i) => (
        <motion.div key={t.slug} variants={V.item} transition={{ delay: i * 0.05 }}>
          <div className="glass card">
            <div className="row between">
              <div className="row">
                <span className="crest-art">
  <Emoji name={t.slug ? `trial-${t.slug}` : 'trial-kindle'} size={22} />
</span>
                <div className="col" style={{ gap: 1 }}>
                  <b style={{ fontSize: 14 }}>{t.name}</b>
                  <span className="tiny">
                    {t.available ? `${t.hint || ''} · +${fmt(t.reward_ember)}` : `Cooldown · ${shortTime(t.nextIn || 0)}`}
                  </span>
                </div>
              </div>
              <Button
                variant={t.available ? 'primary' : 'ghost'}
                disabled={!t.available}
                onClick={() => t.available && setActive(t)}
              >
                {t.available ? 'Play' : 'Wait'}
              </Button>
            </div>
          </div>
        </motion.div>
      ))}

      <AnimatePresence>
        {active && (
          <TrialModal
            trial={active}
            onClose={() => setActive(null)}
            onDone={() => { setActive(null); reload(); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------- trial modal ---------- */
function TrialModal({ trial, onClose, onDone }) {
  const M = useMotionConfig();
  const [charge, setCharge] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  async function submit(payload) {
    try {
      const r = await apiPost(`/api/trials/${trial.slug}`, payload || {});
      if (r.hit === false) {
        toast(`Missed. Correct: ${r.correct}`, 'bad');
        onDone();
        return;
      }
      if (r.reward_ember || r.reward_renown) {
        toast(`+${fmt(r.reward_ember)} Ember · +${fmt(r.reward_renown)} renown`, 'good');
      }
      onDone();
    } catch (e) {
      toast(e.message || 'Trial failed', 'bad');
      onDone();
    }
  }

  function startHold() {
    if (running) return;
    haptic('heavy');
    setRunning(true);
    setCharge(0);
    let c = 0;
    intervalRef.current = setInterval(() => {
      c += 6;
      setCharge(c);
      if (c >= 100) {
        clearInterval(intervalRef.current);
        setRunning(false);
        submit();
      }
    }, 60);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(6px)',
        display: 'grid', placeItems: 'center',
      }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8 }}
        transition={M.buoyant}
        className="glass strong"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 26, borderRadius: 'var(--r-xl)', width: 280, textAlign: 'center' }}
      >
        <h3 className="display" style={{ fontSize: 20, marginBottom: 6 }}>{trial.name}</h3>
        <p className="tiny" style={{ marginBottom: 18 }}>{trial.hint}</p>

        {trial.minigame === 'hold' || trial.minigame === 'stoke' || !trial.minigame ? (
          <motion.button
            onPointerDown={startHold}
            whileTap={{ scale: 0.9 }}
            style={{
              width: 130, height: 130, borderRadius: '50%',
              margin: '0 auto', display: 'grid', placeItems: 'center',
              background: `conic-gradient(var(--ember-500) ${charge}%, rgba(255,255,255,.1) 0)`,
              boxShadow: 'var(--sh-ember)',
            }}
          >
            <span style={{
              width: 108, height: 108, borderRadius: '50%',
              background: 'var(--bg-2)',
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name="fire" size={54} />
            </span>
          </motion.button>
        ) : (
          <SiftGame onSubmit={submit} />
        )}

        <p className="tiny" style={{ marginTop: 16 }}>
          {trial.minigame === 'sift' ? 'Pick the true spark' : `Hold to charge — ${charge}%`}
        </p>
      </motion.div>
    </motion.div>
  );
}

/* ---------- sift minigame ---------- */
function SiftGame({ onSubmit }) {
  const M = useMotionConfig();
  const [pick, setPick] = useState(null);
  return (
    <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.button
          key={i}
          whileTap={{ scale: 0.9 }}
          transition={M.feather}
          onClick={() => { haptic('select'); setPick(i); onSubmit({ pick: i }); }}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: pick === i
              ? 'radial-gradient(circle, #ffd27a, #ff7a18)'
              : 'rgba(255,255,255,.08)',
            border: '1px solid var(--glass-brd)',
            display: 'grid', placeItems: 'center',
          }}
        >
          <Emoji name="trial-sift" size={18} />
        </motion.button>
      ))}
    </div>
  );
}