// TRIBES-FILE: web/src/components/Toast.jsx
// PHASE: 3 — Economy
// Animated toast system. Global via a tiny external store.
// Replaces the Phase 2 version which had misplaced hook imports.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import Icon from './Icon.jsx';

/* ---------- store ---------- */
let id = 0;
let items = [];
const listeners = new Set();

function emit() { for (const fn of listeners) fn(); }

export function toast(message, kind = 'info') {
  const t = { id: ++id, message, kind };
  haptic(kind === 'good' ? 'success' : kind === 'bad' ? 'error' : 'light');
  items = [...items, t];
  emit();
  setTimeout(() => {
    items = items.filter((x) => x.id !== t.id);
    emit();
  }, 2600);
}

function useStore() {
  const [, setN] = useState(0);
  useEffect(() => {
    const fn = () => setN((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return items;
}

/* ---------- host ---------- */
export function ToastHost() {
  const M = useMotionConfig();
  const list = useStore();

  return (
    <div style={{
      position: 'fixed',
      left: 0, right: 0,
      bottom: 'calc(var(--safe-bot) + var(--tabbar-h) + 20px)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {list.map((t) => (
          <motion.div
            key={t.id}
            className="glass strong"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={M.tactile}
            style={{
              padding: '10px 16px',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              maxWidth: '88%',
            }}
          >
            <Icon
              name={t.kind === 'good' ? 'check' : t.kind === 'bad' ? 'bolt' : 'spark'}
              size={16}
              style={{
                color: t.kind === 'good' ? 'var(--good)'
                     : t.kind === 'bad'  ? 'var(--bad)'
                     : 'var(--gold)',
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}