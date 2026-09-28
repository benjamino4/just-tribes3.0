// =====================================================================
// TopBar — Obsidian Glass v3
// Crest chip (left) → Longhouse.
// Ember chip pulses on change.
// Stars chip with gold class.
// Gear → Profile.
// =====================================================================
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store.jsx';
import { fmt } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import Icon from './Icon.jsx';
import { useMotionConfig } from '../lib/motion.js';

export default function TopBar() {
  const nav = useNavigate();
  const { data } = useApp();
  const M = useMotionConfig();
  const user = data?.user || {};
  const tribe = data?.tribe;

  return (
    <header className="topbar">
      <button
        className="crest-chip"
        onClick={() => { haptic('light'); nav('/longhouse'); }}
        aria-label="Open your tribe"
      >
        <span className="crest-art">
          <Icon name="tribe" size={18} style={{ color: '#1f1403' }} />
        </span>
        <span className="crest-meta">
          <b>{tribe ? tribe.name : 'Wanderer'}</b>
          <i>{user.role || 'Kin'}</i>
        </span>
      </button>

      <div className="row" style={{ gap: 8 }}>
        <motion.span
          key={user.ember}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.16, 1] }}
          transition={{ ...M.ember, duration: 0.42 }}
          className="chip ember"
          title="Ember"
        >
          <Icon name="ember" size={15} style={{ color: 'var(--ember-400)' }} />
          <b className="tabular">{fmt(user.ember || 0)}</b>
        </motion.span>

        <span className="chip gold" title="Stars">
          <Icon name="star" size={14} style={{ color: 'var(--gold-300)' }} />
          <b className="tabular">{fmt(user.stars || 0)}</b>
        </span>

        <button
          className="chip"
          style={{ padding: 9, borderRadius: 999 }}
          onClick={() => { haptic('light'); nav('/profile'); }}
          aria-label="Settings"
        >
          <Icon name="gear" size={17} style={{ color: 'var(--ink-dim)' }} />
        </button>
      </div>
    </header>
  );
}