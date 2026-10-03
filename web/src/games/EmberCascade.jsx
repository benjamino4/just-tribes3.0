// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/EmberCascade.jsx
// PURPOSE: Tetris-like falling blocks. Rotate, place, clear lines.
// DEPENDS ON: GameFrame, raf, haptics
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';
import { subscribe as rafSubscribe } from '../lib/raf.js';

const COLS = 8, ROWS = 14;
const SHAPES = [
  [[1, 1], [1, 1]],
  [[1, 1, 1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 1, 0], [0, 1, 1]]
];

function emptyBoard() { return Array.from({ length: ROWS }, () => Array(COLS).fill(0)); }

export default function EmberCascade({ onDone, onExit }) {
  const [board, setBoard] = useState(emptyBoard);
  const [piece, setPiece] = useState(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60000);
  const doneRef = useRef(false);
  const fallRef = useRef(0);

  useEffect(() => {
    spawn();
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 100;
        if (next <= 0 && !doneRef.current) {
          doneRef.current = true;
          onDone?.(Math.min(100, lines * 4 + Math.round(score / 100)), { lines, score });
        }
        return Math.max(0, next);
      });
    }, 100);
    return () => clearInterval(iv);
  }, [lines, score, onDone]);

  useEffect(() => rafSubscribe(() => {
    if (doneRef.current || !piece) return;
    fallRef.current += 1;
    if (fallRef.current >= 30) {
      fallRef.current = 0;
      moveDown();
    }
  }), [piece]);

  function spawn() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    setPiece({ shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 });
  }

  function collide(b, p, nx, ny) {
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (!p.shape[r][c]) continue;
        const tx = nx + c, ty = ny + r;
        if (tx < 0 || tx >= COLS || ty >= ROWS) return true;
        if (ty >= 0 && b[ty][tx]) return true;
      }
    }
    return false;
  }

  function moveDown() {
    if (!piece) return;
    if (!collide(board, piece, piece.x, piece.y + 1)) {
      setPiece({ ...piece, y: piece.y + 1 });
    } else {
      const nb = board.map((r) => r.slice());
      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (piece.shape[r][c]) nb[piece.y + r][piece.x + c] = 1;
        }
      }
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (nb[r].every((v) => v)) {
          nb.splice(r, 1);
          nb.unshift(Array(COLS).fill(0));
          cleared++;
          r++;
        }
      }
      if (cleared > 0) {
        haptic('success');
        setLines((l) => l + cleared);
        setScore((s) => s + [0, 100, 300, 600, 1000][cleared]);
      }
      setBoard(nb);
      spawn();
    }
  }

  function rotate() {
    if (!piece || doneRef.current) return;
    haptic('light');
    const p = piece.shape;
    const rotated = p[0].map((_, i) => p.map((row) => row[i]).reverse());
    if (!collide(board, { shape: rotated, x: piece.x, y: piece.y }, piece.x, piece.y)) {
      setPiece({ ...piece, shape: rotated });
    }
  }

  function tapLeft() {
    if (!piece || doneRef.current) return;
    haptic('light');
    if (!collide(board, piece, piece.x - 1, piece.y)) setPiece({ ...piece, x: piece.x - 1 });
  }

  function tapRight() {
    if (!piece || doneRef.current) return;
    haptic('light');
    if (!collide(board, piece, piece.x + 1, piece.y)) setPiece({ ...piece, x: piece.x + 1 });
  }

  return (
    <GameFrame title="Ember Cascade" onExit={onExit} material="ember" accent="#ff8324">
      <div className="cascade-hud">
        <div className="col"><span className="tiny">Score</span><b className="tabular" style={{ fontSize: 20 }}>{score}</b></div>
        <div className="col" style={{ textAlign: 'right' }}><span className="tiny">Lines</span><b className="tabular" style={{ fontSize: 20, color: 'var(--gold-300)' }}>{lines}</b></div>
      </div>
      <div className="cascade-scene-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {board.map((row, r) =>
          row.map((v, c) => {
            let cellVal = v;
            if (piece) {
              const pr = r - piece.y, pc = c - piece.x;
              if (pr >= 0 && pr < piece.shape.length && pc >= 0 && pc < piece.shape[pr].length && piece.shape[pr][pc]) cellVal = 1;
            }
            return <div key={r + ',' + c} className="cascade-cell" data-on={cellVal ? '1' : '0'} />;
          })
        )}
      </div>
      <div className="cascade-controls">
        <button className="cascade-btn" onClick={tapLeft}>←</button>
        <button className="cascade-btn" onClick={rotate}>↻</button>
        <button className="cascade-btn" onClick={tapRight}>→</button>
        <button className="cascade-btn" onClick={moveDown}>↓</button>
      </div>
    </GameFrame>
  );
}