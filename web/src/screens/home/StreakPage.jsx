import React from 'react';
import { motion } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button } from '../../components/UI.jsx';
import AnimatedIcon from '../../components/AnimatedIcon.jsx';
import { useGame } from '../../store.js';
import { fmt } from '../../lib/format.js';

const MILES = [
  { d: 3, r: 300 }, { d: 7, r: 900 }, { d: 14, r: 2500 }, { d: 30, r: 8000 }, { d: 60, r: 20000 }, { d: 100, r: 60000 },
];

export default function StreakPage() {
  const streak = useGame((s) => s.data?.user?.streak) || 0;
  return (
    <SubPage title="Streak Trail" hint="Feed the fire daily to keep your streak alive. Each milestone drops a bigger Ember reward. Miss a day and the trail resets — unless you hold Streak Insurance.">
      <Card strong style={{ textAlign: 'center' }}>
        <AnimatedIcon name="flame" size={56} />
        <div className="display" style={{ fontSize: 40, lineHeight: 1 }}>{streak}</div>
        <span className="tiny">day streak</span>
      </Card>
      <div style={{ position: 'relative', margin: '18px 0 4px', paddingLeft: 30 }}>
        <div style={{ position: 'absolute', left: 13, top: 8, bottom: 8, width: 3, background: 'linear-gradient(var(--ember-500), rgba(255,255,255,.1))', borderRadius: 3 }} />
        {MILES.map((m, i) => {
          const hit = streak >= m.d;
          return (
            <motion.div key={m.d} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} style={{ position: 'relative', marginBottom: 12 }}>
              <span style={{ position: 'absolute', left: -30, top: 14, width: 20, height: 20, borderRadius: 99, background: hit ? 'var(--ember-500)' : 'rgba(255,255,255,.12)', boxShadow: hit ? '0 0 10px var(--ember-500)' : 'none', border: '2px solid var(--bg-1)' }} />
              <Card style={{ opacity: hit ? 1 : 0.7 }}>
                <div className="row between">
                  <b>Day {m.d}</b>
                  <span className="chip" style={{ color: hit ? 'var(--good)' : 'var(--gold)' }}>{hit ? 'Claimed' : `+${fmt(m.r)}`}</span>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
      <Button variant="ghost" block>Buy Streak Insurance · 250 Ember</Button>
    </SubPage>
  );
}
