import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { haptic } from '../lib/haptics.js';
import ForgottenRune from './ForgottenRune.jsx';

const GAMES = {
  rune_match: { name: 'Rune Match', engine: 'match3', timed: true },
  stone_stack: { name: 'Stone Stack', engine: 'stacker', timed: true },
  fireflies: { name: 'Fireflies', engine: 'catch', timed: true },
  ember_reflex: { name: 'Ember Reflex', engine: 'reaction', timed: false },
  rite_of_hands: { name: 'Rite of Hands', engine: 'choice', timed: false },
  three_masks: { name: 'Three Masks', engine: 'deduction', timed: false },
};

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// Single source of truth: turn any engine's raw payload into a 0–100 score so the
// player and the AI are always compared on the same scale.
export function normFromPayload(p = {}) {
  switch (p.archetype) {
    case 'match3': return clamp(Math.round((p.score || 0) / 5));
    case 'stacker': return clamp((p.height || 0) * 5 + (p.perfects || 0) * 5);
    case 'catch': return clamp((p.caught || 0) * 5);
    case 'reaction': {
      const t = p.times || [];
      const avg = t.length ? t.reduce((a, b) => a + b, 0) / t.length : 1000;
      return clamp(Math.round((600 - avg) / 4));
    }
    case 'choice': {
      const w = p.wins || 0, l = p.losses || 0;
      return Math.round((w * 100) / Math.max(1, w + l));
    }
    case 'deduction': {
      const w = p.rounds_won || 0, l = p.rounds_lost || 0;
      return Math.round((w * 100) / Math.max(1, w + l));
    }
    default: return 0;
  }
}

/* ---------------------------------------------------------------- Engines */

function Match3Game({ onDone, report }) {
  const [board, setBoard] = useState(() => {
    const b = [];
    for (let i = 0; i < 42; i++) b.push(Math.floor(Math.random() * 6));
    return b;
  });
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const RUNES = ['🔥', '🌙', '⚔️', '🦴', '💎', '🌿'];

  useEffect(() => { report(clamp(Math.round(score / 5))); }, [score]);

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
  }, [score]);

  return (
    <div style={{ padding: 16 }}>
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

function StackerGame({ onDone, report }) {
  const [height, setHeight] = useState(0);
  const [perfects, setPerfects] = useState(0);
  const [pos, setPos] = useState(0);
  const [dir, setDir] = useState(1);
  const [speed, setSpeed] = useState(3);

  useEffect(() => { report(clamp(height * 5 + perfects * 5)); }, [height, perfects]);

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
    if (accuracy > 90) { setPerfects((p) => p + 1); haptic('success'); }
    setHeight((h) => h + 1);
    setSpeed((s) => Math.min(10, s + 0.3));
  }

  useEffect(() => {
    const t = setTimeout(() => onDone({ height, perfects, archetype: 'stacker' }), 30000);
    return () => clearTimeout(t);
  }, [height, perfects]);

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
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

function CatchGame({ onDone, report }) {
  const [flies, setFlies] = useState(() =>
    Array.from({ length: 5 }, () => ({
      id: Math.random(), x: Math.random() * 100, y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5
    }))
  );
  const [caught, setCaught] = useState(0);

  useEffect(() => { report(clamp(caught * 5)); }, [caught]);

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
  }, [caught]);

  return (
    <div style={{ padding: 16 }}>
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

function ReactionGame({ onDone, report }) {
  const [phase, setPhase] = useState('idle');
  const [times, setTimes] = useState([]);
  const [round, setRound] = useState(0);
  const liveAt = useRef(0);
  const timer = useRef(0);

  useEffect(() => {
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 1000;
    report(times.length ? clamp(Math.round((600 - avg) / 4)) : 0);
  }, [times]);

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
    if (round >= 5) setTimeout(() => onDone({ times, archetype: 'reaction' }), 400);
  }, [round]);

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <div className="tiny" style={{ marginBottom: 10 }}>Round {round}/5 · avg {avg}ms</div>
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

