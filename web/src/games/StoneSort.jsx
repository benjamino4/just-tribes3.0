// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/StoneSort.jsx
// PURPOSE: Sort colored stones into matching bowls. Level progression.
// DEPENDS ON: GameFrame, haptics
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { motion } from 'framer-motion';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';

const COLORS = ['#d0483a', '#efc168', '#7fc9a7', '#7ea3c4', '#b58cff', '#f0e6cf'];

function newLevel(level) {
  const n = Math.min(6, 3 + Math.floor(level / 2));
  const bowls = [];
  for (let i = 0; i < n; i++) bowls.push([]);
  const pool = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) pool.push(i);
  pool.sort(() => Math.random() - 0.5);
  for (let i = 0; i < n; i++) bowls[i] = pool.slice(i * 4, i * 4 + 4);
  return bowls;
}

export default function StoneSort({ onDone, onExit }) {
  const [level, setLevel] = useState(1);
  const [bowls, setBowls] = useState(() => newLevel(1));
  const [selected, setSelected] = useState(null);

  function tapBowl(i) {
    haptic('light');
    if (selected == null) { setSelected(i); return; }
    if (selected === i) { setSelected(null); return; }
    const from = bowls[selected], to = bowls[i];
    if (!from.length) { setSelected(i); return; }
    if (to.length >= 4) { setSelected(i); return; }
    const top = from[from.length - 1];
    if (to.length > 0 && to[to.length - 1] !== top) { setSelected(i); return; }
    const nb = bowls.map((b) => b.slice());
    nb[i].push(nb[selected].pop());
    setBowls(nb);
    setSelected(null);
    if (nb.every((b) => b.length === 0 || (b.length === 4 && b.every((c) => c === b[0])))) {
      haptic('success');
      if (level >= 3) {
        onDone?.(Math.min(100, level * 20), { levels: level, time_ms: 0 });
      } else {
        setLevel((l) => l + 1);
        setBowls(newLevel(level + 1));
      }
    }
  }

  return (
    <GameFrame title="Stone Sort" onExit={onExit} material="clay" accent="#c08a4a">
      <div className="sort-hud">
        <div className="col"><span className="tiny">Level</span><b className="tabular" style={{ fontSize: 20 }}>{level}</b></div>
      </div>
      <div className="sort-scene">
        {bowls.map((b, i) => (
          <motion.button
            key={i}
            onClick={() => tapBowl(i)}
            className="sort-bowl"
            data-selected={selected === i}
            whileTap={{ scale: 0.96 }}
          >
            {b.map((c, j) => (
              <motion.div
                key={j}
                layout
                className="sort-stone"
                style={{ background: COLORS[c] }}
              />
            ))}
          </motion.button>
        ))}
      </div>
    </GameFrame>
  );
}