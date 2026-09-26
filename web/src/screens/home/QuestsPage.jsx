import React from 'react';
import { motion } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button } from '../../components/UI.jsx';
import AnimatedIcon from '../../components/AnimatedIcon.jsx';
import { useGame } from '../../store.js';
import { toast } from '../../components/Toast.jsx';
import { fmt } from '../../lib/format.js';

export default function QuestsPage() {
  const daily = useGame((s) => s.data?.daily) || [];
  return (
    <SubPage title="Daily Quests" hint="Small tasks that refresh every day. Clear them for Ember and to keep your tribe's quest total climbing toward group rewards.">
      {daily.map((q, i) => (
        <motion.div key={q.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
          <Card>
            <div className="row between">
              <div className="row">
                <AnimatedIcon name={q.done ? 'spark' : 'scroll'} size={34} tone={q.done ? 'var(--good)' : 'var(--gold)'} />
                <div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>{q.title}</b><span className="tiny">+{fmt(q.reward)} Ember</span></div>
              </div>
              {q.done ? <span className="chip" style={{ color: 'var(--good)' }}>Done</span> : <Button variant="ghost" onClick={() => toast('Finish the task first', 'info')}>Claim</Button>}
            </div>
          </Card>
        </motion.div>
      ))}
    </SubPage>
  );
}
