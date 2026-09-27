// TRIBES-FILE: web/src/screens/Inbox.jsx
// PHASE: 7 — Meta & Admin
// Full notification history. Filter by type. Mark-all-read.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMotionConfig, V } from '../lib/motion.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';

const ICON_MAP = {
  'kiva-flame':    'fire',
  'tribe-shield':  'tribe',
  'war-swords':    'bolt',
  'relic-spark':   'spark',
  'crown':         'crown',
  'res-stars':     'spark',
  'halo':          'crown',
  'trials-scroll': 'ranks',
  'lock':          'lock',
  'check':         'check',
  'bolt':          'bolt',
};

const TABS = [
  { id: 'all',      label: 'All' },
  { id: 'unread',   label: 'Unread' },
  { id: 'kiva',     label: 'Kiva' },
  { id: 'war',      label: 'War' },
  { id: 'system',   label: 'System' },
  { id: 'payment',  label: 'Payments' },
];

export default function Inbox() {
  const nav = useNavigate();
  const M = useMotionConfig();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const q = tab === 'unread' ? '?unread=1' : '';
      const r = await apiGet('/api/notifications' + q);
      setItems(r.notifications || []);
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, [tab]);

  async function markAll() {
    haptic('success');
    await apiPost('/api/notifications/seen', {});
    load();
  }

  const filtered = items.filter((n) => {
    if (tab === 'all' || tab === 'unread') return true;
    return n.type === tab;
  });

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }}
                  onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>Inbox</h2>
          <Hint text="Every notification you've received. Tap one to jump to the relevant screen." />
        </div>
        <Button variant="ghost" onClick={markAll}>Mark all read</Button>
      </div>

      <div className="row" style={{ gap: 8, overflowX: 'auto', padding: '4px 0 8px' }}>
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

      {loading && <p className="muted" style={{ padding: 12 }}>Loading…</p>}

      {!loading && !filtered.length && (
        <p className="muted" style={{ padding: 12, textAlign: 'center' }}>Nothing here.</p>
      )}

      {filtered.map((n, i) => (
        <motion.div
          key={n.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02, ...M.buoyant }}
        >
          <div className="glass card" style={{
            opacity: n.seen_at ? 0.7 : 1,
            borderColor: n.seen_at ? 'var(--glass-brd)' : 'rgba(255,122,24,.35)',
          }}>
            <div className="row between">
              <div className="row" style={{ gap: 10 }}>
                <span style={{
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'grid', placeItems: 'center',
                  background: (n.severity === 'success' ? '#5ce39a' :
                                n.severity === 'warn' ? '#ffd15c' :
                                n.severity === 'danger' ? '#ff6b6b' : '#ff9f45') + '22',
                  color: n.severity === 'success' ? '#5ce39a' :
                         n.severity === 'warn' ? '#ffd15c' :
                         n.severity === 'danger' ? '#ff6b6b' : '#ff9f45',
                }}>
                  <Icon name={ICON_MAP[n.icon] || 'spark'} size={14} />
                </span>
                <div className="col" style={{ gap: 1 }}>
                  <b style={{ fontSize: 13.5 }}>{n.title}</b>
                  {n.body && <span className="tiny">{n.body}</span>}
                  <span className="tiny" style={{ opacity: .6 }}>
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}