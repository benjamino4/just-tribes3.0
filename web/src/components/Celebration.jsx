import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import Emoji from './Emoji.jsx';

const TONES = {
  ember: { primary: '#ff8324', secondary: '#ffe2a1', glow: 'rgba(255,131,36,0.5)' },
  gold:  { primary: '#efc168', secondary: '#fff3d0', glow: 'rgba(239,193,104,0.55)' },
  rune:  { primary: '#a26cd1', secondary: '#e0c6ff', glow: 'rgba(162,108,209,0.5)' },
  moss:  { primary: '#8ab06a', secondary: '#d4e8b6', glow: 'rgba(138,176,106,0.5)' },
  blood: { primary: '#d0483a', secondary: '#ffb0a4', glow: 'rgba(208,72,58,0.5)' },
  frost: { primary: '#5f92d4', secondary: '#b9d5ff', glow: 'rgba(95,146,212,0.5)' }
};

export default function Celebration({
  title = 'Well done', subtitle = '', emoji = 'star',
  tone = 'gold', reward = null, onTap = null, onClose
}) {
  const M = useMotionConfig();
  const T = TONES[tone] || TONES.gold;
  const [dismissible, setDismissible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    haptic('success');
    const t1 = setTimeout(() => setDismissible(true), 1200);
    timerRef.current = setTimeout(() => dismiss(null), 4200);
    return () => { clearTimeout(t1); clearTimeout(timerRef.current); };
  }, []);

  function dismiss(e) {
    if (!dismissible && e) return;
    if (exiting) return;
    setExiting(true);
    clearTimeout(timerRef.current);
    setTimeout(() => { if (onTap && e) onTap(); onClose?.(); }, 260);
  }

  const particles = useMemo(() => (
    Array.from({ length: 48 }, (_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / 48 + Math.random() * 0.4,
      dist: 120 + Math.random() * 220,
      size: 3 + Math.random() * 5,
      dur: 0.9 + Math.random() * 0.7,
      delay: Math.random() * 0.2,
      colour: i % 3 === 0 ? T.secondary : i % 3 === 1 ? T.primary : '#ffffff'
    }))
  ), [T]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: exiting ? 0.26 : 0.35 }}
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'radial-gradient(circle at 50% 45%, rgba(6,5,8,.68), rgba(6,5,8,.94))',
        backdropFilter: 'blur(10px)',
        display: 'grid', placeItems: 'center', padding: 24,
        cursor: dismissible ? 'pointer' : 'default'
      }}
    >
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <motion.div
          initial={{ y: -160, scale: 0.4, opacity: 0 }}
          animate={{ y: 0, scale: [0.4, 1.18, 1], opacity: 1 }}
          transition={{ duration: 0.65, ease: [0.34, 1.32, 0.56, 1], times: [0, 0.7, 1] }}
          style={{ filter: `drop-shadow(0 0 30px ${T.glow})`, marginBottom: 22 }}
        >
          <Emoji name={emoji} size={110} />
        </motion.div>

        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(p.angle) * p.dist,
              y: Math.sin(p.angle) * p.dist,
              opacity: 0, scale: 0.2
            }}
            transition={{ duration: p.dur, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute', left: '50%', top: 50,
              width: p.size, height: p.size, borderRadius: '50%',
              background: p.colour, boxShadow: `0 0 10px ${p.colour}`
            }}
          />
        ))}

        {reward && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05, ...M.buoyant }}
            style={{
              padding: '8px 18px', borderRadius: 999,
              background: 'rgba(6,5,8,0.72)',
              border: `1px solid ${T.primary}88`,
              color: T.secondary, fontWeight: 700, fontSize: 14,
              marginBottom: 16
            }}
          >{reward}</motion.div>
        )}

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, ...M.ember, duration: 0.7 }}
          className="display"
          style={{ fontSize: 32, color: 'var(--bone-50)', textAlign: 'center', textShadow: `0 6px 30px ${T.glow}` }}
        >{title}</motion.h2>

        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.5 }}
            style={{ marginTop: 10, fontSize: 14, color: 'var(--bone-200)', textAlign: 'center', maxWidth: 320 }}
          >{subtitle}</motion.p>
        )}
      </div>
    </motion.div>
  );
}