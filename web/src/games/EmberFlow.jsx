// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/EmberFlow.jsx
// PURPOSE: Rotate tiles to guide fire from source to shrine.
// DEPENDS ON: GameFrame, haptics
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';

const SIZE = 5;
const TYPES = ['corner', 'straight', 'tee', 'end'];

function randomTile() {
  const t = TYPES[Math.floor(Math.random() * TYPES.length)];
  return { type: t, rot: Math.floor(Math.random() * 4) };
}

export default function EmberFlow({ onDone, onExit }) {
  const [tiles, setTiles] = useState(() =>
    Array.from({ length: SIZE * SIZE }, () => randomTile())
  );
  const [rotations, setRotations] = useState(0);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTime((t) => t + 100), 100);
    return () => clearInterval(iv);
  }, []);

  function rotate(i) {
    haptic('light');
    setTiles((t) => t.map((tile, idx) => idx === i ? { ...tile, rot: (tile.rot + 1) % 4 } : tile));
    setRotations((r) => r + 1);
  }

  function checkDone() {
    // Simplified: player self-reports when they finish
    haptic('success');
    const levels = 1;
    onDone?.(Math.min(100, 60 + levels * 15 - rotations * 0.5), { levels, rotations, time_ms: time });
  }

  return (
    <GameFrame title="Ember Flow" onExit={onExit} material="frost" accent="#7ea3c4">
      <div className="flow-hud">
        <div className="col"><span className="tiny">Rotations</span><b className="tabular" style={{ fontSize: 20 }}>{rotations}</b></div>
        <button className="btn primary" onClick={checkDone}>Complete</button>
      </div>
      <div className="flow-grid" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
        {tiles.map((t, i) => (
          <motion.button
            key={i}
            onClick={() => rotate(i)}
            className="flow-tile"
            whileTap={{ scale: 0.9 }}
          >
            <motion.svg viewBox="0 0 40 40" animate={{ rotate: t.rot * 90 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
              <rect x="18" y="18" width="4" height="4" fill="#7ea3c4" />
              {t.type === 'straight' && <rect x="18" y="4" width="4" height="32" fill="#7ea3c4" />}
              {t.type === 'corner' && <path d="M20 20 L20 4 L24 4 L24 20 L40 20 L40 24 L20 24 Z" fill="#7ea3c4" />}
              {t.type === 'tee' && <>
                <rect x="18" y="4" width="4" height="16" fill="#7ea3c4" />
                <rect x="4" y="20" width="32" height="4" fill="#7ea3c4" />
              </>}
              {t.type === 'end' && <rect x="18" y="20" width="4" height="16" fill="#7ea3c4" />}
            </motion.svg>
          </motion.button>
        ))}
      </div>
    </GameFrame>
  );
}