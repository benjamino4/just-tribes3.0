// TRIBES-FILE: web/src/screens/Standings.jsx
// PHASE: 8 — Payments + Polish
// Global leaderboards.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V, staggerParent } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { apiGet } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

const TABS = [
  { id: 'tribes', label: 'Tribes' },
  { id: 'users',  label: 'Kin' },
];

export default function Standings() {
  const { data } = useApp();
  const M = useMotionConfig();
  const me = data?.user;
  const myTribe = data?.tribe;

  const [tab, setTab] = useState('tribes');
  const [state, setState] = useState(null);

  useEffect(() => {
    (async () => {
      try { setState(await apiGet('/api/standings')); }
      catch (e) { toast(e.message || 'Could not load standings', 'bad'); }
    })();
  }, []);

  if (!state) return <p className="muted" style={{ padding: 24, textAlign: 'center' }}>Loading…</p>;

  const rows = tab === 'tribes' ? state.tribes : state.users;

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <h2 className="display" style={{ fontSize: 22 }}>Standings</h2>
          <Hint text="Ranked by Renown. Every member's loyalty builds the tribe's total. Season end rewards are distributed by rank." />
        </div>
      </div>

      <div className="glass card" style={{ marginBottom: 6 }}>
        <div className="row between">
          <div className="col">
            <span className="tiny">Your rank</span>
            <b style={{ fontSize: 18 }}>#{state.myRank ?? '—'}</b>
          </div>
          <div className="col" style={{ textAlign: 'right' }}>
            <span className="tiny">Tribe rank</span>
            <b style={{ fontSize: 18 }}>
              {myTribe ? `#${state.myTribeRank ?? '—'}` : '—'}
            </b>
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 8, padding: '4px 0 8px' }}>
        {TABS.map((t) => (
          <button key={t.id}
            onClick={() => { haptic('select'); setTab(t.id); }}
            className="chip"
            style={{
              flex: '0 0 auto',
              borderColor: tab === t.id ? 'var(--ember-400)' : 'var(--glass-brd)',
              color: tab === t.id ? 'var(--ember-200)' : 'var(--ink-dim)',
              background: tab === t.id ? 'rgba(255,122,24,.14)' : 'var(--glass-bg)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab}
          variants={staggerParent(0.03)}
          initial="initial"
          animate="animate"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => {
            const isMe = (tab === 'tribes' && Number(r.id) === Number(myTribe?.id))
                      || (tab === 'users' && Number(r.id) === Number(me?.id));
            return (
              <motion.div key={r.id} variants={V.item}>
                <div className="glass card" style={{
                  borderColor: isMe ? 'rgba(255,180,100,.5)' : 'var(--glass-brd)',
                  boxShadow: isMe ? 'var(--sh-ember)' : undefined,
                }}>
                  <div className="row between">
                    <div className="row">
                      <b style={{
                        width: 28, fontSize: 18,
                        color: i < 3 ? 'var(--gold)' : 'var(--ink-dim)',
                      }}>
                        {i + 1}
                      </b>
                      <span className="crest-art">
                        {i === 0
                          ? <Icon name="crown" size={16} style={{ color: '#2a1200' }} />
                          : <Icon name="tribe" size={16} style={{ color: '#2a1200' }} />}
                      </span>
                      <div className="col" style={{ gap: 1 }}>
                        <b style={{ fontSize: 14 }}>
                          {tab === 'tribes' ? r.name : (r.first_name || r.username || 'Kin')}
                          {isMe && ' (you)'}
                        </b>
                        <span className="tiny">
                          {tab === 'tribes'
                            ? `${r.members} members · Lv ${r.level}`
                            : r.tribe_name || 'no tribe'}
                        </span>
                      </div>
                    </div>
                    <b className="tabular" style={{ color: 'var(--gold)' }}>
                      {fmt(tab === 'tribes' ? r.renown_total : r.renown)}
                    </b>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}