// =====================================================================
// NotifIsland — Obsidian Glass v3
// Centered at top via fixed flex wrapper.
// Inner island animates y / scale / opacity ONLY (never x).
// Colored by severity.
// =====================================================================
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { openNotifStream } from '../lib/notifStream.js';
import Icon from './Icon.jsx';

const ICON_MAP = {
  'kiva-flame':    'hearth',
  'tribe-shield':  'tribe',
  'war-swords':    'bolt',
  'relic-spark':   'bolt',
  'crown':         'crown',
  'res-stars':     'star',
  'halo':          'crown',
  'trials-scroll': 'ranks',
  'lock':          'lock',
  'check':         'check',
  'bolt':          'bolt',
};

const TONES = {
  info:    { border: 'rgba(239,193,104,0.5)',  glow: 'rgba(239,193,104,0.28)', tint: '#efc168' },
  success: { border: 'rgba(138,176,106,0.5)',  glow: 'rgba(138,176,106,0.28)', tint: '#8ab06a' },
  warn:    { border: 'rgba(216,150,74,0.55)',  glow: 'rgba(216,150,74,0.32)',  tint: '#d8964a' },
  danger:  { border: 'rgba(208,72,58,0.55)',   glow: 'rgba(208,72,58,0.32)',   tint: '#d0483a' },
  reward:  { border: 'rgba(242,106,16,0.6)',   glow: 'rgba(242,106,16,0.35)',  tint: '#f26a10' },
  tribe:   { border: 'rgba(162,108,209,0.55)', glow: 'rgba(162,108,209,0.32)', tint: '#a26cd1' },
  war:     { border: 'rgba(208,72,58,0.7)',    glow: 'rgba(208,72,58,0.4)',    tint: '#d0483a' },
  social:  { border: 'rgba(138,176,106,0.55)', glow: 'rgba(138,176,106,0.3)',  tint: '#8ab06a' },
};

export default function NotifIsland() {
  const nav = useNavigate();
  const M = useMotionConfig();
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const lastIdRef = useRef(0);
  const timerRef = useRef(null);

  // poll + stream
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const r = await apiGet('/api/notifications?unread=1&limit=10');
        const list = r.notifications || [];
        const fresh = list.filter((n) => n.id > lastIdRef.current);
        if (!alive || !fresh.length) return;
        lastIdRef.current = Math.max(...list.map((n) => n.id));
        setQueue((q) => [...q, ...fresh.reverse()]);
      } catch {}
    }
    poll();
    const iv = setInterval(poll, 20000);
    let es = null;
    try {
      es = openNotifStream({ onEvent: (evt) => { if (evt.type === 'ping') poll(); } });
    } catch {}
    return () => {
      alive = false;
      clearInterval(iv);
      try { es?.close?.(); } catch {}
    };
  }, []);

  // dequeue one at a time
  useEffect(() => {
    if (active || !queue.length) return;
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
  }, [queue, active]);

  // auto-dismiss
  useEffect(() => {
    if (!active) return;
    setExpanded(false);
    const ttl = active.severity === 'war' ? 4000 : 5000;
    timerRef.current = setTimeout(() => {
      apiPost(`/api/notifications/seen/${active.id}`).catch(() => {});
      setActive(null);
    }, ttl);
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
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--safe-top) + 8px)',
        left: 0,
        right: 0,
        zIndex: 250,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {active && (
          <motion.div
            key={active.id}
            initial={{ y: -80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.94 }}
            transition={M.buoyant}
            onClick={open}
            style={islandStyle(active, expanded)}
          >
            <span style={iconBubbleStyle(active)}>
              <Icon name={ICON_MAP[active.icon] || 'bolt'} size={14} />
            </span>

            <div className="grow" style={{ minWidth: 0 }}>
              <b
                style={{
                  fontSize: 13,
                  lineHeight: 1.2,
                  display: 'block',
                  fontWeight: active.severity === 'war' ? 800 : 700,
                  letterSpacing: active.severity === 'war' ? '0.02em' : 0,
                  textTransform: active.severity === 'war' ? 'uppercase' : 'none',
                }}
              >
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
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-faint)',
                fontSize: 16,
                padding: 4,
                pointerEvents: 'auto',
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function islandStyle(n, expanded) {
  const T = TONES[n.severity] || TONES.info;
  return {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: expanded ? '12px 16px' : '8px 14px',
    maxWidth: 'min(92vw, 420px)',
    width: expanded ? 'min(92vw, 420px)' : 'auto',
    borderRadius: 24,
    background: 'rgba(17, 16, 24, 0.94)',
    border: `1px solid ${T.border}`,
    backdropFilter: 'blur(20px) saturate(140%)',
    WebkitBackdropFilter: 'blur(20px) saturate(140%)',
    boxShadow: `0 16px 44px rgba(0,0,0,.75), 0 0 40px ${T.glow}`,
    cursor: 'pointer',
    transition: 'padding .22s cubic-bezier(.34,1.32,.56,1), width .22s cubic-bezier(.34,1.32,.56,1)',
    animation: n.severity === 'war'
      ? 'islandWarBreath 1.8s ease-in-out infinite'
      : 'islandBreath 2.6s ease-in-out infinite',
  };
}

function iconBubbleStyle(n) {
  const T = TONES[n.severity] || TONES.info;
  return {
    width: 26, height: 26,
    borderRadius: '50%',
    display: 'grid', placeItems: 'center',
    background: T.glow.replace(/\.\d+/, '.35'),
    color: T.tint,
    flex: '0 0 auto',
    boxShadow: `0 0 12px ${T.glow}`,
  };
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
    case 'profile': return '/profile';
    default: return null;
  }
}