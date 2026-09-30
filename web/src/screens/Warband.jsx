// TRIBES-FILE: web/src/screens/Warband.jsx
// PHASE: 4 — Rise of the Eternal Flame
// The Warband gauntlet: a 20-seat ladder climbed by winning Trials by
// Fire, plus the daily Practice Pit bot drill. Unique molten-forge look
// lives in styles/warband.css (all classes prefixed .wb-).

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';
import CanvasReflex from '../games/CanvasReflex.jsx';

function gatePct(g) {
  if (!g) return 0;
  const a = g.need_streak ? Math.min(1, g.streak / g.need_streak) : 0;
  const b = g.need_points ? Math.min(1, g.points / g.need_points) : 0;
  return Math.round(Math.max(a, b) * 100);
}

function Header({ nav }) {
  return (
    <div className="wb-hero">
      <span className="wb-ember-badge"><Icon name="swords" size={20} style={{ color: '#2a1200' }} /></span>
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <button className="chip" style={{ padding: 9, borderRadius: 999 }}
                onClick={() => { haptic('light'); nav(-1); }}>
          <Icon name="chevL" size={18} />
        </button>
        <Hint text="Climb the 20-seat Warband by winning Trials by Fire. Empty seats can be claimed outright; a held seat must be won in a duel." />
      </div>
      <h2 style={{ marginTop: 12 }}>The Gauntlet of Fire</h2>
      <p className="wb-sub">Twenty seats. One ladder. Duel your way up and hold your ground.</p>
    </div>
  );
}

