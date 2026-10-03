// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/RuneLine.jsx
// PURPOSE: One-stroke puzzle. Connect every rune, no crossing.
// DEPENDS ON: GameFrame, haptics
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { motion } from 'framer-motion';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';

const SIZE = 4;
// Preset solvable path for demo
const PUZZLE = [0, 1, 2, 3, 7, 11, 15, 14, 13, 9, 5, 6, 10, 8, 12, 4];

export default function RuneLine({ onDone, onExit }) {
  const [path, setPath] = useState([]);
  const [done, setDone] = useState(false);

  function tapCell(i) {
    if (done) return;
    haptic('light');
    if (path.includes(i)) return;
    if (path.length > 0) {
      const last = path[path.length - 1];
      const [lr, lc] = [Math.floor(last / SIZE), last % SIZE];
      const [cr, cc] = [Math.floor(i / SIZE), i % SIZE];
      if (Math.abs(lr - cr) + Math.abs(lc - cc) !== 1) {
        haptic('error');
        return;
      }
    }
    const next = [...path, i];
    setPath(next);
    if (next.length === SIZE * SIZE) {
      haptic('success');
      setDone(true);
      setTimeout(() => onDone?.(100, { solved: 1, time_ms: 0 }), 500);
    }
  }

  function reset() {
    haptic('select');
    setPath([]);
    setDone(false);
  }

  return (
    <GameFrame title="Rune Line" onExit={onExit} material="metal" accent="#cfd0d8">
      <div className="rune-line-hud">
        <span className="tiny">Progress: {path.length} / {SIZE * SIZE}</span>
        <button className="btn ghost" onClick={reset}>Reset</button>
      </div>
      <div className="rune-line-grid" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
        {Array.from({ length: SIZE * SIZE }, (_, i) => (
          <motion.button
            key={i}
            className="rune-line-cell"
            data-active={path.includes(i) ? '1' : '0'}
            onClick={() => tapCell(i)}
            whileTap={{ scale: 0.9 }}
          />
        ))}
      </div>
    </GameFrame>
  );
}