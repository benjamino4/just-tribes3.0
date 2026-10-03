import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { fmt, shortTime } from '../lib/format.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import ForgottenRune from '../components/ForgottenRune.jsx';
import GameHost from '../components/GameHost.jsx';
import { toast } from '../components/Toast.jsx';

export default function ArenaWar() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const tribe = data?.tribe;
  const user = data?.user || {};
  const [war, setWar] = useState(null);
  const [playing, setPlaying] = useState(null);

  async function load() {
    try {
      const r = await Endpoints.war();
      setWar((r.data || r).war);
    } catch {}
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, []);

  async function declare() {
    try {
      haptic('heavy');
      await Endpoints.warDeclare();
      toast('War declared!', 'good');
      load();
      reload();
    } catch (e) { toast(e.message || 'Could not declare', 'bad'); }
  }

  async function onGameDone(payload) {
    if (!playing) return;
    try {
      const r = await Endpoints.warMatch(playing.front, playing.game, payload);
      const body = r.data || r;
      toast(body.won ? `Victory! +${body.points}` : 'Defeat', body.won ? 'good' : 'bad');
      load();
      reload();
    } catch (e) { toast(e.message || 'Failed', 'bad'); }
    finally { setPlaying(null); }
  }

  if (!tribe) {
    return (
      <motion.div className="col" style={{ gap: 12 }}>
        <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>
          <h2 className="display" style={{ fontSize: 22 }}>No tribe, no war</h2>
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => nav('/tribe')}>Find a Tribe</button>
        </div>
      </motion.div>
    );
  }

  if (playing) {
    return <GameHost game={playing.game} opponent={playing.opponent} onDone={onGameDone} onExit={() => setPlaying(null)} mode="war" />;
  }

  if (!war) {
    return (
      <motion.div className="col" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>←</button>
          <h2 className="display" style={{ fontSize: 22 }}>War Room</h2>
        </div>
        <div className="glass hero card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 56 }}>⚔️</div>
          <h3 className="display" style={{ fontSize: 20, marginTop: 12 }}>Peace</h3>
          <p className="tiny" style={{ marginTop: 8, marginBottom: 16 }}>
            {['Chief', 'Head', 'Elder', 'Warlord', 'Keeper'].includes(user.role)
              ? 'Declare war to summon 5 minutes of live battle.'
              : 'Only leaders can declare war.'}
          </p>
          {['Chief', 'Head', 'Elder', 'Warlord', 'Keeper'].includes(user.role) && (
            <button className="btn primary block" onClick={declare}>⚔️ Declare War</button>
          )}
        </div>
      </motion.div>
    );
  }

  const w = war.war;
  const mine = war.mine;
  const myScore = mine === 'attacker' ? Number(w.attacker_score) : Number(w.defender_score);
  const foeScore = mine === 'attacker' ? Number(w.defender_score) : Number(w.attacker_score);
  const endsIn = Math.max(0, new Date(w.end_at).getTime() - Date.now());

  return (
    <motion.div className="col" style={{ gap: 10 }}>
      <div className="row between">
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>←</button>
          <h2 className="display" style={{ fontSize: 22 }}>War</h2>
        </div>
        <span className="chip" style={{ color: 'var(--ember-300)' }}>{shortTime(endsIn)} left</span>
      </div>

      <div className="glass card" style={{ padding: '14px 16px' }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <b>{war.attacker?.name}</b>
          <span className="tiny">vs</span>
          <b>{war.defender?.name}{war.is_forgotten_opponent && <ForgottenRune />}</b>
        </div>
        <div style={{ display: 'flex', height: 20, borderRadius: 999, overflow: 'hidden', background: 'rgba(6,5,8,0.5)' }}>
          <motion.div
            animate={{ width: (myScore / Math.max(1, myScore + foeScore)) * 100 + '%' }}
            style={{ background: 'linear-gradient(90deg,#8f3402,#d46f2c)' }}
          />
          <motion.div
            animate={{ width: (foeScore / Math.max(1, myScore + foeScore)) * 100 + '%' }}
            style={{ background: 'linear-gradient(90deg,#4c1d95,#8b5cf6)' }}
          />
        </div>
        <div className="row between" style={{ marginTop: 8 }}>
          <b className="tabular" style={{ color: 'var(--ember-300)' }}>{fmt(myScore)}</b>
          <b className="tabular" style={{ color: '#c9b0ff' }}>{fmt(foeScore)}</b>
        </div>
      </div>

      {war.fronts?.map((f) => (
        <button
          key={f.idx}
          className={`war-front terrain-${f.terrain}`}
          onClick={async () => {
            haptic('medium');
            try {
              // The SERVER chooses the game (by terrain) and the AI opponent.
              const r = await Endpoints.warFront(f.idx);
              const body = r.data || r;
              setPlaying({ front: f.idx, game: body.game, opponent: body.opponent });
            } catch (e) { toast(e.message || 'Could not enter front', 'bad'); }
          }}
        >
          <div className="row between" style={{ marginBottom: 6 }}>
            <b style={{ fontSize: 15 }}>{f.name}</b>
            <span className="tiny">{f.terrain}</span>
          </div>
          <div className="row between">
            <b className="tabular" style={{ color: 'var(--ember-300)' }}>{fmt(mine === 'attacker' ? f.attacker_score : f.defender_score)}</b>
            <span className="tiny">Tap to fight</span>
            <b className="tabular" style={{ color: '#c9b0ff' }}>{fmt(mine === 'attacker' ? f.defender_score : f.attacker_score)}</b>
          </div>
        </button>
      ))}
    </motion.div>
  );
}