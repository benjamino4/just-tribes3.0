// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/RuneMatch.jsx
// PURPOSE: Match-3 game. Swap runes to match 3+. Combos. 90s.
// DEPENDS ON: GameFrame, motion, haptics
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';

const RUNES = ['🔥', '⭐', '🌙', '🪶', '🗡️', '💧'];
const ROWS = 7, COLS = 6;
const GAME_MS = 90000;

function makeBoard() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => Math.floor(Math.random() * RUNES.length))
  );
}

function findMatches(b) {
  const matched = new Set();
  for (let r = 0; r < ROWS; r++) {
    let run = 1;
    for (let c = 1; c <= COLS; c++) {
      if (c < COLS && b[r][c] === b[r][c - 1]) run++;
      else {
        if (run >= 3) for (let k = c - run; k < c; k++) matched.add(r + ',' + k);
        run = 1;
      }
    }
  }
  for (let c = 0; c < COLS; c++) {
    let run = 1;
    for (let r = 1; r <= ROWS; r++) {
      if (r < ROWS && b[r][c] === b[r - 1][c]) run++;
      else {
        if (run >= 3) for (let k = r - run; k < r; k++) matched.add(k + ',' + c);
        run = 1;
      }
    }
  }
  return matched;
}

function collapse(b) {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (b[r][c] !== -1) { b[write][c] = b[r][c]; if (write !== r) b[r][c] = -1; write--; }
    }
    for (let r = write; r >= 0; r--) b[r][c] = Math.floor(Math.random() * RUNES.length);
  }
}

export default function RuneMatch({ onDone, onExit, mode = 'solo', timeLimit = GAME_MS }) {
  const [board, setBoard] = useState(makeBoard);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const doneRef = useRef(false);

  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 100;
        if (next <= 0 && !doneRef.current) {
          doneRef.current = true;
          clearInterval(iv);
          const finalScore = score;
          setTimeout(() => onDone?.(Math.min(100, Math.round(finalScore / 30)), { score: finalScore, best_combo: combo }), 200);
        }
        return Math.max(0, next);
      });
    }, 100);
    return () => clearInterval(iv);
  }, [score, combo, onDone]);

  function tapCell(r, c) {
    if (timeLeft <= 0) return;
    haptic('light');
    if (!selected) { setSelected([r, c]); return; }
    const [sr, sc] = selected;
    if (sr === r && sc === c) { setSelected(null); return; }
    const adjacent = Math.abs(sr - r) + Math.abs(sc - c) === 1;
    if (!adjacent) { setSelected([r, c]); return; }

    const nb = board.map((row) => row.slice());
    [nb[sr][sc], nb[r][c]] = [nb[r][c], nb[sr][sc]];
    const matches = findMatches(nb);
    if (matches.size === 0) { haptic('error'); setSelected(null); return; }

    let chain = 0;
    while (findMatches(nb).size > 0) {
      const m = findMatches(nb);
      for (const k of m) {
        const [mr, mc] = k.split(',').map(Number);
        nb[mr][mc] = -1;
      }
      chain++;
      const gained = m.size * 10 * chain;
      setScore((s) => s + gained);
      collapse(nb);
    }
    setCombo(chain);
    haptic('success');
    setBoard(nb);
    setSelected(null);
  }

  return (
    <GameFrame title="Rune Match" onExit={onExit} material="stone" accent="#8899aa">
      <div className="rune-match-hud">
        <div className="col">
          <span className="tiny">Score</span>
          <b className="tabular" style={{ fontSize: 22 }}>{score}</b>
        </div>
        <div className="col" style={{ textAlign: 'right' }}>
          <span className="tiny">Time</span>
          <b className="tabular" style={{ fontSize: 22, color: timeLeft < 10000 ? 'var(--rose-200)' : undefined }}>
            {Math.ceil(timeLeft / 1000)}s
          </b>
        </div>
      </div>
      <div className="rune-match-grid">
        {board.map((row, r) => row.map((v, c) => (
          <motion.button
            key={r + ',' + c}
            onClick={() => tapCell(r, c)}
            className="rune-cell"
            data-selected={selected && selected[0] === r && selected[1] === c}
            whileTap={{ scale: 0.9 }}
          >
            {v >= 0 ? RUNES[v] : ''}
          </motion.button>
        )))}
      </div>
      {combo > 1 && (
        <motion.div
          key={combo}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="combo-badge"
        >
          ×{combo} COMBO
        </motion.div>
      )}
    </GameFrame>
  );
}