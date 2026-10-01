import { useEffect, useRef, useState } from 'react';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';

export default function CascadeReflex({ onDone, onExit, rounds = 4 }) {
  const [sequence, setSequence] = useState([]);
  const [phase, setPhase] = useState('show');   // show | tap | done
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    start();
  }, []);

  function start() {
    setAttempt((a) => a + 1);
    setProgress(0);
    const len = 3 + attempt;
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 5));
    setSequence(seq);
    setPhase('show');
    setResult(null);
    const t = setTimeout(() => setPhase('tap'), 400 + len * 600);
    return () => clearTimeout(t);
  }

  function tap(i) {
    if (phase !== 'tap') return;
    if (sequence[progress] === i) {
      haptic('light');
      const p = progress + 1;
      if (p >= sequence.length) {
        haptic('success');
        const nextAttempt = attempt + 1;
        if (nextAttempt >= rounds) {
          setPhase('done');
          const score = Math.min(100, 40 + nextAttempt * 15);
          setTimeout(() => onDone?.(score, { correct: rounds, total: rounds, max_len: sequence.length }), 400);
        } else {
          setTimeout(() => start(), 500);
        }
      } else {
        setProgress(p);
      }
    } else {
      haptic('medium');
      setResult('Wrong — restart');
      setPhase('show');
      setProgress(0);
      setTimeout(() => start(), 800);
    }
  }

  return (
    <GameFrame title="Cascade" onExit={onExit} material="ember">
      <div className="cascade-scene">
        {[0, 1, 2, 3, 4].map((i) => (
          <button
            key={i}
            className="cascade-fire"
            data-active={phase === 'show' && sequence.indexOf(i) === progress}
            onClick={() => tap(i)}
            style={{
              left: (10 + (i * 80 / 5) * 4) + '%',
              top: (20 + (i % 3) * 25) + '%'
            }}
          >
            <span className="cascade-glyph">🔥</span>
          </button>
        ))}
        <div className="cascade-status">
          {result && <span className="bad">{result}</span>}
          {phase === 'show' && <span>Watch…</span>}
          {phase === 'tap' && <span>Now tap: {progress}/{sequence.length}</span>}
        </div>
      </div>
    </GameFrame>
  );
}