// --- Cave-painting Rite of Hands (rock / paper / scissors) ---------------
// Hand-drawn ochre glyphs on a stone wall, matching the stone-age theme. Index
// order is fixed to the engine: 0 = rock (fist), 1 = paper (open palm),
// 2 = scissors (two-finger). Pure inline SVG — no scripts, no handlers.
const RPS_ART = [
  // 0 — ROCK: a closed fist / knuckles
  `<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <g fill="#b4532f" stroke="#7d3418" stroke-width="1.5">
      <rect x="16" y="28" width="32" height="24" rx="11"/>
      <rect x="18" y="23" width="7" height="12" rx="3.5"/>
      <rect x="27" y="21" width="7" height="14" rx="3.5"/>
      <rect x="36" y="23" width="7" height="12" rx="3.5"/>
      <path d="M15 36c-5 1-7 5-5 9" fill="none" stroke-width="5" stroke-linecap="round"/>
    </g>
    <path d="M22 40h20M22 45h20" stroke="#7d3418" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>
  </svg>`,
  // 1 — PAPER: open palm, five fingers
  `<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <g fill="#c9743a" stroke="#8a4a1f" stroke-width="1.5" stroke-linejoin="round">
      <ellipse cx="32" cy="42" rx="13" ry="13"/>
      <rect x="13" y="34" width="6" height="15" rx="3" transform="rotate(38 16 41)"/>
      <rect x="20" y="16" width="6" height="24" rx="3"/>
      <rect x="28" y="12" width="6" height="28" rx="3"/>
      <rect x="36" y="16" width="6" height="24" rx="3"/>
      <rect x="44" y="22" width="6" height="20" rx="3"/>
    </g>
  </svg>`,
  // 2 — SCISSORS: two extended fingers (a "V")
  `<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <g fill="#a84f8c" stroke="#6e2f5c" stroke-width="1.5" stroke-linejoin="round">
      <ellipse cx="32" cy="44" rx="12" ry="11"/>
      <rect x="22" y="12" width="7" height="30" rx="3.5" transform="rotate(-16 25 27)"/>
      <rect x="35" y="12" width="7" height="30" rx="3.5" transform="rotate(16 39 27)"/>
      <rect x="40" y="36" width="6" height="12" rx="3" transform="rotate(34 43 42)"/>
    </g>
  </svg>`,
];
const RPS_LABEL = ['Rock', 'Paper', 'Shards'];

function RpsHand({ idx, size = 56, dim = false }) {
  if (idx == null || idx < 0) {
    return (
      <span style={{
        width: size, height: size, display: 'grid', placeItems: 'center',
        fontSize: size * 0.5, color: 'var(--slate-300)', opacity: 0.6,
      }}>?</span>
    );
  }
  return (
    <span
      aria-label={RPS_LABEL[idx]}
      style={{ width: size, height: size, display: 'inline-block', opacity: dim ? 0.4 : 1 }}
      dangerouslySetInnerHTML={{ __html: RPS_ART[idx] }}
    />
  );
}

