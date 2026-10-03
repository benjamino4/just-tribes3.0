// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/StoneStack.jsx
// PURPOSE: Perfect stacker. Swing, tap, land. Perfects give bonuses.
// DEPENDS ON: GameFrame, motion, haptics, raf
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';
import { subscribe as rafSubscribe } from '../lib/raf.js';

export default function StoneStack({ onDone, onExit }) {
  const [blocks, setBlocks] = useState([{ x: 50, w: 40, y: 100 }]);
  const [score, setScore] = useState(0);
  const [perfects, setPerfects] = useState(0);
  const [swingPos, setSwingPos] = useState(20);
  const doneRef = useRef(false);
  const dirRef = useRef(1);
  const posRef = useRef(20);

  useEffect(() => {
    return rafSubscribe(() => {
      if (doneRef.current) return;
      posRef.current += dirRef.current * 0.6;
      if (posRef.current >= 80) dirRef.current = -1;
      if (posRef.current <= 20) dirRef.current = 1;
      setSwingPos(posRef.current);
    });
  }, []);

  function drop() {
    if (doneRef.current) return;
    const top = blocks[blocks.length - 1];
    const overlap = Math.max(0, Math.min(top.x + top.w, swingPos + 20) - Math.max(top.x, swingPos - 20));
    if (overlap <= 0) {
      haptic('error');
      doneRef.current = true;
      onDone?.(Math.min(100, blocks.length * 3), { height: blocks.length, perfects });
      return;
    }
    const isPerfect = Math.abs(swingPos - top.x) < 3;
    const newW = Math.min(top.w, overlap);
    const nx = Math.max(top.x, swingPos - 20) + (newW - top.w < 0 ? (top.w - newW) / 2 : 0);
    haptic(isPerfect ? 'success' : 'light');
    setPerfects((p) => p + (isPerfect ? 1 : 0));
    setScore((s) => s + Math.round(newW) * (isPerfect ? 3 : 1));
    const next = [...blocks, { x: nx, w: newW, y: 100 - blocks.length * 8 }];
    setBlocks(next);
    if (next.length >= 12) {
      doneRef.current = true;
      onDone?.(100, { height: next.length, perfects });
    }
  }

  return (
    <GameFrame title="Stone Stack" onExit={onExit} material="clay" accent="#c08a4a">
      <div className="stack-hud">
        <div className="col"><span className="tiny">Height</span><b className="tabular" style={{ fontSize: 20 }}>{blocks.length}</b></div>
        <div className="col" style={{ textAlign: 'right' }}><span className="tiny">Perfect</span><b className="tabular" style={{ fontSize: 20, color: 'var(--gold-300)' }}>{perfects}</b></div>
      </div>
      <div className="stack-scene" onClick={drop}>
        <motion.div
          animate={{ left: swingPos + '%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="swing-block"
        />
        <div className="stack-tower">
          {blocks.map((b, i) => (
            <motion.div
              key={i}
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="stack-block"
              style={{
                left: b.x + '%',
                width: b.w + '%',
                bottom: i * 22 + 'px',
                background: `linear-gradient(180deg, hsl(${30 + i * 3}, 40%, ${35 - i}%), hsl(${30 + i * 3}, 45%, ${22 - i}%))`
              }}
            />
          ))}
        </div>
      </div>
    </GameFrame>
  );
}