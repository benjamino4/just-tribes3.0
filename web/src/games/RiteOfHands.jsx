// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/RiteOfHands.jsx
// PURPOSE: RPS with pattern reading. Best of 5. Shows last 5 throws.
// DEPENDS ON: GameFrame, haptics
// ═══════════════════════════════════════════════════════════════════
import { useState, useRef } from 'react';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';

const THROWS = [
  { id: 0, name: 'Rock', glyph: '✊' },
  { id: 1, name: 'Paper', glyph: '✋' },
  { id: 2, name: 'Scissors', glyph: '✌️' }
];

function beats(a, b) { return (a === 0 && b === 2) || (a === 1 && b === 0) || (a === 2 && b === 1); }

export default function RiteOfHands({ onDone, onExit }) {
  const [history, setHistory] = useState([]);
  const [playerWins, setPlayerWins] = useState(0);
  const [botWins, setBotWins] = useState(0);
  const [msg, setMsg] = useState('First to 3');
  const [reveal, setReveal] = useState(null);
  const ref = useRef({ pw: 0, bw: 0 });

  function play(idx) {
    if (ref.current.pw >= 3 || ref.current.bw >= 3) return;
    haptic('select');
    const bot = Math.floor(Math.random() * 3);
    setReveal({ player: idx, bot });
    setHistory((h) => [...h, bot].slice(-5));

    if (idx === bot) setMsg('Draw — go again');
    else if (beats(idx, bot)) {
      ref.current.pw += 1;
      setPlayerWins(ref.current.pw);
      setMsg('You take the round');
    } else {
      ref.current.bw += 1;
      setBotWins(ref.current.bw);
      setMsg('Bot takes the round');
    }

    if (ref.current.pw >= 3 || ref.current.bw >= 3) {
      setTimeout(() => onDone?.(ref.current.pw >= 3 ? 100 : 30, {
        wins: ref.current.pw, losses: ref.current.bw
      }), 600);
    }

    setTimeout(() => setReveal(null), 400);
  }

  return (
    <GameFrame title="Rite of Hands" onExit={onExit} material="metal" accent="#cfd0d8">
      <div className="hands-scene">
        <div className="hands-history">
          {history.map((b, i) => (
            <span key={i} className="hands-ghost">{THROWS[b].glyph}</span>
          ))}
        </div>
        <div className="hands-arena">
          {reveal ? (
            <>
              <span className="hands-symbol big">{THROWS[reveal.player].glyph}</span>
              <span className="hands-vs">vs</span>
              <span className="hands-symbol big">{THROWS[reveal.bot].glyph}</span>
            </>
          ) : (
            <>
              <span className="hands-symbol ghost">?</span>
              <span className="hands-vs">vs</span>
              <span className="hands-symbol ghost">?</span>
            </>
          )}
        </div>
        <div className="hands-picks">
          {THROWS.map((t) => (
            <button key={t.id} className="hands-pick" onClick={() => play(t.id)}>
              {t.glyph}
            </button>
          ))}
        </div>
        <p className="tiny" style={{ textAlign: 'center' }}>
          You {playerWins} — {botWins} Bot · {msg}
        </p>
      </div>
    </GameFrame>
  );
}