import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { animEnabled } from '../lib/settings.js';
import { haptic } from '../lib/telegram.js';

// Animated glowing bulb. Tap for a brief, nicely-formatted explanation that
// slides open beneath the section header.
export default function Hint({ text, tone = '#ffd27a' }) {
  const [open, setOpen] = useState(false);
  const on = animEnabled();
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <motion.button
        aria-label="Hint"
        onClick={() => { haptic('light'); setOpen((o) => !o); }}
        whileTap={{ scale: 0.85 }}
        style={{ width: 24, height: 24, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.07)', border: '1px solid var(--glass-brd)' }}
      >
        <motion.svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          animate={on ? { filter: [`drop-shadow(0 0 0px ${tone})`, `drop-shadow(0 0 5px ${tone})`, `drop-shadow(0 0 0px ${tone})`] } : {}}
          transition={{ duration: 2, repeat: on ? Infinity : 0 }}>
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z" />
        </motion.svg>
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 480, damping: 30 }}
              className="glass strong"
              style={{ position: 'absolute', top: 30, right: 0, zIndex: 41, width: 230, padding: '10px 12px', borderRadius: 'var(--r-md)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-dim)' }}
            >
              <b style={{ color: tone, display: 'block', marginBottom: 3, fontSize: 12 }}>What is this?</b>
              {text}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
}
