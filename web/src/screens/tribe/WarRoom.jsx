import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button } from '../../components/UI.jsx';
import AnimatedIcon from '../../components/AnimatedIcon.jsx';
import Icon from '../../components/Icon.jsx';
import { toast } from '../../components/Toast.jsx';
import { useGame } from '../../store.js';
import { fmt, timeLeft } from '../../lib/format.js';
import { haptic } from '../../lib/telegram.js';

const TROOPS = [
  { name: 'Ash Raid', cost: 200, power: 340, icon: 'ash', tone: '#ff9f45' },
  { name: 'Fire Volley', cost: 600, power: 1100, icon: 'flame', tone: '#ff5a3c' },
  { name: 'Storm Charge', cost: 1500, power: 3000, icon: 'bolt', tone: '#c39bff' },
];
const LEADERS = [
  { name: 'Kael', pts: 2100 }, { name: 'You', pts: 1740, mine: true }, { name: 'Mira', pts: 1320 }, { name: 'Vex', pts: 860 },
];

export default function WarRoom() {
  const { data, patch } = useGame();
  const war = data?.war || { opponent: 'Stormfang', attacker_score: 6120, defender_score: 5890, ends_in_ms: 18000000, goal: 10000 };
  const user = data?.user || {};
  const [us, setUs] = useState(war.attacker_score);
  const [them, setThem] = useState(war.defender_score);
  const [left, setLeft] = useState(war.ends_in_ms);

  useEffect(() => {
    const t = setInterval(() => {
      setThem((v) => v + Math.floor(Math.random() * 40)); // rival keeps pushing
      setLeft((v) => Math.max(0, v - 1000));
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const winning = us >= them;
  const total = us + them || 1;

  function attack(tr) {
    if ((user.ember || 0) < tr.cost) { toast('Not enough Ember', 'error'); return; }
    haptic('heavy');
    setUs((v) => v + tr.power);
    patch({ user: { ...user, ember: user.ember - tr.cost } });
    toast(`${tr.name}! +${fmt(tr.power)} war points`, 'good');
  }

  return (
    <SubPage title="War Room" hint="Spend Ember to launch attacks and outscore the rival tribe before the timer ends. Winners split the spoils from both Great Pyres. Your top raiders are ranked below.">
      <Card strong style={{ overflow: 'hidden' }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <div className="col center" style={{ gap: 2 }}><span className="crest-art" style={{ width: 40, height: 40 }}><Icon name="tribe" size={20} style={{ color: '#2a1200' }} /></span><b style={{ fontSize: 13 }}>Ashborn</b></div>
          <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="display" style={{ fontSize: 15, color: 'var(--ember-300)' }}>VS</motion.div>
          <div className="col center" style={{ gap: 2 }}><span className="crest-art" style={{ width: 40, height: 40, background: 'linear-gradient(180deg,#6b4a4a,#2a1a1a)' }}><Icon name="tribe" size={20} style={{ color: '#fff' }} /></span><b style={{ fontSize: 13 }}>{war.opponent}</b></div>
        </div>

        {/* Tug-of-war bar */}
        <div style={{ display: 'flex', height: 22, borderRadius: 999, overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.5)' }}>
          <motion.div animate={{ width: (us / total * 100) + '%' }} transition={{ type: 'spring', stiffness: 90, damping: 20 }} style={{ background: 'linear-gradient(90deg,var(--ember-600),var(--ember-400))' }} />
          <motion.div animate={{ width: (them / total * 100) + '%' }} transition={{ type: 'spring', stiffness: 90, damping: 20 }} style={{ background: 'linear-gradient(90deg,#8b5cf6,#6b4a8b)' }} />
        </div>
        <div className="row between" style={{ marginTop: 8 }}>
          <b className="tabular" style={{ color: 'var(--ember-300)' }}>{fmt(us)}</b>
          <span className="chip" style={{ color: winning ? 'var(--good)' : '#ff8a8a' }}>{winning ? 'Winning' : 'Behind'} · {timeLeft(left)}</span>
          <b className="tabular" style={{ color: '#c9b0ff' }}>{fmt(them)}</b>
        </div>
      </Card>

      <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 2px 0' }}>Launch an attack</b>
      {TROOPS.map((tr) => (
        <Card key={tr.name} style={{ borderColor: tr.tone + '33' }}>
          <div className="row between">
            <div className="row"><AnimatedIcon name={tr.icon} size={30} tone={tr.tone} /><div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>{tr.name}</b><span className="tiny">+{fmt(tr.power)} war points</span></div></div>
            <Button variant="primary" onClick={() => attack(tr)}><Icon name="ember" size={13} /> {fmt(tr.cost)}</Button>
          </div>
        </Card>
      ))}

      <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 2px 0' }}>Top raiders</b>
      {LEADERS.sort((a, b) => b.pts - a.pts).map((l, i) => (
        <Card key={l.name} style={{ borderColor: l.mine ? 'var(--ember-400)' : 'var(--glass-brd)' }}>
          <div className="row between">
            <div className="row"><b style={{ width: 22, color: i === 0 ? 'var(--gold)' : 'var(--ink-dim)' }}>#{i + 1}</b><span style={{ fontSize: 14 }}>{l.name}{l.mine && ' (you)'}</span></div>
            <span className="tiny tabular">{fmt(l.pts)} pts</span>
          </div>
        </Card>
      ))}
    </SubPage>
  );
}
