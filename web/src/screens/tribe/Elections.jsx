import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button, ProgressBar } from '../../components/UI.jsx';
import Icon from '../../components/Icon.jsx';
import { toast } from '../../components/Toast.jsx';
import { haptic } from '../../lib/telegram.js';

// Roles ladder: Toddler → Kin → Hunter → Elder → Head → Chief
const POSITIONS = [
  { role: 'Chief', holder: 'Kael', desc: 'Leads the tribe, spends Pyre buffs, declares war', tone: '#ffd27a' },
  { role: 'Head',  holder: 'Mira', desc: 'Second-in-command, manages the roster', tone: '#c39bff' },
  { role: 'Elder', holder: 'Doon', desc: 'Trusted council voice, moderates the Kiva', tone: '#7cc4ff' },
];
const CANDIDATES = [
  { name: 'Kael', role: 'Chief', votes: 42, mine: false },
  { name: 'Mira', role: 'Elder', votes: 31, mine: false },
  { name: 'Vex',  role: 'Hunter', votes: 18, mine: false },
];

export default function Elections() {
  const [cands, setCands] = useState(CANDIDATES);
  const [voted, setVoted] = useState(false);
  const total = cands.reduce((a, c) => a + c.votes, 0) || 1;

  function vote(name) {
    if (voted) { toast('You already cast your vote', 'info'); return; }
    haptic('success'); setVoted(true);
    setCands((c) => c.map((x) => x.name === name ? { ...x, votes: x.votes + 1 } : x));
    toast(`You backed ${name} for Chief`, 'good');
  }

  return (
    <SubPage title="The Council" hint="Tribes are led by an elected Chief. Rise through Toddler → Kin → Hunter → Elder → Head → Chief by earning loyalty. Elections run weekly — one vote each.">
      <Card strong>
        <b className="row" style={{ gap: 8 }}><Icon name="crown" size={18} style={{ color: 'var(--gold)' }} /> Chief Election</b>
        <span className="tiny" style={{ display: 'block', margin: '4px 0 12px' }}>Ends in 2d 14h · {total} votes cast</span>
        <div className="col" style={{ gap: 10 }}>
          {cands.map((c) => {
            const pct = Math.round((c.votes / total) * 100);
            return (
              <div key={c.name} className="col" style={{ gap: 6 }}>
                <div className="row between">
                  <div className="row"><span className="crest-art" style={{ width: 30, height: 30 }}><b style={{ fontSize: 12 }}>{c.name[0]}</b></span><div className="col" style={{ gap: 0 }}><b style={{ fontSize: 14 }}>{c.name}</b><span className="tiny">{c.role} · {pct}%</span></div></div>
                  <Button variant={voted ? 'ghost' : 'primary'} onClick={() => vote(c.name)} disabled={voted}>{voted ? `${c.votes}` : 'Vote'}</Button>
                </div>
                <ProgressBar value={c.votes} max={total} />
              </div>
            );
          })}
        </div>
      </Card>

      <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 2px 0' }}>Positions</b>
      {POSITIONS.map((p, i) => (
        <motion.div key={p.role} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
          <Card style={{ borderColor: p.tone + '44' }}>
            <div className="row between">
              <div className="row"><span className="crest-art" style={{ background: `radial-gradient(circle at 30% 25%, ${p.tone}, #2a1200)` }}><Icon name="shield" size={16} style={{ color: '#2a1200' }} /></span>
                <div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>{p.role}</b><span className="tiny">{p.desc}</span></div></div>
              <span className="chip" style={{ color: p.tone }}>{p.holder}</span>
            </div>
          </Card>
        </motion.div>
      ))}
    </SubPage>
  );
}
