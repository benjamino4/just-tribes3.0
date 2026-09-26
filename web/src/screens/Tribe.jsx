import React from 'react';
import { motion } from 'framer-motion';
import Icon from '../components/Icon.jsx';
import { Card, SectionHeader, Button, ProgressBar } from '../components/UI.jsx';
import { toast } from '../components/Toast.jsx';
import { useGame } from '../store.js';
import { fmt } from '../lib/format.js';

const ROSTER = [
  { name: 'Kael', role: 'Chief', online: true, loyalty: 42000 },
  { name: 'Mira', role: 'Elder', online: true, loyalty: 31500 },
  { name: 'Doon', role: 'Hunter', online: false, loyalty: 22100 },
  { name: 'Vex', role: 'Hunter', online: true, loyalty: 19800 },
  { name: 'Ora', role: 'Kin', online: false, loyalty: 9400 },
];

export default function Tribe() {
  const data = useGame((s) => s.data) || {};
  const tribe = data.tribe;

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
      <Card strong style={{ overflow: 'hidden' }}>
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
      </Card>

      {/* The Great Pyre */}
      <Card>
        <div className="row between" style={{ marginBottom: 10 }}>
          <b className="row" style={{ gap: 6 }}><Icon name="fire" size={18} style={{ color: 'var(--ember-400)' }} /> The Great Pyre</b>
          <span className="chip tabular">{fmt(tribe.treasury)}</span>
        </div>
        <ProgressBar value={tribe.treasury % 200000} max={200000} />
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <Button variant="primary" block onClick={() => toast('+500 stoked into the Pyre', 'good')}>Stoke +500</Button>
          <Button variant="ghost" block onClick={() => toast('Donate flow coming next', 'info')}>Custom</Button>
        </div>
      </Card>

      <SectionHeader>Roster</SectionHeader>
      {ROSTER.map((m, i) => (
        <motion.div key={m.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
          <Card className="roster">
            <div className="row between">
              <div className="row">
                <span className="crest-art" style={{ background: 'linear-gradient(180deg,#4a4038,#241f1a)', position: 'relative' }}>
                  <b style={{ fontSize: 15 }}>{m.name[0]}</b>
                  <span style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: 99, border: '2px solid var(--bg-2)', background: m.online ? 'var(--good)' : 'var(--ink-faint)' }} />
                </span>
                <div className="col" style={{ gap: 1 }}>
                  <b style={{ fontSize: 14 }}>{m.name}</b>
                  <span className="tiny">{m.role}</span>
                </div>
              </div>
              <span className="tiny tabular">{fmt(m.loyalty)} loyalty</span>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
