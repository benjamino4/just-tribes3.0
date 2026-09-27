import { motion } from 'framer-motion';
import { useApp } from '../lib/store.js';
import { fmt } from '../lib/format.js';
import Icon from './Icon.jsx';
import { useMotionConfig } from '../lib/motion.js';

export default function TopBar() {
  const { data } = useApp();
  const M = useMotionConfig();
  const user = data?.user || {};
  const tribe = data?.tribe;

  return (
    <header className="topbar">
      <button className="chip crest-chip">
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
      </div>
    </header>
  );
}
