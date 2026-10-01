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
      <button className="crest-chip" onClick={() => { haptic('light'); nav('/tribe'); }} aria-label="Open your tribe">
        <span className="crest-art"><Icon name="tribe" size={18} style={{ color: '#1f1403' }} /></span>
        <span className="crest-meta">
          <b>{tribe ? tribe.name : 'Wanderer'}</b>
          <i>{user.role || 'Kin'}</i>
        </span>
      </button>

      <div className="row" style={{ gap: 8 }}>
        <motion.span
          key={user.sparks}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.16, 1] }}
          transition={{ ...M.ember, duration: 0.42 }}
          className="chip ember"
          title="Sparks"
        >
          <Icon name="ember" size={15} style={{ color: 'var(--ember-400)' }} />
          <b className="tabular">{fmt(user.sparks || 0)}</b>
        </motion.span>

        <span className="chip gold" title="Kinship">
          <Icon name="crown" size={14} style={{ color: 'var(--gold-300)' }} />
          <b className="tabular">{fmt(user.kinship || 0)}</b>
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