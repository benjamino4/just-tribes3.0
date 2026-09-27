// TRIBES-FILE: web/src/screens/Chronicle.jsx
// PHASE: 6 — War
// War history.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { apiGet } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

export default function Chronicle() {
  const nav = useNavigate();
  const { data } = useApp();
  const M = useMotionConfig();
  const tribe = data?.tribe;
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!tribe) return;
    (async () => {
      try {
        const r = await apiGet('/api/war/chronicle');
        setRows(r.chronicles || []);
      } catch (e) {
        toast(e.message || 'Could not read the Chronicle', 'bad');
      }
    })();
  }, [tribe?.id]);

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }}
                  onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>The Chronicle</h2>
          <Hint text="Every war fought by your tribe, written in stone." />
        </div>
      </div>

      {!rows.length && (
        <p className="muted" style={{ padding: 12 }}>No wars fought yet.</p>
      )}

      {rows.map((c, i) => {
        const won = Number(c.winner_id) === Number(tribe?.id);
        const tie = !c.winner_id;
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, ...M.buoyant }}
          >
            <div className="glass card" style={{
              borderColor: won ? 'rgba(92,227,154,.4)' : tie ? 'var(--glass-brd)' : 'rgba(192,57,43,.35)',
            }}>
              <div className="row between">
                <div className="col" style={{ gap: 2 }}>
                  <b style={{ fontSize: 14 }}>
                    {c.attacker_name} vs {c.defender_name}
                  </b>
                  <span className="tiny">
                    {new Date(c.created_at).toLocaleString()} · {c.challenge_id || 'war'}
                  </span>
                </div>
                <span className="chip" style={{
                  color: won ? 'var(--good)' : tie ? 'var(--ink-dim)' : '#ff8a8a',
                }}>
                  {won ? 'Victory' : tie ? 'Draw' : 'Defeat'}
                </span>
              </div>
              <div className="row between" style={{ marginTop: 10 }}>
                <span className="tiny tabular">{fmt(c.score_a)}</span>
                <span className="tiny">tribute {fmt(c.tribute)}</span>
                <span className="tiny tabular">{fmt(c.score_d)}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}