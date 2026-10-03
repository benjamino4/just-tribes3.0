import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '../lib/haptics.js';

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
  good: { color: 'var(--jade-300)' },
  bad:  { color: 'var(--rose-300)' },
  info: { color: 'var(--lapis-300)' },
  warn: { color: 'var(--amber-300)' }
};

export function ToastHost() {
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
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                padding: '11px 18px', borderRadius: 999,
                display: 'flex', alignItems: 'center', gap: 10,
                maxWidth: '90%', borderColor: tone.color + '66'
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}