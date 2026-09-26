import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { fmt } from '../lib/format.js';
import { useGame } from '../store.js';
import { haptic } from '../lib/telegram.js';

export default function TopBar() {
  const nav = useNavigate();
  const data = useGame((s) => s.data) || {};
  const user = data.user || {};
  const tribe = data.tribe || null;
  return (
    <header className="topbar">
      <motion.button whileTap={{ scale: 0.94 }} className="chip crest-chip" onClick={() => { haptic('light'); nav('/profile'); }}>
        <span className="crest-art"><Icon name="tribe" size={18} style={{ color: '#2a1200' }} /></span>
        <span className="crest-meta">
          <b>{tribe ? tribe.name : 'No Tribe'}</b>
          <i>{user.role || 'Wanderer'}</i>
        </span>
      </motion.button>
      <div className="row" style={{ gap: 8 }}>
        <motion.span key={user.ember} initial={{ scale: 1 }} animate={{ scale: [1, 1.14, 1] }} transition={{ duration: 0.35 }} className="chip" title="Ember">
          <Icon name="ember" size={15} style={{ color: 'var(--ember-400)' }} />
          <b className="tabular">{fmt(user.ember || 0)}</b>
        </motion.span>
        <span className="chip" title="Stars">
          <Icon name="spark" size={14} style={{ color: 'var(--gold)' }} />
          <b className="tabular">{fmt(user.stars || 0)}</b>
        </span>
        <motion.button whileTap={{ scale: 0.88, rotate: 40 }} className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => { haptic('light'); nav('/profile'); }} aria-label="Settings">
          <Icon name="gear" size={17} style={{ color: 'var(--ink-dim)' }} />
        </motion.button>
      </div>
    </header>
  );
}
