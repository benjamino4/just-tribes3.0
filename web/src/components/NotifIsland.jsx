// =====================================================================
// NotifIsland — Dynamic Island notification pill.
//   Centered at top via a fixed flex wrapper.
//   Inner island animates only y / scale / opacity — never x.
//   Colour tone per severity. Up to 3 stacked. Tap to expand + act.
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

const TONES = {
  info:    { border: 'rgba(232,184,102,.5)',  glow: 'rgba(232,184,102,.28)', tint: '#e8b866' },
  success: { border: 'rgba(139,199,106,.5)',  glow: 'rgba(139,199,106,.28)', tint: '#8bc76a' },
  warn:    { border: 'rgba(212,164,68,.55)',  glow: 'rgba(212,164,68,.32)',  tint: '#d4a444' },
  danger:  { border: 'rgba(224,86,46,.55)',   glow: 'rgba(224,86,46,.32)',   tint: '#e0562e' },
  reward:  { border: 'rgba(255,122,24,.6)',   glow: 'rgba(255,122,24,.35)',  tint: '#ff7a18' },
  tribe:   { border: 'rgba(168,120,201,.55)', glow: 'rgba(168,120,201,.32)', tint: '#a878c9' },
  war:     { border: 'rgba(224,86,46,.7)',    glow: 'rgba(224,86,46,.4)',    tint: '#e0562e' },
  social:  { border: 'rgba(139,199,106,.55)', glow: 'rgba(139,199,106,.3)',  tint: '#8bc76a' },
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
              <Icon name={ICON_MAP[active.icon] || 'spark'} size={14} />
            </span>

            <div className="grow" style={{ minWidth: 0 }}>
              <b
                style={{
                  fontSize: 13,
                  lineHeight: 1.2,
                  display: 'block',
                  fontWeight: active.severity === 'war' ? 800 : 700,
                  letterSpacing: active.severity === 'war' ? '.02em' : 0,
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
    background: 'rgba(18, 14, 10, .94)',
    border: `1px solid ${T.border}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: `0 12px 40px rgba(0,0,0,.7), 0 0 40px ${T.glow}`,
    cursor: 'pointer',
    transition: 'padding .22s cubic-bezier(.34,1.3,.5,1), width .22s cubic-bezier(.34,1.3,.5,1)',
    animation: n.severity === 'war'
      ? 'islandWarBreath 1.8s ease-in-out infinite'
      : 'islandBreath 2.6s ease-in-out infinite',
  };
}

function iconBubbleStyle(n) {
  const T = TONES[n.severity] || TONES.info;
  return {
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    background: T.glow.replace('.28', '.35').replace('.32', '.38').replace('.35', '.4').replace('.3', '.36').replace('.4', '.45'),
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
    default: return null;
  }
}