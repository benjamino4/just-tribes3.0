import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

const CATS = ['flame', 'blade', 'voice'];
const CAT_LABELS = { flame: 'Flame', blade: 'Blade', voice: 'Voice' };
const CAT_ICONS = { flame: 'hearth', blade: 'swords', voice: 'bell' };

export default function Vault() {
  const nav = useNavigate();
  const { reload } = useApp();
  const M = useMotionConfig();
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('all');

  async function load() {
    try {
      const r = await Endpoints.relicsState();
      setState(r.data || r);
    } catch (e) { toast(e.message || 'Could not load vault', 'bad'); }
  }
  useEffect(() => { load(); }, []);

  async function equip(relicId) {
    try {
      await Endpoints.relicsEquip(relicId);
      toast('Equipped', 'good');
      load();
      reload();
    } catch (e) { toast(e.message || 'Could not equip', 'bad'); }
  }

  if (!state) return <p className="muted" style={{ padding: 24, textAlign: 'center' }}>Loading…</p>;

  const filtered = (state.catalog || []).filter((r) => {
    if (tab === 'owned') return r.owned;
    if (tab === 'all') return true;
    return r.category === tab;
  });

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <h2 className="display" style={{ fontSize: 22 }}>Vault</h2>
          <Hint slug="vault" text="Equip one relic per category: Flame (economy), Blade (combat), Voice (tribe). Each relic does one thing." />
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        {CATS.map((c) => {
          const equipped = state.slots?.[c];
          const relic = (state.catalog || []).find((r) => Number(r.id) === Number(equipped));
          return (
            <div key={c} className="glass card grow" style={{ padding: 10, textAlign: 'center' }}>
              <Icon name={CAT_ICONS[c]} size={20} style={{ color: 'var(--gold-300)' }} />
              <div className="tiny" style={{ marginTop: 4 }}>{CAT_LABELS[c]}</div>
              <b style={{ fontSize: 12 }}>{relic?.name || '—'}</b>
            </div>
          );
        })}
      </div>

      <Button variant="primary" block onClick={() => nav('/vault/forge')}>
        <Icon name="relic" size={16} /> Open a Cache
      </Button>
      <Button variant="ghost" block onClick={() => nav('/vault/store')}>
        <Icon name="star" size={16} /> Trading Post
      </Button>

      <div className="row" style={{ gap: 8, marginTop: 12, overflowX: 'auto' }}>
        {['all', 'flame', 'blade', 'voice', 'owned'].map((t) => (
          <button key={t}
            onClick={() => { haptic('select'); setTab(t); }}
            className="chip"
            style={{
              flex: '0 0 auto',
              borderColor: tab === t ? 'var(--ember-400)' : 'var(--glass-brd)',
              color: tab === t ? 'var(--ember-200)' : 'var(--ink-dim)',
              background: tab === t ? 'rgba(255,122,24,.14)' : 'var(--glass-bg)'
            }}
          >{t}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
        {filtered.map((r) => (
          <motion.button
            key={r.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => r.owned ? equip(r.id) : toast('Not owned', 'info')}
            className="glass"
            style={{
              padding: 12, textAlign: 'left',
              borderColor: r.equipped ? 'var(--gold-400)' : 'var(--glass-brd)',
              boxShadow: r.equipped ? '0 0 20px rgba(239,193,104,.3)' : undefined
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold-300)', fontWeight: 800 }}>
              {r.tier} · {r.category}
            </div>
            <b style={{ fontSize: 14, display: 'block', marginTop: 4 }}>{r.name}</b>
            <p className="tiny" style={{ marginTop: 4 }}>{r.description}</p>
            {r.equipped && <span className="chip" style={{ marginTop: 8, color: 'var(--good)' }}>Equipped</span>}
          </motion.button>
        ))}
      </div>

      {!filtered.length && <p className="muted" style={{ textAlign: 'center', padding: 24 }}>No relics here yet.</p>}
    </motion.div>
  );
}