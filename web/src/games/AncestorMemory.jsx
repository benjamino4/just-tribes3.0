import { useState, useEffect } from 'react';
import GameFrame from '../components/GameFrame.jsx';
import Emoji from '../components/Emoji.jsx';
import { haptic } from '../lib/haptics.js';

const EMOJI_POOL = [
  'reaction-fire', 'reaction-swords', 'spark_orbit', 'moon_phase', 'bolt_strike',
  'eye_blink', 'wolf_gaze', 'rune_draw', 'halo_glow', 'ice_crystal', 'snowfall', 'aurora_wave'
];

export default function AncestorMemory({ onDone, onExit, rounds = 4 }) {
  const [sequence, setSequence] = useState([]);
  const [phase, setPhase] = useState('show');
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState(0);

  useEffect(() => { start(); }, []);

  function start() {
    setAttempt((a) => a + 1);
    setProgress(0);
    setShown(0);
    const len = 3 + attempt;
    const seq = Array.from({ length: len }, () => EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]);
    setSequence(seq);
    setPhase('show');
    seq.forEach((_, i) => {
      setTimeout(() => { setShown(i + 1); haptic('light'); }, 500 + i * 500);
    });
    setTimeout(() => setPhase('tap'), 500 + seq.length * 500 + 300);
  }

  function tap(key) {
    if (phase !== 'tap') return;
    if (sequence[progress] === key) {
      haptic('light');
      const p = progress + 1;
      if (p >= sequence.length) {
        haptic('success');
        const nextAttempt = attempt + 1;
        if (nextAttempt >= rounds) {
          setPhase('done');
          onDone?.(100, { correct: rounds, total: rounds, max_len: sequence.length });
        } else {
          setTimeout(start, 500);
        }
      } else setProgress(p);
    } else {
      haptic('medium');
      setPhase('done');
      onDone?.(Math.max(20, progress * 15), { correct: progress, total: sequence.length, max_len: sequence.length });
    }
  }

  return (
    <GameFrame title="Ancestor Memory" onExit={onExit} material="bone">
      <div className="memory-scene">
        <div className="memory-totem">
          <svg viewBox="0 0 80 100" width="100" height="120">
            <ellipse cx="40" cy="55" rx="28" ry="36" fill="#4a3a28" stroke="#8a7a5c" strokeWidth="2" />
            <circle cx="30" cy="45" r="4" fill="#ffcf7a" />
            <circle cx="50" cy="45" r="4" fill="#ffcf7a" />
            <path d="M28 70 Q40 78 52 70" stroke="#8a7a5c" strokeWidth="2" fill="none" />
            {phase === 'show' && sequence[shown - 1] && (
              <foreignObject x="20" y="0" width="40" height="30">
                <Emoji name={sequence[shown - 1]} size={30} />
              </foreignObject>
            )}
          </svg>
        </div>

        <div className="memory-grid">
          {EMOJI_POOL.slice(0, 9).map((k) => (
            <button key={k} className="memory-cell" onClick={() => tap(k)}>
              <Emoji name={k} size={28} />
            </button>
          ))}
        </div>

        <p className="tiny" style={{ textAlign: 'center', marginTop: 12 }}>
          {phase === 'show' ? 'Watch the totem…' : `Repeat ${progress}/${sequence.length}`}
        </p>
      </div>
    </GameFrame>
  );
}