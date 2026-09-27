// TRIBES-FILE: web/src/screens/Vault.jsx
// PHASE: 4 — Relics
// Your collection. Wield / unwield, view shards, reforge duplicates.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Relic from '../components/Relic.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

const TABS = [
  { id: 'all',       label: 'All' },
  { id: 'personal',  label: 'Personal' },
  { id: 'war',       label: 'War' },
  { id: 'tribe',     label: 'Tribe' },
  { id: 'cursed',    label: 'Cursed' },
  { id: 'owned',     label: 'Mine' },
];

export default function Vault() {
  const nav = useNavigate();
  const { reload } = useApp();
  const M = useMotionConfig();

  const [state, setState] = useState(null);
  const [tab, setTab] = useState('owned');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await apiGet('/api/relics/state');
        setState(s);
      } catch (e) {
        toast(e.message || 'Could not load the vault', 'bad');
      }
    })();
  }, []);

  async function wield(relicId) {
    try {
      const r = await apiPost('/api/relics/wield', { relicId });
      if (r.warning) toast(r.warning, 'info');
      else toast('Relic wielded', 'good');
      const s = await apiGet('/api/relics/state');
      setState(s);
      setDetail(null);
      reload();
    } catch (e) {
      toast(e.message || 'Could not wield', 'bad');
    }
  }

  async function unwield() {
    try {
      await apiPost('/api/relics/unwield');
      toast('Relic unwielded', 'info');
      const s = await apiGet('/api/relics/state');
      setState(s);
      setDetail(null);
      reload();
    } catch (e) {
      toast(e.message || 'Could not unwield', 'bad');
    }
  }

  if (!state) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <p className="muted">Loading your vault…</p>
    </div>
  );

  const filtered = state.catalog.filter((r) => {
    if (tab === 'owned') return r.owned;
    if (tab === 'all') return true;
    return r.category === tab || (tab === 'cursed' && r.cursed);
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
          <h2 className="display" style={{ fontSize: 22 }}>The Vault</h2>
          <Hint text="Your relic collection. Wield one at a time. Duplicates can be reforged into higher rarities." />
        </div>
      </div>

      <div className="glass card">
        <div className="row between">
          <div className="col">
            <span className="tiny">Ashen Shards</span>
            <b style={{ fontSize: 20 }} className="tabular">{fmt(state.cursed_shards)}</b>
          </div>
          <div className="col">
            <span className="tiny">Wielded</span>
            <b style={{ fontSize: 14 }}>
              {state.equipped_relic_id
                ? state.catalog.find((r) => r.id === state.equipped_relic_id)?.name || '—'
                : 'None'}
            </b>
          </div>
          {state.equipped_relic_id && (
            <Button variant="ghost" onClick={unwield}>Unwield</Button>
          )}
        </div>
      </div>

      {/* tabs */}
      <div className="row" style={{ gap: 8, overflowX: 'auto', padding: '4px 0', marginBottom: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { haptic('select'); setTab(t.id); }}
            className="chip"
            style={{
              flex: '0 0 auto',
              borderColor: tab === t.id ? 'var(--ember-400)' : 'var(--glass-brd)',
              color: tab === t.id ? 'var(--ember-200)' : 'var(--ink-dim)',
              background: tab === t.id ? 'rgba(255,122,24,.14)' : 'var(--glass-bg)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {filtered.map((r) => (
          <Relic
            key={r.id}
            relic={r}
            compact
            equipped={r.equipped}
            onClick={() => { haptic('light'); setDetail(r); }}
          />
        ))}
      </div>

      {!filtered.length && (
        <p className="muted" style={{ textAlign: 'center', padding: 24 }}>
          {tab === 'owned' ? 'Nothing here yet — open a cache in the Forge.' : 'No relics in this category.'}
        </p>
      )}

      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass strong"
            style={{
              width: '100%', maxWidth: 'var(--maxw)',
              borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
              padding: '20px 18px calc(var(--safe-bot) + 22px)',
            }}
          >
            <div style={{ width: 42, height: 5, borderRadius: 99, background: 'rgba(255,255,255,.25)', margin: '0 auto 16px' }} />
            <div style={{ maxWidth: 220, margin: '0 auto 16px' }}>
              <Relic relic={detail} />
            </div>
            {detail.owned ? (
              <Button
                variant={detail.equipped ? 'ghost' : 'primary'}
                block haptic="heavy"
                onClick={() => detail.equipped ? unwield() : wield(detail.id)}
              >
                {detail.equipped ? 'Unwield' : 'Wield'}
              </Button>
            ) : (
              <Button variant="ghost" block onClick={() => { setDetail(null); nav('/forge'); }}>
                Not owned — open a cache
              </Button>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}