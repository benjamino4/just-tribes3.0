// TRIBES-FILE: web/src/components/Bonfire.jsx
// PHASE: 8 — Payments + Polish
// Bonfire event banner. Shows when an event is active.

import { motion } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { shortTime } from '../lib/format.js';
import Icon from './Icon.jsx';

export default function Bonfire({ bonfire, onTap }) {
  const M = useMotionConfig();
  if (!bonfire?.active) return null;

  return (
    <motion.div
      className="glass"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={M.buoyant}
      onClick={onTap}
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderColor: 'rgba(255,180,100,.4)',
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      <motion.span
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.6, repeat: M.drift.repeat || 0 }}
        style={{ display: 'grid', placeItems: 'center', color: 'var(--gold)' }}
      >
        <Icon name="bolt" size={20} />
      </motion.span>
      <div className="grow">
        <b style={{ fontSize: 14 }}>{bonfire.title}</b>
        <div className="tiny">
          ×{bonfire.multiplier} {bonfire.metric} · ends in {shortTime(bonfire.ends_in_ms)}
        </div>
      </div>
    </motion.div>
  );
}