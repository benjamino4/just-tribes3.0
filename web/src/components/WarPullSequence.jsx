// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/WarPullSequence.jsx
// PURPOSE: The 5-beat war pull. Fires once per war on return.
// DEPENDS ON: framer-motion, haptics, Icon
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { haptic } from '../lib/haptics.js';
import Icon from './Icon.jsx';

export default function WarPullSequence({ war, onDone }) {
  const nav = useNavigate();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-war-pull', '1');
    const timers = [
      setTimeout(() => setBeat(1), 0),
      setTimeout(() => { haptic('medium'); setBeat(2); }, 400),
      setTimeout(() => setBeat(3), 1200),
      setTimeout(() => setBeat(4), 2000),
      setTimeout(() => setBeat(5), 3000)
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  function enter() {
    haptic('heavy');
    document.documentElement.removeAttribute('data-war-pull');
    onDone();
    nav('/arena/war');
  }

  function dismiss() {
    document.documentElement.removeAttribute('data-war-pull');
    onDone();
  }

  const attacker = war.attacker?.name || 'Your tribe';
  const defender = war.defender?.name || 'The enemy';
  const scoreA = Number(war.war?.attacker_score || 0);
  const scoreD = Number(war.war?.defender_score || 0);
  const endsIn = Math.max(0, new Date(war.war?.end_at).getTime() - Date.now());
  const mins = Math.ceil(endsIn / 60000);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'radial-gradient(circle at 50% 60%, rgba(90,15,10,.65), rgba(6,5,8,.95))',
          backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, pointerEvents: 'auto'
        }}
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22, delay: 0.4 }}
          style={{ textAlign: 'center' }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{ marginBottom: 20 }}
          >
            <Icon name="swords" size={64} style={{ color: 'var(--ember-300)' }} />
          </motion.div>

          <h1 className="display" style={{ fontSize: 32, color: '#fff', letterSpacing: '.04em' }}>
            War Rages
          </h1>

          <p style={{ marginTop: 10, fontSize: 14, color: 'var(--bone-200)' }}>
            <b>{attacker}</b> · {scoreA}
            <span style={{ margin: '0 10px', color: 'var(--ink-dim)' }}>vs</span>
            {scoreD} · <b>{defender}</b>
          </p>

          <p className="tiny" style={{ marginTop: 6, color: 'var(--ember-300)' }}>
            {mins} minute{mins === 1 ? '' : 's'} left
          </p>

          <div style={{ marginTop: 36, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={dismiss}
              style={{
                padding: '12px 24px', borderRadius: 999,
                background: 'rgba(255,243,208,.06)',
                border: '1px solid var(--glass-brd)',
                color: 'var(--bone-200)', fontWeight: 700
              }}
            >Later</button>
            <button
              onClick={enter}
              style={{
                padding: '12px 32px', borderRadius: 999,
                background: 'linear-gradient(180deg, var(--ember-300), var(--ember-500))',
                border: '1px solid rgba(255,199,138,.55)',
                color: '#1a0b02', fontWeight: 800,
                boxShadow: 'var(--sh-ember)'
              }}
            >Enter the war</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}