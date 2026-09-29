// TRIBES-FILE: web/src/components/TacticWheel.jsx
// PHASE: 6 — War
// Radial tactic picker.

import { motion } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import Emoji from './Emoji.jsx';

export default function TacticWheel({ tactics, terrain, onPick, cooldown }) {
  const M = useMotionConfig();
  const terrainData = terrain || {};

  const favored = (id) => terrainData.favors?.includes(id);
  const resisted = (id) => terrainData.resists?.includes(id);

  const slots = tactics.slice(0, 8);
  const radius = 82;
  const angleStep = (2 * Math.PI) / slots.length;

  return (
    <div className="tactic-wheel">
      <motion.div
        className="tactic-slot center"
        whileTap={{ scale: 0.92 }}
        transition={M.tactile}
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <Emoji name="war-swords" size={30} />
      </motion.div>

      {slots.map((t, i) => {
        const a = i * angleStep - Math.PI / 2;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        const fav = favored(t.id);
        const res = resisted(t.id);

        return (
          <motion.button
            key={t.id}
            className={`tactic-slot${fav ? ' favored' : ''}${res ? ' resisted' : ''}`}
            style={{
              top: '50%', left: '50%',
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            }}
            whileTap={{ scale: 0.88 }}
            transition={M.tactile}
            onClick={() => {
              if (cooldown) return;
              haptic('medium');
              onPick?.(t.id);
            }}
            disabled={cooldown}
          >
            <span style={{ fontSize: 22 }}>{t.glyph}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
