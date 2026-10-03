// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/SeatCircle.jsx
// PURPOSE: Seven seats visualized as a circle. Chief + 6 by rank.
// DEPENDS ON: Icon
// ═══════════════════════════════════════════════════════════════════
import { motion } from 'framer-motion';
import Icon from './Icon.jsx';

const POSITIONS = [
  { key: 'chief',    label: 'Chief',    icon: 'crown',  angle: -90 },
  { key: 'warlord',  label: 'Warlord',  icon: 'swords', angle: -30 },
  { key: 'keeper',   label: 'Keeper',   icon: 'shield', angle: 30 },
  { key: 'voice',    label: 'Voice',    icon: 'bell',   angle: 90 },
  { key: 'smith',    label: 'Smith',    icon: 'bolt',   angle: 150 },
  { key: 'ember',    label: 'Ember',    icon: 'hearth', angle: -150 },
  { key: 'wanderer', label: 'Wanderer', icon: 'user',   angle: -210 }
];

export default function SeatCircle({ seats = [] }) {
  const map = {};
  for (const s of seats) map[s.position] = s;

  const size = 280;
  const radius = 100;
  const cx = size / 2, cy = size / 2;

  return (
    <div className="seat-circle" style={{ width: size, height: size, position: 'relative', margin: '0 auto' }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(239,193,104,0.15)" strokeWidth="1" />
      </svg>
      {POSITIONS.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const x = cx + Math.cos(rad) * radius;
        const y = cy + Math.sin(rad) * radius;
        const seat = map[p.key];
        return (
          <motion.div
            key={p.key}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={{
              position: 'absolute',
              left: x - 32, top: y - 32,
              width: 64, height: 64,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%',
              background: seat
                ? 'radial-gradient(circle at 30% 25%, #ffcf7a, #b8842c)'
                : 'rgba(255,243,208,.04)',
              border: seat ? '2px solid var(--gold-300)' : '1px dashed rgba(255,243,208,.15)',
              boxShadow: seat ? '0 0 20px rgba(239,193,104,.4)' : 'none',
              textAlign: 'center', padding: 4
            }}
          >
            <Icon name={p.icon} size={16} style={{ color: seat ? '#2a1200' : 'var(--ink-dim)' }} />
            <span style={{
              fontSize: 8, fontWeight: 800, marginTop: 2,
              letterSpacing: '.06em', textTransform: 'uppercase',
              color: seat ? '#2a1200' : 'var(--ink-faint)'
            }}>{p.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}