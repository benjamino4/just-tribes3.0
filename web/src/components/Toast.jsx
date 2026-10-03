// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/Toast.jsx
// PURPOSE: Bottom ephemeral pill. One at a time. 2.8s fade.
// DEPENDS ON: motion.js, haptics.js, Icon
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import Icon from './Icon.jsx';

let id = 0;
let items = [];
const listeners = new Set();
function emit() { for (const fn of listeners) fn(); }

export function toast(message, kind = 'info') {
  const t = { id: ++id, message, kind };
  haptic(kind === 'good' ? 'success' : kind === 'bad' ? 'error' : 'light');
  items = [...items, t];
  emit();
  setTimeout(() => { items = items.filter((x) => x.id !== t.id); emit(); }, 2800);
}

function useStore() {
  const [, setN] = useState(0);
  useEffect(() => { const fn = () => setN((n) => n + 1); listeners.add(fn); return () => { listeners.delete(fn); }; }, []);
  return items;
}

const TONES = {
  good: { color: 'var(--jade-200)', icon: 'check' },
  bad:  { color: 'var(--rose-200)', icon: 'bolt' },
  info: { color: 'var(--lapis-200)', icon: 'info' },
  warn: { color: 'var(--amber-200)', icon: 'warn' }
};

export function ToastHost() {
  const M = useMotionConfig();
  const list = useStore();

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0,
      bottom: 'calc(var(--safe-bot) + var(--tabbar-h) + 24px)',
      zIndex: 200, display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 10, pointerEvents: 'none'
    }}>
      <AnimatePresence>
        {list.map((t) => {
          const tone = TONES[t.kind] || TONES.info;
          return (
            <motion.div
              key={t.id}
              className="glass strong"
              initial={{ opacity: 0, y: 28, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.94 }}
              transition={M.tactile}
              style={{
                padding: '11px 18px', borderRadius: 999,
                display: 'flex', alignItems: 'center', gap: 10,
                maxWidth: '90%', borderColor: tone.color + '66'
              }}
            >
              <span style={{ display: 'grid', placeItems: 'center', color: tone.color }}>
                <Icon name={tone.icon} size={16} />
              </span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}