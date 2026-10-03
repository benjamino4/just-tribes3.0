// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/RankUpSequence.jsx
// PURPOSE: The 5-second 7-beat rank-up cinematic.
// DEPENDS ON: framer-motion, haptics
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '../lib/haptics.js';

export default function RankUpSequence({ tierFrom, tierTo, onDone }) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setBeat(1), 0),
      setTimeout(() => { haptic('medium'); setBeat(2); }, 800),
      setTimeout(() => { haptic('heavy'); setBeat(3); }, 1600),
      setTimeout(() => setBeat(4), 2400),
      setTimeout(() => { haptic('success'); setBeat(5); }, 3400),
      setTimeout(() => setBeat(6), 4200),
      setTimeout(() => setBeat(7), 5000),
      setTimeout(() => onDone?.(), 5400)
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="rankup-scene" style={{
      position: 'fixed', inset: 0, zIndex: 600,
      display: 'grid', placeItems: 'center',
      background: 'radial-gradient(circle at 50% 50%, rgba(10,14,20,.96), rgba(4,6,10,1))',
      pointerEvents: 'none'
    }}>
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <AnimatePresence>
          {beat >= 1 && beat < 3 && (
            <motion.div
              key="pre"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              style={{
                width: 180, height: 180, borderRadius: '50%',
                border: `3px solid ${tierFrom?.color_hex || '#8899aa'}`,
                boxShadow: `0 0 40px ${tierFrom?.color_hex || '#8899aa'}66`,
                display: 'grid', placeItems: 'center',
                fontSize: 60
              }}
            >
              {tierFrom?.emoji || '🪨'}
            </motion.div>
          )}
          {beat >= 3 && beat < 4 && (
            <motion.div
              key="shatter"
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.4, 0.3], opacity: [1, 1, 0], rotate: [0, 15, -25] }}
              transition={{ duration: 0.8 }}
              style={{
                width: 180, height: 180, borderRadius: '50%',
                border: `3px solid ${tierFrom?.color_hex || '#8899aa'}`,
                display: 'grid', placeItems: 'center',
                fontSize: 60, filter: 'blur(0)'
              }}
            >
              {tierFrom?.emoji || '🪨'}
            </motion.div>
          )}
          {beat >= 4 && (
            <motion.div
              key="new"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 20 }}
              style={{
                width: 200, height: 200, borderRadius: '50%',
                border: `3px solid ${tierTo?.color_hex || '#efc168'}`,
                boxShadow: `0 0 60px ${tierTo?.color_hex || '#efc168'}88, inset 0 0 40px ${tierTo?.color_hex || '#efc168'}44`,
                display: 'grid', placeItems: 'center',
                fontSize: 72
              }}
            >
              {tierTo?.emoji || '🟡'}
            </motion.div>
          )}
        </AnimatePresence>

        {beat >= 5 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ marginTop: 40 }}
          >
            <h1 className="display" style={{
              fontSize: 34, letterSpacing: '0.16em',
              color: tierTo?.color_hex || 'var(--gold-300)',
              textShadow: `0 0 30px ${tierTo?.color_hex || '#efc168'}88`
            }}>
              {(tierTo?.name || 'GOLD').toUpperCase()}
            </h1>
            <p className="display" style={{
              fontSize: 16, letterSpacing: '0.22em',
              color: 'var(--bone-200)', marginTop: 6
            }}>
              {(tierTo?.title || 'Gold Warlord').toUpperCase()}
            </p>
          </motion.div>
        )}

        {beat >= 6 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            style={{ marginTop: 24, color: 'var(--bone-200)', fontSize: 14, fontStyle: 'italic' }}
          >
            You have become a {tierTo?.title || 'Gold Warlord'}.<br />
            The fire recognizes you.
          </motion.p>
        )}
      </div>
    </div>
  );
}