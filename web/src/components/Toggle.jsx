// =====================================================================
// Toggle — Obsidian Glass v3
// Track has an inset shadow. Thumb is a small bone-colored disc.
// On state: ember glow, thumb slides with a spring.
// =====================================================================
import { motion } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';

export default function Toggle({
  on,
  onChange,
  tone = 'var(--ember-400)',
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
        animate={{
          backgroundColor: on ? 'rgba(242,106,16,0.18)' : 'rgba(6,5,8,0.62)',
          boxShadow: on
            ? `0 0 0 1px ${tone}, 0 0 20px ${tone}55, inset 0 1px 0 rgba(255,243,208,0.16)`
            : '0 0 0 1px rgba(216,201,166,0.12), inset 0 1px 2px rgba(0,0,0,0.6)',
        }}
        transition={M.feather}
        style={{
          width: 56, height: 32, borderRadius: 999,
          padding: 3, display: 'flex',
          justifyContent: on ? 'flex-end' : 'flex-start',
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
            background: on
              ? `radial-gradient(circle at 30% 25%, #fff4e6, ${tone})`
              : 'radial-gradient(circle at 30% 25%, #f0e6cf, #b0a080)',
            boxShadow: on
              ? `0 3px 10px ${tone}88, inset 0 1px 0 rgba(255,255,255,0.6)`
              : '0 2px 6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4)',
            display: 'grid', placeItems: 'center',
            cursor: 'grab',
          }}
        >
          <motion.span
            animate={{ scale: on ? 1 : 0.55, opacity: on ? 1 : 0.32 }}
            transition={M.feather}
            style={{
              width: 6, height: 6, borderRadius: 99,
              background: on ? '#1f1403' : '#4a4235',
            }}
          />
        </motion.span>
      </motion.button>
    </div>
  );
}