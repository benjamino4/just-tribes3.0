// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/IslandHost.jsx
// PURPOSE: Dynamic Island notifications. Stacked. Tribal aesthetic.
// DEPENDS ON: EventProvider, Icon, haptics, api
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../lib/EventProvider.jsx';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import { apiPost } from '../lib/api.js';
import Icon from './Icon.jsx';

const ICON_MAP = {
  'kiva-flame': 'hearth', 'tribe-shield': 'tribe', 'war-swords': 'bolt',
  'relic-spark': 'bolt', 'crown': 'crown', 'res-stars': 'star',
  'halo': 'crown', 'trials-scroll': 'ranks', 'lock': 'lock',
  'check': 'check', 'bolt': 'bolt', 'gift': 'gift', 'spark': 'bolt'
};

const TONES = {
  info:    { border: 'rgba(126,163,196,0.5)',  glow: 'rgba(126,163,196,0.28)', tint: '#7ea3c4' },
  success: { border: 'rgba(127,201,167,0.5)',  glow: 'rgba(127,201,167,0.28)', tint: '#7fc9a7' },
  warn:    { border: 'rgba(224,180,106,0.55)', glow: 'rgba(224,180,106,0.32)', tint: '#e0b46a' },
  danger:  { border: 'rgba(201,130,130,0.55)', glow: 'rgba(201,130,130,0.32)', tint: '#c98282' },
  war:     { border: 'rgba(201,130,130,0.7)',  glow: 'rgba(201,130,130,0.4)',  tint: '#c98282' },
  tribe:   { border: 'rgba(162,108,209,0.55)', glow: 'rgba(162,108,209,0.32)', tint: '#a26cd1' }
};

export default function IslandHost() {
  const nav = useNavigate();
  const M = useMotionConfig();
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
    const t = setTimeout(() => { setQueue((q) => q.slice(1)); }, 8000);
    return () => clearTimeout(t);
  }, [visible]);

  function tap(evt) {
    haptic('light');
    apiPost(`/api/notifications/seen/${evt.id || 0}`).catch(() => {});
    setQueue((q) => q.slice(1));
    const route = routeFor(evt);
    if (route) nav(route);
  }

  function dismiss() {
    apiPost(`/api/notifications/seen/${visible[0]?.id || 0}`).catch(() => {});
    setQueue((q) => q.slice(1));
  }

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--safe-top) + 8px)',
      left: 0, right: 0,
      zIndex: 250,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none'
    }}>
      <AnimatePresence>
        {visible.map((evt, depth) => (
          <motion.div
            key={evt.id || evt.at}
            initial={{ y: -80, opacity: 0, scale: 0.9 }}
            animate={{ y: depth * 4, opacity: 1 - depth * 0.3, scale: 1 - depth * 0.06 }}
            exit={{ y: -60, opacity: 0, scale: 0.94 }}
            transition={M.buoyant}
            onClick={() => tap(evt)}
            style={islandStyle(evt, depth)}
          >
            <span style={iconBubbleStyle(evt)}>
              <Icon name={ICON_MAP[evt.icon] || 'bolt'} size={14} />
            </span>
            <div className="grow" style={{ minWidth: 0 }}>
              <b style={{
                fontSize: 13, lineHeight: 1.2, display: 'block',
                fontWeight: evt.severity === 'war' ? 800 : 700,
                textTransform: evt.severity === 'war' ? 'uppercase' : 'none'
              }}>{evt.title}</b>
              {evt.body && <p className="tiny" style={{ marginTop: 2 }}>{evt.body}</p>}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--ink-faint)', fontSize: 16, padding: 4
              }}
              aria-label="Dismiss">×</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function islandStyle(evt, depth) {
  const T = TONES[evt.severity] || TONES.info;
  return {
    pointerEvents: depth === 0 ? 'auto' : 'none',
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    maxWidth: 'min(92vw, 420px)',
    borderRadius: 24,
    background: 'rgba(17, 20, 26, 0.94)',
    border: `1px solid ${T.border}`,
    backdropFilter: 'blur(20px) saturate(140%)',
    WebkitBackdropFilter: 'blur(20px) saturate(140%)',
    boxShadow: `0 16px 44px rgba(0,0,0,.75), 0 0 40px ${T.glow}`,
    cursor: 'pointer',
    zIndex: 10 - depth
  };
}

function iconBubbleStyle(evt) {
  const T = TONES[evt.severity] || TONES.info;
  return {
    width: 26, height: 26, borderRadius: '50%',
    display: 'grid', placeItems: 'center',
    background: T.glow.replace(/\.\d+/, '.35'),
    color: T.tint, flex: '0 0 auto',
    boxShadow: `0 0 12px ${T.glow}`
  };
}

function routeFor(evt) {
  switch (evt.action_kind) {
    case 'kiva': return '/tribe/kiva';
    case 'war': return '/arena/war';
    case 'tribe': return '/tribe';
    case 'vault': return '/vault';
    case 'hearth': return '/';
    case 'inbox': return '/';
    case 'post': return '/vault/store';
    case 'profile': return '/profile';
    default: return null;
  }
}