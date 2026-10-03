import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { toast } from '../components/Toast.jsx';

const CAT_LABELS = { flame: '🔥 Flame', blade: '⚔️ Blade', voice: '🎺 Voice' };

export default function Vault() {
  const { reload } = useApp();
  const [state, setState] = useState(null);

  async function load() {
    try {
      const r = await Endpoints.relicsState();
      setState(r.data || r);
    } catch (e) { toast(e.message, 'bad'); }
  }
  useEffect(() => { load(); }, []);

  async function equip(relicId) {
    try {
      await Endpoints.relicsEquip(relicId);
      toast('Equipped', 'good');
      load();
      reload();
    } catch (e) { toast(e.message, 'bad'); }
  }

  if (!state) return <p className="muted" style={{ padding: 24, textAlign: 'center' }}>Loading…</p>;

  return (
    <motion.div className="col" style={{ gap: 12 }}>
      <h2 className="display" style={{ fontSize: 22 }}>The Altar</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {['flame', 'blade', 'voice'].map((c) => {
          const equipped = state.slots?.[c];
          const relic = (state.catalog || []).find((r) => Number(r.id) === Number(equipped));
          return (
            <div key={c} className="glass card" style={{ padding: 14, textAlign: 'center', minHeight: 120 }}>
              <div style={{ fontSize: 28 }}>{CAT_LABELS[c].split(' ')[0]}</div>
              <div className="tiny" style={{ marginTop: 4 }}>{c}</div>
              <b style={{ fontSize: 12, display: 'block', marginTop: 6 }}>{relic?.name || '—'}</b>
            </div>
          );
        })}
      </div>

      <div className="sec-h"><h3>Your Relics</h3><span className="line" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {(state.catalog || []).filter((r) => r.owned).map((r) => (
          <motion.button
            key={r.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => r.equipped ? null : equip(r.id)}
            className="glass"
            style={{
              padding: 12, textAlign: 'left',
              borderColor: r.equipped ? 'var(--gold-400)' : 'var(--glass-brd)',
              boxShadow: r.equipped ? '0 0 20px rgba(247,162,89,.3)' : undefined
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold-300)', fontWeight: 800 }}>
              {r.tier} · {r.category}
            </div>
            <b style={{ fontSize: 14, display: 'block', marginTop: 4 }}>{r.name}</b>
            <p className="tiny" style={{ marginTop: 4 }}>{r.description}</p>
            {r.equipped && <span className="chip" style={{ marginTop: 8, color: 'var(--jade-300)' }}>Equipped</span>}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}