function ChoiceGame({ onDone, report }) {
  const [pw, setPw] = useState(0);
  const [bw, setBw] = useState(0);
  const [reveal, setReveal] = useState(null);
  // History of the PLAYER's own throws — shown to the player AND reported to the
  // server so the hidden Forgotten bot can learn this human's bias over time.
  const [history, setHistory] = useState([]);
  const playsRef = useRef([]);

  useEffect(() => { report(Math.round((pw * 100) / Math.max(1, pw + bw))); }, [pw, bw]);

  // Adaptive hidden opponent: looks at the player's recent throws, finds their
  // favourite, and mostly plays the counter to it — with enough randomness that
  // it never feels scripted. Falls back to random until it has seen a few plays.
  function botThrow(recent) {
    if (recent.length >= 2 && Math.random() < 0.6) {
      const counts = [0, 0, 0];
      for (const p of recent) if (p >= 0 && p < 3) counts[p]++;
      const fav = counts.indexOf(Math.max(...counts));
      // counter: beats rock(0)->paper(1), paper(1)->scissors(2), scissors(2)->rock(0)
      return (fav + 1) % 3;
    }
    return Math.floor(Math.random() * 3);
  }

  function play(idx) {
    if (reveal) return;
    haptic('select');
    const recent = playsRef.current.slice(-5);
    const bot = botThrow(recent);
    const nextPlays = [...playsRef.current, idx];
    playsRef.current = nextPlays;
    setReveal({ player: idx, bot });
    setHistory((h) => [...h, idx].slice(-5));
    let newPw = pw, newBw = bw;
    if (idx !== bot) {
      const wins = (idx === 0 && bot === 2) || (idx === 1 && bot === 0) || (idx === 2 && bot === 1);
      if (wins) newPw++; else newBw++;
    }
    setTimeout(() => {
      setReveal(null);
      setPw(newPw); setBw(newBw);
      if (newPw >= 3 || newBw >= 3 || (pw + bw + 1) >= 5) {
        // Report the PLAYER's throws as opponent_plays so the Forgotten learns.
        onDone({ wins: newPw, losses: newBw, archetype: 'choice', opponent_plays: nextPlays });
      }
    }, 800);
  }

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <div className="tiny" style={{ marginBottom: 6, opacity: 0.7 }}>Rite of Hands · best of 5</div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 16, minHeight: 24 }}>
        {history.length === 0
          ? <span className="tiny" style={{ opacity: 0.4 }}>your marks appear on the wall…</span>
          : history.map((h, i) => <RpsHand key={i} idx={h} size={22} dim />)}
      </div>
      <div style={{
        display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center',
        marginBottom: 22, minHeight: 84,
      }}>
        <RpsHand idx={reveal ? reveal.player : -1} size={80} />
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--slate-300)' }}>vs</span>
        <RpsHand idx={reveal ? reveal.bot : -1} size={80} />
      </div>
      <div className="tiny" style={{ marginBottom: 14 }}>
        You {pw} · {bw} Them
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        {[0, 1, 2].map((i) => (
          <button key={i} onClick={() => play(i)} disabled={!!reveal}
            aria-label={RPS_LABEL[i]}
            style={{
              width: 76, height: 76, borderRadius: 16, padding: 10,
              background: 'rgba(90,60,30,0.14)', border: '1px solid var(--glass-brd)',
              display: 'grid', placeItems: 'center', opacity: reveal ? 0.5 : 1,
            }}>
            <RpsHand idx={i} size={52} />
          </button>
        ))}
      </div>
    </div>
  );
}

function DeductionGame({ onDone, report }) {
  const [round, setRound] = useState(1);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [reveal, setReveal] = useState(null);
  const MASKS = ['war', 'trick', 'guard'];
  const RESPONSES = ['attack', 'wait', 'flee'];

  useEffect(() => { report(Math.round((wins * 100) / Math.max(1, wins + losses))); }, [wins, losses]);

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
      if (round >= 3) onDone({ rounds_won: nw, rounds_lost: nl, archetype: 'deduction' });
      else setRound(round + 1);
    }, 900);
  }

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <div className="tiny" style={{ marginBottom: 10 }}>Round {round}/3</div>
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

/* ------------------------------------------------------------- Scoreboard */

