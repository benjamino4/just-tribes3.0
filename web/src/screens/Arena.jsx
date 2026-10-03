import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { toast } from '../components/Toast.jsx';
import GameHost from '../components/GameHost.jsx';

const SEARCH_LINES = [
  'Reading the embers…',
  'Scanning the plains for rivals…',
  'Listening for distant war drums…',
  'Weighing your rank against the horde…',
  'Summoning a worthy challenger…',
];

function Searching({ onCancel }) {
  const [i, setI] = useState(0);
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setI((v) => (v + 1) % SEARCH_LINES.length), 1600);
    const b = setInterval(() => setDots((v) => (v + 1) % 4), 400);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  return (
    <motion.div className="col" style={{ gap: 18, alignItems: 'center', paddingTop: 48, textAlign: 'center' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mm-radar">
        <span className="mm-radar-sweep" />
        <span className="mm-radar-core">⚔️</span>
        <span className="mm-radar-ring r1" />
        <span className="mm-radar-ring r2" />
        <span className="mm-radar-ring r3" />
      </div>
      <div>
        <b style={{ fontSize: 17 }}>Finding a fight{'.'.repeat(dots)}</b>
        <AnimatePresence mode="wait">
          <motion.p key={i} className="tiny" style={{ marginTop: 8, minHeight: 18 }}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {SEARCH_LINES[i]}
          </motion.p>
        </AnimatePresence>
      </div>
      <p className="tiny" style={{ opacity: 0.6 }}>Matching in real time · up to 15s</p>
      <button className="btn ghost" style={{ marginTop: 4 }} onClick={onCancel}>Cancel</button>
    </motion.div>
  );
}

function Fighter({ side, name, rating, tier, delay }) {
  const dir = side === 'left' ? -1 : 1;
  return (
    <motion.div className="clash-fighter"
      initial={{ x: dir * 120, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 20, delay }}
      style={{ alignItems: side === 'left' ? 'flex-start' : 'flex-end' }}>
      <span className="clash-emoji" style={{ background: `radial-gradient(circle at 35% 25%, ${tier?.color_hex || '#f7a259'}, #5a3a12 72%)` }}>
        {tier?.emoji || (side === 'left' ? '🔥' : '💀')}
      </span>
      <b style={{ fontSize: 15, marginTop: 8 }}>{name}</b>
      <span className="tiny" style={{ color: tier?.color_hex || 'var(--slate-300)' }}>{tier?.title || 'Kin'}</span>
      <span className="chip" style={{ marginTop: 6 }}><b className="tabular">{rating}</b></span>
    </motion.div>
  );
}

function Clash({ me, opponent, onReady }) {
  const [count, setCount] = useState(null); // null -> VS phase, then 3,2,1,GO
  useEffect(() => {
    haptic('heavy');
    const t0 = setTimeout(() => setCount(3), 1100);
    return () => clearTimeout(t0);
  }, []);
  useEffect(() => {
    if (count == null) return;
    if (count <= 0) { const t = setTimeout(onReady, 500); return () => clearTimeout(t); }
    haptic('medium');
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <motion.div className="clash-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="clash-row">
        <Fighter side="left" name={me.name} rating={me.rating} tier={me.tier} delay={0.05} />
        <motion.div className="clash-vs"
          initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.5 }}>
          <span className="clash-spark" />VS
        </motion.div>
        <Fighter side="right" name={opponent.name} rating={opponent.rating} tier={opponent.tier} delay={0.15} />
      </div>
      <AnimatePresence mode="wait">
        {count != null && (
          <motion.div key={count} className="clash-count"
            initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
            {count > 0 ? count : 'GO!'}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Arena() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const user = data?.user || {};
  const [phase, setPhase] = useState('idle'); // idle | searching | clash | game
  const [match, setMatch] = useState(null);
  const [games, setGames] = useState([]);
  const cancelRef = useRef(false);

  useEffect(() => {
    Endpoints.games().then((r) => setGames((r.data || r).games || [])).catch(() => {});
  }, []);

  async function findRanked() {
    haptic('medium');
    cancelRef.current = false;
    setPhase('searching');
    try {
      const r = await Endpoints.arenaRankedFind();
      const body = r.data || r;
      if (cancelRef.current) return;
      setMatch({
        duel_id: body.duel_id,
        game: body.game,
        opponent: body.opponent,
        opponent_type: body.opponent_type,
      });
      setPhase('clash');
    } catch (e) {
      if (cancelRef.current) return;
      toast(e.message || 'Matchmaking failed', 'bad');
      setPhase('idle');
    }
  }

  function cancelSearch() {
    cancelRef.current = true;
    setPhase('idle');
  }

  async function onGameDone(payload) {
    if (!match) return;
    try {
      const r = await Endpoints.arenaRankedResolve(match.duel_id, payload);
      const body = r.data || r;
      toast(body.won ? 'Victory!' : 'Defeat', body.won ? 'good' : 'bad');
      reload();
    } catch (e) { toast(e.message || 'Resolve failed', 'bad'); }
    finally { setMatch(null); setPhase('idle'); }
  }

  if (phase === 'searching') return <Searching onCancel={cancelSearch} />;

  if (phase === 'clash' && match) {
    const myTier = user.rank_tier || {};
    const op = match.opponent || {};
    return (
      <Clash
        me={{ name: user.first_name || user.username || 'You', rating: user.rank_rating || 1000, tier: myTier }}
        opponent={{ name: op.name || 'Rival', rating: op.rank_rating || 1000, tier: op.forgotten ? { emoji: '💀', title: 'Forgotten', color_hex: '#8a7bbf' } : myTier }}
        onReady={() => setPhase('game')}
      />
    );
  }

  if (phase === 'game' && match) {
    return <GameHost game={match.game} opponent={match.opponent} onDone={onGameDone} onExit={() => { setMatch(null); setPhase('idle'); }} />;
  }

  return (
    <motion.div className="col" style={{ gap: 12 }}>
      <div className="row between">
        <h2 className="display" style={{ fontSize: 22 }}>Arena</h2>
        <span className="chip gold">
          {user.rank_tier?.emoji} {user.rank_tier?.title || 'Kin'}
        </span>
      </div>

      <div className="glass card">
        <b style={{ fontSize: 15 }}>Ranked duel</b>
        <p className="tiny" style={{ marginTop: 6 }}>
          Free matchmaking. The arena picks your game and rival — win to climb the ranks.
        </p>
        <button className="btn primary block" style={{ marginTop: 14 }} onClick={findRanked}>
          ⚔️ Find a fight
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn ghost block" onClick={() => nav('/arena/war')}>⚔️ War Room</button>
        <button className="btn ghost block" onClick={() => nav('/leaderboard')}>🏆 Leaderboard</button>
      </div>

      {games.length > 0 && (
        <>
          <div className="sec-h"><h3>Games</h3><span className="line" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {games.map((g) => (
              <div key={g.slug} className="glass card" style={{ padding: 12 }}>
                <b style={{ fontSize: 13 }}>{g.name}</b>
                <p className="tiny" style={{ marginTop: 4 }}>{g.description}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
