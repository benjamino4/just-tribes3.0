// Morphing bottom sheet with a rubber-band drag-to-dismiss, iOS-style.
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '../lib/telegram.js';

export default function Sheet({ open, onClose, title, children }) {
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
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,.5)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <motion.div
            className="glass strong sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) { haptic('light'); onClose && onClose(); } }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 'var(--maxw)',
              borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
              padding: '10px 18px calc(var(--safe-bot) + 22px)',
              maxHeight: '86vh', overflowY: 'auto',
            }}
          >
            <div style={{ width: 42, height: 5, borderRadius: 99, background: 'rgba(255,255,255,.25)', margin: '2px auto 12px' }} />
            {title && <h2 style={{ fontSize: 20, marginBottom: 12 }}>{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
