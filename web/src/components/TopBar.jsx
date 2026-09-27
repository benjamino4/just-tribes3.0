// TRIBES-FILE: web/src/components/TopBar.jsx
// PHASE: 2 — Identity & shell
// Adds a gear icon that navigates to /profile.

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
        className="chip crest-chip"
        onClick={() => { haptic('light'); nav('/profile'); }}
      >
        <span className="crest-art">
          <Icon name="tribe" size={18} style={{ color: '#2a1200' }} />
        </span>
        <span className="crest-meta">
          <b>{tribe ? tribe.name : 'No Tribe'}</b>
          <i>{user.role || 'Wanderer'}</i>
        </span>
      </button>

      <div className="row" style={{ gap: 8 }}>
        <motion.span
          key={user.ember}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.14, 1] }}
          transition={{ ...M.ember, duration: 0.35 }}
          className="chip"
          title="Ember"
        >
          <Icon name="ember" size={15} style={{ color: 'var(--ember-400)' }} />
          <b className="tabular">{fmt(user.ember || 0)}</b>
        </motion.span>

        <span className="chip" title="Stars">
          <Icon name="spark" size={14} style={{ color: 'var(--gold)' }} />
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