function VsScoreboard({ you, ai, aiName, forgotten, timed, endsIn }) {
  const total = Math.max(1, you + ai);
  const youPct = (you / total) * 100;
  const leading = you > ai ? 'you' : ai > you ? 'ai' : 'tie';
  return (
    <div className="glass card" style={{ margin: '0 16px 4px', padding: '12px 14px' }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div style={{ textAlign: 'left' }}>
          <div className="tiny" style={{ color: 'var(--ember-300)', fontWeight: 800, letterSpacing: '.08em' }}>YOU</div>
          <motion.b key={you} initial={{ scale: 1.25 }} animate={{ scale: 1 }}
            className="tabular" style={{ fontSize: 30, color: 'var(--ember-200)', display: 'block', lineHeight: 1 }}>
            {you}
          </motion.b>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span className="chip" style={{
            fontSize: 10,
            color: leading === 'you' ? 'var(--jade-300)' : leading === 'ai' ? '#ff9b9b' : 'var(--slate-300)'
          }}>
            {leading === 'you' ? 'LEADING' : leading === 'ai' ? 'BEHIND' : 'EVEN'}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="tiny" style={{ color: '#c9b0ff', fontWeight: 800, letterSpacing: '.08em' }}>
            {(aiName || 'AI').toUpperCase()}{forgotten && <ForgottenRune />}
          </div>
          <motion.b key={ai} initial={{ scale: 1.15 }} animate={{ scale: 1 }}
            className="tabular" style={{ fontSize: 30, color: '#c9b0ff', display: 'block', lineHeight: 1 }}>
            {ai}
          </motion.b>
        </div>
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: 'rgba(6,5,8,0.6)' }}>
        <motion.div animate={{ width: youPct + '%' }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          style={{ background: 'linear-gradient(90deg,#8f3402,#f7a259)' }} />
        <motion.div animate={{ width: (100 - youPct) + '%' }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          style={{ background: 'linear-gradient(90deg,#8b5cf6,#4c1d95)' }} />
      </div>
      {timed && (
        <div style={{ marginTop: 8, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <motion.div animate={{ width: Math.max(0, endsIn) + '%' }} transition={{ ease: 'linear', duration: 0.2 }}
            style={{ height: '100%', background: 'var(--ember-400)' }} />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Host */

export default function GameHost({ game, opponent, onDone, onExit, mode = 'duel' }) {
  const meta = GAMES[game] || { name: game, engine: 'reaction', timed: false };
  const Engine = ENGINES[meta.engine] || ReactionGame;
  const durationMs = meta.timed ? 30000 : (meta.engine === 'reaction' ? 18000 : 14000);

  // AI target reached this match (server-authoritative). Fallback keeps offline/
  // legacy flows playable.
  const target = Number.isFinite(Number(opponent?.target_score))
    ? Math.max(0, Math.min(100, Number(opponent.target_score)))
    : 45 + Math.round(Math.random() * 25);

  const [you, setYou] = useState(0);
  const [ai, setAi] = useState(0);
  const [timePct, setTimePct] = useState(100);
  const youRef = useRef(0);
  const report = (v) => { youRef.current = v; setYou(v); };

  // Animate the AI "ghost" toward its target so the player watches the race live.
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = t * t * (3 - 2 * t);
      if (t >= 1) {
        setAi(target);
        setTimePct(0);
        clearInterval(id);
        return;
      }
      const jitter = (Math.random() - 0.5) * 4;
      setAi(Math.max(0, Math.min(target, Math.round(eased * target + jitter))));
      if (meta.timed) setTimePct(Math.max(0, 100 - t * 100));
    }, 150);
    return () => clearInterval(id);
  }, []);

  function handleDone(payload) {
    const youFinal = normFromPayload(payload);
    setYou(youFinal);
    setAi(target);
    onDone({
      ...payload,
      score: youFinal,
      opponent_score: target,
      opponent_rating: opponent?.rank_rating
    });
  }

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
        <span className="chip" style={{ fontSize: 11 }}>{mode === 'war' ? 'War' : 'Ranked'}</span>
      </header>
      <VsScoreboard
        you={you} ai={ai}
        aiName={opponent?.name}
        forgotten={opponent?.forgotten}
        timed={meta.timed} endsIn={timePct}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Engine onDone={handleDone} report={report} />
      </div>
    </div>
  );
}
