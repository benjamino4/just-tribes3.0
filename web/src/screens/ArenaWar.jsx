import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt, shortTime } from '../lib/format.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import Emoji from '../components/Emoji.jsx';
import RulesOverlay from '../components/RulesOverlay.jsx';
import EmberReflex from '../games/EmberReflex.jsx';
import CascadeReflex from '../games/CascadeReflex.jsx';
import AncestorMemory from '../games/AncestorMemory.jsx';
import MissingRune from '../games/MissingRune.jsx';
import RiteOfHands from '../games/RiteOfHands.jsx';
import BidOrFold from '../games/BidOrFold.jsx';
import ChainOfFire from '../games/ChainOfFire.jsx';
import ThreeMasks from '../games/ThreeMasks.jsx';
import { toast } from '../components/Toast.jsx';

const GAME_COMPONENTS = {
  reflex: EmberReflex, cascade: CascadeReflex, ancestor: AncestorMemory,
  rune: MissingRune, hands: RiteOfHands, bid: BidOrFold, chain: ChainOfFire, masks: ThreeMasks
};

export default function ArenaWar() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const tribe = data?.tribe;

  const [war, setWar] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [rules, setRules] = useState(null);

  async function load() {
    try {
      const r = await Endpoints.war();
      setWar((r.data || r).war);
    } catch {}
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  async function declare() {
    try {
      haptic('heavy');
      const r = await Endpoints.warDeclare();
      toast('War declared!', 'good');
      load();
      reload();
    } catch (e) { toast(e.message || 'Could not declare', 'bad'); }
  }

  async function onGameDone(score, payload) {
    if (!playing) return;
    try {
      const r = await Endpoints.warMatch(playing.front, playing.game, payload || {});
      const body = r.data || r;
      toast(body.won ? `Victory! +${body.points}` : 'Defeat', body.won ? 'good' : 'bad');
      load();
      reload();
    } catch (e) { toast(e.message || 'Failed', 'bad'); }
    finally { setPlaying(null); }
  }

  if (!tribe) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
        <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>
          <h2 className="display" style={{ fontSize: 22 }}>No tribe, no war</h2>
          <Button variant="primary" block style={{ marginTop: 12 }} onClick={() => nav('/tribe')}>Find a Tribe</Button>
        </div>
      </motion.div>
    );
  }

  if (playing) {
    const Game = GAME_COMPONENTS[playing.game] || EmberReflex;
    return (
      <>
        {rules && <RulesOverlay slug={rules} open onClose={() => setRules(null)} />}
        <Game onDone={onGameDone} onExit={() => setPlaying(null)} />
      </>
    );
  }

  if (!war) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
        <div className="row between" style={{ margin: '2px 2px 12px' }}>
          <div className="row" style={{ gap: 10 }}>
            <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>
              <Icon name="chevL" size={18} />
            </button>
            <h2 className="display" style={{ fontSize: 22 }}>War Room</h2>
          </div>
        </div>
        <div className="glass hero card" style={{ textAlign: 'center', padding: 32 }}>
          <Emoji name="war-swords" size={56} />
          <h3 className="display" style={{ fontSize: 20, marginTop: 12 }}>Peace</h3>
          <p className="tiny" style={{ marginTop: 8, marginBottom: 16 }}>
            {['Chief', 'Head', 'Elder'].includes(data?.user?.role)
              ? 'Declare war to summon 30 minutes of live battle.'
              : 'Only Elders+ can declare war.'}
          </p>
          {['Chief', 'Head', 'Elder'].includes(data?.user?.role) && (
            <Button variant="primary" size="lg" block onClick={declare}>
              <Icon name="swords" size={18} /> Declare War
            </Button>
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
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 10 }}>
      <div className="row between" style={{ margin: '2px 2px 0' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>War</h2>
        </div>
        <span className="chip" style={{ color: 'var(--ember-300)' }}>{shortTime(endsIn)} left</span>
      </div>

      <div className="glass card" style={{ padding: '14px 16px' }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <b>{war.attacker?.name}</b>
          <span className="tiny" style={{ color: 'var(--ink-dim)' }}>vs</span>
          <b>{war.defender?.name}</b>
        </div>
        <div style={{ display: 'flex', height: 20, borderRadius: 999, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: (myScore / Math.max(1, myScore + foeScore)) * 100 + '%' }}
            style={{ background: 'linear-gradient(90deg,#8f3402,#ff8324)' }}
          />
          <motion.div
            animate={{ width: (foeScore / Math.max(1, myScore + foeScore)) * 100 + '%' }}
            style={{ background: 'linear-gradient(90deg,#4c1d95,#8b5cf6)' }}
          />
        </div>
        <div className="row between" style={{ marginTop: 8 }}>
          <b className="tabular" style={{ color: 'var(--ember-300)' }}>{fmt(myScore)}</b>
          <span className="tiny">{myScore >= foeScore ? 'Winning' : 'Behind'}</span>
          <b className="tabular" style={{ color: '#c9b0ff' }}>{fmt(foeScore)}</b>
        </div>
      </div>

      {war.fronts?.map((f) => {
        const myF = mine === 'attacker' ? Number(f.attacker_score) : Number(f.defender_score);
        const foeF = mine === 'attacker' ? Number(f.defender_score) : Number(f.attacker_score);
        return (
          <button
            key={f.idx}
            className={`war-front terrain-${f.terrain}`}
            onClick={() => {
              haptic('medium');
              const game = ['reflex','cascade','ancestor','rune','hands','bid','chain','masks'][Math.floor(Math.random() * 8)];
              if (!localStorage.getItem('tribes.games.seen')) setRules(game);
              setPlaying({ front: f.idx, game });
            }}
            style={{
              padding: 16, borderRadius: 'var(--r-lg)',
              textAlign: 'left', border: '1px solid var(--glass-brd)',
              background: 'linear-gradient(180deg, rgba(60,10,4,.32), rgba(30,6,2,.55))'
            }}
          >
            <div className="row between" style={{ marginBottom: 6 }}>
              <b style={{ fontSize: 15 }}>{f.name}</b>
              <span className="tiny">{f.terrain}</span>
            </div>
            <div className="row between">
              <b className="tabular" style={{ color: 'var(--ember-300)' }}>{fmt(myF)}</b>
              <span className="tiny">Tap to fight</span>
              <b className="tabular" style={{ color: '#c9b0ff' }}>{fmt(foeF)}</b>
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}