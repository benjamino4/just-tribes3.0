import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '../lib/haptics.js';
import { Endpoints, measurePing } from '../lib/api.js';
import { toast } from './Toast.jsx';
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
    <div className="game-pad">
      <div className="game-hint" style={{ marginBottom: 10 }}>Swap neighbours — line up 3 runes</div>
      <div className="game-stage m3-grid">
        {board.map((v, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.9 }}
            onClick={() => tap(i)}
            className={'m3-tile' + (selected === i ? ' sel' : '')}
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
    <div className="game-pad" style={{ textAlign: 'center' }}>
      <div className="game-hint" style={{ marginBottom: 10 }}>Tap to drop — land it dead-centre for a perfect</div>
      <div className="game-stage stk-stage">
        <div className="stk-floor" />
        {Array.from({ length: height }).map((_, i) => (
          <div key={i} className="stk-block" style={{ bottom: 22 + i * 14 }} />
        ))}
        <div className="stk-mover" style={{ bottom: 22 + height * 14, left: `${pos}%` }} />
      </div>
      <button className="game-cta" onClick={drop}>Drop Stone</button>
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
    <div className="game-pad">
      <div className="game-hint" style={{ marginBottom: 10 }}>Tap the drifting fireflies before they scatter</div>
      <div className="game-stage fly-stage">
        {flies.map((f) => (
          <motion.button
            key={f.id}
            whileTap={{ scale: 0.8 }}
            onClick={() => tap(f.id)}
            className="fly"
            style={{ left: `${f.x}%`, top: `${f.y}%` }}
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

  const padClass = phase === 'live' ? 'live' : phase === 'wait' ? 'wait' : 'idle';
  return (
    <div className="game-pad" style={{ textAlign: 'center' }}>
      <div className="game-hint" style={{ marginBottom: 10 }}>Round {round}/5 · avg {avg}ms — strike the instant it glows</div>
      <button onClick={tap} className={'rx-pad ' + padClass}>
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

function ChoiceGame({ onDone, report, moveSec = 10 }) {
  const [pw, setPw] = useState(0);
  const [bw, setBw] = useState(0);
  const [phase, setPhase] = useState('choose'); // choose | shoot | reveal
  const [pending, setPending] = useState(null);  // { player, bot, result, timedOut }
  const [picked, setPicked] = useState(null);
  const [history, setHistory] = useState([]);
  const [timeLeft, setTimeLeft] = useState(moveSec);
  const playsRef = useRef([]);
  const roundRef = useRef(0);
  const lockRef = useRef(false);

  useEffect(() => { report(Math.round((pw * 100) / Math.max(1, pw + bw))); }, [pw, bw]);

  // Adaptive hidden opponent: finds the player's favourite recent throw and
  // mostly plays its counter, with enough randomness to never feel scripted.
  function botThrow(recent) {
    if (recent.length >= 2 && Math.random() < 0.6) {
      const counts = [0, 0, 0];
      for (const p of recent) if (p >= 0 && p < 3) counts[p]++;
      const fav = counts.indexOf(Math.max(...counts));
      return (fav + 1) % 3;
    }
    return Math.floor(Math.random() * 3);
  }

  // Per-throw decision countdown. Both players race the SAME clock; if it runs
  // out we auto-throw a random hand so the match never stalls.
  useEffect(() => {
    if (phase !== 'choose') return;
    setTimeLeft(moveSec);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const left = moveSec - (Date.now() - t0) / 1000;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) { clearInterval(iv); commit(Math.floor(Math.random() * 3), true); }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function commit(idx, timedOut = false) {
    if (lockRef.current) return;
    lockRef.current = true;
    haptic(timedOut ? 'warning' : 'select');
    const recent = playsRef.current.slice(-5);
    const bot = botThrow(recent);
    const nextPlays = [...playsRef.current, idx];
    playsRef.current = nextPlays;
    setPicked(idx);
    const wins = idx !== bot && ((idx === 0 && bot === 2) || (idx === 1 && bot === 0) || (idx === 2 && bot === 1));
    const result = idx === bot ? 'tie' : wins ? 'win' : 'lose';
    setPending({ player: idx, bot, result, timedOut });
    setPhase('shoot');
    // "Rock — Paper — Scissors — SHOOT!" the hands shake, then release.
    setTimeout(() => haptic('medium'), 0);
    setTimeout(() => haptic('medium'), 300);
    setTimeout(() => haptic('medium'), 600);
    setTimeout(() => {
      setPhase('reveal');
      haptic(result === 'win' ? 'success' : result === 'lose' ? 'warning' : 'light');
      setHistory((h) => [...h, idx].slice(-5));
      const newPw = pw + (result === 'win' ? 1 : 0);
      const newBw = bw + (result === 'lose' ? 1 : 0);
      setTimeout(() => {
        setPw(newPw); setBw(newBw);
        roundRef.current += 1;
        if (newPw >= 3 || newBw >= 3 || roundRef.current >= 5) {
          onDone({ wins: newPw, losses: newBw, archetype: 'choice', opponent_plays: nextPlays });
        } else {
          setPending(null); setPicked(null); lockRef.current = false; setPhase('choose');
        }
      }, 1150);
    }, 1050);
  }

  const shaking = phase === 'shoot';
  const chant = ['ROCK', 'PAPER', 'SCISSORS', 'SHOOT!'];
  const leftIdx = phase === 'reveal' ? pending?.player : (shaking ? 0 : (picked ?? -1));
  const rightIdx = phase === 'reveal' ? pending?.bot : (shaking ? 0 : -1);
  const timePct = Math.max(0, Math.min(100, (timeLeft / moveSec) * 100));
  const urgent = phase === 'choose' && timeLeft <= 3;

  return (
    <div className="game-pad rps-stage" style={{ textAlign: 'center' }}>
      <div className="game-hint" style={{ marginBottom: 6 }}>Rite of Hands · best of 5</div>
      <div className="rps-history">
        {history.length === 0
          ? <span className="tiny" style={{ opacity: 0.4 }}>your marks appear on the wall…</span>
          : history.map((h, i) => <RpsHand key={i} idx={h} size={22} dim />)}
      </div>

      <div className="rps-timer" aria-hidden={phase !== 'choose'}>
        <div className={'rps-timer-bar' + (urgent ? ' urgent' : '')} style={{ opacity: phase === 'choose' ? 1 : 0.25 }}>
          <motion.span animate={{ width: timePct + '%' }} transition={{ ease: 'linear', duration: 0.12 }} />
        </div>
        <span className={'rps-timer-num' + (urgent ? ' urgent' : '')}>
          {phase === 'choose' ? Math.ceil(timeLeft) + 's' : '—'}
        </span>
      </div>

      <div className="rps-vs">
        <motion.span className="rps-slot"
          animate={shaking ? { y: [0, -16, 0, -16, 0, -16, 0], rotate: [0, -6, 0, -6, 0, -4, 0] } : { y: 0, rotate: 0 }}
          transition={shaking ? { duration: 1.0, times: [0, .14, .28, .42, .56, .78, 1] } : { type: 'spring', stiffness: 300, damping: 18 }}>
          <RpsHand idx={leftIdx} size={64} />
        </motion.span>
        <span className="rps-mid">
          <AnimatePresence mode="wait">
            {phase === 'reveal'
              ? <motion.b key="r" className={'rps-result ' + pending?.result}
                  initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                  {pending?.result === 'win' ? 'WIN' : pending?.result === 'lose' ? 'LOSE' : 'TIE'}
                </motion.b>
              : <span key="vs" style={{ fontSize: 20, fontWeight: 800, color: 'var(--slate-300)' }}>vs</span>}
          </AnimatePresence>
        </span>
        <motion.span className="rps-slot"
          animate={shaking ? { y: [0, -16, 0, -16, 0, -16, 0], rotate: [0, 6, 0, 6, 0, 4, 0] } : { y: 0, rotate: 0 }}
          transition={shaking ? { duration: 1.0, times: [0, .14, .28, .42, .56, .78, 1] } : { type: 'spring', stiffness: 300, damping: 18 }}>
          <RpsHand idx={rightIdx} size={64} />
        </motion.span>
      </div>

      {shaking && (
        <AnimatePresence mode="wait">
          <motion.div key={Math.min(3, Math.floor((1 - 0) * 3))} className="rps-chant"
            initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            {chant[3]}
          </motion.div>
        </AnimatePresence>
      )}

      <div className="tiny" style={{ margin: '12px 0 10px' }}>You {pw} · {bw} Them</div>
      <div className="rps-choices">
        {[0, 1, 2].map((i) => (
          <button key={i} onClick={() => commit(i)} disabled={phase !== 'choose'}
            aria-label={RPS_LABEL[i]}
            className={'rps-btn' + (picked === i && phase !== 'choose' ? ' chosen' : '')}
            style={{ opacity: phase !== 'choose' ? 0.4 : 1 }}>
            <RpsHand idx={i} size={52} />
          </button>
        ))}
      </div>
    </div>
  );
}

function DeductionGame({ onDone, report, moveSec = 10 }) {
  const [round, setRound] = useState(1);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [reveal, setReveal] = useState(null);
  const [timeLeft, setTimeLeft] = useState(moveSec);
  const lockRef = useRef(false);
  const MASKS = ['war', 'trick', 'guard'];
  const RESPONSES = ['attack', 'wait', 'flee'];

  useEffect(() => { report(Math.round((wins * 100) / Math.max(1, wins + losses))); }, [wins, losses]);

  // Per-round decision clock, visible to both sides; auto-moves on timeout.
  useEffect(() => {
    if (reveal) return;
    setTimeLeft(moveSec);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const left = moveSec - (Date.now() - t0) / 1000;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) { clearInterval(iv); play(RESPONSES[Math.floor(Math.random() * 3)], true); }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, reveal]);

  function resolve(mask, response) {
    if (mask === 'war') return response === 'attack' ? 'win' : response === 'wait' ? 'lose' : 'tie';
    if (mask === 'trick') return response === 'attack' ? 'lose' : response === 'wait' ? 'tie' : 'win';
    return response === 'attack' ? 'tie' : response === 'wait' ? 'win' : 'lose';
  }

  function play(response, timedOut = false) {
    if (lockRef.current || reveal || round > 3) return;
    lockRef.current = true;
    haptic(timedOut ? 'warning' : 'select');
    const mask = MASKS[Math.floor(Math.random() * 3)];
    const result = resolve(mask, response);
    setReveal({ mask, response, result });
    let nw = wins, nl = losses;
    if (result === 'win') nw++; else if (result === 'lose') nl++;
    setTimeout(() => {
      setWins(nw); setLosses(nl);
      if (round >= 3) onDone({ rounds_won: nw, rounds_lost: nl, archetype: 'deduction' });
      else { setRound(round + 1); setReveal(null); lockRef.current = false; }
    }, 950);
  }

  const timePct = Math.max(0, Math.min(100, (timeLeft / moveSec) * 100));
  const urgent = !reveal && timeLeft <= 3;

  return (
    <div className="game-pad mask-stage">
      <div className="game-hint" style={{ marginBottom: 10 }}>Round {round}/3 — read the mask, choose your move</div>
      <div className="rps-timer" style={{ maxWidth: 260, margin: '0 auto 14px' }}>
        <div className={'rps-timer-bar' + (urgent ? ' urgent' : '')} style={{ opacity: reveal ? 0.25 : 1 }}>
          <motion.span animate={{ width: timePct + '%' }} transition={{ ease: 'linear', duration: 0.12 }} />
        </div>
        <span className={'rps-timer-num' + (urgent ? ' urgent' : '')}>{reveal ? '—' : Math.ceil(timeLeft) + 's'}</span>
      </div>
      <motion.div className={'mask-face' + (reveal ? ' reveal ' + reveal.result : '')}
        animate={reveal ? { scale: [0.9, 1.08, 1], rotate: [0, -3, 0] } : { scale: 1 }}
        transition={{ duration: 0.5 }}>
        {reveal ? reveal.mask.toUpperCase() : '???'}
      </motion.div>
      <div className="mask-choices">
        {RESPONSES.map((r) => (
          <button key={r} onClick={() => play(r)} disabled={!!reveal}
            className="btn ghost" style={{ padding: '12px 18px', opacity: reveal ? 0.4 : 1 }}>
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

function PingChip({ ping }) {
  const ok = ping != null;
  const good = ok && ping < 90;
  const mid = ok && ping >= 90 && ping < 200;
  const color = !ok ? '#ff9b9b' : good ? 'var(--jade-300)' : mid ? '#f7c948' : '#ff9b9b';
  const bars = !ok ? 0 : good ? 3 : mid ? 2 : 1;
  return (
    <span className="ping-chip" title="network round-trip">
      <span className="ping-bars" aria-hidden>
        {[0, 1, 2].map((i) => (
          <i key={i} style={{ height: 4 + i * 4, background: i < bars ? color : 'rgba(255,255,255,0.18)' }} />
        ))}
      </span>
      <span style={{ color, fontWeight: 700 }}>{ok ? ping + 'ms' : 'offline'}</span>
    </span>
  );
}

function VsScoreboard({ you, ai, aiName, forgotten, timed, endsIn, isBot, oppPresent, ping, matchLeft }) {
  const total = Math.max(1, you + ai);
  const youPct = (you / total) * 100;
  const leading = you > ai ? 'you' : ai > you ? 'ai' : 'tie';
  return (
    <div className="glass card" style={{ margin: '0 16px 4px', padding: '12px 14px' }}>
      {!isBot && (
        <div className="row between" style={{ marginBottom: 8 }}>
          <PingChip ping={ping} />
          {matchLeft != null && (
            <span className="match-clock" style={{ color: matchLeft <= 10 ? '#ff9b9b' : 'var(--slate-300)' }}>
              ⏱ {Math.max(0, Math.ceil(matchLeft))}s
            </span>
          )}
          <span className="presence" style={{ color: oppPresent ? 'var(--jade-300)' : '#ff9b9b' }}>
            <span className={'presence-dot' + (oppPresent ? ' live' : '')} />
            {oppPresent ? 'live' : 'reconnecting…'}
          </span>
        </div>
      )}
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

export default function GameHost({ game, opponent, duelId, onDone, onForfeit, onExit, mode = 'duel' }) {
  const meta = GAMES[game] || { name: game, engine: 'reaction', timed: false };
  const Engine = ENGINES[meta.engine] || ReactionGame;
  const durationMs = meta.timed ? 30000 : (meta.engine === 'reaction' ? 18000 : 14000);

  // Only ghost-animate the AI toward a target when the opponent is actually a
  // hidden bot (a "Forgotten"), or when we have no live duel to track (offline /
  // legacy). For real human-vs-human we DRIVE the opponent bar from the live
  // heart-beat only — no scripted bot interference.
  const isBot = !!opponent?.forgotten || !duelId;
  const MATCH_TIMEOUT_MS = 75000; // mirrors server arena_match_timeout_sec
  const MOVE_SEC = 10;            // mirrors server arena_move_timer_sec

  const target = Number.isFinite(Number(opponent?.target_score))
    ? Math.max(0, Math.min(100, Number(opponent.target_score)))
    : 45 + Math.round(Math.random() * 25);

  const [you, setYou] = useState(0);
  const [ai, setAi] = useState(0);
  const [timePct, setTimePct] = useState(100);
  const [oppPresent, setOppPresent] = useState(true);
  const [ping, setPing] = useState(null);
  const [matchLeft, setMatchLeft] = useState(MATCH_TIMEOUT_MS / 1000);
  const youRef = useRef(0);
  const doneRef = useRef(false);
  const report = (v) => { youRef.current = v; setYou(v); };

  // --- Bot ghost: smooth race toward the server target (bots only) ---
  useEffect(() => {
    if (!isBot) return;
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = t * t * (3 - 2 * t);
      if (t >= 1) { setAi(target); setTimePct(0); clearInterval(id); return; }
      const jitter = (Math.random() - 0.5) * 4;
      setAi(Math.max(0, Math.min(target, Math.round(eased * target + jitter))));
      if (meta.timed) setTimePct(Math.max(0, 100 - t * 100));
    }, 150);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Live heart-beat for REAL human matches ---
  // Reports my live score and reads the opponent's real score + presence. If the
  // opponent abandons mid-game the server flags a forfeit and we win instantly.
  useEffect(() => {
    if (isBot) return;
    let cancelled = false;
    async function beat() {
      if (cancelled || doneRef.current) return;
      try {
        const r = await Endpoints.arenaLive(duelId, youRef.current);
        const d = r.data || r;
        if (cancelled || doneRef.current) return;
        if (typeof d.opponent_score === 'number') setAi(Math.round(d.opponent_score));
        setOppPresent(!!d.opponent_present);
        if (d.opponent_forfeited || (d.opponent_finished && d.opponent_present === false && d.opponent_forfeited)) {
          doneRef.current = true;
          toast('Opponent left — you win!', 'good');
          handleDone({ archetype: meta.engine, forfeit_win: true });
        }
      } catch { /* transient network error; keep trying */ }
    }
    beat();
    const id = setInterval(beat, 1800);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Real network ping (human matches only) ---
  useEffect(() => {
    if (isBot) return;
    let cancelled = false;
    async function tick() {
      const p = await measurePing();
      if (!cancelled) setPing(p);
    }
    tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Overall match deadline: if MY clock runs out first, I forfeit ---
  useEffect(() => {
    if (isBot) return;
    const start = Date.now();
    const id = setInterval(() => {
      const left = MATCH_TIMEOUT_MS / 1000 - (Date.now() - start) / 1000;
      setMatchLeft(Math.max(0, left));
      if (left <= 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(id);
        toast('Time exhausted — forfeit', 'bad');
        onForfeit && onForfeit('timeout');
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDone(payload) {
    if (doneRef.current && !payload.forfeit_win) return;
    doneRef.current = true;
    const youFinal = payload.forfeit_win ? Math.max(youRef.current, 1) : normFromPayload(payload);
    setYou(youFinal);
    if (isBot) setAi(target);
    onDone({
      ...payload,
      score: youFinal,
      opponent_score: isBot ? target : ai,
      opponent_rating: opponent?.rank_rating
    });
  }

  return (
    <div className="game-screen">
      <header className="game-head">
        <button onClick={onExit} className="game-back">←</button>
        <h1 className="display">{meta.name}</h1>
        <span className="chip" style={{ fontSize: 11 }}>{mode === 'war' ? 'War' : mode === 'friendly' ? 'Friendly' : 'Ranked'}</span>
      </header>
      <VsScoreboard
        you={you} ai={ai}
        aiName={opponent?.name}
        forgotten={opponent?.forgotten}
        timed={meta.timed} endsIn={timePct}
        isBot={isBot} oppPresent={oppPresent} ping={ping} matchLeft={isBot ? null : matchLeft}
      />
      <div className="game-body">
        <Engine onDone={handleDone} report={report} moveSec={MOVE_SEC} />
      </div>
    </div>
  );
}
