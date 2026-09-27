// TRIBES-FILE: web/src/screens/Profile.jsx
// PHASE: 2 — Identity & shell
// Real working toggles: animations, haptics, sound, data saver.
// Settings persist to localStorage and take effect immediately.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import Toggle from '../components/Toggle.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';

const SETTINGS_KEY = 'tribes.settings';
const DEFAULTS = {
  animations: true,
  haptics: true,
  sound: false,
  reducedData: false,
};

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function apply(s) {
  document.documentElement.setAttribute('data-fx', s.animations ? 'full' : 'reduced');
  window.__hapticsEnabled = s.haptics;
  window.__soundEnabled = s.sound;
  window.__animEnabled = s.animations;
}

export default function Profile() {
  const nav = useNavigate();
  const { data } = useApp();
  const M = useMotionConfig();
  const [s, setS] = useState(load());

  useEffect(() => { apply(s); }, [s]);

  const update = (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
  };

  const user = data?.user || {};

  return (
    <motion.div
      className="col"
      style={{ gap: 4 }}
      variants={V.page}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={M.buoyant}
    >
      {/* ---------- header row ---------- */}
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button
            className="chip"
            style={{ padding: 9, borderRadius: 999 }}
            onClick={() => { haptic('light'); nav(-1); }}
          >
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>Profile</h2>
        </div>
      </div>

      {/* ---------- profile card ---------- */}
      <div className="glass strong card">
        <div className="row" style={{ gap: 14 }}>
          <span className="crest-art" style={{ width: 56, height: 56 }}>
            <Icon name="fire" size={30} style={{ color: '#2a1200' }} />
          </span>
          <div className="grow">
            <h2 style={{ fontSize: 19 }}>@{user.username || 'wanderer'}</h2>
            <span className="tiny">
              {user.role || 'Wanderer'} · {fmt(user.renown || 0)} renown
            </span>
          </div>
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          <Stat label="Ember" value={fmt(user.ember || 0)} />
          <Stat label="Stars" value={fmt(user.stars || 0)} />
          <Stat label="Streak" value={(user.streak || 0) + 'd'} />
        </div>
      </div>

      {/* ---------- motion settings ---------- */}
      <div className="glass card">
        <b style={{
          fontSize: 13,
          letterSpacing: '.04em',
          color: 'var(--ink-dim)',
          textTransform: 'uppercase',
        }}>
          Motion & Feel
        </b>
        <div className="col" style={{ gap: 14, marginTop: 14 }}>
          <Toggle
            label="Animations"
            hint="Fluid motion across the app"
            on={s.animations}
            onChange={(v) => update({ animations: v })}
          />
          <Toggle
            label="Haptics"
            hint="Vibration feedback on taps"
            on={s.haptics}
            onChange={(v) => update({ haptics: v })}
            tone="#7cc4ff"
          />
          <Toggle
            label="Sound"
            hint="Ambient fire & UI sounds"
            on={s.sound}
            onChange={(v) => update({ sound: v })}
            tone="#5ce39a"
          />
          <Toggle
            label="Data saver"
            hint="Lighter effects on slow networks"
            on={s.reducedData}
            onChange={(v) => update({ reducedData: v })}
            tone="#c39bff"
          />
        </div>
      </div>

      {/* ---------- admin shortcut (Phase 7 fills this) ---------- */}
      <div className="glass card">
        <div className="row between">
          <div className="row">
            <Icon name="spark" size={26} style={{ color: '#ffd27a' }} />
            <div className="col" style={{ gap: 1 }}>
              <b>Admin Control Room</b>
              <span className="tiny">Keepers only</span>
            </div>
          </div>
          <Button variant="ghost" onClick={() => nav('/admin')}>Open</Button>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="col">
      <span className="tiny">{label}</span>
      <b className="tabular">{value}</b>
    </div>
  );
}