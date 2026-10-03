import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { haptic } from '../lib/haptics.js';
import ForgottenRune from './ForgottenRune.jsx';

const GAMES = {
  rune_match: { name: 'Rune Match', engine: 'match3' },
  stone_stack: { name: 'Stone Stack', engine: 'stacker' },
  fireflies: { name: 'Fireflies', engine: 'catch' },
  ember_reflex: { name: 'Ember Reflex', engine: 'reaction' },
  rite_of_hands: { name: 'Rite of Hands', engine: 'choice' },
  three_masks: { name: 'Three Masks', engine: 'deduction' },
};

function Match3Game({ onDone }) {
  const [board, setBoard] = useState(() => {
    const b = [];
    for (let i = 0; i < 42; i++) b.push(Math.floor(Math.random() * 6));
    return b;
  });
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const RUNES = ['🔥', '🌙', '⚔️', '🦴', '💎', '🌿'];

  function tap(i) {
    haptic('light');
    if (selected === null) { setSelected(i); return; }
    const diff = Math.abs(selected - i);
    if (diff === 1 || diff === 7) {
      const newBoard = [...board];
      [newBoard[selected], newBoard[i]] = [newBoard[i], newBoard[selected]];
      setBoard(newBoard);
      setTimeout(() => resolveMatches(newBoard), 200);
    }
    setSelected(null);
  }

  function resolveMatches(b) {
    const matches = new Set();
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const idx = r * 7 + c;
        if (c < 5 && b[idx] === b[idx + 1] && b[idx] === b[idx + 2]) {
          matches.add(idx); matches.add(idx + 1); matches.add(idx + 2);
        }
        if (r < 4 && b[idx] === b[idx + 7] && b[idx] === b[idx + 14]) {
          matches.add(idx); matches.add(idx + 7); matches.add(idx + 14);
        }
      }
    }
    if (matches.size > 0) {
      const newBoard = b.map((v, i) => matches.has(i) ? -1 : v);
      const gained = matches.size * 10;
      setScore((s) => s + gained);
      setTimeout(() => {
        const filled = newBoard.map((v) => v === -1 ? Math.floor(Math.random() * 6) : v);
        setBoard(filled);
      }, 300);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => onDone({ score, archetype: 'match3' }), 30000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="tiny">Best: —</span>
        <b className="tabular" style={{ fontSize: 24, color: 'var(--ember-300)' }}>{score}</b>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
        padding: 12, background: 'rgba(6,5,8,0.5)', borderRadius: 16
      }}>
        {board.map((v, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.9 }}
            onClick={() => tap(i)}
            style={{
              aspectRatio: '1', borderRadius: 10, fontSize: 22,
              background: selected === i ? 'rgba(212,111,44,0.3)' : 'rgba(255,243,208,0.05)',
              border: selected === i ? '2px solid var(--ember-400)' : '1px solid var(--glass-brd)',
              display: 'grid', placeItems: 'center'
            }}
          >
            {RUNES[v] || ''}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function StackerGame({ onDone }) {
  const [height, setHeight] = useState(0);
  const [perfects, setPerfects] = useState(0);
  const [pos, setPos] = useState(0);
  const [dir, setDir] = useState(1);
  const [speed, setSpeed] = useState(3);

  useEffect(() => {
    const iv = setInterval(() => {
      setPos((p) => {
        const next = p + dir * speed;
        if (next > 100 || next < 0) setDir((d) => -d);
        return Math.max(0, Math.min(100, next));
      });
    }, 16);
    return () => clearInterval(iv);
  }, [dir, speed]);

  function drop() {
    haptic('medium');
    const accuracy = 100 - Math.abs(pos - 50) * 2;
    if (accuracy > 90) {
      setPerfects((p) => p + 1);
      haptic('success');
    }
    setHeight((h) => h + 1);
    setSpeed((s) => Math.min(10, s + 0.3));
  }

  useEffect(() => {
    const t = setTimeout(() => onDone({ height, perfects, archetype: 'stacker' }), 30000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="tiny">Perfects: {perfects}</span>
        <b className="tabular" style={{ fontSize: 24, color: 'var(--ember-300)' }}>{height}</b>
      </div>
      <div style={{
        height: 300, background: 'rgba(6,5,8,0.5)', borderRadius: 16,
        position: 'relative', overflow: 'hidden'
      }}>
        {Array.from({ length: height }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', bottom: i * 14, left: 20, right: 20,
            height: 12, background: `linear-gradient(180deg, var(--slate-200), var(--slate-400))`,
            borderRadius: 4
          }} />
        ))}
        <div style={{
          position: 'absolute', bottom: height * 14, left: `${pos}%`,
          width: 60, height: 12, marginLeft: -30,
          background: 'linear-gradient(180deg, var(--ember-200), var(--ember-400))',
          borderRadius: 4, boxShadow: '0 0 20px var(--ember-400)'
        }} />
      </div>
      <button className="btn primary block" style={{ marginTop: 16 }} onClick={drop}>
        Drop Stone
      </button>
    </div>
  );
}

