import { useState, useEffect } from 'react';
import GameFrame from '../components/GameFrame.jsx';
import Emoji from '../components/Emoji.jsx';
import { haptic } from '../lib/haptics.js';

const RUNES = ['rune_draw', 'eye_blink', 'moon_phase', 'bolt_strike', 'flame_flicker', 'ice_crystal', 'aurora_wave', 'skull_pulse'];

export default function MissingRune({ onDone, onExit, rounds = 4 }) {
  const [ring, setRing] = useState([]);
  const [missing, setMissing] = useState(null);
  const [options, setOptions] = useState([]);
  const [phase, setPhase] = useState('show');
  const [score, setScore] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { start(); }, []);

  function start() {
    setAttempt((a) => a + 1);
    const runes = [...RUNES].sort(() => Math.random() - 0.5).slice(0, 6);
    setRing(runes);
    setPhase('show');
    setTimeout(() => {
      const idx = Math.floor(Math.random() * runes.length);
      const miss = runes[idx];
      setMissing(miss);
      const opts = [miss, ...RUNES.filter((r) => r !== miss).sort(() => Math.random() - 0.5).slice(0, 3)]
        .sort(() => Math.random() - 0.5);
      setOptions(opts);
      setPhase('pick');
    }, 1800);
  }

  function pick(r) {
    if (phase !== 'pick') return;
    if (r === missing) {
      haptic('success');
      const s = score + 25;
      setScore(s);
      if (attempt >= rounds) {
        setPhase('done');
        onDone?.(Math.min(100, s + 25), { correct: attempt, total: rounds, max_len: 6 });
      } else setTimeout(start, 500);
    } else {
      haptic('medium');
      setPhase('done');
      onDone?.(Math.max(20, score), { correct: attempt - 1, total: rounds, max_len: 6 });
    }
  }

  return (
    <GameFrame title="Missing Rune" onExit={onExit} material="frost">
      <div className="rune-scene">
        <div className="rune-ring">
          {ring.map((r, i) => {
            const a = (i * 360) / ring.length - 90;
            const rad = (a * Math.PI) / 180;
            const x = 50 + Math.cos(rad) * 40;
            const y = 50 + Math.sin(rad) * 40;
            const isMissing = phase === 'pick' && r === missing;
            return (
              <span key={i} className="rune-slot" data-missing={isMissing} style={{ left: x + '%', top: y + '%' }}>
                {!isMissing && <Emoji name={r} size={28} />}
              </span>
            );
          })}
        </div>

        {phase === 'pick' && (
          <div className="rune-options">
            {options.map((r) => (
              <button key={r} className="rune-option" onClick={() => pick(r)}>
                <Emoji name={r} size={32} />
              </button>
            ))}
          </div>
        )}

        <p className="tiny" style={{ textAlign: 'center', marginTop: 12 }}>
          {phase === 'show' ? 'Watch the ring…' : 'Tap the missing rune'}
        </p>
      </div>
    </GameFrame>
  );
}