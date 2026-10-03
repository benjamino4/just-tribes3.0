// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/ThreeMasks.jsx
// PURPOSE: Guess their mask. WAR, TRICK, GUARD. Best of 3.
// DEPENDS ON: GameFrame, haptics
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';

const MASKS = ['war', 'trick', 'guard'];
const RESPONSES = ['attack', 'wait', 'flee'];

function resolve(mask, response) {
  if (mask === 'war') return response === 'attack' ? 'win' : response === 'wait' ? 'lose' : 'tie';
  if (mask === 'trick') return response === 'attack' ? 'lose' : response === 'wait' ? 'tie' : 'win';
  return response === 'attack' ? 'tie' : response === 'wait' ? 'win' : 'lose';
}

export default function ThreeMasks({ onDone, onExit }) {
  const [round, setRound] = useState(1);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [reveal, setReveal] = useState(null);

  function play(response) {
    if (reveal || round > 3) return;
    haptic('select');
    const mask = MASKS[Math.floor(Math.random() * 3)];
    const result = resolve(mask, response);
    setReveal({ mask, response, result });
    let nw = wins, nl = losses;
    if (result === 'win') nw++;
    else if (result === 'lose') nl++;

    setTimeout(() => {
      setReveal(null);
      if (round >= 3) {
        setWins(nw); setLosses(nl);
        onDone?.(nw > nl ? 100 : nw === nl ? 60 : 30, { rounds_won: nw, rounds_lost: nl });
      } else {
        setWins(nw); setLosses(nl);
        setRound(round + 1);
      }
    }, 900);
  }

  return (
    <GameFrame title="Three Masks" onExit={onExit} material="bone" accent="#f0e6cf">
      <div className="masks-scene">
        <div className="masks-figure">
          <div className="masks-face" data-mask={reveal?.mask || 'hidden'}>
            {reveal ? reveal.mask.toUpperCase() : '???'}
          </div>
        </div>
        <div className="masks-picks">
          {RESPONSES.map((r) => (
            <button key={r} className="masks-btn" disabled={!!reveal} onClick={() => play(r)}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="tiny" style={{ textAlign: 'center', marginTop: 12 }}>
          Round {round}/3 · You {wins} — {losses} Them
          {reveal && ` · ${reveal.result}`}
        </p>
      </div>
    </GameFrame>
  );
}