function CatchGame({ onDone }) {
  const [flies, setFlies] = useState(() =>
    Array.from({ length: 5 }, () => ({
      id: Math.random(), x: Math.random() * 100, y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5
    }))
  );
  const [caught, setCaught] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setFlies((fs) => fs.map((f) => ({
        ...f,
        x: Math.max(0, Math.min(100, f.x + f.vx)),
        y: Math.max(0, Math.min(100, f.y + f.vy)),
        vx: f.x <= 0 || f.x >= 100 ? -f.vx : f.vx,
        vy: f.y <= 0 || f.y >= 100 ? -f.vy : f.vy,
      })));
    }, 50);
    return () => clearInterval(iv);
  }, []);

  function tap(id) {
    haptic('light');
    setCaught((c) => c + 1);
    setFlies((fs) => fs.map((f) => f.id === id ? { ...f, x: Math.random() * 100, y: Math.random() * 100 } : f));
  }

  useEffect(() => {
    const t = setTimeout(() => onDone({ caught, missed: 0, archetype: 'catch' }), 30000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="tiny">Catch them all</span>
        <b className="tabular" style={{ fontSize: 24, color: 'var(--ember-300)' }}>{caught}</b>
      </div>
      <div style={{
        height: 340, background: 'radial-gradient(circle at 50% 100%, #1a2418, #05080d)',
        borderRadius: 16, position: 'relative', overflow: 'hidden'
      }}>
        {flies.map((f) => (
          <motion.button
            key={f.id}
            whileTap={{ scale: 0.8 }}
            onClick={() => tap(f.id)}
            style={{
              position: 'absolute', left: `${f.x}%`, top: `${f.y}%`,
              width: 30, height: 30, borderRadius: '50%',
              background: 'radial-gradient(circle, #ffe7c2, #d46f2c)',
              boxShadow: '0 0 20px #f7a259',
              transform: 'translate(-50%, -50%)'
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ReactionGame({ onDone }) {
  const [phase, setPhase] = useState('idle');
  const [times, setTimes] = useState([]);
  const [round, setRound] = useState(0);
  const liveAt = useRef(0);
  const timer = useRef(0);

  function start() {
    setPhase('wait');
    timer.current = setTimeout(() => {
      setPhase('live');
      liveAt.current = performance.now();
    }, 700 + Math.random() * 1500);
  }

  function tap() {
    if (phase === 'idle') { start(); return; }
    if (phase === 'wait') {
      clearTimeout(timer.current);
      setTimes((t) => [...t, 1000]);
      setRound((r) => r + 1);
      setPhase('idle');
      return;
    }
    if (phase === 'live') {
      const rt = performance.now() - liveAt.current;
      setTimes((t) => [...t, rt]);
      setRound((r) => r + 1);
      setPhase('idle');
    }
  }

  useEffect(() => {
    if (round >= 5) {
      setTimeout(() => onDone({ times, archetype: 'reaction' }), 400);
    }
  }, [round]);

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="tiny">Round {round}/5</span>
        <b className="tabular" style={{ fontSize: 24, color: 'var(--ember-300)' }}>{avg}ms</b>
      </div>
      <button
        onClick={tap}
        style={{
          width: '100%', height: 300, borderRadius: 16,
          background: phase === 'live'
            ? 'radial-gradient(circle, #f7a259, #d46f2c)'
            : phase === 'wait' ? 'radial-gradient(circle, #5a6675, #3a4452)'
            : 'radial-gradient(circle, #262c38, #0f141c)',
          border: '2px solid var(--glass-brd)',
          color: '#fff', fontSize: 24, fontWeight: 800,
          boxShadow: phase === 'live' ? '0 0 40px var(--ember-400)' : 'none'
        }}
      >
        {phase === 'idle' ? (round === 0 ? 'TAP TO START' : 'READY…') :
         phase === 'wait' ? 'WAIT…' : 'STRIKE!'}
      </button>
    </div>
  );
}

function ChoiceGame({ onDone }) {
  const [pw, setPw] = useState(0);
  const [bw, setBw] = useState(0);
  const [reveal, setReveal] = useState(null);
  const [history, setHistory] = useState([]);
  const THROWS = ['✊', '✋', '✌️'];

  function play(idx) {
    if (reveal) return;
    haptic('select');
    const bot = Math.floor(Math.random() * 3);
    setReveal({ player: idx, bot });
    setHistory((h) => [...h, bot].slice(-5));
    let newPw = pw, newBw = bw;
    if (idx !== bot) {
      const wins = (idx === 0 && bot === 2) || (idx === 1 && bot === 0) || (idx === 2 && bot === 1);
      if (wins) newPw++; else newBw++;
    }
    setTimeout(() => {
      setReveal(null);
      setPw(newPw); setBw(newBw);
      if (newPw >= 3 || newBw >= 3 || (pw + bw + 1) >= 5) {
        onDone({ wins: newPw, losses: newBw, archetype: 'choice', opponent_plays: history });
      }
    }, 800);
  }

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="tiny">You {pw}</span>
        <b className="tabular" style={{ fontSize: 24 }}>vs</b>
        <span className="tiny">{bw} Them</span>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20, opacity: 0.5 }}>
        {history.map((h, i) => <span key={i} style={{ fontSize: 18 }}>{THROWS[h]}</span>)}
      </div>
      <div style={{ fontSize: 64, marginBottom: 20 }}>
        {reveal ? `${THROWS[reveal.player]} vs ${THROWS[reveal.bot]}` : '? vs ?'}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        {THROWS.map((t, i) => (
          <button key={i} onClick={() => play(i)} disabled={!!reveal}
            style={{
              width: 72, height: 72, borderRadius: 16, fontSize: 32,
              background: 'rgba(255,243,208,0.05)', border: '1px solid var(--glass-brd)'
            }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function DeductionGame({ onDone }) {
  const [round, setRound] = useState(1);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [reveal, setReveal] = useState(null);
  const MASKS = ['war', 'trick', 'guard'];
  const RESPONSES = ['attack', 'wait', 'flee'];

  function resolve(mask, response) {
    if (mask === 'war') return response === 'attack' ? 'win' : response === 'wait' ? 'lose' : 'tie';
    if (mask === 'trick') return response === 'attack' ? 'lose' : response === 'wait' ? 'tie' : 'win';
    return response === 'attack' ? 'tie' : response === 'wait' ? 'win' : 'lose';
  }

  function play(response) {
    if (reveal || round > 3) return;
    haptic('select');
    const mask = MASKS[Math.floor(Math.random() * 3)];
    const result = resolve(mask, response);
    setReveal({ mask, response, result });
    let nw = wins, nl = losses;
    if (result === 'win') nw++; else if (result === 'lose') nl++;
    setTimeout(() => {
      setReveal(null);
      setWins(nw); setLosses(nl);
      if (round >= 3) {
        onDone({ rounds_won: nw, rounds_lost: nl, archetype: 'deduction' });
      } else {
        setRound(round + 1);
      }
    }, 900);
  }

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="tiny">Round {round}/3</span>
        <b>You {wins} — {losses} Them</b>
      </div>
      <div style={{
        width: 140, height: 180, margin: '20px auto',
        background: 'linear-gradient(180deg, #1a1010, #0a0608)',
        borderRadius: '40% 40% 20% 20%',
        display: 'grid', placeItems: 'center',
        border: '1px solid var(--glass-brd)',
        fontSize: 20, fontWeight: 800, letterSpacing: '.1em',
        color: reveal ? 'var(--ember-200)' : 'var(--slate-300)'
      }}>
        {reveal ? reveal.mask.toUpperCase() : '???'}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {RESPONSES.map((r) => (
          <button key={r} onClick={() => play(r)} disabled={!!reveal}
            className="btn ghost" style={{ padding: '12px 18px' }}>
            {r.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

const ENGINES = {
  match3: Match3Game,
  stacker: StackerGame,
  catch: CatchGame,
  reaction: ReactionGame,
  choice: ChoiceGame,
  deduction: DeductionGame,
};

export default function GameHost({ game, opponent, onDone, onExit, mode = 'duel' }) {
  const meta = GAMES[game] || { name: game, engine: 'reaction' };
  const Engine = ENGINES[meta.engine] || ReactionGame;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'radial-gradient(circle at 50% 40%, #1a0d06 0%, #060508 70%)',
      display: 'flex', flexDirection: 'column'
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(var(--safe-top) + 14px) 20px 10px'
      }}>
        <button onClick={onExit} style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(15,20,28,0.82)', border: '1px solid var(--glass-brd)',
          color: 'var(--slate-100)'
        }}>←</button>
        <h1 className="display" style={{ fontSize: 18 }}>{meta.name}</h1>
        <span className="chip" style={{ fontSize: 11 }}>
          {opponent?.name || 'Opponent'}
          {opponent?.forgotten && <ForgottenRune />}
        </span>
      </header>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Engine onDone={onDone} />
      </div>
    </div>
  );
}