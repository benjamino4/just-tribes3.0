import React from 'react';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon.jsx';
import { haptic } from '../lib/telegram.js';

const useToasts = create((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items, t] })),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

let seq = 0;
export function toast(message, kind = 'info') {
  const id = ++seq;
  haptic(kind === 'good' ? 'success' : kind === 'bad' ? 'error' : 'light');
  useToasts.getState().push({ id, message, kind });
  setTimeout(() => useToasts.getState().remove(id), 2600);
}

export default function ToastHost() {
  const items = useToasts((s) => s.items);
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(var(--safe-bot) + var(--tabbar-h) + 20px)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            className="glass strong"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            style={{ padding: '10px 16px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 8, maxWidth: '88%' }}
          >
            <Icon
              name={t.kind === 'good' ? 'check' : t.kind === 'bad' ? 'bolt' : 'spark'}
              size={16}
              style={{ color: t.kind === 'good' ? 'var(--good)' : t.kind === 'bad' ? 'var(--bad)' : 'var(--gold)' }}
            />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
