// =====================================================================
// Sheet — Obsidian Glass v3
// Bottom sheet with drag-to-dismiss. Morphing corners: only the top two
// corners are rounded. Handle bar is a wide gold-tinted capsule.
// =====================================================================
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';

export default function Sheet({ open, onClose, title, children }) {
  const M = useMotionConfig();

  useEffect(() => {
    if (open) haptic('light');
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(6, 5, 8, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <motion.div
            className="glass strong sheet"
            initial={{ y: '102%' }}
            animate={{ y: 0 }}
            exit={{ y: '102%' }}
            transition={M.buoyant}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) {
                haptic('light');
                onClose?.();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 'var(--maxw)',
              borderRadius: 'var(--r-2xl) var(--r-2xl) 0 0',
              padding: '12px 20px calc(var(--safe-bot) + 26px)',
              maxHeight: '88vh',
              overflowY: 'auto',
              boxShadow: '0 -20px 60px rgba(0,0,0,.65), inset 0 1px 0 var(--glass-hi)',
            }}
          >
            <div
              style={{
                width: 52, height: 4,
                borderRadius: 99,
                background: 'linear-gradient(90deg, transparent, var(--gold-400), transparent)',
                opacity: 0.7,
                margin: '0 auto 16px',
                boxShadow: '0 0 12px rgba(217,166,70,0.4)',
              }}
            />
            {title && (
              <h2
                className="display"
                style={{ fontSize: 22, marginBottom: 14, letterSpacing: '0.01em' }}
              >
                {title}
              </h2>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}