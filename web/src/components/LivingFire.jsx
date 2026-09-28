// =====================================================================
// LivingFire — streak-driven campfire.
// 8 intensity stages. Bloom on transition. Dim on loss.
// Tap-to-extend. Full-bleed when expanded.
//
// Stage table:
//   0  (streak 0)       cold, no flames, no glow
//   1  (streak 1-2)     2 flames, small, dull ember
//   2  (streak 3-6)     3 flames, warm orange
//   3  (streak 7-13)    4 flames, bright with white flecks
//   4  (streak 14-29)   5 flames, white core
//   5  (streak 30-59)   6 flames, near-white core
//   6  (streak 60-99)   8 flames, golden fire
//   7  (streak 100+)    10 flames, pillar of light
// =====================================================================
import { useMemo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';

export function fireStateFor(streak) {
  const s = Number(streak) || 0;
  if (s <= 0)  return { stage: 0, size: 130, flames: 0,  embers: 0,  colour: '#4a4235', core: '#2e2920', label: 'cold'    };
  if (s < 3)   return { stage: 1, size: 165, flames: 2,  embers: 3,  colour: '#8f3402', core: '#cc4f05', label: 'flicker' };
  if (s < 7)   return { stage: 2, size: 185, flames: 3,  embers: 5,  colour: '#cc4f05', core: '#f26a10', label: 'warm'    };
  if (s < 14)  return { stage: 3, size: 205, flames: 4,  embers: 8,  colour: '#f26a10', core: '#ff8324', label: 'bright'  };
  if (s < 30)  return { stage: 4, size: 225, flames: 5,  embers: 12, colour: '#ff8324', core: '#ffc37f', label: 'hot'     };
  if (s < 60)  return { stage: 5, size: 245, flames: 6,  embers: 16, colour: '#ffc37f', core: '#ffe2a1', label: 'white'   };
  if (s < 100) return { stage: 6, size: 265, flames: 8,  embers: 22, colour: '#ffc37f', core: '#fff3d0', label: 'gold'    };
  return             { stage: 7, size: 300, flames: 10, embers: 30, colour: '#efc168', core: '#fff3d0', label: 'eternal' };
}

export default function LivingFire({ streak = 0, extended = false, dim = false }) {
  const M = useMotionConfig();
  const state = fireStateFor(streak);
  const [prevStage, setPrevStage] = useState(state.stage);
  const [blooming, setBlooming] = useState(false);
  const [dimming, setDimming] = useState(false);

  // Track stage transitions for bloom / dim
  useEffect(() => {
    if (state.stage > prevStage) {
      setBlooming(true);
      const t = setTimeout(() => setBlooming(false), 1400);
      return () => clearTimeout(t);
    } else if (state.stage < prevStage) {
      setDimming(true);
      const t = setTimeout(() => setDimming(false), 1800);
      return () => clearTimeout(t);
    }
    setPrevStage(state.stage);
  }, [state.stage, prevStage]);

  // Ember particles — count driven by stage, positions random
  const embers = useMemo(() => (
    Array.from({ length: state.embers }, (_, i) => ({
      i,
      x: 18 + Math.random() * 64,
      delay: Math.random() * 4,
      dur: 3 + Math.random() * 3,
      size: 3 + Math.random() * 4,
    }))
  ), [state.embers]);

  const scale = extended ? 1.55 : 1;

  return (
    <div
      className="living-fire"
      style={{
        position: 'relative',
        width: 200, height: 200,
        display: 'grid', placeItems: 'center',
        margin: '4px auto 0',
        transform: `scale(${scale})`,
        transformOrigin: 'center top',
        transition: 'transform .45s cubic-bezier(.34,1.32,.56,1)',
      }}
    >
      {/* Halo */}
      <motion.div
        animate={{
          scale: blooming
            ? [1, 1.5, 1.15]
            : (state.stage === 0 ? 1 : [0.94, 1.08, 0.94]),
          opacity: blooming
            ? [0.9, 1, 0.75]
            : (dimming
              ? [0.9, 0.25]
              : (state.stage === 0 ? 0.18 : [0.72, 1, 0.72])),
        }}
        transition={{
          duration: blooming ? 1.4 : (dimming ? 1.8 : 3.6),
          repeat: (blooming || dimming) ? 0 : (M.drift.repeat || 0),
        }}
        style={{
          position: 'absolute',
          inset: -38,
          borderRadius: '50%',
          background: state.stage > 0
            ? `radial-gradient(circle, ${state.core}66, ${state.colour}22 45%, transparent 72%)`
            : 'radial-gradient(circle, rgba(74,66,53,0.30), transparent 70%)',
          filter: 'blur(12px)',
          pointerEvents: 'none',
        }}
      />

      {/* Bloom flash */}
      {blooming && (
        <motion.div
          initial={{ scale: 0.6, opacity: 1 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.9 }}
          style={{
            position: 'absolute',
            inset: -20,
            borderRadius: '50%',
            border: `3px solid ${state.core}`,
            boxShadow: `0 0 60px ${state.core}`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Embers */}
      {state.stage > 0 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {embers.map((e) => (
            <motion.span
              key={e.i}
              animate={{
                y: [0, -140 - Math.random() * 60],
                x: [0, (Math.random() - 0.5) * 40],
                opacity: [0, 1, 0.6, 0],
                scale: [1, 0.6, 0.2],
              }}
              transition={{
                duration: e.dur,
                repeat: M.drift.repeat || 0,
                delay: e.delay,
                ease: 'easeOut',
              }}
              style={{
                position: 'absolute',
                left: e.x + '%',
                bottom: 58,
                width: e.size, height: e.size,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${state.core}, ${state.colour})`,
                boxShadow: `0 0 8px 1px ${state.core}`,
              }}
            />
          ))}
        </div>
      )}

      {/* SVG — logs + flames */}
      <svg
        className="cf-svg"
        viewBox="0 0 160 160"
        width="200" height="200"
        aria-hidden="true"
        style={{ position: 'relative', zIndex: 2, overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="flameCore" cx="50%" cy="80%" r="70%">
            <stop offset="0%"   stopColor={state.core} />
            <stop offset="45%"  stopColor={state.colour} />
            <stop offset="100%" stopColor={state.colour + '00'} />
          </radialGradient>
          <linearGradient id="logG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#6b4a30" />
            <stop offset="100%" stopColor="#3c2718" />
          </linearGradient>
        </defs>

        {/* Logs */}
        <g>
          <rect x="40" y="120" width="80" height="14" rx="7" fill="url(#logG)" transform="rotate(-12 80 127)" />
          <rect x="40" y="120" width="80" height="14" rx="7" fill="url(#logG)" transform="rotate( 12 80 127)" />
        </g>

        {/* Flames */}
        {state.stage > 0 && (
          <g
            style={{
              transformOrigin: '80px 130px',
              animation: dimming ? 'cfShrink 1.6s cubic-bezier(.34,1.32,.56,1) forwards' : undefined,
            }}
          >
            <motion.path
              animate={{
                scaleY: blooming ? [0.6, 1.3, 1.05] : [0.94, 1.08, 0.94],
                scaleX: blooming ? [0.8, 1.15, 1]    : [1.03, 0.97, 1.03],
              }}
              transition={{
                duration: blooming ? 1.4 : 1.8,
                repeat: blooming ? 0 : (M.drift.repeat || 0),
              }}
              style={{ transformOrigin: '80px 130px' }}
              d={flamePath(1, state.flames)}
              fill="url(#flameCore)"
              opacity={0.95}
            />
            <motion.path
              animate={{
                scaleY: blooming ? [0.7, 1.25, 1.05] : [0.98, 1.06, 0.98],
                scaleX: blooming ? [0.9, 1.1, 1]    : [1.02, 0.98, 1.02],
              }}
              transition={{
                duration: blooming ? 1.4 : 1.4,
                repeat: blooming ? 0 : (M.drift.repeat || 0),
                delay: 0.2,
              }}
              style={{ transformOrigin: '80px 130px' }}
              d={flamePath(2, Math.max(0, state.flames - 1))}
              fill={state.core}
              opacity={0.6}
            />
          </g>
        )}
      </svg>

      {/* Cold-state charcoal lines */}
      {state.stage === 0 && (
        <svg
          viewBox="0 0 160 160"
          width="200" height="200"
          style={{ position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none' }}
        >
          <g stroke="#2e2920" strokeWidth="2" strokeLinecap="round">
            <path d="M40 90 Q80 76 120 88" />
            <path d="M50 100 Q80 90 110 98" />
            <path d="M60 110 Q80 104 100 108" />
          </g>
        </svg>
      )}
    </div>
  );
}

// Procedural flame path — layer 1 is body, layer 2 is inner tongue
function flamePath(layer, count) {
  const base = layer === 1
    ? 'M80 40 C90 60 74 70 74 84 A16 16 0 0 0 106 84 C106 72 100 66 100 66 C104 72 108 78 108 88 A28 28 0 1 1 52 88 C52 70 68 60 80 40 Z'
    : 'M80 62 C86 72 78 78 78 86 A10 10 0 0 0 98 86 C98 80 94 76 94 76 C98 82 100 88 100 92 A20 20 0 1 1 60 92 C60 84 68 78 80 62 Z';
  return base;
}