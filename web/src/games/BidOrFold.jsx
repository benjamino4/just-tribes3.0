// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/BidOrFold.jsx
// PURPOSE: Both bid 0-3 coins. Higher bid wins the pot. Push luck.
// DEPENDS ON: GameFrame, haptics
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';

export default function BidOrFold({ onDone, onExit }) {
  const [myCoins, setMyCoins] = useState(3);
  const [oppCoins, setOppCoins] = useState(3);
  const [pot, setPot] = useState(0);
  const [lastBid, setLastBid] = useState(null);
  const [done, setDone] = useState(false);

  function bid(n) {
    if (done || n > myCoins) return;
    haptic('select');
    const opp = Math.floor(Math.random() * (oppCoins + 1));
    const playerWins = n > opp;
    let newMy = myCoins, newOpp = oppCoins, newPot = pot;
    if (playerWins) { newMy -= n; newPot += n + opp; }
    else { newOpp -= opp; newPot += n + opp; }
    setMyCoins(newMy); setOppCoins(newOpp); setPot(newPot);
    setLastBid({ player: n, opp, playerWins });
    if (newPot >= 5) {
      setDone(true);
      setTimeout(() => onDone?.(playerWins ? 100 : 30, { wins: playerWins ? 3 : 1, losses: playerWins ? 1 : 3 }), 600);
    }
    setTimeout(() => setLastBid(null), 800);
  }

  return (
    <GameFrame title="Bid or Fold" onExit={onExit} material="clay" accent="#c08a4a">
      <div className="bid-scene">
        <div className="bid-bowl">
          <span className="bid-pot">{pot}</span>
        </div>
        {lastBid && (
          <div className="bid-reveal">
            You bid {lastBid.player} · They bid {lastBid.opp}
          </div>
        )}
        <div className="bid-row">
          <div className="col center"><span className="tiny">You</span><b style={{ fontSize: 24 }}>{myCoins}</b></div>
          <div className="col center"><span className="tiny">Them</span><b style={{ fontSize: 24 }}>{oppCoins}</b></div>
        </div>
        <div className="bid-actions">
          {[0, 1, 2, 3].map((n) => (
            <button key={n} className="bid-btn" disabled={n > myCoins || done} onClick={() => bid(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="tiny" style={{ textAlign: 'center', marginTop: 12 }}>Bid more than them or fold. First to 5 in the pot.</p>
      </div>
    </GameFrame>
  );
}