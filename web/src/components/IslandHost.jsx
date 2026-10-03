import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../lib/EventProvider.jsx';
import { haptic } from '../lib/haptics.js';
import { apiPost } from '../lib/api.js';

const TONES = {
  info:    { border: 'rgba(201,212,224,0.3)', glow: 'rgba(201,212,224,0.2)' },
  success: { border: 'rgba(85,168,130,0.5)',  glow: 'rgba(85,168,130,0.3)' },
  warn:    { border: 'rgba(196,144,64,0.55)', glow: 'rgba(196,144,64,0.3)' },
  danger:  { border: 'rgba(160,88,88,0.55)',  glow: 'rgba(160,88,88,0.3)' },
  war:     { border: 'rgba(212,111,44,0.7)',  glow: 'rgba(212,111,44,0.4)' },
};

export default function IslandHost() {
  const nav = useNavigate();
  const { subscribe } = useEvents();
  const [queue, setQueue] = useState([]);
  const [visible, setVisible] = useState([]);

  useEffect(() => subscribe((evt) => {
    if (evt.tier !== 'island') return;
    setQueue((q) => [...q, evt]);
  }), [subscribe]);

  useEffect(() => { setVisible(queue.slice(0, 3)); }, [queue]);

  useEffect(() => {
    if (!visible.length) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 8000);
    return () => clearTimeout(t);
  }, [visible]);

  function tap(evt) {
    haptic('light');
    apiPost(`/api/notifications/seen/${evt.id || 0}`).catch(() => {});
    // Deep-link from the island pill to the relevant place.
    try {
      if (evt.action_kind === 'open_kiva') nav('/tribe/kiva');
      else if (evt.action_kind === 'open_arena') nav('/arena');
      else if (evt.action_kind === 'open_vault') nav('/vault');
      else if (evt.action_kind === 'open_tribe') nav('/tribe');
    } catch {}
    setQueue((q) => q.slice(1));
  }

  return (
    <div style={{
      position: 'fixed', top: 'calc(var(--safe-top) + 8px)',
      left: 0, right: 0, zIndex: 250,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none'
    }}>
      <AnimatePresence>
        {visible.map((evt, depth) => {
          const T = TONES[evt.severity] || TONES.info;
          return (
            <motion.div
              key={evt.id || evt.at}
              initial={{ y: -80, opacity: 0, scale: 0.9 }}
              animate={{ y: depth * 4, opacity: 1 - depth * 0.3, scale: 1 - depth * 0.06 }}
              exit={{ y: -60, opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              onClick={() => tap(evt)}
              style={{
                pointerEvents: depth === 0 ? 'auto' : 'none',
                position: 'absolute',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                maxWidth: 'min(92vw, 420px)',
                borderRadius: 24,
                background: 'rgba(15, 20, 28, 0.94)',
                border: `1px solid ${T.border}`,
                backdropFilter: 'blur(20px)',
                boxShadow: `0 16px 44px rgba(0,0,0,.75), 0 0 40px ${T.glow}`,
                cursor: 'pointer', zIndex: 10 - depth
              }}
            >
              <div className="grow" style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13, lineHeight: 1.2, display: 'block' }}>{evt.title}</b>
                {evt.body && <p className="tiny" style={{ marginTop: 2 }}>{evt.body}</p>}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}