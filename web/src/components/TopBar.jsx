import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store.jsx';
import { fmt } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';

export default function TopBar() {
  const nav = useNavigate();
  const { data } = useApp();
  const user = data?.user || {};
  const tribe = data?.tribe;
  const tier = user.rank_tier || {};

  return (
    <header className="topbar">
      <button className="crest-chip" onClick={() => { haptic('light'); nav('/tribe'); }}>
        <span className="crest-art" style={{ background: `radial-gradient(circle at 30% 25%, ${tier.color_hex || '#f7a259'}, #8a5e19 70%)` }}>
          <span style={{ fontSize: 16 }}>{tier.emoji || '🔥'}</span>
        </span>
        <span className="crest-meta">
          <b>{tribe ? tribe.name : 'Wanderer'}</b>
          <i>{tier.title || 'Kin'}</i>
        </span>
      </button>
      <div className="row" style={{ gap: 8 }}>
        <motion.span
          key={user.sparks}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.16, 1] }}
          transition={{ duration: 0.42 }}
          className="chip ember"
        >
          <span style={{ color: 'var(--ember-400)' }}>🔥</span>
          <b className="tabular">{fmt(user.sparks || 0)}</b>
        </motion.span>
        <span className="chip gold">
          <span style={{ color: 'var(--gold-300)' }}>🏛</span>
          <b className="tabular">{fmt(user.kinship || 0)}</b>
        </span>
        <span className="chip" style={{ padding: '7px 10px' }}>
          <b className="tabular" style={{ color: tier.color_hex || '#c9d4e0' }}>#{user.rank_rating || 1000}</b>
        </span>
        <button
          className="chip"
          style={{ padding: 9, borderRadius: 999 }}
          onClick={() => { haptic('light'); nav('/profile'); }}
        >⚙️</button>
      </div>
    </header>
  );
}