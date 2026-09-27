// TRIBES-FILE: web/src/components/NotifIsland.jsx
// PHASE: 7 — Meta & Admin
// Dynamic Island notification pill. Compact → expanded. Tap to open.
// Queue: shows one at a time. Polls /api/notifications.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { openNotifStream } from '../lib/notifStream.js';
import Icon from './Icon.jsx';

const ICON_MAP = {
  'kiva-flame':    'fire',
  'tribe-shield':  'tribe',
  'war-swords':    'bolt',
  'relic-spark':   'spark',
  'crown':         'crown',
  'res-stars':     'spark',
  'halo':          'crown',
  'trials-scroll': 'ranks',
  'lock':          'lock',
  'check':         'check',
  'bolt':          'bolt',
};

export default function NotifIsland() {
  const nav = useNavigate();
  const M = useMotionConfig();
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const lastIdRef = useRef(0);
  const timerRef = useRef(null);

  // poll for new notifications
  useEffect(() => {
    async function poll() {
      try {
        const r = await apiGet('/api/notifications?unread=1&limit=10');
        const list = r.notifications || [];
        const fresh = list.filter((n) => n.id > lastIdRef.current);
        if (fresh.length) {
          lastIdRef.current = Math.max(...list.map((n) => n.id));
          setQueue((q) => [...q, ...fresh.reverse()]);
        }
      } catch {}
    }
    poll();
    const iv = setInterval(poll, 20000);

    const es = openNotifStream({
      onEvent: (evt) => { if (evt.type === 'ping') poll(); },
    });
    return () => { clearInterval(iv); es?.close?.(); };
  }, []);

  // dequeue one at a time
  useEffect(() => {
    if (active || !queue.length) return;
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
  }, [queue, active]);

  // auto-dismiss after 5s
  useEffect(() => {
    if (!active) return;
    setExpanded(false);
    timerRef.current = setTimeout(() => {
      apiPost(`/api/notifications/seen/${active.id}`).catch(() => {});
      setActive(null);
    }, 5000);
    return () => clearTimeout(timerRef.current);
  }, [active]);

  function open() {
    if (!active) return;
    clearTimeout(timerRef.current);
    haptic('light');
    setExpanded(true);
    setTimeout(() => {
      apiPost(`/api/notifications/seen/${active.id}`).catch(() => {});
      const route = routeFor(active);
      setActive(null);
      setExpanded(false);
      if (route) nav(route);
    }, 260);
  }

  function dismiss() {
    if (!active) return;
    clearTimeout(timerRef.current);
    apiPost(`/api/notifications/seen/${active.id}`).catch(() => {});
    setActive(null);
    setExpanded(false);
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ y: -80, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -60, opacity: 0, scale: 0.94 }}
          transition={M.buoyant}
          onClick={open}
          style={{
            position: 'fixed',
            top: 'calc(var(--safe-top) + 60px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 250,
            width: expanded ? 'min(92vw, 400px)' : 'auto',
            maxWidth: '92vw',
            padding: expanded ? '12px 16px' : '8px 14px',
            borderRadius: 24,
            background: 'rgba(15, 11, 18, .92)',
            border: `1px solid ${toneFor(active)}66`,
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            boxShadow: `0 12px 40px rgba(0,0,0,.6), 0 0 40px ${toneFor(active)}33`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
          }}
        >
          <span style={{
            width: 26, height: 26, borderRadius: '50%',
            display: 'grid', placeItems: 'center',
            background: toneFor(active) + '22',
            color: toneFor(active),
            flex: '0 0 auto',
          }}>
            <Icon name={ICON_MAP[active.icon] || 'spark'} size={14} />
          </span>

          <div className="grow" style={{ minWidth: 0 }}>
            <b style={{ fontSize: 13, lineHeight: 1.2, display: 'block' }}>
              {active.title}
            </b>
            {expanded && active.body && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="tiny"
                style={{ marginTop: 4, lineHeight: 1.4 }}
              >
                {active.body}
              </motion.p>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--ink-faint)', fontSize: 16, padding: 4,
            }}
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function toneFor(n) {
  if (n.severity === 'success') return '#5ce39a';
  if (n.severity === 'warn') return '#ffd15c';
  if (n.severity === 'danger') return '#ff6b6b';
  return '#ff9f45';
}

function routeFor(n) {
  switch (n.action_kind) {
    case 'kiva': return '/kiva';
    case 'war': return '/war';
    case 'forge': return '/forge';
    case 'vault': return '/vault';
    case 'pyre': return '/pyre';
    case 'moot': return '/moot';
    case 'post': return '/post';
    case 'inbox': return '/inbox';
    case 'watchtower': return '/watchtower';
    case 'hearth': return '/';
    default: return null;
  }
}