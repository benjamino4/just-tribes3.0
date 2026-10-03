// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/Fireflies.jsx
// PURPOSE: Catch drifting fireflies. Endless. Meditative.
// DEPENDS ON: GameFrame, raf
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';
import { subscribe as rafSubscribe } from '../lib/raf.js';

export default function Fireflies({ onDone, onExit, mode = 'solo', timeLimit = 60000 }) {
  const [flies, setFlies] = useState([]);
  const [caught, setCaught] = useState(0);
  const [missed, setMissed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const idRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const spawn = () => {
      setFlies((f) => {
        if (f.length >= 6) return f;
        return [...f, {
          id: ++idRef.current,
          x: 10 + Math.random() * 80,
          y: 15 + Math.random() * 70,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          born: performance.now()
        }];
      });
    };
    const iv = setInterval(spawn, 800);
    spawn();
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const start = performance.now();
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 100;
        if (next <= 0 && !doneRef.current) {
          doneRef.current = true;
          onDone?.(Math.min(100, caught * 2 - missed * 5), { caught, waves: Math.floor(caught / 10), missed });
        }
        return Math.max(0, next);
      });
    }, 100);
    const unsub = rafSubscribe(() => {
      if (doneRef.current) return;
      setFlies((f) => f
        .map((fly) => ({
          ...fly,
          x: fly.x + fly.vx,
          y: fly.y + fly.vy,
          vx: fly.vx + (Math.random() - 0.5) * 0.02,
          vy: fly.vy + (Math.random() - 0.5) * 0.02
        }))
        .filter((fly) => performance.now() - fly.born < 8000)
      );
    });
    return () => { clearInterval(iv); unsub(); };
  }, [caught, missed, onDone]);

  useEffect(() => {
    if (missed >= 3 && !doneRef.current) {
      doneRef.current = true;
      onDone?.(Math.max(0, caught * 2 - missed * 5), { caught, waves: Math.floor(caught / 10), missed });
    }
  }, [missed, caught, onDone]);

  function tapFly(id) {
    haptic('light');
    setCaught((c) => c + 1);
    setFlies((f) => f.filter((x) => x.id !== id));
  }

  return (
    <GameFrame title="Fireflies" onExit={onExit} material="ember" accent="#ffcf7a">
      <div className="fireflies-hud">
        <div className="col"><span className="tiny">Caught</span><b className="tabular" style={{ fontSize: 22, color: 'var(--gold-300)' }}>{caught}</b></div>
        <div className="col" style={{ textAlign: 'right' }}>
          <span className="tiny">Missed</span>
          <b className="tabular" style={{ fontSize: 22, color: missed > 0 ? 'var(--rose-200)' : undefined }}>{missed}</b>
        </div>
      </div>
      <div className="fireflies-scene">
        {flies.map((fly) => (
          <motion.button
            key={fly.id}
            onClick={() => tapFly(fly.id)}
            className="firefly"
            style={{ left: fly.x + '%', top: fly.y + '%' }}
            whileTap={{ scale: 0.5 }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        ))}
      </div>
    </GameFrame>
  );
}