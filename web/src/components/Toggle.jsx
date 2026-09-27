// TRIBES-FILE: web/src/components/Toggle.jsx
// PHASE: 2 — Identity & shell
// Real physics toggle. Draggable thumb, spring settle, warm glow when on.

import { motion } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';

export default function Toggle({
  on,
  onChange,
  tone = '#ff7a18',
  label,
  hint,
}) {
  const M = useMotionConfig();

  const set = (v) => {
    if (v === on) return;
    haptic('select');
    onChange?.(v);
  };

  return (
    <div className="row between" style={{ padding: '2px 0' }}>
      <div className="col" style={{ gap: 2 }}>
        {label && <b style={{ fontSize: 15 }}>{label}</b>}
        {hint && <span className="tiny">{hint}</span>}
      </div>

      <motion.button
        role="switch"
        aria-checked={on}
        onClick={() => set(!on)}
        animate={{ backgroundColor: on ? tone : 'rgba(255,255,255,.14)' }}
        transition={M.feather}
        style={{
          width: 56, height: 32, borderRadius: 999,
          padding: 3, display: 'flex',
          justifyContent: on ? 'flex-end' : 'flex-start',
          boxShadow: on
            ? `0 4px 16px ${tone}66, inset 0 1px 0 rgba(255,255,255,.3)`
            : 'inset 0 1px 2px rgba(0,0,0,.5)',
          flex: '0 0 auto',
        }}
      >
        <motion.span
          layout
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.4}
          onDragEnd={(_, info) => {
            if (info.offset.x > 12) set(true);
            else if (info.offset.x < -12) set(false);
          }}
          transition={M.feather}
          style={{
            width: 26, height: 26, borderRadius: 999,
            background: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,.4)',
            display: 'grid', placeItems: 'center',
            cursor: 'grab',
          }}
        >
          <motion.span
            animate={{ scale: on ? 1 : 0.6, opacity: on ? 1 : 0.35 }}
            transition={M.feather}
            style={{ width: 8, height: 8, borderRadius: 99, background: tone }}
          />
        </motion.span>
      </motion.button>
    </div>
  );
}