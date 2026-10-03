// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/RuneBloom.jsx
// PURPOSE: 2048-like. Slide to combine matching runes.
// DEPENDS ON: GameFrame, haptics
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';

const SIZE = 4;
const TIERS = ['#3a4452', '#7ea3c4', '#7fc9a7', '#efc168', '#c08a4a', '#ff8324', '#d0483a', '#b58cff', '#f0e6cf'];

function emptyGrid() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }
function spawn(grid) {
  const empties = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empties.push([r, c]);
  if (!empties.length) return grid;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const g = grid.map((row) => row.slice());
  g[r][c] = Math.random() < 0.9 ? 1 : 2;
  return g;
}

function slideRow(row) {
  const filtered = row.filter((v) => v);
  const out = [];
  let merged = 0;
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i] === filtered[i + 1]) {
      out.push(filtered[i] + 1);
      merged += filtered[i] + 1;
      i++;
    } else out.push(filtered[i]);
  }
  while (out.length < SIZE) out.push(0);
  return { row: out, gained: merged };
}

export default function RuneBloom({ onDone, onExit }) {
  const [grid, setGrid] = useState(() => spawn(emptyGrid()));
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState(1);
  const doneRef = useRef(false);

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grid]);

  function move(dir) {
    if (doneRef.current) return;
    let g = grid.map((r) => r.slice());
    let gained = 0;
    if (dir === 'left' || dir === 'right') {
      for (let r = 0; r < SIZE; r++) {
        const row = dir === 'left' ? g[r] : [...g[r]].reverse();
        const { row: nr, gained: gain } = slideRow(row);
        gained += gain;
        g[r] = dir === 'left' ? nr : nr.reverse();
      }
    } else {
      for (let c = 0; c < SIZE; c++) {
        const col = [];
        for (let r = 0; r < SIZE; r++) col.push(g[r][c]);
        const ordered = dir === 'up' ? col : [...col].reverse();
        const { row: nr, gained: gain } = slideRow(ordered);
        gained += gain;
        const final = dir === 'up' ? nr : nr.reverse();
        for (let r = 0; r < SIZE; r++) g[r][c] = final[r];
      }
    }
    if (gained === 0) { haptic('error'); return; }
    haptic('light');
    g = spawn(g);
    setGrid(g);
    setScore((s) => s + gained);
    setMoves((m) => m + 1);
    let top = 0;
    for (const row of g) for (const v of row) top = Math.max(top, v);
    setBest((b) => Math.max(b, top));
    if (top >= 8 || moves >= 40) {
      doneRef.current = true;
      onDone?.(Math.min(100, top * 10), { highest_tier: top, moves });
    }
  }

  return (
    <GameFrame title="Rune Bloom" onExit={onExit} material="frost" accent="#7ea3c4">
      <div className="bloom-hud">
        <div className="col"><span className="tiny">Score</span><b className="tabular" style={{ fontSize: 20 }}>{score}</b></div>
        <div className="col" style={{ textAlign: 'right' }}><span className="tiny">Highest</span><b className="tabular" style={{ fontSize: 20, color: 'var(--gold-300)' }}>{best}</b></div>
      </div>
      <div className="bloom-grid" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
        {grid.map((row, r) =>
          row.map((v, c) => (
            <motion.div
              key={r + ',' + c}
              className="bloom-cell"
              layout
              style={{ background: v ? TIERS[Math.min(v, TIERS.length - 1)] : 'rgba(255,255,255,0.03)' }}
              animate={{ scale: v ? 1 : 0.92 }}
            >
              {v ? <b style={{ color: '#0b0a10' }}>{Math.pow(2, v)}</b> : null}
            </motion.div>
          ))
        )}
      </div>
      <div className="bloom-controls">
        <button className="cascade-btn" onClick={() => move('left')}>←</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className="cascade-btn" onClick={() => move('up')}>↑</button>
          <button className="cascade-btn" onClick={() => move('down')}>↓</button>
        </div>
        <button className="cascade-btn" onClick={() => move('right')}>→</button>
      </div>
    </GameFrame>
  );
}