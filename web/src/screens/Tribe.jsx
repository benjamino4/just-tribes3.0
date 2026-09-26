import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../components/Icon.jsx';
import AnimatedIcon from '../components/AnimatedIcon.jsx';
import Hint from '../components/Hint.jsx';
import Shape, { RADII } from '../components/Shape.jsx';
import { Card, Button, ProgressBar } from '../components/UI.jsx';
import { toast } from '../components/Toast.jsx';
import { useGame } from '../store.js';
import { fmt, timeLeft } from '../lib/format.js';
import { haptic } from '../lib/telegram.js';

const SECTIONS = [
  { id: 'kiva',      name: 'The Kiva',    icon: 'scroll', shape: 'blob',   tone: '#ff9f45', sub: 'Tribe chat' },
  { id: 'elections', name: 'Council',    icon: 'shield', shape: 'shield', tone: '#ffd27a', sub: 'Roles & votes' },
  { id: 'war',       name: 'War Room',   icon: 'bolt',   shape: 'curved', tone: '#ff5a3c', sub: 'Raids & rivals' },
  { id: 'members',   name: 'Roster',     icon: 'spark',  shape: 'circle', tone: '#7cc4ff', sub: 'The tribe' },
];

export default function Tribe() {
  const nav = useNavigate();
  const data = useGame((s) => s.data) || {};
  const tribe = data.tribe;
  const war = data.war;

  if (!tribe) {
    return (
      <Card style={{ textAlign: 'center', padding: 28 }}>
        <span className="crest-art" style={{ width: 56, height: 56, margin: '0 auto 12px' }}>
          <Icon name="tribe" size={30} style={{ color: '#2a1200' }} />
        </span>
        <h2 className="display" style={{ fontSize: 22 }}>March under a banner</h2>
        <p className="muted" style={{ fontSize: 14, margin: '8px 0 18px' }}>Found your own band or join an existing tribe to feed the Great Pyre together.</p>
        <Button variant="primary" block onClick={() => toast('Tribe browser coming next', 'info')}>Find a Tribe</Button>
      </Card>
    );
  }

  return (
    <div className="col" style={{ gap: 4 }}>
      <Shape kind="soft" className="card strong" style={{ overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}><Hint text="Your tribe rises together. Feed the Great Pyre, win wars, and elect a Chief to climb the global ranks." /></div>
        <div className="row" style={{ gap: 14 }}>
          <motion.span className="crest-art" style={{ width: 54, height: 54 }} animate={{ rotate: [0, -4, 4, 0] }} transition={{ duration: 6, repeat: Infinity }}>
            <Icon name="tribe" size={28} style={{ color: '#2a1200' }} />
          </motion.span>
          <div className="grow">
            <h2 className="display" style={{ fontSize: 22 }}>{tribe.name}</h2>
            <p className="tiny">“{tribe.motto}”</p>
          </div>
          <div className="col center"><span className="tiny">Rank</span><b style={{ fontSize: 20 }}>#{tribe.rank}</b></div>
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          <div className="col"><span className="tiny">Level</span><b>{tribe.level}</b></div>
          <div className="col"><span className="tiny">Members</span><b>{tribe.members}</b></div>
          <div className="col"><span className="tiny">Loyalty</span><b className="tabular">{fmt(tribe.loyalty_total)}</b></div>
        </div>
      </Shape>

      {/* Great Pyre summary → full page */}
      <Shape kind="curved" className="card" onClick={() => { haptic('medium'); nav('/tribe/pyre'); }} style={{ cursor: 'pointer' }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <b className="row" style={{ gap: 8 }}><AnimatedIcon name="flame" size={24} tone="var(--ember-400)" /> The Great Pyre</b>
          <span className="chip tabular">{fmt(tribe.treasury)}</span>
        </div>
        <ProgressBar value={tribe.treasury % 200000} max={200000} />
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="tiny">Level {tribe.level} → {tribe.level + 1}</span>
          <span className="tiny" style={{ color: 'var(--ember-200)' }}>Tap to stoke ›</span>
        </div>
      </Shape>

      {war?.active && (
        <Shape kind="blob" className="card" onClick={() => { haptic('medium'); nav('/tribe/war'); }} style={{ cursor: 'pointer', borderColor: 'rgba(255,90,60,.4)' }}>
          <div className="row between">
            <div className="row"><AnimatedIcon name="bolt" size={26} tone="var(--ember-400)" /><div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>War vs {war.opponent}</b><span className="tiny">{fmt(war.attacker_score)} – {fmt(war.defender_score)} · {timeLeft(war.ends_in_ms)} left</span></div></div>
            <Icon name="chevron" size={18} style={{ color: 'var(--ink-dim)' }} />
          </div>
        </Shape>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
        {SECTIONS.map((s, i) => (
          <motion.button key={s.id}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 26 }}
            whileTap={{ scale: 0.95 }} onClick={() => { haptic('medium'); nav('/tribe/' + s.id); }}
            className="glass" style={{ padding: 16, textAlign: 'left', borderRadius: RADII[s.shape], minHeight: 118, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
            <div style={{ alignSelf: s.shape === 'circle' ? 'center' : 'flex-start' }}><AnimatedIcon name={s.icon} size={38} tone={s.tone} /></div>
            <div className="row between" style={{ width: '100%' }}>
              <div className="col" style={{ gap: 0 }}><b style={{ fontSize: 15 }}>{s.name}</b><span className="tiny">{s.sub}</span></div>
              <Icon name="chevron" size={16} style={{ color: 'var(--ink-dim)' }} />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
