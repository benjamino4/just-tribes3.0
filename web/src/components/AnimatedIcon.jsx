import React from 'react';
import { motion } from 'framer-motion';
import { animEnabled } from '../lib/settings.js';

// Unique, characterful animated glyphs — each has its own idle motion.
// All pure SVG, no image files. Respect the animations-off setting.
export default function AnimatedIcon({ name, size = 34, tone = '#ff9f45' }) {
  const on = animEnabled();
  const svg = { width: size, height: size, viewBox: '0 0 48 48' };
  const rep = on ? Infinity : 0;

  switch (name) {
    case 'flame':
      return (
        <svg {...svg}>
          <defs><radialGradient id="aiF" cx="50%" cy="70%" r="70%"><stop offset="0%" stopColor="#fff3c4"/><stop offset="55%" stopColor={tone}/><stop offset="100%" stopColor="#c53a05"/></radialGradient></defs>
          <motion.path fill="url(#aiF)" d="M24 6c3 6-3 9-3 14a6 6 0 0 0 12 0c0-3-1-5-1-5 4 4 6 9 6 15a14 14 0 1 1-28 0c0-8 6-13 9-18 2-3 2-6 5-6z"
            style={{ transformOrigin: '24px 38px' }}
            animate={on ? { scaleY: [1, 1.12, 0.96, 1], scaleX: [1, 0.95, 1.04, 1] } : {}} transition={{ duration: 1.4, repeat: rep, ease: 'easeInOut' }} />
        </svg>
      );
    case 'ash':
      return (
        <svg {...svg} fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round">
          {[14, 22, 30, 38].map((y, i) => (
            <motion.line key={y} x1="10" y1={y} x2="38" y2={y}
              animate={on ? { x1: [10, 13, 10], x2: [38, 35, 38], opacity: [0.5, 1, 0.5] } : {}}
              transition={{ duration: 2 + i * 0.3, repeat: rep, ease: 'easeInOut', delay: i * 0.2 }} />
          ))}
        </svg>
      );
    case 'scroll':
      return (
        <svg {...svg} fill="none" stroke={tone} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <motion.g animate={on ? { rotate: [-2, 2, -2] } : {}} style={{ transformOrigin: '24px 24px' }} transition={{ duration: 4, repeat: rep, ease: 'easeInOut' }}>
            <path d="M14 10h20v24a6 6 0 0 1-6 6H14z" />
            <path d="M14 10a5 5 0 0 0-5 5 4 4 0 0 0 5 4M34 40a6 6 0 0 0 6-6" />
            <path d="M19 18h10M19 24h10M19 30h6" strokeWidth="2" />
          </motion.g>
        </svg>
      );
    case 'bolt':
      return (
        <svg {...svg}>
          <motion.path fill={tone} d="M27 4L11 26h10l-3 18 19-24H26z"
            animate={on ? { opacity: [1, 0.55, 1], scale: [1, 1.08, 1] } : {}} style={{ transformOrigin: '24px 24px' }} transition={{ duration: 1.2, repeat: rep }} />
        </svg>
      );
    case 'wheel':
      return (
        <svg {...svg} fill="none" stroke={tone} strokeWidth="3">
          <motion.g animate={on ? { rotate: 360 } : {}} style={{ transformOrigin: '24px 24px' }} transition={{ duration: 8, repeat: rep, ease: 'linear' }}>
            <circle cx="24" cy="24" r="16" />
            {[0, 60, 120, 180, 240, 300].map((a) => <line key={a} x1="24" y1="24" x2={24 + 16 * Math.cos(a * Math.PI / 180)} y2={24 + 16 * Math.sin(a * Math.PI / 180)} />)}
            <circle cx="24" cy="24" r="3" fill={tone} />
          </motion.g>
        </svg>
      );
    case 'shield':
      return (
        <svg {...svg} fill="none" stroke={tone} strokeWidth="3" strokeLinejoin="round">
          <motion.path d="M24 6l14 5v10c0 9-6 16-14 21-8-5-14-12-14-21V11z" animate={on ? { scale: [1, 1.05, 1] } : {}} style={{ transformOrigin: '24px 24px' }} transition={{ duration: 2.4, repeat: rep, ease: 'easeInOut' }} />
        </svg>
      );
    case 'skull':
      return (
        <svg {...svg} fill={tone}>
          <motion.g animate={on ? { y: [0, -1.5, 0] } : {}} transition={{ duration: 2, repeat: rep }}>
            <path d="M24 6c-9 0-15 6-15 15 0 5 2 8 5 10v6h4v-4h3v4h6v-4h3v4h4v-6c3-2 5-5 5-10 0-9-6-15-15-15z" />
            <circle cx="17" cy="22" r="3.4" fill="#1a1020" /><circle cx="31" cy="22" r="3.4" fill="#1a1020" />
          </motion.g>
        </svg>
      );
    case 'spark':
    default:
      return (
        <svg {...svg} fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round">
          <motion.g animate={on ? { rotate: 360, scale: [1, 1.1, 1] } : {}} style={{ transformOrigin: '24px 24px' }} transition={{ duration: 6, repeat: rep, ease: 'linear' }}>
            <path d="M24 6v10M24 32v10M6 24h10M32 24h10M12 12l7 7M29 29l7 7M36 12l-7 7M19 29l-7 7" />
          </motion.g>
        </svg>
      );
  }
}
