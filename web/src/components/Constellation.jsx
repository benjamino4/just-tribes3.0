// TRIBES-FILE: web/src/components/Constellation.jsx
// PHASE: 3 — Economy
// Home tile grid. Phase 3 uses basic shapes; Phase 4 adds the full 8-shape
// library and per-shape icon idle animations (spec point 2).

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import Icon from './Icon.jsx';

const SHAPES = {
  soft:    'var(--r-lg)',
  blob:    '46% 54% 42% 58% / 55% 45% 55% 45%',
  circle:  '50%',
  curved:  '40px',
  shield:  '32px 32px 46% 46% / 32px 32px 60% 60%',
};

export default function Constellation({ tiles = [], accent = 'var(--ember-500)' }) {
  const nav = useNavigate();
  const M = useMotionConfig();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      marginTop: 8,
    }}>
      {tiles.map((t, i) => {
        const odd = tiles.length % 2 === 1 && i === tiles.length - 1;
        return (
          <motion.button
            key={t.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...M.buoyant, delay: i * 0.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { haptic('medium'); nav(t.to); }}
            className="glass"
            style={{
              padding: 16,
              textAlign: 'left',
              borderRadius: SHAPES[t.shape] || SHAPES.soft,
              minHeight: 118,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
              gridColumn: odd ? '1 / -1' : 'auto',
            }}
          >
            <div style={{ alignSelf: t.shape === 'circle' ? 'center' : 'flex-start' }}>
              <Icon name={t.icon} size={38} style={{ color: accent }} />
            </div>
            <div className="row between" style={{ width: '100%' }}>
              <b style={{ fontSize: 15 }}>{t.name}</b>
              <Icon name="chevron" size={16} style={{ color: 'var(--ink-dim)' }} />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}