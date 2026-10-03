import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { toast } from '../components/Toast.jsx';
import { shareInvite, startParam } from '../lib/telegram.js';
import GameHost from '../components/GameHost.jsx';
import ResultScreen from '../components/ResultScreen.jsx';

const SEARCH_LINES = [
  'Reading the embers…',
  'Scanning the plains for rivals…',
  'Listening for distant war drums…',
  'Weighing your rank against the horde…',
  'Summoning a worthy challenger…',
];

function Searching({ label, waited, botAt, onCancel }) {
  const [i, setI] = useState(0);
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setI((v) => (v + 1) % SEARCH_LINES.length), 1600);
    const b = setInterval(() => setDots((v) => (v + 1) % 4), 400);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  const nearBot = botAt && waited >= botAt - 8;
  return (
    <motion.div className="col" style={{ gap: 18, alignItems: 'center', paddingTop: 40, textAlign: 'center' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mm-radar">
        <span className="mm-radar-sweep" />
        <span className="mm-radar-core">⚔️</span>
        <span className="mm-radar-ring r1" />
        <span className="mm-radar-ring r2" />
        <span className="mm-radar-ring r3" />
      </div>
      <div>
        <b style={{ fontSize: 17 }}>{label || 'Finding a fight'}{'.'.repeat(dots)}</b>
        <AnimatePresence mode="wait">
          <motion.p key={i} className="tiny" style={{ marginTop: 8, minHeight: 18 }}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {nearBot ? 'No kin nearby — waking a Forgotten One…' : SEARCH_LINES[i]}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mm-wait">
        <span className="kiva-live"><span className="kiva-live-dot" /> live</span>
        <span className="tiny tabular" style={{ opacity: 0.7 }}>searching {waited}s</span>
      </div>
      {botAt > 0 && (
        <div className="mm-bar"><motion.span animate={{ width: Math.min(100, (waited / botAt) * 100) + '%' }} transition={{ ease: 'linear', duration: 0.4 }} /></div>
      )}
      <button className="btn ghost" style={{ marginTop: 2 }} onClick={onCancel}>Cancel</button>
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
  const [count, setCount] = useState(null);
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

function FriendlyWait({ code, onCancel }) {
  return (
    <motion.div className="col" style={{ gap: 16, alignItems: 'center', paddingTop: 36, textAlign: 'center' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mm-radar"><span className="mm-radar-sweep" /><span className="mm-radar-core">🤝</span>
        <span className="mm-radar-ring r1" /><span className="mm-radar-ring r2" /></div>
      <b style={{ fontSize: 17 }}>Waiting for your friend…</b>
      <div className="friendly-code">{code}</div>
      <p className="tiny" style={{ opacity: 0.7, maxWidth: 260 }}>Share this code or the invite link. The match starts the moment they join.</p>
      <div className="row" style={{ gap: 10 }}>
        <button className="btn primary" onClick={() => shareInvite(code)}>📤 Share invite</button>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </motion.div>
  );
}

export default function Arena() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const user = data?.user || {};
  const [phase, setPhase] = useState('idle'); // idle|searching|friendly_wait|clash|game|result
  const [match, setMatch] = useState(null);
  const [result, setResult] = useState(null);
  const [games, setGames] = useState([]);
  const [waited, setWaited] = useState(0);
  const [botAt, setBotAt] = useState(45);
  const [friendCode, setFriendCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const pollRef = useRef(null);
  const stopRef = useRef(false);

  useEffect(() => {
    Endpoints.games().then((r) => setGames((r.data || r).games || [])).catch(() => {});
  }, []);

  // Auto-join a friendly challenge if the app was opened from an invite link.
  useEffect(() => {
    const p = startParam();
    if (p && p.startsWith('ch_')) acceptCode(p.slice(3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearPoll() {
    stopRef.current = true;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  useEffect(() => () => clearPoll(), []);

  function goMatch(body) {
    setMatch({ duel_id: body.duel_id, game: body.game, opponent: body.opponent, opponent_type: body.opponent_type, casual: body.opponent_type === 'friend' });
    setPhase('clash');
  }

  // ---- Ranked matchmaking (real-time queue + bot fallback) ----
  async function findRanked() {
    haptic('medium');
    stopRef.current = false;
    setWaited(0);
    setPhase('searching');
    try {
      const r = await Endpoints.arenaRankedFind();
      const body = r.data || r;
      if (stopRef.current) return;
      if (body.bot_fallback_sec) setBotAt(body.bot_fallback_sec);
      if (body.status === 'matched') { goMatch(body); return; }
      startRankedPolling();
    } catch (e) {
      if (stopRef.current) return;
      toast(e.message || 'Matchmaking failed', 'bad');
      setPhase('idle');
    }
  }

  function startRankedPolling() {
    const t0 = Date.now();
    pollRef.current = setInterval(async () => {
      setWaited(Math.round((Date.now() - t0) / 1000));
      try {
        const r = await Endpoints.arenaRankedPoll();
        const body = r.data || r;
        if (stopRef.current) return;
        if (body.bot_fallback_sec) setBotAt(body.bot_fallback_sec);
        if (body.status === 'matched') { clearPoll(); goMatch(body); }
      } catch { /* keep polling */ }
    }, 2000);
  }

  async function cancelSearch() {
    clearPoll();
    setPhase('idle');
    try { await Endpoints.arenaRankedCancel(); } catch {}
  }

  // ---- Friendly invites ----
  async function hostFriendly() {
    haptic('medium');
    stopRef.current = false;
    try {
      const r = await Endpoints.friendlyCreate();
      const body = r.data || r;
      setFriendCode(body.code);
      setPhase('friendly_wait');
      pollRef.current = setInterval(async () => {
        try {
          const pr = await Endpoints.friendlyPoll(body.code);
          const pb = pr.data || pr;
          if (stopRef.current) return;
          if (pb.status === 'matched') { clearPoll(); goMatch(pb); }
          else if (pb.status === 'gone' || pb.status === 'expired' || pb.status === 'cancelled') {
            clearPoll(); setPhase('idle'); toast('Challenge closed', 'bad');
          }
        } catch {}
      }, 2000);
    } catch (e) { toast(e.message || 'Could not create invite', 'bad'); }
  }

  async function cancelFriendly() {
    clearPoll();
    setPhase('idle');
    if (friendCode) { try { await Endpoints.friendlyCancel(friendCode); } catch {} }
  }

  async function acceptCode(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return;
    haptic('medium');
    setPhase('searching');
    try {
      const r = await Endpoints.friendlyAccept(c);
      const body = r.data || r;
      if (body.status === 'matched') { goMatch(body); return; }
      setPhase('idle');
    } catch (e) {
      toast(e.message || 'Could not join', 'bad');
      setPhase('idle');
    }
  }

  // ---- Resolve a finished game ----
  async function onGameDone(payload) {
    if (!match) return;
    try {
      const r = await Endpoints.arenaRankedResolve(match.duel_id, payload);
      const body = r.data || r;
      setResult({ ...body, opponent_name: body.opponent_name || match.opponent?.name });
      setPhase('result');
      reload();
    } catch (e) {
      toast(e.message || 'Resolve failed', 'bad');
      setMatch(null); setPhase('idle');
    }
  }

  function closeResult() {
    setResult(null); setMatch(null); setPhase('idle');
  }

  // ---- Forfeit: local timer ran out, or opponent dropped and we auto-lose ----
  async function onGameForfeit(reason = 'timeout') {
    if (!match) return;
    try {
      const r = await Endpoints.arenaForfeit(match.duel_id, reason);
      const body = r.data || r;
      setResult({ ...body, forfeited: true, opponent_name: body.opponent_name || match.opponent?.name });
      setPhase('result');
      reload();
    } catch (e) {
      toast(e.message || 'Forfeit failed', 'bad');
      setMatch(null); setPhase('idle');
    }
  }

  if (phase === 'searching') return <Searching waited={waited} botAt={botAt} onCancel={cancelSearch} />;
  if (phase === 'friendly_wait') return <FriendlyWait code={friendCode} onCancel={cancelFriendly} />;

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
    return <GameHost game={match.game} opponent={match.opponent} duelId={match.duel_id}
      mode={match.casual ? 'friendly' : 'duel'}
      onDone={onGameDone} onForfeit={onGameForfeit}
      onExit={() => { setMatch(null); setPhase('idle'); }} />;
  }

  if (phase === 'result' && result) {
    return <ResultScreen result={result} opponent={match?.opponent} onClose={closeResult} />;
  }

  return (
    <motion.div className="col" style={{ gap: 12 }}>
      <div className="row between">
        <h2 className="display" style={{ fontSize: 22 }}>Arena</h2>
        <span className="chip gold">{user.rank_tier?.emoji} {user.rank_tier?.title || 'Kin'}</span>
      </div>

      <div className="glass card arena-hero">
        <b style={{ fontSize: 15 }}>Ranked duel</b>
        <p className="tiny" style={{ marginTop: 6 }}>
          Real-time matchmaking — we pair you with another kin who's searching now. No one in range within {botAt}s? A Forgotten One steps in so you never wait long.
        </p>
        <button className="btn primary block" style={{ marginTop: 14 }} onClick={findRanked}>⚔️ Find a fight</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn ghost block" onClick={() => nav('/arena/war')}>⚔️ War Room</button>
        <button className="btn ghost block" onClick={() => nav('/leaderboard')}>🏆 Leaderboard</button>
      </div>

      <div className="glass card friendly-card">
        <div className="row between">
          <b style={{ fontSize: 15 }}>🤝 Play a friend</b>
          <span className="chip" style={{ fontSize: 10 }}>CASUAL</span>
        </div>
        <p className="tiny" style={{ marginTop: 6 }}>Invite a friend to a private match. No rank at stake — just bragging rights.</p>
        <button className="btn block" style={{ marginTop: 12 }} onClick={hostFriendly}>Create invite</button>
        <div className="friendly-join">
          <input className="friendly-input" placeholder="Enter code" maxLength={6}
            value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
          <button className="btn ghost" disabled={joinCode.trim().length < 4} onClick={() => acceptCode(joinCode)}>Join</button>
        </div>
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