export default function Warband() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const [wb, setWb] = useState(null);
  const [bp, setBp] = useState(null);
  const [duel, setDuel] = useState(null);
  const [drill, setDrill] = useState(false);
  const [busy, setBusy] = useState(false);

  const inTribe = !!data?.tribe;

  const loadAll = useCallback(async () => {
    if (!inTribe) return;
    try {
      const [w, b] = await Promise.all([Endpoints.warband(), Endpoints.botPractice()]);
      setWb(w); setBp(b);
    } catch (e) { toast(e.message || 'Could not load the Warband', 'bad'); }
  }, [inTribe]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (!inTribe) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" exit="exit"
        transition={M.buoyant} className="wb-wrap">
        <Header nav={nav} />
        <div className="wb-empty-note">Join a tribe to take your place in the Warband.</div>
      </motion.div>
    );
  }

  const gate = wb?.gate;
  const seats = wb?.seats || [];
  const pct = gatePct(gate);

  async function openDuel(seat) {
    if (busy) return;
    if (seat.user_id && !gate?.eligible) {
      toast('Build a check-in streak or activity before you can challenge.', 'bad');
      return;
    }
    setBusy(true);
    try {
      const r = await Endpoints.warbandChallenge(seat.seat_no, seat.user_id ? 'reflex' : '');
      if (r.claimed) {
        toast(`Seat #${seat.seat_no} claimed!`, 'good'); haptic('heavy');
        await loadAll(); reload();
      } else {
        setDuel({ seat, game: r.game, challengeId: r.challenge_id, defenderName: seat.holder });
      }
    } catch (e) {
      toast(e.data?.error || e.message || 'Challenge failed', 'bad');
    } finally { setBusy(false); }
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit"
      transition={M.buoyant} className="wb-wrap">
      <Header nav={nav} />

      {gate && (
        <div className="wb-gate">
          <div className="wb-gate-top">
            <span className="wb-gate-title">Challenge readiness</span>
            <span className="wb-gate-state" data-ok={gate.eligible}>
              {gate.eligible ? 'Ready to duel' : 'Not ready'}
            </span>
          </div>
          <div className="wb-meter"><i style={{ width: pct + '%' }} /></div>
          <div className="wb-gate-rows">
            <span className="wb-gr"><b>{gate.streak}/{gate.need_streak}</b>day streak</span>
            <span className="wb-gr"><b>{gate.points}/{gate.need_points}</b>activity pts</span>
            <span className="wb-gr"><b>{wb?.my_seat ? '#' + wb.my_seat : '\u2014'}</b>your seat</span>
          </div>
        </div>
      )}

      <div className="wb-drill">
        <div className="row between">
          <div>
            <h3>Practice Pit</h3>
            <p className="wb-drill-sub">Spar the training bot once a day for a small Ember reward.</p>
          </div>
          <Icon name="spear" size={26} style={{ color: '#7aa8c4' }} />
        </div>
        <Button variant={bp?.available ? 'primary' : 'ghost'} block disabled={!bp?.available}
          onClick={() => bp?.available && setDrill(true)}>
          {bp?.available ? `Train \u00b7 +${fmt(bp.reward_ember)} Ember` : 'Trained today \u2014 back tomorrow'}
        </Button>
      </div>

      <div className="sec-h"><h3>The Gauntlet</h3><span className="line" /></div>
      <div className="wb-ladder">
        {seats.map((s, i) => {
          const mine = wb?.my_seat === s.seat_no;
          const empty = !s.user_id;
          return (
            <motion.button key={s.seat_no}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ ...M.buoyant, delay: Math.min(i * 0.02, 0.3) }}
              className="wb-seat" data-mine={mine} data-empty={empty} data-apex={s.seat_no === 1}
              onClick={() => { haptic('medium'); openDuel(s); }}>
              <span className="wb-rank">{s.seat_no}</span>
              <span className="wb-seat-body">
                {empty
                  ? <span className="wb-seat-empty-name">Open seat</span>
                  : <span className="wb-seat-name">{s.holder}</span>}
                <span className="wb-seat-meta">
                  {empty ? 'Tap to claim' : (mine ? 'You hold this seat' : 'Tap to challenge')}
                </span>
              </span>
              {mine ? <span className="wb-tag mine">Yours</span>
                : empty ? <span className="wb-tag open">Open</span>
                : <span className="wb-tag duel">Duel</span>}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {duel && <DuelSheet duel={duel} onClose={() => setDuel(null)}
          onDone={async () => { setDuel(null); await loadAll(); reload(); }} />}
        {drill && <DrillSheet reward={bp?.reward_ember} onClose={() => setDrill(false)}
          onDone={async () => { setDrill(false); await loadAll(); reload(); }} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------- overlay shell ---------- */
function Overlay({ children, onClose, M, title, sub }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(6,5,8,.72)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'grid', placeItems: 'center', padding: 20 }}>
      <motion.div initial={{ scale: 0.85, y: 26 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85 }}
        transition={M.buoyant} className="glass strong" onClick={(e) => e.stopPropagation()}
        style={{ padding: 24, borderRadius: 'var(--r-2xl)', width: 320, maxWidth: '92vw', textAlign: 'center' }}>
        <h3 className="display" style={{ fontSize: 20, marginBottom: 4 }}>{title}</h3>
        <p className="tiny" style={{ marginBottom: 16 }}>{sub}</p>
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ---------- seat duel ---------- */
function DuelSheet({ duel, onClose, onDone }) {
  const M = useMotionConfig();
  const isRps = duel.game === 'rps';

  async function finishReflex(score, times) {
    try {
      const r = await Endpoints.warbandResolve(duel.challengeId, { score, times });
      if (r.win) { toast(`Victory! Seat #${duel.seat.seat_no} is yours.`, 'good'); haptic('heavy'); }
      else toast('Defeated \u2014 train and try again.', 'bad');
    } catch (e) { toast(e.message || 'Duel failed', 'bad'); }
    onDone();
  }
  async function finishRps(won, total) {
    try {
      const r = await Endpoints.warbandResolve(duel.challengeId, { rounds_won: won, rounds_total: total });
      if (r.win) { toast(`Victory! Seat #${duel.seat.seat_no} is yours.`, 'good'); haptic('heavy'); }
      else toast('Defeated \u2014 the seat holds.', 'bad');
    } catch (e) { toast(e.message || 'Duel failed', 'bad'); }
    onDone();
  }

  return (
    <Overlay onClose={onClose} M={M} title={`Duel \u00b7 Seat #${duel.seat.seat_no}`}
      sub={`vs ${duel.defenderName || 'the holder'} \u00b7 ${isRps ? 'Rite of Hands (best of 5)' : 'Ember Reflex'}`}>
      {isRps ? <RpsGame onDone={finishRps} /> : <CanvasReflex rounds={5} onDone={finishReflex} />}
    </Overlay>
  );
}

/* ---------- daily practice drill ---------- */
function DrillSheet({ reward, onClose, onDone }) {
  const M = useMotionConfig();
  async function finish(score, times) {
    try {
      const r = await Endpoints.botPracticeClaim({ score, times });
      toast(`Trained! +${fmt(r.reward_ember)} Ember`, 'good'); haptic('heavy');
    } catch (e) { toast(e.data?.error || e.message || 'Already trained today', 'bad'); }
    onDone();
  }
  return (
    <Overlay onClose={onClose} M={M} title="Practice Pit" sub={`Reflex drill \u00b7 +${fmt(reward)} Ember`}>
      <CanvasReflex rounds={3} onDone={finish} />
    </Overlay>
  );
}

/* ---------- rock / paper / scissors (best of 5) ---------- */
const RPS = [['rock', '\u270a'], ['paper', '\u270b'], ['scissors', '\u270c\ufe0f']];
function beats(a, b) { return (a === 0 && b === 2) || (a === 1 && b === 0) || (a === 2 && b === 1); }

function RpsGame({ onDone }) {
  const [won, setWon] = useState(0);
  const [lost, setLost] = useState(0);
  const [pick, setPick] = useState(null);
  const [msg, setMsg] = useState('First to 3 wins');
  const wonRef = useRef(0);
  const lostRef = useRef(0);

  function play(idx) {
    if (wonRef.current >= 3 || lostRef.current >= 3) return;
    setPick(idx); haptic('select');
    const bot = Math.floor(Math.random() * 3);
    if (idx === bot) { setMsg('Draw \u2014 go again'); }
    else if (beats(idx, bot)) { wonRef.current += 1; setWon(wonRef.current); setMsg('You take the round'); }
    else { lostRef.current += 1; setLost(lostRef.current); setMsg('Bot takes the round'); }
    if (wonRef.current >= 3 || lostRef.current >= 3) {
      const total = wonRef.current + lostRef.current;
      setTimeout(() => onDone(wonRef.current, total), 550);
    }
    setTimeout(() => setPick(null), 250);
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="wb-rps">
        {RPS.map(([name, glyph], i) => (
          <button key={name} data-pick={pick === i} onClick={() => play(i)}>{glyph}</button>
        ))}
      </div>
      <div className="wb-rps-score">{`You ${won} \u2014 ${lost} Bot \u00b7 ${msg}`}</div>
    </div>
  );
}
