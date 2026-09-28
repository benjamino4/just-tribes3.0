// TRIBES-FILE: web/src/screens/War.jsx
// PHASE: 6 — War
// The War Stage: front-line visualization, live score, tactic wheel.

import { useState, useEffect, useRef } from 'react';
import Emoji from '../components/Emoji.jsx';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt, shortTime } from '../lib/format.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import TacticWheel from '../components/TacticWheel.jsx';
import { toast } from '../components/Toast.jsx';

export default function War() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const tribe = data?.tribe;

  const [war, setWar] = useState(null);
  const [tactics, setTactics] = useState(null);
  const [hint, setHint] = useState(null);
  const [selectedFront, setSelectedFront] = useState(0);
  const [busy, setBusy] = useState(false);
  const [particles, setParticles] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [w, t, h] = await Promise.all([
          apiGet('/api/war').catch(() => ({ war: null })),
          apiGet('/api/war/tactics').catch(() => null),
          apiGet('/api/war/hint').catch(() => null),
        ]);
        setWar(w.war);
        setTactics(t);
        setHint(h);
      } catch {}
    })();
    const poll = setInterval(async () => {
      try {
        const w = await apiGet('/api/war');
        setWar(w.war);
      } catch {}
    }, 8000);
    return () => clearInterval(poll);
  }, []);

  async function fireTactic(kind) {
    if (busy || !war) return;
    setBusy(true);
    try {
      // spawn particles from wheel to selected front
      spawnParticles();
      const r = await apiPost('/api/war/action', { front: selectedFront, kind });
      toast(`+${fmt(r.points)} pts`, 'good');
      haptic('heavy');
      const w = await apiGet('/api/war');
      setWar(w.war);
      reload();
    } catch (e) {
      toast(e.message || 'Action failed', 'bad');
    } finally {
      setBusy(false);
    }
  }

  function spawnParticles() {
    const arr = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      dx: (Math.random() - 0.5) * 200,
      dy: -60 - Math.random() * 100,
    }));
    setParticles((p) => [...p, ...arr]);
    setTimeout(() => setParticles((p) => p.filter((x) => !arr.find((a) => a.id === x.id))), 800);
  }

  if (!tribe) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}>
        <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>
          <h2 className="display" style={{ fontSize: 22 }}>No war to wage</h2>
          <Button variant="primary" block style={{ marginTop: 14 }} onClick={() => nav('/longhouse')}>Join a Tribe</Button>
        </div>
      </motion.div>
    );
  }

  const side = war?.mine || 'attacker';
  const myScore = war ? Number(side === 'attacker' ? war.attacker_score : war.defender_score) : 0;
  const foeScore = war ? Number(side === 'attacker' ? war.defender_score : war.attacker_score) : 0;
  const total = myScore + foeScore || 1;
  const endsMs = war ? new Date(war.end_at).getTime() - Date.now() : 0;

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4, position: 'relative' }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }}
                  onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>The War Room</h2>
          <Hint text="Wars are fought across three fronts, each with its own terrain. Terrain favours some tactics and resists others. Beaten tribes earn Vengeance. Allies cannot be matched against each other." />
        </div>
      </div>

      {!war && (
        <div className="glass card">
          <p className="tiny">No war rages right now.</p>
          {['Chief', 'Head', 'Elder'].includes(data?.user?.role) && (
            <Button variant="primary" block style={{ marginTop: 12 }}
              onClick={async () => {
                try {
                  await apiPost('/api/war/declare', { stance: 'skirmish' });
                  toast('War declared', 'good');
                  const w = await apiGet('/api/war');
                  setWar(w.war);
                } catch (e) { toast(e.message || 'Could not declare', 'bad'); }
              }}>
              Declare War
            </Button>
          )}
        </div>
      )}

      {war && (
        <>
          {war.legendary && (
            <div className="war-legendary">
              <Icon name="bolt" size={18} />
              <span className="grow">Legendary — ×{Number(war.legendary.multiplier)}</span>
            </div>
          )}

          <div className="war-stage">
            <div className="war-foe">
              <div className="war-banner">
                <span className="crest">
                  <Icon name="tribe" size={22} style={{ color: '#2a1200' }} />
                </span>
                <b style={{ fontSize: 13 }}>{war.attacker.name}</b>
              </div>
              <span className="war-vs display">VS</span>
              <div className="war-banner foe">
                <span className="crest">
                  <Icon name="tribe" size={22} style={{ color: '#fff' }} />
                </span>
                <b style={{ fontSize: 13 }}>{war.defender.name}</b>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{
                display: 'flex',
                height: 22,
                borderRadius: 999,
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,.5)',
              }}>
                <motion.div
                  animate={{ width: myScore / total * 100 + '%' }}
                  transition={M.ember}
                  style={{ background: 'linear-gradient(90deg,#c53a05,#ff9f45)' }}
                />
                <motion.div
                  animate={{ width: foeScore / total * 100 + '%' }}
                  transition={M.ember}
                  style={{ background: 'linear-gradient(90deg,#8b5cf6,#6b4a8b)' }}
                />
              </div>
              <div className="row between" style={{ marginTop: 8 }}>
                <b className="tabular" style={{ color: 'var(--ember-300)' }}>{fmt(myScore)}</b>
                <span className="chip" style={{
                  color: myScore >= foeScore ? 'var(--good)' : '#ff8a8a',
                }}>
                  {myScore >= foeScore ? 'Winning' : 'Behind'} · {shortTime(endsMs)}
                </span>
                <b className="tabular" style={{ color: '#c9b0ff' }}>{fmt(foeScore)}</b>
              </div>
            </div>

            <div className="war-fronts" style={{ '--count': (war.fronts || []).length }}>
              {(war.fronts || []).map((f) => {
                const myF = side === 'attacker' ? f.attacker_score : f.defender_score;
                const foeF = side === 'attacker' ? f.defender_score : f.attacker_score;
                const tot = Number(myF) + Number(foeF) || 1;
                const fortified = f.fortify_until && new Date(f.fortify_until).getTime() > Date.now();
                return (
                  <button
                    key={f.idx}
                    className={`war-front terrain-${f.terrain}${selectedFront === f.idx ? ' selected' : ''}${fortified ? ' war-front-fortified' : ''}`}
                    onClick={() => { haptic('select'); setSelectedFront(f.idx); }}
                  >
                    <span className="war-front-glyph">
  <Emoji name={`terrain-${f.terrain}`} size={22} />
</span>
                    <span className="war-front-name">{f.name}</span>
                    <div className="war-front-bars">
                      <i style={{ width: (myF / tot * 100) + '%' }} />
                      <i className="foe" style={{ width: (foeF / tot * 100) + '%' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {tactics && (
            <div className="glass card" style={{ position: 'relative' }}>
              <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>Choose a tactic</b>
              <div style={{ margin: '12px 0' }}>
                <TacticWheel
                  tactics={tactics.offensive || []}
                  terrain={war.fronts?.[selectedFront]}
                  onPick={fireTactic}
                  cooldown={busy}
                />
              </div>
              {hint?.hint && (
                <p className="tiny" style={{ marginTop: 8, textAlign: 'center', color: 'var(--gold)' }}>
                  <Emoji name="bulb" size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
{hint.hint}
                </p>
              )}
            </div>
          )}

          {/* particle layer */}
          {particles.map((p) => (
            <span
              key={p.id}
              className="war-particle"
              style={{
                left: '50%', top: '50%',
                ['--dx']: p.dx + 'px',
                ['--dy']: p.dy + 'px',
              }}
            />
          ))}
        </>
      )}
    </motion.div>
  );
}