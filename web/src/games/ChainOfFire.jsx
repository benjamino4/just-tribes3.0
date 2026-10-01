import { useState } from 'react';
import GameFrame from '../components/GameFrame.jsx';
import Emoji from '../components/Emoji.jsx';
import { haptic } from '../lib/haptics.js';

const SHAPES = ['dom-fire', 'dom-sun', 'dom-moon', 'dom-bone', 'dom-ash'];

export default function ChainOfFire({ onDone, onExit }) {
  const [chain, setChain] = useState([SHAPES[Math.floor(Math.random() * SHAPES.length)]]);
  const [done, setDone] = useState(false);

  function add(shape) {
    if (done) return;
    haptic('select');
    const last = chain[chain.length - 1];
    const legal = shape !== last || Math.random() < 0.3;
    if (legal) {
      const next = [...chain, shape];
      setChain(next);
      const oppLegal = Math.random() < 0.7;
      if (!oppLegal) {
        setDone(true);
        setTimeout(() => onDone?.(100, { chain_len: next.length, won: true }), 600);
      }
    } else {
      setDone(true);
      setTimeout(() => onDone?.(Math.min(80, chain.length * 8), { chain_len: chain.length, won: false }), 600);
    }
  }

  return (
    <GameFrame title="Chain of Fire" onExit={onExit} material="ember">
      <div className="chain-scene">
        <div className="chain-line">
          {chain.map((s, i) => (
            <span key={i} className="chain-torch"><Emoji name={s} size={26} /></span>
          ))}
        </div>
        <div className="chain-actions">
          {SHAPES.map((s) => (
            <button key={s} className="chain-btn" onClick={() => add(s)}>
              <Emoji name={s} size={32} />
            </button>
          ))}
        </div>
        <p className="tiny" style={{ textAlign: 'center', marginTop: 12 }}>
          Add a torch that connects. If you cannot move, you lose.
        </p>
      </div>
    </GameFrame>
  );
}